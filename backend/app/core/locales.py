"""Deterministic locale resolution, authentic name pools, and coherent person synthesis.

Rules:
1. Locale resolution: extract locale/nationality/country, normalize case/hyphens,
   validate against faker.config.AVAILABLE_LOCALES. Fall back gracefully to 'en_US'
   with visible warning, never fail.
2. Curated name data in backend/app/data/names/<locale>.json.
3. Strict Pydantic NamePool schema: validated against PII, digits, duplicates.
4. Coherent record synthesis: gender matches first name, email derived from name,
   unique emails with weighted providers, phone in country format, realistic city weights.
"""
from __future__ import annotations

import json
from pathlib import Path
import re
import unicodedata
from typing import Any, Optional
import faker.config
import numpy as np
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

DATA_DIR = Path(__file__).resolve().parents[1] / 'data' / 'names'

# Known nationality/country/alias to canonical Faker locale mapping
LOCALE_ALIASES = {
    'pakistan': 'en_PK',
    'pakistani': 'en_PK',
    'pk': 'en_PK',
    'ur': 'en_PK',
    'ur_pk': 'en_PK',
    'ur-pk': 'en_PK',
    'en_pk': 'en_PK',
    'en-pk': 'en_PK',

    'united states': 'en_US',
    'united states of america': 'en_US',
    'usa': 'en_US',
    'us': 'en_US',
    'american': 'en_US',
    'america': 'en_US',
    'en_us': 'en_US',
    'en-us': 'en_US',

    'united kingdom': 'en_GB',
    'great britain': 'en_GB',
    'britain': 'en_GB',
    'british': 'en_GB',
    'uk': 'en_GB',
    'gb': 'en_GB',
    'england': 'en_GB',
    'english': 'en_GB',
    'en_gb': 'en_GB',
    'en-gb': 'en_GB',

    'germany': 'de_DE',
    'german': 'de_DE',
    'deutschland': 'de_DE',
    'deutsch': 'de_DE',
    'de_de': 'de_DE',
    'de-de': 'de_DE',
    'de': 'de_DE',

    'france': 'fr_FR',
    'french': 'fr_FR',
    'français': 'fr_FR',
    'francais': 'fr_FR',
    'fr_fr': 'fr_FR',
    'fr-fr': 'fr_FR',
    'fr': 'fr_FR',

    'spain': 'es_ES',
    'spanish': 'es_ES',
    'españa': 'es_ES',
    'espana': 'es_ES',
    'español': 'es_ES',
    'espanol': 'es_ES',
    'es_es': 'es_ES',
    'es-es': 'es_ES',
    'es': 'es_ES',

    'india': 'en_IN',
    'indian': 'en_IN',
    'hindi': 'en_IN',
    'in': 'en_IN',
    'hi_in': 'en_IN',
    'hi-in': 'en_IN',
    'en_in': 'en_IN',
    'en-in': 'en_IN',

    'canada': 'en_CA',
    'canadian': 'en_CA',
    'en_ca': 'en_CA',
    'en-ca': 'en_CA',

    'australia': 'en_AU',
    'australian': 'en_AU',
    'en_au': 'en_AU',
    'en-au': 'en_AU',
}

# Fast lookup map for available Faker locales (case-insensitive -> canonical)
_AVAILABLE_LOWER = {loc.lower(): loc for loc in faker.config.AVAILABLE_LOCALES}

# Common email domains with realistic market weights
EMAIL_DOMAINS = [
    ('gmail.com', 0.50),
    ('yahoo.com', 0.20),
    ('outlook.com', 0.15),
    ('hotmail.com', 0.10),
    ('icloud.com', 0.05),
]


