from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from app.api.routes import router
from app.core.config import settings
from app.db.session import Base, engine

Base.metadata.create_all(bind=engine)


def ensure_user_first_name_column() -> None:
    inspector = inspect(engine)
    columns = {column["name"] for column in inspector.get_columns("users")}
    if "first_name" in columns:
        return

    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE users ADD COLUMN first_name VARCHAR(80) NOT NULL DEFAULT ''"))


ensure_user_first_name_column()

app = FastAPI(
    title="HealthSignal AI API",
    description="Educational clinical signal extraction and risk insight service",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

app.include_router(router)
