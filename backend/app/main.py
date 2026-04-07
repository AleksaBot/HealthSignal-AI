from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.db.session import Base, engine
from app.models import report, session, user  # noqa: F401

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="HealthSignal AI API",
    description="Educational clinical signal extraction and risk insight service",
    version="0.2.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

app.include_router(router)
