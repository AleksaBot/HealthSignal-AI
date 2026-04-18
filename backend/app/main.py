from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from app.api.routes import router
from app.core.config import settings
from app.db.session import Base, engine

Base.metadata.create_all(bind=engine)


def ensure_user_columns() -> None:
    inspector = inspect(engine)
    columns = {column["name"] for column in inspector.get_columns("users")}

    with engine.begin() as connection:
        if "first_name" not in columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN first_name VARCHAR(80) NOT NULL DEFAULT ''"))

        if "health_profile_json" not in columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN health_profile_json TEXT"))

        if "health_profile_updated_at" not in columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN health_profile_updated_at DATETIME"))


ensure_user_columns()

app = FastAPI(
    title="HealthSignal AI API",
    description="Educational clinical signal extraction and risk insight service",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_origin_regex=settings.cors_allowed_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

app.include_router(router)
