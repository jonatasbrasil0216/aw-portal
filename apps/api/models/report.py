from sqlalchemy import Column, Integer, String, Float, DateTime, Date, ForeignKey, func
from sqlalchemy.orm import relationship
from database import Base


class ReportSession(Base):
    __tablename__ = "report_sessions"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    quarter = Column(String, nullable=False)
    report_date = Column(Date, nullable=False)
    created_at = Column(DateTime, default=func.now())
    sacs_pdf_path = Column(String, nullable=True)
    tcc_pdf_path = Column(String, nullable=True)

    client = relationship("Client", back_populates="report_sessions")
    balance_entries = relationship("BalanceEntry", back_populates="session", cascade="all, delete-orphan")


class BalanceEntry(Base):
    __tablename__ = "balance_entries"

    id = Column(Integer, primary_key=True, index=True)
    report_session_id = Column(Integer, ForeignKey("report_sessions.id"), nullable=False)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)
    liability_id = Column(Integer, ForeignKey("liabilities.id"), nullable=True)
    field_key = Column(String, nullable=False)
    balance = Column(Float, nullable=False)
    last_known_balance = Column(Float, nullable=True)

    session = relationship("ReportSession", back_populates="balance_entries")
    account = relationship("Account", back_populates="balance_entries")
    liability = relationship("Liability", back_populates="balance_entries")
