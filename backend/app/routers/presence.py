from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..schemas import HeartbeatRequest, UserOnlineResponse, OnlineUsersResponse
from ..services.presence import presence_service

router = APIRouter(prefix="/presence", tags=["presence"])


@router.post("/heartbeat", response_model=UserOnlineResponse)
def heartbeat(
    request: HeartbeatRequest,
    db: Session = Depends(get_db)
):
    """Update user's last seen timestamp"""
    try:
        return presence_service.heartbeat(db, request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update heartbeat: {str(e)}")


@router.get("/online", response_model=OnlineUsersResponse)
def get_online_users(db: Session = Depends(get_db)):
    """Get list of users active in the last 30 seconds"""
    try:
        users = presence_service.get_online_users(db)
        return OnlineUsersResponse(users=users, count=len(users))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get online users: {str(e)}")


@router.delete("/cleanup")
def cleanup_stale_users(db: Session = Depends(get_db)):
    """Manually trigger cleanup of stale user records"""
    try:
        deleted_count = presence_service.prune_stale_users(db)
        return {"message": f"Cleaned up {deleted_count} stale user records"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to cleanup stale users: {str(e)}")
