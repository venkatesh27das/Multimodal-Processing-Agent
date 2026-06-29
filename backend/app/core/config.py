from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Multimodal Parsing Agent"
    app_version: str = "0.1.0"
    environment: str = "local"
    api_prefix: str = "/api/v1"
    log_level: str = "INFO"

    database_url: str = "sqlite:///./local.db"
    storage_dir: Path = Path("./storage")
    max_upload_bytes: int = 50 * 1024 * 1024

    tesseract_cmd: str | None = None
    lm_studio_enabled: bool = False
    lm_studio_base_url: str = "http://localhost:1234/v1"
    lm_studio_vlm_model: str = "google/gemma-4-12b"
    lm_studio_timeout_seconds: float = 60.0
    lm_studio_max_pdf_pages: int = 3
    lm_studio_embedding_enabled: bool = False
    lm_studio_embedding_model: str = "text-embedding-nomic-embed-text-v1.5"
    agent_task_background_enabled: bool = True
    agent_task_max_attempts: int = 3
    agent_task_lock_timeout_seconds: int = 300
    agent_task_retry_backoff_seconds: int = 30

    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:3000", "http://127.0.0.1:3000"]
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
