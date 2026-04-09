from utils import parse_quantity
from routers.settlements import _calc_effective_qty


def test_parse_quantity_plain_number():
    assert parse_quantity("123.5") == 123.5


def test_parse_quantity_k_suffix():
    assert parse_quantity("1.5k") == 1500.0


def test_parse_quantity_w_suffix():
    assert parse_quantity("2w") == 20000.0


def test_calc_effective_qty_normal_case():
    effective, remaining = _calc_effective_qty(
        target_qty=1000,
        submitted_qty=200,
        consumed_in_request=100,
        requested_qty=300,
    )
    assert remaining == 700
    assert effective == 300


def test_calc_effective_qty_cap_to_remaining():
    effective, remaining = _calc_effective_qty(
        target_qty=1000,
        submitted_qty=900,
        consumed_in_request=50,
        requested_qty=300,
    )
    assert remaining == 50
    assert effective == 50


def test_calc_effective_qty_no_remaining():
    effective, remaining = _calc_effective_qty(
        target_qty=1000,
        submitted_qty=1000,
        consumed_in_request=0,
        requested_qty=1,
    )
    assert remaining == 0
    assert effective == 0
