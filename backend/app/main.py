import logging
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, engine
from app.core.middleware import AxisCorsMiddleware, AxisRateLimiterMiddleware
from app.routers import tracking_router, auth_router, emails_router

# Setup logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("axis_main")

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Enterprise-grade, privacy-first email tracking ecosystem API.",
    version="1.0.0"
)

# 1. Register Middlewares
# AxisCorsMiddleware intercepts pre-flights and matches chrome-extension origins dynamically.
app.add_middleware(AxisCorsMiddleware)
# AxisRateLimiterMiddleware enforces sliding window constraints (100 req/min).
app.add_middleware(AxisRateLimiterMiddleware)

@app.on_event("startup")
async def on_startup():
    logger.info("Initializing database tables...")
    async with engine.begin() as conn:
        # Create all tables asynchronously if they don't exist
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables initialized successfully.")

# 2. Register Routers
# Public tracking router
app.include_router(tracking_router)

# Authenticated API routes
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(emails_router, prefix=settings.API_V1_STR)

@app.get("/")
async def root():
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "version": "1.0.0"
    }
