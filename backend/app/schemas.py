from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator
from uuid import UUID


class HeartbeatRequest(BaseModel):
    """Request schema for heartbeat endpoint"""
    display_name: str = Field(..., min_length=1, max_length=100, description="User's display name")
    user_id: Optional[str] = Field(None, description="Optional user ID for validation")
    
    @field_validator('user_id')
    @classmethod
    def validate_user_id(cls, v):
        if v is not None:
            try:
                UUID(v)
            except ValueError:
                raise ValueError('user_id must be a valid UUID')
        return v
    
    model_config = {"from_attributes": True}


class UserOnlineResponse(BaseModel):
    """Response schema for online users"""
    id: UUID
    user_id: Optional[UUID] = None
    display_name: str
    last_seen: datetime
    status: str = "online"

    model_config = {"from_attributes": True}


class OnlineUsersResponse(BaseModel):
    """Response schema for online users list"""
    users: List[UserOnlineResponse]
    count: int
