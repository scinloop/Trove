"""Application configuration. Values can be overridden via environment variables."""
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent  # collecthub/backend


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env", env_file_encoding="utf-8", extra="ignore"
    )

    app_name: str = "Trove"
    db_path: Path = BASE_DIR / "data" / "collecthub.db"
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    # ---- Bangumi（https://bangumi.github.io/api/） ----
    # UA 规范：开发者ID/应用名/版本 (项目主页)；官方明确禁止 "Bangumi/1.0" 之类
    bgm_ua: str = "scinloop/Trove/1.0.0 (https://github.com/scinloop/Trove)"
    # Personal Access Token（365 天），存 backend/.env 的 BGM_TOKEN，绝不入库/入 git/入日志
    bgm_token: str = ""
    bgm_base: str = "https://api.bgm.tv"
    # 官方建议 ≤1 req/s：所有出站请求串行 + 最小间隔节流
    bgm_min_interval: float = 1.1
    bgm_timeout: float = 20.0

    @property
    def db_url(self) -> str:
        return f"sqlite+aiosqlite:///{self.db_path.as_posix()}"

    @property
    def bgm_configured(self) -> bool:
        return bool(self.bgm_token.strip())


settings = Settings()
