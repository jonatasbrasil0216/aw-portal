"""Integration tests using FastAPI TestClient."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Use in-memory DB for tests
TEST_DB_URL = "sqlite:///./test_portal.db"
os.environ["DATABASE_URL"] = TEST_DB_URL
os.environ["CORS_ORIGINS"] = "http://localhost:5173"

from database import Base, get_db
from main import app

engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    return TestClient(app)


# ── Client CRUD ───────────────────────────────────────────────────────────────

def test_create_and_list_client(client):
    payload = {
        "c1_first": "James", "c1_last": "Anderson",
        "c1_dob": "1962-04-15", "c1_ssn_last4": "4821",
        "monthly_inflow": 15000.0, "monthly_outflow": 11000.0,
    }
    res = client.post("/api/clients", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["display_name"] == "James Anderson"
    assert data["monthly_inflow"] == 15000.0

    res = client.get("/api/clients")
    assert res.status_code == 200
    assert len(res.json()) == 1


def test_create_married_client(client):
    payload = {
        "c1_first": "Robert", "c1_last": "Chen",
        "c1_dob": "1958-11-03", "c1_ssn_last4": "2293",
        "c2_first": "Linda", "c2_last": "Chen",
        "c2_dob": "1960-07-18", "c2_ssn_last4": "8841",
        "monthly_inflow": 22000.0, "monthly_outflow": 14000.0,
    }
    res = client.post("/api/clients", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["is_married"] is True
    assert "Linda" in data["display_name"]


def test_ssn_not_in_list_endpoint(client):
    """SSN must not appear in list endpoint. (compliance)"""
    payload = {
        "c1_first": "Margaret", "c1_last": "Morrison",
        "c1_dob": "1955-03-28", "c1_ssn_last4": "5519",
        "monthly_inflow": 18500.0, "monthly_outflow": 10500.0,
    }
    client.post("/api/clients", json=payload)
    res = client.get("/api/clients")
    raw = res.text
    assert "5519" not in raw
    assert "ssn" not in raw.lower() or "ssn_last4" not in raw


# ── Full workflow: client → accounts → session → balances → calculate ─────────

def _create_full_client(client):
    payload = {
        "c1_first": "James", "c1_last": "Anderson",
        "c1_dob": "1962-04-15", "c1_ssn_last4": "4821",
        "c2_first": "Patricia", "c2_last": "Anderson",
        "c2_dob": "1964-09-22", "c2_ssn_last4": "6374",
        "monthly_inflow": 15000.0, "monthly_outflow": 11000.0,
        "reserve_target_months": 6,
    }
    res = client.post("/api/clients", json=payload)
    assert res.status_code == 201
    return res.json()["id"]


def test_add_account(client):
    cid = _create_full_client(client)
    res = client.post(f"/api/clients/{cid}/accounts", json={
        "owner": "c1", "account_type": "ira",
        "account_category": "retirement", "account_number_last4": "7731", "sort_order": 1,
    })
    assert res.status_code == 201
    assert res.json()["account_type"] == "ira"


def test_add_liability(client):
    cid = _create_full_client(client)
    res = client.post(f"/api/clients/{cid}/liabilities", json={
        "liability_type": "Mortgage", "interest_rate": "3.5%", "sort_order": 1,
    })
    assert res.status_code == 201
    assert res.json()["liability_type"] == "Mortgage"


def test_full_calculation_workflow(client):
    cid = _create_full_client(client)

    # Add accounts
    c1_ira = client.post(f"/api/clients/{cid}/accounts", json={
        "owner": "c1", "account_type": "ira",
        "account_category": "retirement", "account_number_last4": "7731", "sort_order": 1,
    }).json()["id"]
    c2_ira = client.post(f"/api/clients/{cid}/accounts", json={
        "owner": "c2", "account_type": "ira",
        "account_category": "retirement", "account_number_last4": "5512", "sort_order": 2,
    }).json()["id"]
    brokerage = client.post(f"/api/clients/{cid}/accounts", json={
        "owner": "joint", "account_type": "brokerage",
        "account_category": "non_retirement", "account_number_last4": "8823", "sort_order": 3,
    }).json()["id"]

    # Add liability
    mortgage = client.post(f"/api/clients/{cid}/liabilities", json={
        "liability_type": "Mortgage", "interest_rate": "3.5%", "sort_order": 1,
    }).json()["id"]

    # Create session
    import datetime
    session_res = client.post(f"/api/clients/{cid}/sessions", json={
        "quarter": "Q2 2026",
        "report_date": str(datetime.date.today()),
    })
    assert session_res.status_code == 201
    sid = session_res.json()["id"]

    # Submit balances
    balances_payload = {"entries": [
        {"field_key": "private_reserve", "balance": 55000.0},
        {"field_key": "schwab_investment", "balance": 120000.0},
        {"field_key": f"account_{c1_ira}", "account_id": c1_ira, "balance": 180000.0},
        {"field_key": f"account_{c2_ira}", "account_id": c2_ira, "balance": 130000.0},
        {"field_key": f"account_{brokerage}", "account_id": brokerage, "balance": 200000.0},
        {"field_key": "zillow_zestimate", "balance": 450000.0},
        {"field_key": f"liability_{mortgage}", "liability_id": mortgage, "balance": 320000.0},
    ]}
    res = client.put(f"/api/sessions/{sid}/balances", json=balances_payload)
    assert res.status_code == 200

    # Run calculations
    res = client.post(f"/api/sessions/{sid}/calculate")
    assert res.status_code == 200
    calcs = res.json()

    assert calcs["monthly_excess"] == 4000.0
    assert calcs["private_reserve_target"] == 66000.0
    assert calcs["c1_retirement_total"] == 180000.0
    assert calcs["c2_retirement_total"] == 130000.0
    assert calcs["non_retirement_total"] == 200000.0
    assert calcs["trust_value"] == 450000.0
    assert calcs["grand_total_net_worth"] == 960000.0
    assert calcs["liabilities_total"] == 320000.0

    # Business rule: liabilities are NOT in grand total (Rebecca, 26:15)
    assert calcs["grand_total_net_worth"] != calcs["grand_total_net_worth"] - calcs["liabilities_total"]
    assert calcs["grand_total_net_worth"] == (
        calcs["c1_retirement_total"]
        + calcs["c2_retirement_total"]
        + calcs["non_retirement_total"]
        + calcs["trust_value"]
    )
