from fastapi import APIRouter, HTTPException
from ..metrics import metrics
from uuid import UUID

router = APIRouter(prefix="/metrics", tags=["metrics"])


@router.get("/")
async def get_metrics():
    """Get current application metrics"""
    try:
        return metrics.get_current_stats()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving metrics: {str(e)}")


@router.get("/user/{user_id}")
async def get_user_metrics(user_id: UUID):
    """Get metrics for a specific user"""
    try:
        return metrics.get_user_stats(user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving user metrics: {str(e)}")


@router.get("/hourly")
async def get_hourly_metrics(hours: int = 24):
    """Get hourly metrics for the last N hours"""
    try:
        if hours < 1 or hours > 168:  # Max 1 week
            raise HTTPException(status_code=400, detail="Hours must be between 1 and 168")
        return metrics.get_hourly_stats(hours)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving hourly metrics: {str(e)}")


@router.get("/daily")
async def get_daily_metrics(days: int = 7):
    """Get daily metrics for the last N days"""
    try:
        if days < 1 or days > 30:  # Max 1 month
            raise HTTPException(status_code=400, detail="Days must be between 1 and 30")
        return metrics.get_daily_stats(days)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving daily metrics: {str(e)}")


@router.post("/reset")
async def reset_metrics():
    """Reset all metrics (admin only)"""
    try:
        metrics.reset_stats()
        return {"message": "Metrics reset successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error resetting metrics: {str(e)}")
