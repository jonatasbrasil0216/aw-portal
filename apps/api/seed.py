"""Seed script — populates 3 demo clients with accounts and liabilities."""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import SessionLocal, create_tables
from models.client import Client, Account, Liability, OwnerEnum, AccountTypeEnum, AccountCategoryEnum


def seed():
    create_tables()
    db = SessionLocal()

    if db.query(Client).count() > 0:
        print("Database already seeded. Skipping.")
        db.close()
        return

    # ── Client 1: Anderson Family (married, moderate complexity) ──────────────
    anderson = Client(
        c1_first="James", c1_last="Anderson", c1_dob="1962-04-15", c1_ssn_last4="4821",
        c2_first="Patricia", c2_last="Anderson", c2_dob="1964-09-22", c2_ssn_last4="6374",
        monthly_inflow=15000.0,
        monthly_outflow=11000.0,
        reserve_target_months=6,
    )
    db.add(anderson)
    db.flush()

    db.add_all([
        Account(client_id=anderson.id, owner=OwnerEnum.c1, account_type=AccountTypeEnum.ira,
                account_category=AccountCategoryEnum.retirement, account_number_last4="7731", sort_order=1),
        Account(client_id=anderson.id, owner=OwnerEnum.c1, account_type=AccountTypeEnum.roth_ira,
                account_category=AccountCategoryEnum.retirement, account_number_last4="2984", sort_order=2),
        Account(client_id=anderson.id, owner=OwnerEnum.c2, account_type=AccountTypeEnum.ira,
                account_category=AccountCategoryEnum.retirement, account_number_last4="5512", sort_order=3),
        Account(client_id=anderson.id, owner=OwnerEnum.joint, account_type=AccountTypeEnum.brokerage,
                account_category=AccountCategoryEnum.non_retirement, account_number_last4="8823", sort_order=4),
        Account(client_id=anderson.id, owner=OwnerEnum.joint, account_type=AccountTypeEnum.trust,
                account_category=AccountCategoryEnum.trust, account_number_last4=None,
                sort_order=5),
    ])
    db.add_all([
        Liability(client_id=anderson.id, liability_type="Mortgage", interest_rate="3.5%", sort_order=1),
        Liability(client_id=anderson.id, liability_type="Auto Loan", interest_rate="6.2%", sort_order=2),
    ])

    # ── Client 2: Chen Family (married, high complexity — 5 retirement accounts) ──
    chen = Client(
        c1_first="Robert", c1_last="Chen", c1_dob="1958-11-03", c1_ssn_last4="2293",
        c2_first="Linda", c2_last="Chen", c2_dob="1960-07-18", c2_ssn_last4="8841",
        monthly_inflow=22000.0,
        monthly_outflow=14000.0,
        reserve_target_months=6,
    )
    db.add(chen)
    db.flush()

    db.add_all([
        Account(client_id=chen.id, owner=OwnerEnum.c1, account_type=AccountTypeEnum.k401,
                account_category=AccountCategoryEnum.retirement, account_number_last4="1134", sort_order=1),
        Account(client_id=chen.id, owner=OwnerEnum.c1, account_type=AccountTypeEnum.ira,
                account_category=AccountCategoryEnum.retirement, account_number_last4="8871", sort_order=2),
        Account(client_id=chen.id, owner=OwnerEnum.c1, account_type=AccountTypeEnum.roth_ira,
                account_category=AccountCategoryEnum.retirement, account_number_last4="2211", sort_order=3),
        Account(client_id=chen.id, owner=OwnerEnum.c2, account_type=AccountTypeEnum.ira,
                account_category=AccountCategoryEnum.retirement, account_number_last4="4456", sort_order=4),
        Account(client_id=chen.id, owner=OwnerEnum.c2, account_type=AccountTypeEnum.roth_ira,
                account_category=AccountCategoryEnum.retirement, account_number_last4="7723", sort_order=5),
        Account(client_id=chen.id, owner=OwnerEnum.joint, account_type=AccountTypeEnum.brokerage,
                account_category=AccountCategoryEnum.non_retirement, account_number_last4="3312", sort_order=6),
        Account(client_id=chen.id, owner=OwnerEnum.c1, account_type=AccountTypeEnum.individual_brokerage,
                account_category=AccountCategoryEnum.non_retirement, account_number_last4="5589", sort_order=7),
        Account(client_id=chen.id, owner=OwnerEnum.joint, account_type=AccountTypeEnum.trust,
                account_category=AccountCategoryEnum.trust, account_number_last4=None, sort_order=8),
    ])
    db.add(Liability(client_id=chen.id, liability_type="Mortgage", interest_rate="3.1%", sort_order=1))

    # ── Client 3: Morrison (individual, max liabilities) ─────────────────────
    morrison = Client(
        c1_first="Margaret", c1_last="Morrison", c1_dob="1955-03-28", c1_ssn_last4="5519",
        monthly_inflow=18500.0,
        monthly_outflow=10500.0,
        reserve_target_months=6,
    )
    db.add(morrison)
    db.flush()

    db.add_all([
        Account(client_id=morrison.id, owner=OwnerEnum.c1, account_type=AccountTypeEnum.ira,
                account_category=AccountCategoryEnum.retirement, account_number_last4="3341", sort_order=1),
        Account(client_id=morrison.id, owner=OwnerEnum.c1, account_type=AccountTypeEnum.roth_ira,
                account_category=AccountCategoryEnum.retirement, account_number_last4="7756", sort_order=2),
        Account(client_id=morrison.id, owner=OwnerEnum.c1, account_type=AccountTypeEnum.pension,
                account_category=AccountCategoryEnum.retirement, account_number_last4=None, sort_order=3),
        Account(client_id=morrison.id, owner=OwnerEnum.c1, account_type=AccountTypeEnum.individual_brokerage,
                account_category=AccountCategoryEnum.non_retirement, account_number_last4="2298", sort_order=4),
        Account(client_id=morrison.id, owner=OwnerEnum.c1, account_type=AccountTypeEnum.trust,
                account_category=AccountCategoryEnum.trust, account_number_last4=None, sort_order=5),
    ])
    db.add_all([
        Liability(client_id=morrison.id, liability_type="Mortgage", interest_rate="4.0%", sort_order=1),
        Liability(client_id=morrison.id, liability_type="Auto Loan", interest_rate="5.5%", sort_order=2),
        Liability(client_id=morrison.id, liability_type="HELOC", interest_rate="7.2%", sort_order=3),
    ])

    db.commit()
    db.close()
    print("Seeded: 3 clients, accounts, and liabilities.")


if __name__ == "__main__":
    seed()
