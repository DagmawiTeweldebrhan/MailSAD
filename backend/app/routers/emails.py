from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.models import User, TrackedEmail, TrackingEvent, TrackingEventType
from app.schemas.schemas import (
    TrackedEmailCreate,
    TrackedEmailResponse,
    TrackedEmailOverview,
    TrackingEventResponse
)

router = APIRouter(prefix="/emails", tags=["emails"])

@router.post("", response_model=TrackedEmailResponse, status_code=status.HTTP_201_CREATED)
async def create_tracked_email(
    payload: TrackedEmailCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Registers a new email for tracking. Generates a unique tracking UUID (email_id).
    Used by the Chrome extension when sending an email.
    """
    # Create the tracked email model
    tracked_email = TrackedEmail(
        id=uuid.uuid4(),
        user_id=current_user.id,
        recipient_email=str(payload.recipient_email),
        subject=payload.subject,
        message_id=payload.message_id,
    )
    
    db.add(tracked_email)
    try:
        await db.commit()
        await db.refresh(tracked_email)
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to register tracked email: {str(e)}"
        )
    
    # Return response (events list is empty initially)
    return TrackedEmailResponse(
        id=tracked_email.id,
        user_id=tracked_email.user_id,
        recipient_email=tracked_email.recipient_email,
        subject=tracked_email.subject,
        message_id=tracked_email.message_id,
        status=tracked_email.status,
        sent_at=tracked_email.sent_at,
        events=[]
    )

@router.get("", response_model=List[TrackedEmailOverview])
async def list_tracked_emails(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieves all tracked emails registered by the current user.
    Aggregates open counts, click counts, and latest activity.
    """
    # 1. Base query for emails of the user
    stmt = (
        select(
            TrackedEmail.id,
            TrackedEmail.user_id,
            TrackedEmail.recipient_email,
            TrackedEmail.subject,
            TrackedEmail.message_id,
            TrackedEmail.status,
            TrackedEmail.sent_at,
            # Count pixel opens (exclude bot requests if desired, or count them all - here we count non-bot events for accuracy)
            func.count(
                func.nullif(
                    (TrackingEvent.event_type == TrackingEventType.PIXEL_OPEN) & (~TrackingEvent.is_bot),
                    False
                )
            ).label("opens_count"),
            # Count link clicks
            func.count(
                func.nullif(
                    (TrackingEvent.event_type == TrackingEventType.LINK_CLICK) & (~TrackingEvent.is_bot),
                    False
                )
            ).label("clicks_count"),
            # Get latest activity timestamp
            func.max(TrackingEvent.timestamp).label("latest_activity")
        )
        .select_from(TrackedEmail)
        .outerjoin(TrackingEvent, TrackedEmail.id == TrackingEvent.email_id)
        .where(TrackedEmail.user_id == current_user.id)
        .group_by(TrackedEmail.id)
        .order_by(desc(TrackedEmail.sent_at))
    )
    
    res = await db.execute(stmt)
    rows = res.all()
    
    overview_list = []
    for row in rows:
        overview_list.append(
            TrackedEmailOverview(
                id=row.id,
                user_id=row.user_id,
                recipient_email=row.recipient_email,
                subject=row.subject,
                message_id=row.message_id,
                status=row.status,
                sent_at=row.sent_at,
                opens_count=row.opens_count,
                clicks_count=row.clicks_count,
                latest_activity=row.latest_activity
            )
        )
    return overview_list

@router.get("/{email_id}", response_model=TrackedEmailResponse)
async def get_email_details(
    email_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieves the detailed history of a single tracked email, including all event logs.
    """
    stmt = (
        select(TrackedEmail)
        .options(selectinload(TrackedEmail.events))
        .where(TrackedEmail.id == email_id, TrackedEmail.user_id == current_user.id)
    )
    
    res = await db.execute(stmt)
    email = res.scalar_one_or_none()
    
    if not email:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tracked email not found or access denied."
        )

    # Sort events in chronological order (descending)
    sorted_events = sorted(email.events, key=lambda e: e.timestamp, reverse=True)

    events_response = [
        TrackingEventResponse(
            id=ev.id,
            email_id=ev.email_id,
            event_type=ev.event_type,
            target_url=ev.target_url,
            ip_address=ev.ip_address,
            user_agent=ev.user_agent,
            is_bot=ev.is_bot,
            city=ev.city,
            timestamp=ev.timestamp
        )
        for ev in sorted_events
    ]

    return TrackedEmailResponse(
        id=email.id,
        user_id=email.user_id,
        recipient_email=email.recipient_email,
        subject=email.subject,
        message_id=email.message_id,
        status=email.status,
        sent_at=email.sent_at,
        events=events_response
    )
