from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.database import connect_db, close_db, get_db, create_indexes
from app.core.rate_limit import limiter
from app.api.v1.router import api_router
from app.utils.logger import logger


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting SecureX Pro API...")
    await connect_db()
    db = get_db()
    await create_indexes(db)
    logger.info("Connected to MongoDB and indexes created.")
    yield
    await close_db()
    logger.info("Disconnected from MongoDB.")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Unified Vulnerability Assessment and Exploitation Analysis Framework",
    lifespan=lifespan,
)

# Wire the slowapi rate limiter — see app/core/rate_limit.py
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

_cors_origins = settings.CORS_ORIGINS if not settings.DEBUG else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=not settings.DEBUG,  # credentials can't be sent to wildcard origin
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "version": settings.APP_VERSION}
