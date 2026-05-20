from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime


class ReportSessionCreate(BaseModel):
    quarter: str
    report_date: date


class ReportSessionOut(BaseModel):
    id: int
    client_id: int
    quarter: str
    report_date: date
    created_at: datetime
    has_sacs_pdf: bool
    has_tcc_pdf: bool

    model_config = {"from_attributes": True}


class BalanceEntryIn(BaseModel):
    account_id: Optional[int] = None
    liability_id: Optional[int] = None
    field_key: str
    balance: float
    last_known_balance: Optional[float] = None


class BalanceEntryOut(BalanceEntryIn):
    id: int
    report_session_id: int

    model_config = {"from_attributes": True}


class BalancesUpsert(BaseModel):
    entries: list[BalanceEntryIn]


class CalculationsOut(BaseModel):
    monthly_inflow: float
    monthly_outflow: float
    monthly_excess: float
    private_reserve_balance: float
    private_reserve_target: float
    schwab_balance: float
    c1_retirement_total: float
    c2_retirement_total: float
    non_retirement_total: float
    trust_value: float
    grand_total_net_worth: float
    liabilities_total: float


class SessionDetail(ReportSessionOut):
    balance_entries: list[BalanceEntryOut]

    model_config = {"from_attributes": True}


class ReportHistorySummary(BaseModel):
    id: int
    client_id: int
    client_name: str
    quarter: str
    report_date: date
    created_at: datetime
    has_sacs_pdf: bool
    has_tcc_pdf: bool

    model_config = {"from_attributes": True}
