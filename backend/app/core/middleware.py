import time
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
import redis.asyncio as aioredis
from app.core.config import settings
import logging

logger = logging.getLogger("axis_middleware")

# Initialize Redis client pool for rate limiting
redis_pool = aioredis.ConnectionPool.from_url(settings.REDIS_URL, decode_responses=True)
redis_client = aioredis.Redis(connection_pool=redis_pool)

class AxisCorsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        origin = request.headers.get("origin")
        
        # Determine if origin is allowed
        # Allow any chrome-extension origin, localhost (dev), or production domain
        allowed = False
        if origin:
            if origin.startswith("chrome-extension://"):
                allowed = True
            else:
                allowed_origins_list = settings.ALLOWED_ORIGINS.split(",")
                if origin in allowed_origins_list:
                    allowed = True
        
        # Handle preflight (OPTIONS) requests
        if request.method == "OPTIONS":
            response = Response()
            if allowed and origin:
                response.headers["Access-Control-Allow-Origin"] = origin
                response.headers["Access-Control-Allow-Credentials"] = "true"
                response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
                response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, X-API-Key"
                response.headers["Access-Control-Max-Age"] = "600"
            return response

        # Proceed with normal request
        response = await call_next(request)
        
        if allowed and origin:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, X-API-Key"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        
        return response

class AxisRateLimiterMiddleware(BaseHTTPMiddleware):
    """
    Sliding window rate limiter using Redis.
    Limits: 100 requests per minute per IP or API key.
    """
    async def dispatch(self, request: Request, call_next):
        # Allow tracking pixels and link redirections to bypass standard rate limiter,
        # or implement a higher threshold to avoid dropping critical events.
        # Here we apply the limit to API endpoints, bypassing "/track"
        path = request.url.path
        if path.startswith("/track"):
            return await call_next(request)

        # Identify client (API Key or IP Address)
        client_identifier = request.headers.get("X-API-Key")
        if not client_identifier:
            # Fallback to IP address
            client_identifier = request.client.host if request.client else "unknown_ip"

        limit = 100
        window = 60 # 1 minute in seconds
        now = time.time()
        
        key = f"rate_limit:{client_identifier}"
        
        try:
            # We use a pipeline to perform sliding window rate limiting atomic operations
            async with redis_client.pipeline(transaction=True) as pipe:
                # Remove timestamps older than the window
                pipe.zremrangebyscore(key, 0, now - window)
                # Add current request timestamp
                pipe.zadd(key, {str(now): now})
                # Count total requests in the window
                pipe.zcard(key)
                # Set TTL on key
                pipe.expire(key, window)
                
                results = await pipe.execute()
                
            request_count = results[2]
            
            if request_count > limit:
                logger.warning(f"Rate limit exceeded for client: {client_identifier}. Requests: {request_count}")
                return JSONResponse(
                    status_code=429,
                    content={
                        "detail": "Rate limit exceeded. Maximum 100 requests per minute. Try again later."
                    }
                )
        except Exception as e:
            # Fail-open if Redis is down, but log the event
            logger.error(f"Rate limiter connection failure: {str(e)}")
            
        return await call_next(request)
