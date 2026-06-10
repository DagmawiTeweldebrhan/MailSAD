from datetime import datetime, timedelta, timezone
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.models import User
from app.schemas.schemas import UserResponse, Token

router = APIRouter(prefix="/auth", tags=["authentication"])

class GoogleAuthRequest(BaseModel):
    email: EmailStr
    google_id: str

class AuthResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Generates a secure HS256 JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(days=30)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")

@router.post("/google", response_model=AuthResponse)
async def authenticate_google(
    payload: GoogleAuthRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Endpoint for Google Sign-In authentication.
    Checks if a user exists with the email. If not, creates a new user.
    Returns JWT token and user info (including API Key).
    """
    # Check if user exists by google_id or email
    stmt = select(User).where((User.google_id == payload.google_id) | (User.email == payload.email))
    res = await db.execute(stmt)
    user = res.scalars().first()

    if not user:
        # Create new user
        user = User(
            id=uuid.uuid4(),
            email=payload.email,
            google_id=payload.google_id,
            api_key=uuid.uuid4().hex
        )
        db.add(user)
        try:
            await db.commit()
            await db.refresh(user)
        except Exception as e:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to register user: {str(e)}"
            )
    else:
        # Link google_id if missing
        if not user.google_id:
            user.google_id = payload.google_id
            await db.commit()
            await db.refresh(user)

    # Generate access token
    access_token = create_access_token(data={"sub": user.email})

    # Prepare response user
    user_response = UserResponse(
        id=user.id,
        email=user.email,
        api_key=user.api_key,
        created_at=user.created_at
    )

    return AuthResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_response
    )

@router.get("/me", response_model=UserResponse)
async def get_my_profile(
    current_user: User = Depends(get_current_user)
):
    """Returns the authenticated user profile."""
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        api_key=current_user.api_key,
        created_at=current_user.created_at
    )