def normalize_locale(raw_locale: Optional[str]) -> tuple[str, Optional[str]]:
    """
    Deterministic locale normalization.
    Maps nationality/country phrases or raw strings to supported Faker locales.
    Validates against faker.config.AVAILABLE_LOCALES.
    If unsupported, falls back to 'en_US' with a visible warning.
    Never fails or throws an exception.
    """
    if not raw_locale or not isinstance(raw_locale, str):
        return 'en_US', None

    cleaned = raw_locale.strip()
    key = cleaned.lower().replace('-', '_')

    # Check aliases
    if key in LOCALE_ALIASES:
        target = LOCALE_ALIASES[key]
        if target in faker.config.AVAILABLE_LOCALES:
            return target, None

    # Check direct match in Faker available locales (case-insensitive)
    if key in _AVAILABLE_LOWER:
        return _AVAILABLE_LOWER[key], None

    # Try matching hyphen to underscore
    dash_key = cleaned.lower().replace('_', '-')
    if dash_key in LOCALE_ALIASES:
        target = LOCALE_ALIASES[dash_key]
        if target in faker.config.AVAILABLE_LOCALES:
            return target, None

    # Try language prefix only (e.g. 'de' from 'de_XX' if 'de' in AVAILABLE_LOCALES)
    prefix = key.split('_')[0]
    if prefix in _AVAILABLE_LOWER:
        return _AVAILABLE_LOWER[prefix], f"Locale '{raw_locale}' mapped to '{_AVAILABLE_LOWER[prefix]}'."

    # Unsupported: fall back gracefully to en_US with warning
    warning = f"Unsupported locale '{raw_locale}'; fell back to 'en_US'."
    return 'en_US', warning


def extract_locale_from_prompt(prompt: str) -> tuple[Optional[str], Optional[str]]:
    """Extract nationality or country mentioned in prompt text."""
    p_lower = prompt.lower()
    for phrase, canonical in LOCALE_ALIASES.items():
        # Match as whole word
        pattern = r'\b' + re.escape(phrase) + r'\b'
        if re.search(pattern, p_lower):
            return normalize_locale(canonical)
    return None, None


# ---------------------------------------------------------------------------
# Strict Pydantic NamePool Schema for AI and User Assist
# ---------------------------------------------------------------------------

_PII_PATTERN = re.compile(r'(@|\b\d{3}[-.]?\d{2}[-.]?\d{4}\b|\b\d{10,}\b|https?://)', re.IGNORECASE)
_PLAUSIBLE_NAME = re.compile(r"^[\w\u00C0-\u024F\u0600-\u06FF\s'\.-]+$", re.UNICODE)


def _validate_name_list(names: list[str], field_name: str) -> list[str]:
    cleaned = []
    seen = set()
    for item in names:
        if not isinstance(item, str):
            raise ValueError(f"{field_name} must contain strings only.")
        s = item.strip()
        if not s:
            continue
        if len(s) > 50:
            raise ValueError(f"Name '{s[:20]}...' exceeds maximum length of 50 characters.")
        if _PII_PATTERN.search(s):
            raise ValueError(f"PII or sensitive pattern detected in {field_name}: '{s}'")
        if re.search(r'\d', s):
            raise ValueError(f"Digits not allowed in {field_name}: '{s}'")
        if not _PLAUSIBLE_NAME.match(s):
            raise ValueError(f"Invalid characters in {field_name}: '{s}'")
        key = s.lower()
        if key in seen:
            continue  # deduplicate gracefully
        seen.add(key)
        cleaned.append(s)
    return cleaned


class NamePool(BaseModel):
    model_config = ConfigDict(extra='ignore')
    locale: str = 'en_US'
    region: str = ''
    first_names_male: list[str] = Field(default_factory=list, max_length=200)
    first_names_female: list[str] = Field(default_factory=list, max_length=200)
    last_names: list[str] = Field(default_factory=list, max_length=200)
    cities: list[str] = Field(default_factory=list, max_length=200)

    @field_validator('first_names_male')
    @classmethod
    def check_male_names(cls, v: list[str]) -> list[str]:
        return _validate_name_list(v, 'first_names_male')

    @field_validator('first_names_female')
    @classmethod
    def check_female_names(cls, v: list[str]) -> list[str]:
        return _validate_name_list(v, 'first_names_female')

    @field_validator('last_names')
    @classmethod
    def check_last_names(cls, v: list[str]) -> list[str]:
        return _validate_name_list(v, 'last_names')

    @field_validator('cities')
    @classmethod
    def check_cities(cls, v: list[str]) -> list[str]:
        return _validate_name_list(v, 'cities')

    @model_validator(mode='after')
    def check_non_empty(self) -> NamePool:
        total_first = len(self.first_names_male) + len(self.first_names_female)
        if total_first == 0 and len(self.last_names) == 0:
            raise ValueError("NamePool must contain at least one valid first or last name.")
        return self


