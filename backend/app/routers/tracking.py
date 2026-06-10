import base64
import json
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Request, Response, Query, HTTPException
from fastapi.responses import RedirectResponse

from app.services.bot_detector import is_bot_user_agent
from app.core.middleware import redis_client

logger = logging.getLogger("axis_tracking_router")

router = APIRouter(prefix="/track", tags=["tracking"])

# Transparent 1x1 GIF Base64
TRANSPARENT_GIF_B64 = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
GIF_BYTES = base64.b64decode(TRANSPARENT_GIF_B64)

def get_client_ip(request: Request) -> str:
    """Retrieves client IP addressing, accounting for reverse proxies (X-Forwarded-For)."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        # Get the first IP in the comma-separated list
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"

@router.get("/p.gif")
async def track_pixel(
    request: Request,
    eid: str = Query(..., alias="eid", description="Tracking Email ID (UUID)")
):
    """
    Tracking pixel endpoint. Returns a 1x1 transparent GIF.
    Pushes open event tracking payload directly to Redis 'event_queue' asynchronously.
    """
    user_agent = request.headers.get("user-agent", "")
    ip = get_client_ip(request)
    is_bot = is_bot_user_agent(user_agent)

    # Construct the event payload
    event_payload = {
        "email_id": eid,
        "event_type": "pixel_open",
        "ip_address": ip,
        "user_agent": user_agent,
        "is_bot": is_bot,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

    try:
        # Push to Redis 'event_queue' asynchronously
        await redis_client.rpush("event_queue", json.dumps(event_payload))
    except Exception as e:
        # Fail silently to user/client but log internally
        logger.error(f"Failed to queue pixel event: {str(e)}")

    headers = {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        "Access-Control-Allow-Origin": "*"
    }
    return Response(content=GIF_BYTES, media_type="image/gif", headers=headers)

@router.get("/l")
async def track_link(
    request: Request,
    eid: str = Query(..., alias="eid", description="Tracking Email ID (UUID)"),
    url: str = Query(..., alias="url", description="Base64 URL-encoded redirect destination")
):
    """
    Link click tracking redirection endpoint. Decodes target URL and redirects.
    Pushes link_click event payload to Redis 'event_queue'.
    """
    # Base64 decode URL
    try:
        # Handle potential padding issues by adding '==' if needed
        missing_padding = len(url) % 4
        if missing_padding:
            url += '=' * (4 - missing_padding)
        
        # Decode urlsafe or standard base64
        decoded_url_bytes = base64.urlsafe_b64decode(url)
        decoded_url = decoded_url_bytes.decode("utf-8")
    except Exception as e:
        logger.error(f"Failed to decode tracking URL: {url}. Error: {str(e)}")
        raise HTTPException(status_code=400, detail="Invalid target URL encoding")

    user_agent = request.headers.get("user-agent", "")
    ip = get_client_ip(request)
    is_bot = is_bot_user_agent(user_agent)

    event_payload = {
        "email_id": eid,
        "event_type": "link_click",
        "target_url": decoded_url,
        "ip_address": ip,
        "user_agent": user_agent,
        "is_bot": is_bot,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

    try:
        await redis_client.rpush("event_queue", json.dumps(event_payload))
    except Exception as e:
        logger.error(f"Failed to queue link click event: {str(e)}")

    return RedirectResponse(url=decoded_url, status_code=302)
