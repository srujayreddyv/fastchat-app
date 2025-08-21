from fastapi import APIRouter, HTTPException
from ..metrics import metrics
from uuid import UUID
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/metrics", tags=["metrics"])


@router.get("/")
async def get_metrics():
    """Get current application metrics"""
    try:
        return metrics.get_current_stats()
    except (ValueError, KeyError) as e:
        logger.error(f"Data error in metrics: {e}")
        raise HTTPException(status_code=500, detail="Internal metrics data error")
    except Exception as e:
        logger.error(f"Unexpected error retrieving metrics: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/user/{user_id}")
async def get_user_metrics(user_id: UUID):
    """Get metrics for a specific user"""
    try:
        return metrics.get_user_stats(user_id)
    except (ValueError, KeyError) as e:
        logger.error(f"Data error in user metrics for {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal user metrics data error")
    except Exception as e:
        logger.error(f"Unexpected error retrieving user metrics for {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/hourly")
async def get_hourly_metrics(hours: int = 24):
    """Get hourly metrics for the last N hours"""
    try:
        if hours < 1 or hours > 168:  # Max 1 week
            raise HTTPException(status_code=400, detail="Hours must be between 1 and 168")
        return metrics.get_hourly_stats(hours)
    except HTTPException:
        raise
    except (ValueError, KeyError) as e:
        logger.error(f"Data error in hourly metrics: {e}")
        raise HTTPException(status_code=500, detail="Internal hourly metrics data error")
    except Exception as e:
        logger.error(f"Unexpected error retrieving hourly metrics: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/daily")
async def get_daily_metrics(days: int = 7):
    """Get daily metrics for the last N days"""
    try:
        if days < 1 or days > 30:  # Max 1 month
            raise HTTPException(status_code=400, detail="Days must be between 1 and 30")
        return metrics.get_daily_stats(days)
    except HTTPException:
        raise
    except (ValueError, KeyError) as e:
        logger.error(f"Data error in daily metrics: {e}")
        raise HTTPException(status_code=500, detail="Internal daily metrics data error")
    except Exception as e:
        logger.error(f"Unexpected error retrieving daily metrics: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/reset")
async def reset_metrics():
    """Reset all metrics (admin only)"""
    try:
        metrics.reset_stats()
        return {"message": "Metrics reset successfully"}
    except (ValueError, KeyError) as e:
        logger.error(f"Data error resetting metrics: {e}")
        raise HTTPException(status_code=500, detail="Internal metrics reset error")
    except Exception as e:
        logger.error(f"Unexpected error resetting metrics: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
