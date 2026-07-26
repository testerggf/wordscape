from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import generate, health, persistence, vocab

app = FastAPI(
    title="WordScape API",
    version="0.1.0",
    docs_url="/docs" if settings.debug else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(vocab.router, prefix="/api/vocab", tags=["vocab"])
app.include_router(generate.router, prefix="/api/generate", tags=["generate"])
app.include_router(persistence.router, prefix="/api/persist", tags=["persistence"])
