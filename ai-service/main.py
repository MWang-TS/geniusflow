from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.api import inspector, assistant, health
from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("AI Service starting up...")
    yield
    print("AI Service shutting down...")


app = FastAPI(
    title="GeniusFlow AI Service",
    description="AI Agent services for GeniusFlow",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/health", tags=["health"])
app.include_router(inspector.router, prefix="/ai", tags=["inspector"])
app.include_router(assistant.router, prefix="/ai", tags=["assistant"])


@app.get("/")
async def root():
    return {"message": "GeniusFlow AI Service", "version": "0.1.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
