"""
Pure calculation functions — no side effects, no DB access.
All business rules are sourced from client conversations and PRD.
"""


# ── SACS Calculations ─────────────────────────────────────────────────────────

def calc_monthly_excess(inflow: float, outflow: float) -> float:
    """Inflow minus Outflow = excess transferred to Private Reserve. (PRD spec)"""
    return inflow - outflow


def calc_private_reserve_target(monthly_outflow: float, months: int = 6) -> float:
    """Target = N months of expenses, default 6. (PRD spec)
    NOTE: Insurance deductibles are added to reserve target in V2.
    """
    return monthly_outflow * months


# ── TCC Calculations ──────────────────────────────────────────────────────────

def calc_retirement_total(balances: list[float]) -> float:
    """Sum of one client's retirement account balances."""
    return sum(balances)


def calc_non_retirement_total(balances: list[float]) -> float:
    """Sum of non-retirement accounts ONLY — trust is EXCLUDED.
    Rebecca's rule: 'the non-retirement total is only the accounts, not the trust' (24:28)
    Caller must pass only brokerage/individual_brokerage balances — never trust.
    """
    return sum(balances)


def calc_grand_total_net_worth(
    c1_retirement: float,
    c2_retirement: float,
    non_retirement: float,
    trust: float,
) -> float:
    """Grand Total = C1 Retirement + C2 Retirement + Non-Retirement + Trust.
    Liabilities are NEVER subtracted. Rebecca's rule: 'we do not subtract
    liabilities from their net worth' (26:15)
    """
    return c1_retirement + c2_retirement + non_retirement + trust


def calc_liabilities_total(balances: list[float]) -> float:
    """Sum of all liabilities — displayed separately, NOT subtracted from net worth.
    Rebecca's rule (26:15): liabilities shown separately below grand total.
    """
    return sum(balances)


def calc_all(session_data: dict) -> dict:
    """Master calculation function.

    Expected session_data keys:
        monthly_inflow, monthly_outflow, reserve_target_months,
        private_reserve_balance, schwab_balance,
        c1_retirement_balances: list[float],
        c2_retirement_balances: list[float],
        non_retirement_balances: list[float],
        trust_value: float,
        liability_balances: list[float]

    Returns all computed values needed by both SACS and TCC reports.
    """
    inflow = float(session_data.get("monthly_inflow", 0))
    outflow = float(session_data.get("monthly_outflow", 0))
    months = int(session_data.get("reserve_target_months", 6))

    private_reserve_balance = float(session_data.get("private_reserve_balance", 0))
    schwab_balance = float(session_data.get("schwab_balance", 0))

    c1_ret = [float(b) for b in session_data.get("c1_retirement_balances", [])]
    c2_ret = [float(b) for b in session_data.get("c2_retirement_balances", [])]
    non_ret = [float(b) for b in session_data.get("non_retirement_balances", [])]
    trust_value = float(session_data.get("trust_value", 0))
    liabilities = [float(b) for b in session_data.get("liability_balances", [])]

    c1_ret_total = calc_retirement_total(c1_ret)
    c2_ret_total = calc_retirement_total(c2_ret)
    non_ret_total = calc_non_retirement_total(non_ret)
    liabilities_total = calc_liabilities_total(liabilities)
    grand_total = calc_grand_total_net_worth(c1_ret_total, c2_ret_total, non_ret_total, trust_value)

    return {
        "monthly_inflow": inflow,
        "monthly_outflow": outflow,
        "monthly_excess": calc_monthly_excess(inflow, outflow),
        "private_reserve_balance": private_reserve_balance,
        "private_reserve_target": calc_private_reserve_target(outflow, months),
        "schwab_balance": schwab_balance,
        "c1_retirement_total": c1_ret_total,
        "c2_retirement_total": c2_ret_total,
        "non_retirement_total": non_ret_total,
        "trust_value": trust_value,
        "grand_total_net_worth": grand_total,
        "liabilities_total": liabilities_total,
    }
