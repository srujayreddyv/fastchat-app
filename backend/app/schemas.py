from datetime import datetime
from typing import List
from pydantic import BaseModel, Field
from uuid import UUID


class HeartbeatRequest(BaseModel):
    """Request schema for heartbeat endpoint"""
    display_name: str = Field(..., min_length=1, max_length=100, description="User's display name")


class UserOnlineResponse(BaseModel):
    """Response schema for online users"""
    id: UUID
    display_name: str
    last_seen: datetime

    class Config:
        from_attributes = True


class OnlineUsersResponse(BaseModel):
    """Response schema for online users list"""
    users: List[UserOnlineResponse]
    count: int
