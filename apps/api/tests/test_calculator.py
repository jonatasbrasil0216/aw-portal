"""Unit tests for services/calculator.py"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from services.calculator import (
    calc_monthly_excess,
    calc_private_reserve_target,
    calc_retirement_total,
    calc_non_retirement_total,
    calc_grand_total_net_worth,
    calc_liabilities_total,
    calc_all,
)


class TestCalcMonthlyExcess:
    def test_normal(self):
        assert calc_monthly_excess(15000.0, 11000.0) == 4000.0

    def test_zero_inflow(self):
        assert calc_monthly_excess(0.0, 5000.0) == -5000.0

    def test_zero_both(self):
        assert calc_monthly_excess(0.0, 0.0) == 0.0

    def test_equal(self):
        assert calc_monthly_excess(10000.0, 10000.0) == 0.0


class TestCalcPrivateReserveTarget:
    def test_default_6_months(self):
        assert calc_private_reserve_target(11000.0) == 66000.0

    def test_custom_months(self):
        assert calc_private_reserve_target(10000.0, months=3) == 30000.0

    def test_zero_outflow(self):
        assert calc_private_reserve_target(0.0) == 0.0


class TestCalcRetirementTotal:
    def test_normal(self):
        assert calc_retirement_total([100000.0, 200000.0, 50000.0]) == 350000.0

    def test_empty(self):
        assert calc_retirement_total([]) == 0.0

    def test_single(self):
        assert calc_retirement_total([500000.0]) == 500000.0

    def test_zero_balances(self):
        assert calc_retirement_total([0.0, 0.0]) == 0.0


class TestCalcNonRetirementTotal:
    def test_normal(self):
        assert calc_non_retirement_total([80000.0, 120000.0]) == 200000.0

    def test_empty(self):
        assert calc_non_retirement_total([]) == 0.0

    def test_trust_excluded_by_caller(self):
        # Trust must NOT be passed in here — caller responsibility
        # This test documents the expected usage
        brokerage_only = [80000.0]
        assert calc_non_retirement_total(brokerage_only) == 80000.0


class TestCalcGrandTotalNetWorth:
    def test_normal(self):
        result = calc_grand_total_net_worth(
            c1_retirement=350000.0,
            c2_retirement=200000.0,
            non_retirement=100000.0,
            trust=500000.0,
        )
        assert result == 1150000.0

    def test_single_client_no_c2(self):
        result = calc_grand_total_net_worth(
            c1_retirement=400000.0,
            c2_retirement=0.0,
            non_retirement=150000.0,
            trust=300000.0,
        )
        assert result == 850000.0

    def test_liabilities_not_in_grand_total(self):
        """Business rule (Rebecca, 26:15): liabilities are NEVER subtracted."""
        liabilities = 200000.0
        grand_total = calc_grand_total_net_worth(
            c1_retirement=500000.0,
            c2_retirement=300000.0,
            non_retirement=100000.0,
            trust=400000.0,
        )
        # Grand total must equal sum of assets — liabilities have no effect
        assert grand_total == 1300000.0
        assert grand_total != (1300000.0 - liabilities)

    def test_zeros(self):
        assert calc_grand_total_net_worth(0.0, 0.0, 0.0, 0.0) == 0.0


class TestCalcLiabilitiesTotal:
    def test_normal(self):
        assert calc_liabilities_total([150000.0, 25000.0, 40000.0]) == 215000.0

    def test_empty(self):
        assert calc_liabilities_total([]) == 0.0

    def test_max_liabilities_count(self):
        # Morrison client has 3 liabilities
        balances = [300000.0, 18000.0, 45000.0]
        assert calc_liabilities_total(balances) == 363000.0


class TestCalcAll:
    def _base_data(self):
        return {
            "monthly_inflow": 15000.0,
            "monthly_outflow": 11000.0,
            "reserve_target_months": 6,
            "private_reserve_balance": 55000.0,
            "schwab_balance": 120000.0,
            "c1_retirement_balances": [180000.0, 45000.0],
            "c2_retirement_balances": [130000.0],
            "non_retirement_balances": [200000.0],
            "trust_value": 450000.0,
            "liability_balances": [320000.0, 15000.0],
        }

    def test_full_calculation(self):
        result = calc_all(self._base_data())
        assert result["monthly_excess"] == 4000.0
        assert result["private_reserve_target"] == 66000.0
        assert result["c1_retirement_total"] == 225000.0
        assert result["c2_retirement_total"] == 130000.0
        assert result["non_retirement_total"] == 200000.0
        assert result["trust_value"] == 450000.0
        assert result["grand_total_net_worth"] == 1005000.0
        assert result["liabilities_total"] == 335000.0

    def test_grand_total_excludes_liabilities(self):
        """Business rule (Rebecca, 26:15): liabilities never in grand total."""
        result = calc_all(self._base_data())
        expected = (
            result["c1_retirement_total"]
            + result["c2_retirement_total"]
            + result["non_retirement_total"]
            + result["trust_value"]
        )
        assert result["grand_total_net_worth"] == expected
        assert result["grand_total_net_worth"] != expected - result["liabilities_total"]

    def test_single_client_no_c2(self):
        data = self._base_data()
        data["c2_retirement_balances"] = []
        result = calc_all(data)
        assert result["c2_retirement_total"] == 0.0
        assert result["grand_total_net_worth"] == (
            result["c1_retirement_total"]
            + result["non_retirement_total"]
            + result["trust_value"]
        )

    def test_zero_balances(self):
        data = {
            "monthly_inflow": 0.0,
            "monthly_outflow": 0.0,
            "reserve_target_months": 6,
            "private_reserve_balance": 0.0,
            "schwab_balance": 0.0,
            "c1_retirement_balances": [],
            "c2_retirement_balances": [],
            "non_retirement_balances": [],
            "trust_value": 0.0,
            "liability_balances": [],
        }
        result = calc_all(data)
        assert result["grand_total_net_worth"] == 0.0
        assert result["liabilities_total"] == 0.0
        assert result["monthly_excess"] == 0.0
