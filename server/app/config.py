import os
from pathlib import Path

from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)


class Settings(BaseSettings):
    app_name: str = "DHRUVA - AI-Powered Polar Mission Control"
    app_version: str = "1.0.0"

    database_url: str = f"sqlite:///{DATA_DIR / 'dhruva.db'}"
    jwt_secret: str = ""
    jwt_expires_minutes: int = 720

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    owm_api_key: str = ""
    owm_base_url: str = "https://api.openweathermap.org/data/2.5"

    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"

    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""

    sms_webhook_url: str = ""

    seed_demo: bool = True

    model_config = {"env_file": str(BASE_DIR / ".env"), "extra": "ignore"}

    @property
    def cors_origin_list(self) -> list:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def jwt_secret_resolved(self) -> str:
        if self.jwt_secret:
            return self.jwt_secret
        secret_file = DATA_DIR / ".jwt_secret"
        if secret_file.exists():
            return secret_file.read_text().strip()
        import secrets

        token = secrets.token_hex(32)
        secret_file.write_text(token)
        return token


settings = Settings()