from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from dependencies import get_db, get_current_user, get_admin_user
from models import Order, OrderItem, Worker, Item, OrderStatusEnum, Settlement, SettlementItem
from schemas import Order as OrderSchema, OrderCreate, OrderUpdate
from utils import parse_quantity
from typing import List
from datetime import datetime, timezone, timedelta

router = APIRouter()


def _beijing_now() -> datetime:
    """返回北京时间（UTC+8）"""
    return datetime.now(timezone(timedelta(hours=8)))

def _to_beijing(dt: datetime | None) -> datetime | None:
    """统一把时间转换为北京时间；历史无时区数据按北京时间本地值解释。"""
    if dt is None:
        return None
    bj_tz = timezone(timedelta(hours=8))
    if dt.tzinfo is None:
        return dt.replace(tzinfo=bj_tz)
    return dt.astimezone(bj_tz)

def _attach_delivered_qty(orders: List[Order], db: Session) -> None:
    """
    为订单内的每个 OrderItem 动态附加 delivered_qty（累计已交数量）。
    该字段用于前端展示进度条，不入库。
    """
    order_ids = [o.id for o in orders]
    if not order_ids:
        return

    rows = (
        db.query(Settlement.order_id, SettlementItem.item_id, func.coalesce(func.sum(SettlementItem.submit_qty), 0.0))
        .join(SettlementItem, SettlementItem.settlement_id == Settlement.id)
        .filter(Settlement.order_id.in_(order_ids))
        .group_by(Settlement.order_id, SettlementItem.item_id)
        .all()
    )
    delivered_map = {(int(oid), int(item_id)): float(qty or 0.0) for oid, item_id, qty in rows}

    for o in orders:
        for oi in getattr(o, "order_items", []) or []:
            setattr(oi, "delivered_qty", delivered_map.get((int(o.id), int(oi.item_id)), 0.0))


def _build_order_display_id_map(db: Session) -> dict[int, str]:
    rows = db.query(Order.id, Order.create_time).order_by(Order.create_time.asc(), Order.id.asc()).all()
    seq_by_day: dict[str, int] = {}
    result: dict[int, str] = {}
    for order_id, create_time in rows:
        bj_dt = _to_beijing(create_time)
        if bj_dt is None:
            continue
        day_key = bj_dt.strftime("%y%m%d")
        seq_by_day[day_key] = seq_by_day.get(day_key, 0) + 1
        result[int(order_id)] = f"{day_key}-{seq_by_day[day_key]:03d}"
    return result


def _attach_display_ids(orders: List[Order], db: Session) -> None:
    display_map = _build_order_display_id_map(db)
    for order in orders:
        setattr(order, "display_id", display_map.get(int(order.id), str(order.id)))


@router.get("/", response_model=List[OrderSchema], dependencies=[Depends(get_current_user)])
async def get_orders(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    orders = db.query(Order).offset(skip).limit(limit).all()
    for o in orders:
        o.create_time = _to_beijing(o.create_time)
    _attach_display_ids(orders, db)
    _attach_delivered_qty(orders, db)
    return orders

@router.post("/", response_model=OrderSchema, dependencies=[Depends(get_current_user)])
async def create_order(order: OrderCreate, db: Session = Depends(get_db)):
    # 验证打手是否存在（如果提供了worker_id）
    if order.worker_id is not None:
        worker = db.query(Worker).filter(Worker.id == order.worker_id).first()
        if not worker:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="打手不存在"
            )
    
    # 创建订单
    db_order = Order(
        boss_name=order.boss_name,
        worker_id=order.worker_id,
        remarks=order.remarks,
        create_time=_beijing_now(),
    )
    db.add(db_order)
    db.flush()  # 获取order.id
    
    # 创建订单物资
    for order_item in order.order_items:
        # 验证物资是否存在
        item = db.query(Item).filter(Item.id == order_item.item_id).first()
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"物资ID {order_item.item_id} 不存在"
            )
        
        # 智能解析数量
        target_qty = parse_quantity(str(order_item.target_qty))
        
        db_order_item = OrderItem(
            order_id=db_order.id,
            item_id=order_item.item_id,
            target_qty=target_qty,
            premium_rate=order_item.premium_rate
        )
        db.add(db_order_item)
    
    db.commit()
    db.refresh(db_order)
    db_order.create_time = _to_beijing(db_order.create_time)
    _attach_display_ids([db_order], db)
    return db_order

@router.get("/{order_id}", response_model=OrderSchema, dependencies=[Depends(get_current_user)])
async def get_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="订单不存在"
        )
    order.create_time = _to_beijing(order.create_time)
    _attach_display_ids([order], db)
    return order

@router.put("/{order_id}", response_model=OrderSchema, dependencies=[Depends(get_current_user)])
async def update_order(order_id: int, order_update: OrderUpdate, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="订单不存在"
        )
    
    # 更新订单信息
    update_data = order_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if key != "order_items":  # 订单物资单独处理
            setattr(order, key, value)
    
    db.commit()
    db.refresh(order)
    order.create_time = _to_beijing(order.create_time)
    _attach_display_ids([order], db)
    return order


@router.post("/{order_id}/force-complete", response_model=OrderSchema, dependencies=[Depends(get_admin_user)])
async def force_complete_order(order_id: int, db: Session = Depends(get_db)):
    """强制结单：无论数量是否达标，直接把订单状态置为 completed"""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="订单不存在"
        )

    order.status = OrderStatusEnum.completed
    db.commit()
    db.refresh(order)
    order.create_time = _to_beijing(order.create_time)
    _attach_display_ids([order], db)

    # 强制结单后也返回最新 delivered_qty（便于前端刷新）
    _attach_delivered_qty([order], db)
    return order

@router.delete("/{order_id}", dependencies=[Depends(get_admin_user)])
async def delete_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="订单不存在"
        )
    
    db.delete(order)
    db.commit()
    return {"message": "订单删除成功"}

@router.get("/pending/list", response_model=List[OrderSchema], dependencies=[Depends(get_current_user)])
async def get_pending_orders(db: Session = Depends(get_db)):
    """获取待结算的订单"""
    orders = db.query(Order).filter(Order.status == OrderStatusEnum.pending).all()
    for o in orders:
        o.create_time = _to_beijing(o.create_time)
    _attach_display_ids(orders, db)
    _attach_delivered_qty(orders, db)
    return orders