from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from dependencies import get_db, get_current_user, get_admin_user
from models import Item, OrderItem, SettlementItem
from schemas import Item as ItemSchema, ItemCreate, ItemUpdate
from typing import List

router = APIRouter()

@router.get("/", response_model=List[ItemSchema], dependencies=[Depends(get_current_user)])
async def get_items(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    items = db.query(Item).offset(skip).limit(limit).all()
    return items

@router.post("/", response_model=ItemSchema, dependencies=[Depends(get_current_user)])
async def create_item(item: ItemCreate, db: Session = Depends(get_db)):
    # 创建新物资
    db_item = Item(**item.model_dump())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.get("/{item_id}", response_model=ItemSchema, dependencies=[Depends(get_current_user)])
async def get_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="物资不存在"
        )
    return item

@router.put("/{item_id}", response_model=ItemSchema, dependencies=[Depends(get_current_user)])
async def update_item(item_id: int, item_update: ItemUpdate, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="物资不存在"
        )
    
    # 更新物资信息
    update_data = item_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(item, key, value)
    
    db.commit()
    db.refresh(item)
    return item

@router.delete("/{item_id}", dependencies=[Depends(get_admin_user)])
async def delete_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="物资不存在"
        )

    # A 策略：只要被引用就绝对禁止删除
    used_in_order = db.query(OrderItem.id).filter(OrderItem.item_id == item_id).first() is not None
    used_in_settlement = db.query(SettlementItem.id).filter(SettlementItem.item_id == item_id).first() is not None
    if used_in_order or used_in_settlement:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该物资已被订单/结算引用，无法删除"
        )

    try:
        db.delete(item)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该物资已被订单/结算引用，无法删除"
        )
    return {"message": "物资删除成功"}