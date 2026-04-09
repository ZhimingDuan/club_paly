import json
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta

BASE = "http://127.0.0.1:8001/api"


def post(path: str, payload: dict, token: str | None = None) -> dict:
    data = json.dumps(payload).encode()
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(f"{BASE}{path}", data=data, headers=headers)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())


def post_expect_error(path: str, payload: dict, token: str | None = None) -> tuple[int, dict]:
    data = json.dumps(payload).encode()
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(f"{BASE}{path}", data=data, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = json.loads(e.read().decode())
        return e.code, body


def get(path: str, token: str | None = None) -> dict | list:
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(f"{BASE}{path}", headers=headers)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())


def assert_true(cond: bool, msg: str) -> None:
    if not cond:
        raise AssertionError(msg)


def main() -> None:
    login = post("/auth/login", {"username": "boss_duan", "password": "BossDuan123"})
    token = login["access_token"]
    suffix = str(int(time.time()))
    results: list[dict] = []

    # 固定基础数据
    worker = post("/workers/", {"name": f"auto_worker_{suffix}", "commission_rate": 0.6}, token)
    item_commissioned = post(
        "/items/",
        {"item_name": f"auto_commissioned_{suffix}", "unit_qty": 1000, "unit_price": 1000, "is_commissioned": True},
        token,
    )
    item_no_commission = post(
        "/items/",
        {"item_name": f"auto_no_commission_{suffix}", "unit_qty": 1000, "unit_price": 1000, "is_commissioned": False},
        token,
    )

    # 场景1：北京时间时间戳（create_time）
    order_tz = post(
        "/orders/",
        {
            "boss_name": "tz_case",
            "worker_id": worker["id"],
            "remarks": "tz",
            "order_items": [{"item_id": item_commissioned["id"], "target_qty": 1000, "premium_rate": 1.0}],
        },
        token,
    )
    assert_true("+08:00" in str(order_tz.get("create_time", "")), "订单创建时间未返回北京时间时区偏移")
    results.append({"case": "timezone_beijing", "ok": True})

    # 场景2：不分成物资
    order_no_cut = post(
        "/orders/",
        {
            "boss_name": "no_cut_case",
            "worker_id": worker["id"],
            "remarks": "no_cut",
            "order_items": [{"item_id": item_no_commission["id"], "target_qty": "1k", "premium_rate": 1.0}],
        },
        token,
    )
    settlement_no_cut = post(
        "/settlements/",
        {
            "order_id": order_no_cut["id"],
            "worker_id": worker["id"],
            "settlement_items": [{"item_id": item_no_commission["id"], "submit_qty": "1k"}],
        },
        token,
    )
    row = settlement_no_cut["settlement_items"][0]
    assert_true(abs(float(row["club_cut"]) - 0.0) < 1e-6, "不分成物资仍产生俱乐部抽成")
    assert_true(abs(float(row["worker_pay"]) - float(row["total_value"])) < 1e-6, "不分成物资未全额给打手")
    results.append({"case": "no_commission_item", "ok": True})

    # 场景3：k/w 符号 + 超额截断
    order_cap = post(
        "/orders/",
        {
            "boss_name": "cap_case",
            "worker_id": worker["id"],
            "remarks": "cap",
            "order_items": [{"item_id": item_commissioned["id"], "target_qty": "2k", "premium_rate": 1.0}],
        },
        token,
    )
    s1 = post(
        "/settlements/",
        {
            "order_id": order_cap["id"],
            "worker_id": worker["id"],
            "settlement_items": [{"item_id": item_commissioned["id"], "submit_qty": "1k"}],
        },
        token,
    )
    s2 = post(
        "/settlements/",
        {
            "order_id": order_cap["id"],
            "worker_id": worker["id"],
            "settlement_items": [{"item_id": item_commissioned["id"], "submit_qty": "5k"}],
        },
        token,
    )
    assert_true(abs(float(s1["settlement_items"][0]["submit_qty"]) - 1000.0) < 1e-6, "k 符号解析错误")
    assert_true(abs(float(s2["settlement_items"][0]["submit_qty"]) - 1000.0) < 1e-6, "超额未按剩余数量截断")
    results.append({"case": "symbol_parse_and_cap", "ok": True})

    # 场景4：同一请求重复同一物资，不得累计超额
    order_dup = post(
        "/orders/",
        {
            "boss_name": "dup_case",
            "worker_id": worker["id"],
            "remarks": "dup",
            "order_items": [{"item_id": item_commissioned["id"], "target_qty": 1000, "premium_rate": 1.0}],
        },
        token,
    )
    s_dup = post(
        "/settlements/",
        {
            "order_id": order_dup["id"],
            "worker_id": worker["id"],
            "settlement_items": [
                {"item_id": item_commissioned["id"], "submit_qty": 800},
                {"item_id": item_commissioned["id"], "submit_qty": 800},
            ],
        },
        token,
    )
    total_dup_qty = sum(float(x["submit_qty"]) for x in s_dup["settlement_items"])
    assert_true(total_dup_qty <= 1000.0 + 1e-6, "同请求重复物资可突破订单上限")
    results.append({"case": "duplicate_item_in_request_cap", "ok": True})

    # 场景5：全0提交应被拒绝
    order_zero = post(
        "/orders/",
        {
            "boss_name": "zero_case",
            "worker_id": worker["id"],
            "remarks": "zero",
            "order_items": [{"item_id": item_commissioned["id"], "target_qty": 1000, "premium_rate": 1.0}],
        },
        token,
    )
    code, body = post_expect_error(
        "/settlements/",
        {
            "order_id": order_zero["id"],
            "worker_id": worker["id"],
            "settlement_items": [{"item_id": item_commissioned["id"], "submit_qty": 0}],
        },
        token,
    )
    assert_true(code == 400, "全0提交未被拒绝")
    assert_true("没有可入账数量" in str(body.get("detail", "")), "全0提交错误信息不明确")
    results.append({"case": "all_zero_rejected", "ok": True})

    # 场景6：汇总口径
    now = datetime.now()
    summary = post(
        "/reports/summary",
        {"start_date": (now - timedelta(days=30)).isoformat(), "end_date": (now + timedelta(days=1)).isoformat()},
        token,
    )
    assert_true("total_income" in summary and "total_expense" in summary and "net_profit" in summary, "汇总字段不完整")
    results.append({"case": "report_fields", "ok": True})

    print(json.dumps({"ok": True, "results": results}, ensure_ascii=False))


if __name__ == "__main__":
    main()
