from __future__ import annotations

from fastapi import FastAPI

from app.settings import settings
from app.api.items import router as items_router


app = FastAPI(title=settings.app_name)
app.include_router(items_router)

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
