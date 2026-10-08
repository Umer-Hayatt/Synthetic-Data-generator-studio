"""Deterministic heuristics; semantic confidence describes evidence, not certainty."""
import re
import numpy as np
import pandas as pd


def infer_schema(frame: pd.DataFrame) -> list[dict]:
    return [infer_column(str(name), frame[name]) for name in frame.columns]


def infer_column(name: str, series: pd.Series) -> dict:
    values = series.dropna()
    text = values.astype(str).str.strip()
    lower = name.lower()
    dtype = 'string'
    parsed = values
    if len(values):
        numeric = pd.to_numeric(values, errors='coerce')
        if pd.api.types.is_bool_dtype(values) or text.str.lower().isin(['true', 'false']).all():
            dtype = 'boolean'
        elif numeric.notna().all() and np.isfinite(numeric.astype(float)).all():
            dtype = 'integer' if (numeric % 1 == 0).all() else 'float'
            parsed = numeric
        elif pd.api.types.is_datetime64_any_dtype(values) or text.str.match(r'^\d{4}[-/]\d{1,2}[-/]\d{1,2}').all():
            dates = pd.to_datetime(values, errors='coerce', utc=True, format='mixed')
            if dates.notna().all():
                dtype, parsed = 'datetime', dates
    unique = int(values.nunique())
    semantic, confidence = 'generic_text', 0.3
    if dtype in ('integer', 'float'):
        semantic, confidence = 'numeric', 0.95
    if dtype == 'datetime':
        semantic, confidence = 'datetime', 0.95
    elif dtype == 'boolean':
        semantic, confidence = 'categorical', 0.95
    elif dtype in ('integer', 'string') and len(values) and (lower == 'id' or lower.endswith('_id')) and unique == len(values):
        semantic, confidence = 'id', 0.9
    elif len(values) and text.str.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').mean() >= 0.9:
        semantic, confidence = 'email', 0.95
    elif len(values) and ('phone' in lower or 'mobile' in lower) and text.str.match(r'^\+?[\d ().-]{7,20}$').mean() >= 0.9:
        semantic, confidence = 'phone', 0.85
        dtype = 'string'
    elif dtype == 'string' and lower in ('name', 'full_name', 'first_name', 'last_name', 'person_name'):
        semantic, confidence = 'person_name', 0.65
    elif dtype in ('integer', 'float') and re.search(r'price|amount|salary|income|cost|balance', lower):
        semantic, confidence = 'money', 0.75
    elif dtype == 'string' and len(values) and unique <= min(50, max(2, len(values) * 0.2)):
        semantic, confidence = 'categorical', 0.8
    is_sensitive, sensitive_category = detect_sensitive(name, series, dtype, semantic)
    result = {'name': name, 'dtype': dtype, 'semantic_type': semantic,
              'semantic_confidence': confidence, 'nullable': bool(series.isna().any()),
              'null_rate': float(series.isna().mean()), 'unique_count': unique,
              'is_sensitive': is_sensitive, 'sensitive_category': sensitive_category}
    if len(values) and dtype in ('integer', 'float'):
        result.update(min=float(parsed.min()), max=float(parsed.max()),
                      mean=float(parsed.mean()), std=float(parsed.std(ddof=0)))
    elif len(values) and dtype == 'datetime':
        result.update(min=parsed.min().isoformat(), max=parsed.max().isoformat())
    if semantic == 'categorical':
        counts = text.value_counts(normalize=True)
        result['category_frequencies'] = [{'value': value, 'frequency': float(freq)} for value, freq in counts.items()]
    return result


_NON_PERSON_SUFFIXES = {
    'company_name', 'product_name', 'item_name', 'brand_name', 'category_name',
    'file_name', 'table_name', 'project_name', 'dataset_name', 'column_name',
    'city_name', 'country_name', 'region_name', 'org_name', 'event_name',
    'service_name', 'tag_name', 'class_name', 'host_name', 'domain_name'
}

_NATIONAL_ID_EXACT = {
    'ssn', 'social_security', 'social_security_number', 'national_id',
    'nic', 'cnic', 'passport', 'passport_number', 'passport_no',
    'tax_id', 'ein', 'tin', 'npi', 'aadhaar', 'sin', 'dni'
}


def detect_sensitive(name: str, series: pd.Series, dtype: str, semantic: str = '') -> tuple[bool, str | None]:
    """Deterministic detection of PII and sensitive data patterns."""
    clean_name = re.sub(r'[^a-z0-9]', '_', str(name).lower()).strip('_')
    values = series.dropna()
    text = values.astype(str).str.strip() if len(values) else pd.Series(dtype=str)

    # 1. Emails
    if 'email' in clean_name or 'e_mail' in clean_name or semantic == 'email':
        return True, 'email'
    if len(text) and text.str.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').mean() >= 0.7:
        return True, 'email'

    # 2. Phones
    if any(k in clean_name for k in ('phone', 'mobile', 'cell', 'telephone', 'fax')) or semantic == 'phone':
        return True, 'phone'
    if len(text) and dtype == 'string':
        if ('phone' in clean_name or 'tel' in clean_name) and text.str.match(r'^\+?[\d ().-]{7,20}$').mean() >= 0.7:
            return True, 'phone'
        if text.str.match(r'^\+?[\d ().-]{7,20}$').mean() >= 0.8:
            return True, 'phone'

    # 3. Person Names
    if clean_name in ('name', 'full_name', 'first_name', 'last_name', 'middle_name', 'person_name',
                      'customer_name', 'client_name', 'patient_name', 'employee_name', 'user_name',
                      'username', 'contact_name', 'owner_name', 'author_name', 'student_name') or semantic == 'person_name':
        return True, 'person_name'
    if clean_name.endswith(('_firstname', '_lastname', '_fullname')) or (
        clean_name.endswith('_name') and clean_name not in _NON_PERSON_SUFFIXES
    ):
        return True, 'person_name'

    # 4. National IDs / SSN / Passport / Tax ID
    if clean_name in _NATIONAL_ID_EXACT or re.search(r'\b(ssn|social_security|national_id|cnic|passport|tax_id)\b', clean_name):
        return True, 'national_id'
    if len(text):
        if text.str.match(r'^\d{3}-\d{2}-\d{4}$').mean() >= 0.7:
            return True, 'national_id'
        if text.str.match(r'^\d{5}-\d{7}-\d{1}$').mean() >= 0.7:
            return True, 'national_id'

    # 5. Addresses (physical address, street, zip / postal code)
    if clean_name in ('address', 'street', 'street_address', 'home_address', 'billing_address',
                      'shipping_address', 'mailing_address', 'postal_code', 'zip_code', 'zipcode', 'postcode') or 'address' in clean_name or semantic == 'address':
        return True, 'address'

    # 6. Dates of birth
    if clean_name in ('dob', 'date_of_birth', 'birth_date', 'birthdate', 'birthday') or re.search(r'\b(dob|birth_?date|date_?of_?birth)\b', clean_name):
        return True, 'date_of_birth'

    # 7. Card or Account numbers
    if re.search(r'\b(credit_card|card_num|card_number|card_no|debit_card|cc_num|cc_number|cvv|cvc|account_num|account_number|account_no|bank_account|bank_acc|iban|routing_number|swift_code)\b', clean_name):
        return True, 'card_or_account'
    if len(text) and ('card' in clean_name or 'cc' in clean_name or 'pan' in clean_name or 'acc' in clean_name):
        digits_only = text.str.replace(r'[- ]', '', regex=True)
        if digits_only.str.match(r'^\d{12,19}$').mean() >= 0.8:
            return True, 'card_or_account'

    return False, None
