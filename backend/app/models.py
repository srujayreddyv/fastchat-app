import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from .database import Base


class UserOnline(Base):
    """Model for tracking online users"""
    __tablename__ = "users_online"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    display_name = Column(Text, nullable=False)
    last_seen = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
