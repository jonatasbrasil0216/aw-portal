from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime


class AccountBase(BaseModel):
    owner: str
    account_type: str
    account_category: str
    account_number_last4: Optional[str] = None
    sort_order: int = 0


class AccountCreate(AccountBase):
    pass


class AccountOut(AccountBase):
    id: int
    is_active: bool

    model_config = {"from_attributes": True}


class LiabilityBase(BaseModel):
    liability_type: str
    interest_rate: str
    sort_order: int = 0


class LiabilityCreate(LiabilityBase):
    pass


class LiabilityOut(LiabilityBase):
    id: int

    model_config = {"from_attributes": True}


class ClientCreate(BaseModel):
    c1_first: str
    c1_last: str
    c1_dob: str
    c1_ssn_last4: str

    c2_first: Optional[str] = None
    c2_last: Optional[str] = None
    c2_dob: Optional[str] = None
    c2_ssn_last4: Optional[str] = None

    monthly_inflow: float
    monthly_outflow: float
    reserve_target_months: int = 6

    @field_validator("c1_ssn_last4", "c2_ssn_last4", mode="before")
    @classmethod
    def validate_ssn(cls, v):
        if v is not None and len(str(v)) > 4:
            raise ValueError("SSN last4 must be 4 characters max")
        return v


class ClientUpdate(BaseModel):
    c1_first: Optional[str] = None
    c1_last: Optional[str] = None
    c1_dob: Optional[str] = None
    c2_first: Optional[str] = None
    c2_last: Optional[str] = None
    c2_dob: Optional[str] = None
    monthly_inflow: Optional[float] = None
    monthly_outflow: Optional[float] = None
    reserve_target_months: Optional[int] = None


class ClientSummary(BaseModel):
    id: int
    display_name: str
    initials: str
    is_married: bool
    monthly_inflow: float
    monthly_outflow: float
    account_count: int
    last_report_date: Optional[str] = None
    last_report_quarter: Optional[str] = None

    model_config = {"from_attributes": True}


class ClientC1Out(BaseModel):
    first: str
    last: str
    dob: str
    ssn_last4: str


class ClientC2Out(BaseModel):
    first: str
    last: str
    dob: str
    ssn_last4: str


class ClientDetail(ClientSummary):
    c1: ClientC1Out
    c2: Optional[ClientC2Out] = None
    reserve_target_months: int
    accounts: list[AccountOut]
    liabilities: list[LiabilityOut]

    model_config = {"from_attributes": True}
