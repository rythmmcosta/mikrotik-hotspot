from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str = "mysql+asyncmy://hotspot:password@localhost:3306/hotspot_db"
    redis_url: str = "redis://localhost:6379/0"
    secret_key: str = "change-me-32-bytes"
    secret_encryption_key: str = "change-me-32-bytes"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    cors_origins: str = "http://localhost:5173"
    environment: str = "development"
    syslog_port: int = 514
    agent_metrics_retention_days: int = 7

    model_config = {"env_file": ".env", "case_sensitive": False}

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]


@lru_cache
def get_settings() -> Settings:
    return Settings()
