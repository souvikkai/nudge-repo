from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.settings import settings
from app.api.items import router as items_router

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000",
    "https://nudge-repo.vercel.app",
    "https://nudge-repo-hknkrsu3t-souvikkais-projects.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(items_router)

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}