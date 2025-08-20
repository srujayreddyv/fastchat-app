import os
import asyncio
from datetime import datetime, timedelta
from typing import List
from sqlalchemy.orm import Session
from sqlalchemy import and_
from ..models import UserOnline
from ..schemas import HeartbeatRequest, UserOnlineResponse


class PresenceService:
    """Service for managing user presence"""
    
    def __init__(self):
        # Get configurable thresholds from environment variables
        self.online_threshold_seconds = int(os.getenv("ONLINE_THRESHOLD_SECONDS", "30"))
        self.reaper_interval_seconds = int(os.getenv("REAPER_INTERVAL_SECONDS", "60"))
        self._reaper_task = None
    
    async def start_reaper_task(self):
        """Start the background reaper task"""
        if self._reaper_task is None:
            self._reaper_task = asyncio.create_task(self._reaper_loop())
    
    async def stop_reaper_task(self):
        """Stop the background reaper task"""
        if self._reaper_task:
            self._reaper_task.cancel()
            try:
                await self._reaper_task
            except asyncio.CancelledError:
                pass
            self._reaper_task = None
    
    async def _reaper_loop(self):
        """Background task to prune stale user records"""
        while True:
            try:
                await asyncio.sleep(self.reaper_interval_seconds)
                # Note: This would need to be called with a database session
                # In a real implementation, you'd inject the session or use a connection pool
                pass
            except asyncio.CancelledError:
                break
    
    def heartbeat(self, db: Session, request: HeartbeatRequest) -> UserOnlineResponse:
        """Update user's last seen timestamp"""
        # Check if user already exists
        user = db.query(UserOnline).filter(
            UserOnline.display_name == request.display_name
        ).first()
        
        if user:
            # Update existing user's last_seen
            user.last_seen = datetime.utcnow()
        else:
            # Create new user
            user = UserOnline(
                display_name=request.display_name,
                last_seen=datetime.utcnow()
            )
            db.add(user)
        
        db.commit()
        db.refresh(user)
        
        return UserOnlineResponse.from_orm(user)
    
    def get_online_users(self, db: Session) -> List[UserOnlineResponse]:
        """Get users active within the threshold period"""
        threshold_time = datetime.utcnow() - timedelta(seconds=self.online_threshold_seconds)
        
        users = db.query(UserOnline).filter(
            UserOnline.last_seen >= threshold_time
        ).order_by(UserOnline.last_seen.desc()).all()
        
        return [UserOnlineResponse.from_orm(user) for user in users]
    
    def prune_stale_users(self, db: Session) -> int:
        """Remove users who haven't been seen recently"""
        threshold_time = datetime.utcnow() - timedelta(seconds=self.online_threshold_seconds)
        
        deleted_count = db.query(UserOnline).filter(
            UserOnline.last_seen < threshold_time
        ).delete()
        
        db.commit()
        return deleted_count


# Global instance
presence_service = PresenceService()
