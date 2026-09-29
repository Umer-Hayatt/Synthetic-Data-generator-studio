import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    max_upload_bytes: int = int(os.getenv('MAX_UPLOAD_BYTES', 15 * 1024 * 1024))
    max_rows: int = int(os.getenv('MAX_ROWS', 50_000))
    max_columns: int = int(os.getenv('MAX_COLUMNS', 200))
    max_xlsx_expanded_bytes: int = int(os.getenv('MAX_XLSX_EXPANDED_BYTES', 100 * 1024 * 1024))
    cache_ttl_seconds: int = int(os.getenv('CACHE_TTL_SECONDS', 900))
    cache_max_bytes: int = int(os.getenv('CACHE_MAX_BYTES', 128 * 1024 * 1024))
    max_cells: int = int(os.getenv('MAX_CELLS', 1_000_000))


settings = Settings()
