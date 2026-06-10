from pydantic import BaseModel, EmailStr, Field
from uuid import UUID
from datetime import datetime
from typing import Optional, List
from app.models.models import EmailStatus, TrackingEventType

# --- USER SCHEMAS ---
class UserBase(BaseModel):
    email: EmailStr

class UserCreate(UserBase):
    google_id: Optional[str] = None

class UserResponse(UserBase):
    id: UUID
    api_key: str
    created_at: datetime

    class Config:
        from_attributes = True

# --- EVENT SCHEMAS ---
class TrackingEventBase(BaseModel):
    event_type: TrackingEventType
    target_url: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    is_bot: bool = False
    city: Optional[str] = None

class TrackingEventResponse(TrackingEventBase):
    id: UUID
    email_id: UUID
    timestamp: datetime

    class Config:
        from_attributes = True

# --- EMAIL SCHEMAS ---
class TrackedEmailBase(BaseModel):
    recipient_email: EmailStr
    subject: Optional[str] = None
    message_id: Optional[str] = None

class TrackedEmailCreate(TrackedEmailBase):
    pass

class TrackedEmailResponse(TrackedEmailBase):
    id: UUID
    user_id: UUID
    status: EmailStatus
    sent_at: datetime
    events: List[TrackingEventResponse] = []

    class Config:
        from_attributes = True

class TrackedEmailOverview(TrackedEmailBase):
    id: UUID
    user_id: UUID
    status: EmailStatus
    sent_at: datetime
    opens_count: int = 0
    clicks_count: int = 0
    latest_activity: Optional[datetime] = None

    class Config:
        from_attributes = True

# --- TOKEN SCHEMAS ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
