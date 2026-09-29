import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


# Resolve from this module, not the server's working directory. Production
# environment variables take precedence; a missing local file is harmless.
load_dotenv(Path(__file__).resolve().parents[3] / '.env', override=False)


@dataclass(frozen=True)
class Settings:
    max_upload_bytes: int = int(os.getenv('MAX_UPLOAD_BYTES', 15 * 1024 * 1024))
    max_rows: int = int(os.getenv('MAX_ROWS', 50_000))
    max_columns: int = int(os.getenv('MAX_COLUMNS', 200))
    max_xlsx_expanded_bytes: int = int(os.getenv('MAX_XLSX_EXPANDED_BYTES', 100 * 1024 * 1024))
    cache_ttl_seconds: int = int(os.getenv('CACHE_TTL_SECONDS', 900))
    cache_max_bytes: int = int(os.getenv('CACHE_MAX_BYTES', 128 * 1024 * 1024))
    max_cells: int = int(os.getenv('MAX_CELLS', 1_000_000))
    artifact_root: str = os.getenv('ARTIFACT_ROOT', str(Path(__file__).resolve().parents[2] / 'generated' / 'artifacts'))
    artifact_max_bytes: int = int(os.getenv('ARTIFACT_MAX_BYTES', 2 * 1024**3))
    artifact_ttl_seconds: int = int(os.getenv('ARTIFACT_TTL_SECONDS', 86400))
    job_upload_bytes: int = int(os.getenv('JOB_UPLOAD_BYTES', 512 * 1024**2))
    batch_rows: int = int(os.getenv('BATCH_ROWS', 4096))
    profile_rows: int = int(os.getenv('PROFILE_ROWS', 5000))
    job_max_rows: int = int(os.getenv('JOB_MAX_ROWS', 10_000_000))
    job_queue_size: int = int(os.getenv('JOB_QUEUE_SIZE', 8))
    job_metadata_limit: int = int(os.getenv('JOB_METADATA_LIMIT', 1000))


settings = Settings()
