from typing import Optional
from fastapi import Security, HTTPException, status, Depends
from fastapi.security.api_key import APIKeyHeader
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.core.database import get_db
from app.models.models import User

# Authentication Schemas
API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)
JWT_BEARER = HTTPBearer(auto_error=False)

async def get_current_user(
    api_key: Optional[str] = Security(API_KEY_HEADER),
    token: Optional[HTTPAuthorizationCredentials] = Security(JWT_BEARER),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Dependency to authenticate requests. Supports X-API-Key header or JWT Bearer Token.
    """
    # 1. Check API Key
    if api_key:
        stmt = select(User).where(User.api_key == api_key)
        res = await db.execute(stmt)
        user = res.scalar_one_or_none()
        if user:
            return user
            
    # 2. Check JWT Bearer Token
    if token:
        try:
            payload = jwt.decode(
                token.credentials,
                settings.SECRET_KEY,
                algorithms=["HS256"]
            )
            email: str = payload.get("sub")
            if email:
                stmt = select(User).where(User.email == email)
                res = await db.execute(stmt)
                user = res.scalar_one_or_none()
                if user:
                    return user
        except JWTError:
            pass

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or missing authentication credentials (X-API-Key or Bearer Token required)",
    )
