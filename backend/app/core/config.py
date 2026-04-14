from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "HealthSignal AI API"
    database_url: str = Field(default="sqlite:///./healthsignal.db", alias="DATABASE_URL")
    secret_key: str = Field(default="dev-change-me", alias="SECRET_KEY")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    configured_origins: str | None = Field(
        default=None,
        validation_alias=AliasChoices("CORS_ORIGINS", "ALLOWED_ORIGINS", "FRONTEND_ORIGIN"),
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
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]

        if not self.configured_origins:
            return local_origins

        parsed = [
            origin.strip().rstrip("/")
            for origin in self.configured_origins.split(",")
            if origin.strip()
        ]
        exact_origins = [origin for origin in parsed if "*" not in origin]

        deduped_origins: list[str] = []
        for origin in [*local_origins, *exact_origins]:
            if origin not in deduped_origins:
                deduped_origins.append(origin)

        return deduped_origins

    @property
    def cors_allowed_origin_regex(self) -> str | None:
        if not self.configured_origins:
            return r"^https:\/\/[a-z0-9-]+\.vercel\.app$"

        parsed = [
            origin.strip().rstrip("/")
            for origin in self.configured_origins.split(",")
            if origin.strip()
        ]

        wildcard_origins = {origin for origin in parsed if "*" in origin}
        if "https://*.vercel.app" in wildcard_origins or "*.vercel.app" in wildcard_origins:
            return r"^https:\/\/[a-z0-9-]+\.vercel\.app$"

        return None


settings = Settings()
