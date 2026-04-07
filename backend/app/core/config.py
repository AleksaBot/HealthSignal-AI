from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "HealthSignal AI API"
    database_url: str = Field(default="sqlite:///./healthsignal.db")
    secret_key: str = Field(default="dev-change-me")
    jwt_algorithm: str = Field(default="HS256")

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
