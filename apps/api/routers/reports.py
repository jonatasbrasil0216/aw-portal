from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc
from database import get_db
from models.client import Client, Account, Liability
from models.client import AccountCategoryEnum
from models.report import ReportSession, BalanceEntry
from schemas.report import (
    ReportSessionCreate, ReportSessionOut, BalancesUpsert,
    BalanceEntryOut, CalculationsOut, SessionDetail, ReportHistorySummary,
)
from services.calculator import calc_all
from services.pdf_generator import generate_sacs_pdf, generate_tcc_pdf
import os

router = APIRouter()

PDF_STORAGE_PATH = os.getenv("PDF_STORAGE_PATH", "./generated_pdfs")


# ── Sessions ──────────────────────────────────────────────────────────────────

@router.get("/sessions", response_model=list[ReportHistorySummary])
def list_all_sessions(db: Session = Depends(get_db)):
    from routers.clients import _build_display_name
    sessions = (
        db.query(ReportSession)
        .order_by(desc(ReportSession.report_date), desc(ReportSession.created_at))
        .all()
    )
    return [
        {
            **_session_out(s),
            "client_name": _build_display_name(s.client) if s.client else "Unknown",
        }
        for s in sessions
    ]


@router.get("/clients/{client_id}/sessions", response_model=list[ReportSessionOut])
def list_sessions(client_id: int, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    sessions = (
        db.query(ReportSession)
        .filter(ReportSession.client_id == client_id)
        .order_by(desc(ReportSession.report_date))
        .all()
    )
    return [_session_out(s) for s in sessions]


@router.post("/clients/{client_id}/sessions", response_model=ReportSessionOut, status_code=201)
def create_session(client_id: int, data: ReportSessionCreate, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    session = ReportSession(
        client_id=client_id,
        quarter=data.quarter,
        report_date=data.report_date,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return _session_out(session)


@router.get("/sessions/{session_id}", response_model=SessionDetail)
def get_session(session_id: int, db: Session = Depends(get_db)):
    session = db.query(ReportSession).filter(ReportSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    result = _session_out(session)
    result["balance_entries"] = session.balance_entries
    return result


@router.put("/sessions/{session_id}/balances", response_model=list[BalanceEntryOut])
def upsert_balances(session_id: int, data: BalancesUpsert, db: Session = Depends(get_db)):
    session = db.query(ReportSession).filter(ReportSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    for entry_in in data.entries:
        existing = db.query(BalanceEntry).filter(
            BalanceEntry.report_session_id == session_id,
            BalanceEntry.field_key == entry_in.field_key,
        ).first()
        if existing:
            existing.balance = entry_in.balance
            if entry_in.last_known_balance is not None:
                existing.last_known_balance = entry_in.last_known_balance
            existing.account_id = entry_in.account_id
            existing.liability_id = entry_in.liability_id
        else:
            new_entry = BalanceEntry(
                report_session_id=session_id,
                **entry_in.model_dump(),
            )
            db.add(new_entry)

    db.commit()
    entries = db.query(BalanceEntry).filter(BalanceEntry.report_session_id == session_id).all()
    return entries


@router.post("/sessions/{session_id}/calculate", response_model=CalculationsOut)
def calculate(session_id: int, db: Session = Depends(get_db)):
    session = db.query(ReportSession).filter(ReportSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    client = session.client
    entries = {e.field_key: e.balance for e in session.balance_entries}
    accounts = {a.id: a for a in client.accounts}

    c1_ret, c2_ret, non_ret = [], [], []
    for entry in session.balance_entries:
        if entry.account_id and entry.account_id in accounts:
            acct = accounts[entry.account_id]
            if acct.account_category == AccountCategoryEnum.retirement:
                if acct.owner == "c1":
                    c1_ret.append(entry.balance)
                elif acct.owner == "c2":
                    c2_ret.append(entry.balance)
                else:
                    c1_ret.append(entry.balance)
            elif acct.account_category == AccountCategoryEnum.non_retirement:
                # Rebecca's rule (24:28): trust excluded from non-retirement total
                non_ret.append(entry.balance)

    liability_balances = []
    for entry in session.balance_entries:
        if entry.liability_id:
            liability_balances.append(entry.balance)

    session_data = {
        "monthly_inflow": client.monthly_inflow,
        "monthly_outflow": client.monthly_outflow,
        "reserve_target_months": client.reserve_target_months,
        "private_reserve_balance": entries.get("private_reserve", 0.0),
        "schwab_balance": entries.get("schwab_investment", 0.0),
        "c1_retirement_balances": c1_ret,
        "c2_retirement_balances": c2_ret,
        "non_retirement_balances": non_ret,
        "trust_value": entries.get("zillow_zestimate", 0.0),
        "liability_balances": liability_balances,
    }

    return calc_all(session_data)


# ── PDF Generation ────────────────────────────────────────────────────────────

@router.post("/sessions/{session_id}/generate/sacs")
def generate_sacs(session_id: int, db: Session = Depends(get_db)):
    try:
        session, client, calcs = _prepare_for_pdf(session_id, db)
        pdf_bytes = generate_sacs_pdf(client, session, session.balance_entries, calcs)
        os.makedirs(PDF_STORAGE_PATH, exist_ok=True)
        path = os.path.join(PDF_STORAGE_PATH, f"sacs_{session_id}.pdf")
        with open(path, "wb") as f:
            f.write(pdf_bytes)
        session.sacs_pdf_path = path
        db.commit()
        return {"ok": True, "session_id": session_id}
    except HTTPException:
        raise
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"SACS generation failed: {e}")


@router.post("/sessions/{session_id}/generate/tcc")
def generate_tcc(session_id: int, db: Session = Depends(get_db)):
    try:
        session, client, calcs = _prepare_for_pdf(session_id, db)
        pdf_bytes = generate_tcc_pdf(client, session, session.balance_entries, calcs)
        os.makedirs(PDF_STORAGE_PATH, exist_ok=True)
        path = os.path.join(PDF_STORAGE_PATH, f"tcc_{session_id}.pdf")
        with open(path, "wb") as f:
            f.write(pdf_bytes)
        session.tcc_pdf_path = path
        db.commit()
        return {"ok": True, "session_id": session_id}
    except HTTPException:
        raise
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"TCC generation failed: {e}")


@router.get("/sessions/{session_id}/download/sacs")
def download_sacs(session_id: int, db: Session = Depends(get_db)):
    session = db.query(ReportSession).filter(ReportSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if not session.sacs_pdf_path or not os.path.exists(session.sacs_pdf_path):
        raise HTTPException(status_code=404, detail="SACS PDF not yet generated")
    return FileResponse(session.sacs_pdf_path, media_type="application/pdf",
                        filename=f"sacs_{session_id}.pdf")


@router.get("/sessions/{session_id}/download/tcc")
def download_tcc(session_id: int, db: Session = Depends(get_db)):
    session = db.query(ReportSession).filter(ReportSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if not session.tcc_pdf_path or not os.path.exists(session.tcc_pdf_path):
        raise HTTPException(status_code=404, detail="TCC PDF not yet generated")
    return FileResponse(session.tcc_pdf_path, media_type="application/pdf",
                        filename=f"tcc_{session_id}.pdf")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _session_out(session: ReportSession) -> dict:
    return {
        "id": session.id,
        "client_id": session.client_id,
        "quarter": session.quarter,
        "report_date": session.report_date,
        "created_at": session.created_at,
        "has_sacs_pdf": session.sacs_pdf_path is not None,
        "has_tcc_pdf": session.tcc_pdf_path is not None,
    }


def _prepare_for_pdf(session_id: int, db: Session):
    session = db.query(ReportSession).filter(ReportSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    client = session.client
    entries_map = {e.field_key: e.balance for e in session.balance_entries}
    accounts    = {a.id: a for a in client.accounts}

    c1_ret, c2_ret, non_ret = [], [], []
    for entry in session.balance_entries:
        if entry.account_id and entry.account_id in accounts:
            acct = accounts[entry.account_id]
            if acct.account_category == AccountCategoryEnum.retirement:
                (c2_ret if acct.owner == "c2" else c1_ret).append(entry.balance)
            elif acct.account_category == AccountCategoryEnum.non_retirement:
                non_ret.append(entry.balance)

    liab_balances = [e.balance for e in session.balance_entries if e.liability_id]

    calcs = calc_all({
        "monthly_inflow":          client.monthly_inflow,
        "monthly_outflow":         client.monthly_outflow,
        "reserve_target_months":   client.reserve_target_months,
        "private_reserve_balance": entries_map.get("private_reserve", 0.0),
        "schwab_balance":          entries_map.get("schwab_investment", 0.0),
        "c1_retirement_balances":  c1_ret,
        "c2_retirement_balances":  c2_ret,
        "non_retirement_balances": non_ret,
        "trust_value":             entries_map.get("zillow_zestimate", 0.0),
        "liability_balances":      liab_balances,
    })
    return session, client, calcs
