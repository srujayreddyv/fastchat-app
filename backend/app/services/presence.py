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
        try:
            # Convert string user_id to UUID if provided
            user_id_uuid = None
            if request.user_id:
                try:
                    from uuid import UUID
                    user_id_uuid = UUID(request.user_id)
                except ValueError:
                    # If user_id is not a valid UUID, treat it as None
                    user_id_uuid = None
            
            # Check if user already exists by user_id if provided, otherwise by display_name
            if user_id_uuid:
                user = db.query(UserOnline).filter(
                    UserOnline.user_id == user_id_uuid
                ).first()
            else:
                user = db.query(UserOnline).filter(
                    UserOnline.display_name == request.display_name
                ).first()
            
            if user:
                # Update existing user's last_seen and user_id if not set
                user.last_seen = datetime.utcnow()
                if user_id_uuid and not user.user_id:
                    user.user_id = user_id_uuid
            else:
                # Create new user
                user = UserOnline(
                    user_id=user_id_uuid,
                    display_name=request.display_name,
                    last_seen=datetime.utcnow()
                )
                db.add(user)
            
            db.commit()
            db.refresh(user)
            
            return UserOnlineResponse.model_validate(user)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error in heartbeat: {e}")
            logger.error(f"Request data: {request}")
            raise
    
    def get_online_users(self, db: Session, exclude_user_id: str = None) -> List[UserOnlineResponse]:
        """Get users active within the threshold period"""
        threshold_time = datetime.utcnow() - timedelta(seconds=self.online_threshold_seconds)
        
        query = db.query(UserOnline).filter(
            UserOnline.last_seen >= threshold_time
        )
        
        # Exclude specific user if provided
        if exclude_user_id:
            try:
                from uuid import UUID
                exclude_uuid = UUID(exclude_user_id)
                query = query.filter(UserOnline.user_id != exclude_uuid)
            except ValueError:
                # If exclude_user_id is not a valid UUID, ignore the filter
                pass
        
        users = query.order_by(UserOnline.last_seen.desc()).all()
        
        return [UserOnlineResponse.model_validate(user) for user in users]
    
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
