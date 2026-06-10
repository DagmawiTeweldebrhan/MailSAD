import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any

import redis.asyncio as aioredis
from sqlalchemy import update
from sqlalchemy.future import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.models import TrackingEvent, TrackedEmail, EmailStatus, TrackingEventType

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("axis_worker")

# Setup redis client
redis_pool = aioredis.ConnectionPool.from_url(settings.REDIS_URL, decode_responses=True)
redis_client = aioredis.Redis(connection_pool=redis_pool)

def resolve_ip_city(ip: str) -> str:
    """
    Mock IP geolocation logic. In production, this can use a MaxMind GeoIP2 database
    or a fast local subnet lookup.
    """
    if not ip or ip in ("127.0.0.1", "::1", "localhost"):
        return "Local Loopback"
    
    # Simple deterministic hashing of IP for demonstration geolocation
    cities = ["New York", "San Francisco", "London", "Tokyo", "Berlin", "Paris", "Sydney", "Toronto"]
    try:
        ip_sum = sum(int(part) for part in ip.split(".") if part.isdigit())
        return cities[ip_sum % len(cities)]
    except Exception:
        return "Unknown City"

async def process_batch(events_data: List[str]):
    """Processes a batch of raw event strings from Redis queue and saves them to DB."""
    if not events_data:
        return

    parsed_events: List[Dict[str, Any]] = []
    for raw_ev in events_data:
        try:
            parsed_events.append(json.loads(raw_ev))
        except Exception as e:
            logger.error(f"Failed to parse event JSON: {raw_ev}. Error: {str(e)}")

    if not parsed_events:
        return

    async with AsyncSessionLocal() as session:
        try:
            # Prepare events for bulk insert
            db_events = []
            emails_to_update: Dict[uuid.UUID, EmailStatus] = {}

            for ev in parsed_events:
                eid_str = ev.get("email_id")
                if not eid_str:
                    continue
                
                try:
                    email_id = uuid.UUID(eid_str)
                except ValueError:
                    logger.warning(f"Invalid UUID for email_id: {eid_str}")
                    continue

                event_type_str = ev.get("event_type")
                if event_type_str == "pixel_open":
                    event_type = TrackingEventType.PIXEL_OPEN
                    target_status = EmailStatus.OPENED
                elif event_type_str == "link_click":
                    event_type = TrackingEventType.LINK_CLICK
                    target_status = EmailStatus.CLICKED
                else:
                    logger.warning(f"Invalid event type: {event_type_str}")
                    continue

                ip = ev.get("ip_address", "")
                city = resolve_ip_city(ip)

                timestamp_str = ev.get("timestamp")
                if timestamp_str:
                    try:
                        timestamp = datetime.fromisoformat(timestamp_str)
                    except ValueError:
                        timestamp = datetime.now(timezone.utc)
                else:
                    timestamp = datetime.now(timezone.utc)

                db_event = TrackingEvent(
                    id=uuid.uuid4(),
                    email_id=email_id,
                    event_type=event_type,
                    target_url=ev.get("target_url"),
                    ip_address=ip,
                    user_agent=ev.get("user_agent"),
                    is_bot=ev.get("is_bot", False),
                    city=city,
                    timestamp=timestamp
                )
                db_events.append(db_event)

                # Keep track of the highest level status change
                # clicked > opened > sent
                current_target = emails_to_update.get(email_id)
                if not current_target:
                    emails_to_update[email_id] = target_status
                elif current_target == EmailStatus.OPENED and target_status == EmailStatus.CLICKED:
                    emails_to_update[email_id] = target_status

            if db_events:
                # Add all events
                session.add_all(db_events)
                
                # Fetch current status of emails to avoid downgrading clicked to opened
                email_ids = list(emails_to_update.keys())
                stmt = select(TrackedEmail).where(TrackedEmail.id.in_(email_ids))
                res = await session.execute(stmt)
                emails = res.scalars().all()
                
                for email in emails:
                    target_st = emails_to_update[email.id]
                    # Only upgrade status: sent -> opened/clicked, or opened -> clicked
                    if email.status == EmailStatus.SENT:
                        email.status = target_st
                    elif email.status == EmailStatus.OPENED and target_st == EmailStatus.CLICKED:
                        email.status = target_st

                await session.commit()
                logger.info(f"Successfully processed and bulk-inserted batch of {len(db_events)} events.")
        except Exception as e:
            await session.rollback()
            logger.error(f"Error executing batch insert: {str(e)}")

async def run_worker():
    """Main worker loop that pulls from Redis event queue."""
    logger.info("Axis Tracker Worker starting up...")
    
    # Wait for Redis to be fully available
    connected = False
    while not connected:
        try:
            await redis_client.ping()
            connected = True
            logger.info("Connected to Redis successfully.")
        except Exception as e:
            logger.warning(f"Waiting for Redis connection... {str(e)}")
            await asyncio.sleep(2)

    batch_size = 100
    timeout_seconds = 1.0

    while True:
        try:
            # We want to pull batch_size elements or wait up to timeout_seconds
            batch = []
            # Pop first element with blocking
            popped = await redis_client.blpop("event_queue", timeout=int(timeout_seconds))
            if popped:
                # blpop returns (key, value)
                batch.append(popped[1])
                
                # Pop remaining elements up to batch_size non-blocking
                for _ in range(batch_size - 1):
                    item = await redis_client.rpop("event_queue")
                    if item:
                        batch.append(item)
                    else:
                        break
            
            if batch:
                await process_batch(batch)
            
        except asyncio.CancelledError:
            logger.info("Worker received cancel signal. Shutting down...")
            break
        except Exception as e:
            logger.error(f"Error in worker main loop: {str(e)}")
            await asyncio.sleep(1)

if __name__ == "__main__":
    try:
        asyncio.run(run_worker())
    except KeyboardInterrupt:
        logger.info("Worker stopped by user.")
