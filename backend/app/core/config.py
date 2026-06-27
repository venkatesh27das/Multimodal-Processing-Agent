from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Multimodal Parsing Agent"
    app_version: str = "0.1.0"
    environment: str = "local"
    api_prefix: str = "/api/v1"

    database_url: str = "sqlite:///./local.db"
    storage_dir: Path = Path("./storage")

    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

