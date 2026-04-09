from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from dependencies import get_db, get_current_user, get_admin_user
from models import Settlement, SettlementItem, Order, OrderItem, Worker, Item, OrderStatusEnum
from schemas import Settlement as SettlementSchema, SettlementCreate
from utils import parse_quantity
from typing import List
from datetime import datetime, timezone, timedelta

router = APIRouter()

def _beijing_now() -> datetime:
    return datetime.now(timezone(timedelta(hours=8)))

def _to_beijing(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    bj_tz = timezone(timedelta(hours=8))
    if dt.tzinfo is None:
        return dt.replace(tzinfo=bj_tz)
    return dt.astimezone(bj_tz)


def _calc_effective_qty(
    *,
    target_qty: float,
    submitted_qty: float,
    consumed_in_request: float,
    requested_qty: float,
) -> tuple[float, float]:
    """
    计算本次可入账数量（effective_qty）与剩余数量（remaining_qty）。
    - 统一在一个函数内处理，便于测试和避免重复逻辑分叉
    """
    remaining_qty = max(float(target_qty) - float(submitted_qty) - float(consumed_in_request), 0.0)
    effective_qty = min(float(requested_qty), remaining_qty)
    return max(effective_qty, 0.0), remaining_qty

@router.get("/", response_model=List[SettlementSchema], dependencies=[Depends(get_current_user)])
async def get_settlements(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    settlements = db.query(Settlement).offset(skip).limit(limit).all()
    for s in settlements:
        s.datetime = _to_beijing(s.datetime)
        if getattr(s, "order", None):
            s.order.create_time = _to_beijing(s.order.create_time)
    return settlements

@router.post("/", response_model=SettlementSchema, dependencies=[Depends(get_current_user)])
async def create_settlement(settlement: SettlementCreate, db: Session = Depends(get_db)):
    # 验证订单是否存在
    order = db.query(Order).filter(Order.id == settlement.order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="订单不存在"
        )
    
    # 订单已完成则不允许继续结算
    if order.status == OrderStatusEnum.completed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该订单已完成，无法继续结算"
        )
    
    # 验证打手是否存在
    worker = db.query(Worker).filter(Worker.id == settlement.worker_id).first()
    if not worker:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="打手不存在"
        )
    
    # 创建结算
    db_settlement = Settlement(
        order_id=settlement.order_id,
        worker_id=settlement.worker_id,
        datetime=_beijing_now(),
    )
    db.add(db_settlement)
    db.flush()  # 获取settlement.id
    
    created_items = 0
    in_request_consumed_qty: dict[int, float] = {}
    # 创建结算物资并计算
    for settlement_item in settlement.settlement_items:
        # 验证物资是否存在
        item = db.query(Item).filter(Item.id == settlement_item.item_id).first()
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"物资ID {settlement_item.item_id} 不存在"
            )
        
        # 找到订单物资配置（包含倍率）
        order_item = (
            db.query(OrderItem)
            .filter(OrderItem.order_id == order.id, OrderItem.item_id == settlement_item.item_id)
            .first()
        )
        if not order_item:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"物资ID {settlement_item.item_id} 不在该订单物资清单中"
            )

        # 智能解析数量（支持 0 / k / w）
        submit_qty = parse_quantity(str(settlement_item.submit_qty))
        if submit_qty < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"物资ID {settlement_item.item_id} 的提交数量不能小于0"
            )

        # 按订单剩余数量截断，避免结算超出老板订单总量
        submitted_qty = (
            db.query(func.coalesce(func.sum(SettlementItem.submit_qty), 0.0))
            .join(Settlement, Settlement.id == SettlementItem.settlement_id)
            .filter(Settlement.order_id == order.id, SettlementItem.item_id == settlement_item.item_id)
            .scalar()
        )
        already_consumed_in_request = float(in_request_consumed_qty.get(int(settlement_item.item_id), 0.0))
        effective_qty, remaining_qty = _calc_effective_qty(
            target_qty=float(order_item.target_qty),
            submitted_qty=float(submitted_qty or 0.0),
            consumed_in_request=already_consumed_in_request,
            requested_qty=float(submit_qty),
        )
        if effective_qty <= 0:
            continue
        
        # 计算总价值（需要乘以订单物资的单价倍率）
        premium_rate = float(order_item.premium_rate or 1.0)
        total_value = (effective_qty / item.unit_qty) * item.unit_price * premium_rate
        
        # 计算打手应得和俱乐部抽成：
        # - 参与分成：按打手抽成比例
        # - 不参与分成：全额给打手，俱乐部分成为 0
        if bool(item.is_commissioned):
            worker_pay = total_value * worker.commission_rate
            club_cut = total_value - worker_pay
        else:
            worker_pay = total_value
            club_cut = 0.0
        
        db_settlement_item = SettlementItem(
            settlement_id=db_settlement.id,
            item_id=settlement_item.item_id,
            submit_qty=effective_qty,
            total_value=total_value,
            club_cut=club_cut,
            worker_pay=worker_pay
        )
        db.add(db_settlement_item)
        in_request_consumed_qty[int(settlement_item.item_id)] = already_consumed_in_request + effective_qty
        created_items += 1

    if created_items == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="本次结算没有可入账数量（可能都为0或已达到订单上限）"
        )

    # 让本次结算物资写入会话，确保后续汇总可见
    db.flush()

    # 规则：只有当订单内所有物资“累计提交数量 >= 目标数量”时才把订单置为 completed
    order_items: List[OrderItem] = db.query(OrderItem).filter(OrderItem.order_id == order.id).all()
    is_completed = True
    for oi in order_items:
        submitted_qty = (
            db.query(func.coalesce(func.sum(SettlementItem.submit_qty), 0.0))
            .join(Settlement, Settlement.id == SettlementItem.settlement_id)
            .filter(Settlement.order_id == order.id, SettlementItem.item_id == oi.item_id)
            .scalar()
        )
        if float(submitted_qty or 0.0) < float(oi.target_qty):
            is_completed = False
            break

    order.status = OrderStatusEnum.completed if is_completed else OrderStatusEnum.pending

    db.commit()
    db.refresh(db_settlement)
    db_settlement.datetime = _to_beijing(db_settlement.datetime)
    if getattr(db_settlement, "order", None):
        db_settlement.order.create_time = _to_beijing(db_settlement.order.create_time)
    return db_settlement

@router.get("/{settlement_id}", response_model=SettlementSchema, dependencies=[Depends(get_current_user)])
async def get_settlement(settlement_id: int, db: Session = Depends(get_db)):
    settlement = db.query(Settlement).filter(Settlement.id == settlement_id).first()
    if not settlement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="结算不存在"
        )
    settlement.datetime = _to_beijing(settlement.datetime)
    if getattr(settlement, "order", None):
        settlement.order.create_time = _to_beijing(settlement.order.create_time)
    return settlement

@router.delete("/{settlement_id}", dependencies=[Depends(get_admin_user)])
async def delete_settlement(settlement_id: int, db: Session = Depends(get_db)):
    settlement = db.query(Settlement).filter(Settlement.id == settlement_id).first()
    if not settlement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="结算不存在"
        )
    
    # 更新订单状态为待结算
    order = db.query(Order).filter(Order.id == settlement.order_id).first()
    if order:
        order.status = OrderStatusEnum.pending
    
    db.delete(settlement)
    db.commit()
    return {"message": "结算删除成功"}