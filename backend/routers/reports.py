from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from dependencies import get_db, get_current_user
from models import Settlement, SettlementItem
from schemas import ReportParams
import pandas as pd
from io import BytesIO
from datetime import datetime, timezone, timedelta
from typing import List

router = APIRouter()

def _to_beijing(dt: datetime) -> datetime:
    bj_tz = timezone(timedelta(hours=8))
    if dt.tzinfo is None:
        return dt.replace(tzinfo=bj_tz)
    return dt.astimezone(bj_tz)


def _to_beijing_naive_for_db(dt: datetime) -> datetime:
    """
    将查询时间统一转换为“北京时间的无时区时间”用于 SQLite 过滤。
    说明：
    - SQLite 中历史时间通常按无时区字符串存储
    - 若直接拿带时区时间比较，容易出现当天边界错位
    """
    bj = _to_beijing(dt)
    return bj.replace(tzinfo=None)

@router.post("/export-excel")
async def export_excel(report_params: ReportParams, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """导出指定时间段内的结算数据为Excel"""
    start_dt = _to_beijing_naive_for_db(report_params.start_date)
    end_dt = _to_beijing_naive_for_db(report_params.end_date)
    # 查询结算数据
    settlements = db.query(Settlement).filter(
        Settlement.datetime >= start_dt,
        Settlement.datetime <= end_dt
    ).all()
    
    if not settlements:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="该时间段内没有结算数据"
        )
    
    # 准备数据
    data = []
    total_receipt = 0.0
    total_worker_pay = 0.0
    total_club_share = 0.0
    
    for settlement in settlements:
        bj_dt = _to_beijing(settlement.datetime)
        for item in settlement.settlement_items:
            data.append({
                "结算ID": settlement.id,
                "订单ID": settlement.order_id,
                "打手": settlement.worker.name,
                "物资": item.item.item_name,
                "提交数量": item.submit_qty,
                "单位": item.item.unit_qty,
                "单价": item.item.unit_price,
                "总价值": item.total_value,
                "俱乐部抽成": item.club_cut,
                "打手应得": item.worker_pay,
                "结算时间": bj_dt
            })
            total_receipt += float(item.total_value or 0.0)
            total_worker_pay += float(item.worker_pay or 0.0)
            total_club_share += float(item.club_cut or 0.0)
    
    # 创建DataFrame
    df = pd.DataFrame(data)
    
    # 创建Excel文件
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        # 写入数据
        df.to_excel(writer, sheet_name='结算明细', index=False)
        
        # 创建汇总表
        summary_data = {
            "项目": ["流水（总收款）", "总佣金支出", "净利润（俱乐部分成）"],
            "金额": [total_receipt, total_worker_pay, total_club_share]
        }
        summary_df = pd.DataFrame(summary_data)
        summary_df.to_excel(writer, sheet_name='汇总', index=False)
    
    output.seek(0)
    
    # 生成文件名
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"settlement_report_{timestamp}.xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )

@router.post("/summary")
async def get_report_summary(report_params: ReportParams, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """获取指定时间段内的结算汇总数据"""
    start_dt = _to_beijing_naive_for_db(report_params.start_date)
    end_dt = _to_beijing_naive_for_db(report_params.end_date)
    # 查询结算数据
    settlements = db.query(Settlement).filter(
        Settlement.datetime >= start_dt,
        Settlement.datetime <= end_dt
    ).all()
    
    total_receipt = 0.0
    total_worker_pay = 0.0
    total_club_share = 0.0
    
    for settlement in settlements:
        for item in settlement.settlement_items:
            total_receipt += float(item.total_value or 0.0)
            total_worker_pay += float(item.worker_pay or 0.0)
            total_club_share += float(item.club_cut or 0.0)
    
    return {
        "start_date": report_params.start_date,
        "end_date": report_params.end_date,
        "total_income": total_receipt,
        "total_expense": total_worker_pay,
        "net_profit": total_club_share
    }

@router.post("/trend")
async def get_report_trend(report_params: ReportParams, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """获取指定时间段内的收益趋势数据"""
    start_dt = _to_beijing_naive_for_db(report_params.start_date)
    end_dt = _to_beijing_naive_for_db(report_params.end_date)
    # 查询结算数据
    settlements = db.query(Settlement).filter(
        Settlement.datetime >= start_dt,
        Settlement.datetime <= end_dt
    ).all()
    
    # 按日期分组计算数据
    daily_data = {}
    
    for settlement in settlements:
        date_key = _to_beijing(settlement.datetime).strftime("%Y-%m-%d")
        if date_key not in daily_data:
            daily_data[date_key] = {
                "date": date_key,
                "income": 0,
                "expense": 0,
                "profit": 0
            }
        
        for item in settlement.settlement_items:
            total_value = float(item.total_value or 0.0)
            worker_pay = float(item.worker_pay or 0.0)
            club_cut = float(item.club_cut or 0.0)
            daily_data[date_key]["income"] += total_value
            daily_data[date_key]["expense"] += worker_pay
            daily_data[date_key]["profit"] += club_cut
    
    # 转换为列表并按日期排序
    trend_data = sorted(daily_data.values(), key=lambda x: x["date"])
    
    return trend_data