# In-memory cache for validated name pools and curated files
_POOL_CACHE: dict[str, dict[str, Any]] = {}


def get_curated_data(locale: str) -> Optional[dict[str, Any]]:
    """Load curated JSON for the given locale from backend/app/data/names/."""
    eff_locale, _ = normalize_locale(locale)
    cache_key = eff_locale.lower()
    if cache_key in _POOL_CACHE:
        return _POOL_CACHE[cache_key]

    # Map locale to filename candidate
    candidates = [
        cache_key,
        cache_key.replace('_', '-'),
    ]
    if eff_locale == 'en_PK':
        candidates.insert(0, 'pk')
    elif eff_locale == 'en_IN' or eff_locale == 'hi_IN':
        candidates.insert(0, 'in')

    target_file = None
    for cand in candidates:
        f = DATA_DIR / f"{cand}.json"
        if f.exists():
            target_file = f
            break
        # Try matching case-insensitively in DATA_DIR
        if DATA_DIR.exists():
            for existing in DATA_DIR.glob('*.json'):
                if existing.stem.lower() == cand:
                    target_file = existing
                    break
        if target_file:
            break

    if not target_file:
        return None

    try:
        with open(target_file, 'r', encoding='utf-8') as fp:
            data = json.load(fp)
            _POOL_CACHE[cache_key] = data
            return data
    except Exception:
        return None


def register_name_pool(pool: NamePool) -> None:
    """Cache an AI-proposed or user-provided validated NamePool."""
    eff, _ = normalize_locale(pool.locale)
    data = {
        'locale': eff,
        'country': pool.region or eff,
        'phone_format': '+## ### #######',
        'first_names': {
            'male': [{'name': n, 'weight': 1.0} for n in pool.first_names_male],
            'female': [{'name': n, 'weight': 1.0} for n in pool.first_names_female],
        },
        'last_names': [{'name': n, 'weight': 1.0} for n in pool.last_names],
        'cities': [{'name': n, 'weight': 1.0} for n in pool.cities],
    }
    _POOL_CACHE[eff.lower()] = data


def _slugify(name: str) -> str:
    """Convert name to clean ASCII alphanumeric string for email creation."""
    s = unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode('ascii')
    s = re.sub(r"[^a-zA-Z0-9]+", "", s).lower()
    return s or 'user'


def _weighted_choice(items: list[dict[str, Any]], rng: np.random.Generator) -> str:
    if not items:
        return 'Unknown'
    names = [it['name'] for it in items]
    weights = np.array([float(it.get('weight', 1.0)) for it in items], dtype=float)
    if weights.sum() <= 0:
        weights = np.ones(len(names))
    probs = weights / weights.sum()
    idx = rng.choice(len(names), p=probs)
    return names[idx]


