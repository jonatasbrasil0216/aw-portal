from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Enum, func
from sqlalchemy.orm import relationship
from database import Base
import enum


class OwnerEnum(str, enum.Enum):
    c1 = "c1"
    c2 = "c2"
    joint = "joint"


class AccountTypeEnum(str, enum.Enum):
    ira = "ira"
    roth_ira = "roth_ira"
    k401 = "401k"
    pension = "pension"
    brokerage = "brokerage"
    individual_brokerage = "individual_brokerage"
    trust = "trust"
    checking = "checking"
    savings = "savings"


class AccountCategoryEnum(str, enum.Enum):
    retirement = "retirement"
    non_retirement = "non_retirement"
    trust = "trust"
    cash = "cash"


class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    c1_first = Column(String, nullable=False)
    c1_last = Column(String, nullable=False)
    c1_dob = Column(String, nullable=False)
    c1_ssn_last4 = Column(String(4), nullable=False)

    c2_first = Column(String, nullable=True)
    c2_last = Column(String, nullable=True)
    c2_dob = Column(String, nullable=True)
    c2_ssn_last4 = Column(String(4), nullable=True)

    monthly_inflow = Column(Float, nullable=False)
    monthly_outflow = Column(Float, nullable=False)
    reserve_target_months = Column(Integer, default=6)

    accounts = relationship("Account", back_populates="client", cascade="all, delete-orphan")
    liabilities = relationship("Liability", back_populates="client", cascade="all, delete-orphan")
    report_sessions = relationship("ReportSession", back_populates="client", cascade="all, delete-orphan")


class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    owner = Column(Enum(OwnerEnum), nullable=False)
    account_type = Column(Enum(AccountTypeEnum), nullable=False)
    account_category = Column(Enum(AccountCategoryEnum), nullable=False)
    account_number_last4 = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)

    client = relationship("Client", back_populates="accounts")
    balance_entries = relationship("BalanceEntry", back_populates="account")


class Liability(Base):
    __tablename__ = "liabilities"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    liability_type = Column(String, nullable=False)
    interest_rate = Column(String, nullable=False)
    sort_order = Column(Integer, default=0)

    client = relationship("Client", back_populates="liabilities")
    balance_entries = relationship("BalanceEntry", back_populates="liability")
