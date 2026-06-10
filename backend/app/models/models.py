import enum
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean, Enum, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base

class EmailStatus(str, enum.Enum):
    SENT = "sent"
    OPENED = "opened"
    CLICKED = "clicked"

class TrackingEventType(str, enum.Enum):
    PIXEL_OPEN = "pixel_open"
    LINK_CLICK = "link_click"

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    google_id = Column(String, unique=True, nullable=True)  # Nullable if API-key-only creation is allowed
    api_key = Column(String, unique=True, index=True, nullable=False, default=lambda: uuid.uuid4().hex)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))

    # Relationships
    tracked_emails = relationship("TrackedEmail", back_populates="user", cascade="all, delete-orphan")

class TrackedEmail(Base):
    __tablename__ = "tracked_emails"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    recipient_email = Column(String, nullable=False)
    subject = Column(String, nullable=True)
    message_id = Column(String, unique=True, index=True, nullable=True) # Gmail's message-id
    status = Column(Enum(EmailStatus), nullable=False, default=EmailStatus.SENT)
    sent_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))

    # Relationships
    user = relationship("User", back_populates="tracked_emails")
    events = relationship("TrackingEvent", back_populates="email", cascade="all, delete-orphan")

class TrackingEvent(Base):
    __tablename__ = "tracking_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email_id = Column(UUID(as_uuid=True), ForeignKey("tracked_emails.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(Enum(TrackingEventType), nullable=False)
    target_url = Column(String, nullable=True)  # Populated for link_click
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    is_bot = Column(Boolean, nullable=False, default=False)
    city = Column(String, nullable=True)
    timestamp = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"), index=True)

    # Relationships
    email = relationship("TrackedEmail", back_populates="events")