def generate_coherent_person(
    locale: str,
    gender: Optional[str],
    rng: np.random.Generator,
    seen_emails: set[str],
    row_idx: int = 1,
) -> dict[str, str]:
    """
    Generate coherent personal attributes:
    - Gender-matched authentic first name
    - Culturally accurate last name
    - Full name with natural frequencies
    - Unique email derived from person's name with weighted providers
    - Country-accurate phone number
    - City with realistic population weights
    - Country matching locale
    - Address matching city and country
    - Fake CNIC pattern if Pakistan
    """
    data = get_curated_data(locale)
    is_pk = (locale.lower().startswith(('ur', 'pk')) or locale.upper().endswith('PK'))

    # 1. Gender determination
    if not gender or gender.lower() not in ('male', 'female'):
        gender = 'male' if rng.random() < 0.50 else 'female'
    else:
        gender = gender.lower()

    # 2. First name
    if data and 'first_names' in data:
        gender_list = data['first_names'].get(gender) or data['first_names'].get('male', [])
        first_name = _weighted_choice(gender_list, rng)
    else:
        first_name = 'Ali' if is_pk else ('John' if gender == 'male' else 'Mary')

    # 3. Last name
    if data and 'last_names' in data:
        last_name = _weighted_choice(data['last_names'], rng)
    else:
        last_name = 'Khan' if is_pk else 'Smith'

    full_name = f"{first_name} {last_name}"

    # 4. Email derived from name, guaranteed unique
    slug_first = _slugify(first_name)
    slug_last = _slugify(last_name)

    # Pick email domain based on market share weights
    domains, d_weights = zip(*EMAIL_DOMAINS)
    p_domains = np.array(d_weights) / sum(d_weights)
    domain = rng.choice(domains, p=p_domains)

    # Derivation templates
    templates = [
        f"{slug_first}.{slug_last}",
        f"{slug_first[0]}{slug_last}",
        f"{slug_first}{slug_last}",
        f"{slug_last}.{slug_first}",
        f"{slug_first}_{slug_last}",
    ]
    base_prefix = rng.choice(templates)
    email = f"{base_prefix}@{domain}"

    # Disambiguate if already seen
    if email in seen_emails:
        disambig = f"{base_prefix}{row_idx}@{domain}"
        if disambig in seen_emails:
            disambig = f"{base_prefix}{row_idx}_{rng.integers(10, 99)}@{domain}"
        email = disambig
    seen_emails.add(email)

    # 5. City & Country
    if data and 'cities' in data and data['cities']:
        city = _weighted_choice(data['cities'], rng)
        country = data.get('country', 'Pakistan' if is_pk else 'United States')
    else:
        city = 'Karachi' if is_pk else 'New York'
        country = 'Pakistan' if is_pk else 'United States'

    # 6. Phone number in country format
    if is_pk:
        # Pakistani mobile numbers: +92 3XX XXXXXXX (mobile codes 300-349)
        operator_code = rng.integers(300, 350)
        subscriber_num = rng.integers(1000000, 9999999)
        phone = f"+92 {operator_code} {subscriber_num}"
    elif data and 'phone_format' in data:
        fmt = data['phone_format']
        # Replace '#' with random digits
        phone_chars = []
        for ch in fmt:
            phone_chars.append(str(rng.integers(0, 10)) if ch == '#' else ch)
        phone = "".join(phone_chars)
    else:
        phone = f"+1 ({rng.integers(200, 999)}) {rng.integers(100, 999)}-{rng.integers(1000, 9999)}"

    # 7. Address
    if is_pk:
        roads = ['Jinnah Road', 'Iqbal Road', 'Mall Road', 'Shahrah-e-Faisal', 'Gulberg Main Blvd', 'Korangi Road', 'Ferozepur Road', 'University Road']
        road = rng.choice(roads)
        house_no = rng.integers(1, 999)
        address = f"House {house_no}, {road}, {city}, Pakistan"
    else:
        streets = ['Main St', 'High St', 'Park Ave', 'Oak St', 'Maple Rd', 'Cedar Ln']
        street = rng.choice(streets)
        num = rng.integers(10, 9999)
        address = f"{num} {street}, {city}"

    # 8. Fake CNIC pattern (only for Pakistan)
    # Format: 5 digits - 7 digits - 1 digit (e.g. 42101-1234567-1)
    area_code = rng.integers(10000, 99999)
    family_code = rng.integers(1000000, 9999999)
    check_digit = 1 if gender == 'male' else 2
    cnic = f"{area_code}-{family_code}-{check_digit}"

    return {
        'first_name': first_name,
        'last_name': last_name,
        'full_name': full_name,
        'gender': gender.capitalize(),
        'email': email,
        'phone': phone,
        'city': city,
        'country': country,
        'address': address,
        'cnic': cnic,
    }
