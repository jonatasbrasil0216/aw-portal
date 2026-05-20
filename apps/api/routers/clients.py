from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from database import get_db
from models.client import Client, Account, Liability
from models.report import ReportSession
from schemas.client import (
    ClientCreate, ClientUpdate, ClientSummary, ClientDetail,
    AccountCreate, AccountOut, LiabilityCreate, LiabilityOut,
    ClientC1Out, ClientC2Out,
)

router = APIRouter()


def _build_display_name(client: Client) -> str:
    if client.c2_first:
        return f"{client.c1_first} & {client.c2_first} {client.c1_last}"
    return f"{client.c1_first} {client.c1_last}"


def _build_initials(client: Client) -> str:
    if client.c2_first:
        return f"{client.c1_first[0]}{client.c2_first[0]}"
    return f"{client.c1_first[0]}{client.c1_last[0]}"


def _client_summary(client: Client, db: Session) -> dict:
    last_session = (
        db.query(ReportSession)
        .filter(ReportSession.client_id == client.id)
        .order_by(desc(ReportSession.report_date))
        .first()
    )
    return {
        "id": client.id,
        "display_name": _build_display_name(client),
        "initials": _build_initials(client),
        "is_married": client.c2_first is not None,
        "monthly_inflow": client.monthly_inflow,
        "monthly_outflow": client.monthly_outflow,
        "account_count": len([a for a in client.accounts if a.is_active]),
        "last_report_date": str(last_session.report_date) if last_session else None,
        "last_report_quarter": last_session.quarter if last_session else None,
    }


@router.get("/clients", response_model=list[ClientSummary])
def list_clients(db: Session = Depends(get_db)):
    clients = db.query(Client).all()
    return [_client_summary(c, db) for c in clients]


@router.post("/clients", response_model=ClientDetail, status_code=201)
def create_client(data: ClientCreate, db: Session = Depends(get_db)):
    client = Client(**data.model_dump())
    db.add(client)
    db.commit()
    db.refresh(client)
    return _client_detail(client, db)


@router.get("/clients/{client_id}", response_model=ClientDetail)
def get_client(client_id: int, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return _client_detail(client, db)


@router.put("/clients/{client_id}", response_model=ClientDetail)
def update_client(client_id: int, data: ClientUpdate, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(client, field, value)
    db.commit()
    db.refresh(client)
    return _client_detail(client, db)


def _client_detail(client: Client, db: Session) -> dict:
    summary = _client_summary(client, db)
    summary["c1"] = ClientC1Out(
        first=client.c1_first,
        last=client.c1_last,
        dob=client.c1_dob,
        ssn_last4=client.c1_ssn_last4,
    )
    summary["c2"] = (
        ClientC2Out(
            first=client.c2_first,
            last=client.c2_last,
            dob=client.c2_dob,
            ssn_last4=client.c2_ssn_last4,
        )
        if client.c2_first
        else None
    )
    summary["reserve_target_months"] = client.reserve_target_months
    summary["accounts"] = client.accounts
    summary["liabilities"] = client.liabilities
    return summary


# ── Accounts ──────────────────────────────────────────────────────────────────

@router.post("/clients/{client_id}/accounts", response_model=AccountOut, status_code=201)
def add_account(client_id: int, data: AccountCreate, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    account = Account(client_id=client_id, **data.model_dump())
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


@router.delete("/clients/{client_id}/accounts/{account_id}", status_code=204)
def delete_account(client_id: int, account_id: int, db: Session = Depends(get_db)):
    account = db.query(Account).filter(
        Account.id == account_id, Account.client_id == client_id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    db.delete(account)
    db.commit()


# ── Liabilities ───────────────────────────────────────────────────────────────

@router.post("/clients/{client_id}/liabilities", response_model=LiabilityOut, status_code=201)
def add_liability(client_id: int, data: LiabilityCreate, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    liability = Liability(client_id=client_id, **data.model_dump())
    db.add(liability)
    db.commit()
    db.refresh(liability)
    return liability


@router.delete("/clients/{client_id}/liabilities/{liability_id}", status_code=204)
def delete_liability(client_id: int, liability_id: int, db: Session = Depends(get_db)):
    liability = db.query(Liability).filter(
        Liability.id == liability_id, Liability.client_id == client_id
    ).first()
    if not liability:
        raise HTTPException(status_code=404, detail="Liability not found")
    db.delete(liability)
    db.commit()
