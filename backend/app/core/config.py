from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "HealthSignal AI API"
    database_url: str = Field(default="sqlite:///./healthsignal.db", alias="DATABASE_URL")
    secret_key: str = Field(default="dev-change-me", alias="SECRET_KEY")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
