"""Application configuration. Values can be overridden via environment variables."""
from pathlib import Path

from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent.parent  # collecthub/backend


class Settings(BaseSettings):
    app_name: str = "Trove"
    db_path: Path = BASE_DIR / "data" / "collecthub.db"
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    @property
    def db_url(self) -> str:
        return f"sqlite+aiosqlite:///{self.db_path.as_posix()}"


settings = Settings()
