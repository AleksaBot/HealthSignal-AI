from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "HealthSignal AI API"
    database_url: str = Field(default="sqlite:///./healthsignal.db", alias="DATABASE_URL")
    secret_key: str = Field(default="dev-change-me", alias="SECRET_KEY")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    configured_origins: str | None = Field(
        default=None,
        validation_alias=AliasChoices("ALLOWED_ORIGINS", "FRONTEND_ORIGIN"),
    )
    llm_api_key: str | None = Field(default=None, alias="OPENAI_API_KEY")
    llm_model: str = Field(default="gpt-4o-mini", alias="OPENAI_MODEL")
    llm_base_url: str = Field(default="https://api.openai.com/v1", alias="OPENAI_BASE_URL")

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def cors_allowed_origins(self) -> list[str]:
        local_origins = [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]

        if not self.configured_origins:
            return local_origins

        parsed = [
            origin.strip().rstrip("/")
            for origin in self.configured_origins.split(",")
            if origin.strip()
        ]

        deduped_origins: list[str] = []
        for origin in [*local_origins, *parsed]:
            if origin not in deduped_origins:
                deduped_origins.append(origin)

        return deduped_origins


settings = Settings()
