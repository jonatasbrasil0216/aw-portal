"""Standalone calculation endpoint (also called internally by reports router)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from schemas.report import CalculationsOut

router = APIRouter()


@router.post("/sessions/{session_id}/calculate", response_model=CalculationsOut)
def calculate_endpoint(session_id: int, db: Session = Depends(get_db)):
    """Alias — calculation logic lives in routers/reports.py to avoid circular imports."""
    from routers.reports import calculate
    return calculate(session_id, db)
