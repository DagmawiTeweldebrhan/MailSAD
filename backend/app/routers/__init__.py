from app.routers.tracking import router as tracking_router
from app.routers.auth import router as auth_router
from app.routers.emails import router as emails_router

__all__ = ["tracking_router", "auth_router", "emails_router"]
