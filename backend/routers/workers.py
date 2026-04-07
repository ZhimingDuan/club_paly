from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from dependencies import get_db, get_current_user, get_admin_user
from models import Worker, Order, Settlement
from schemas import Worker as WorkerSchema, WorkerCreate, WorkerUpdate
from typing import List

router = APIRouter()

@router.get("/", response_model=List[WorkerSchema], dependencies=[Depends(get_current_user)])
async def get_workers(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    workers = db.query(Worker).offset(skip).limit(limit).all()
    return workers

@router.post("/", response_model=WorkerSchema, dependencies=[Depends(get_current_user)])
async def create_worker(worker: WorkerCreate, db: Session = Depends(get_db)):
    # 创建新打手
    db_worker = Worker(**worker.model_dump())
    db.add(db_worker)
    db.commit()
    db.refresh(db_worker)
    return db_worker

@router.get("/{worker_id}", response_model=WorkerSchema, dependencies=[Depends(get_current_user)])
async def get_worker(worker_id: int, db: Session = Depends(get_db)):
    worker = db.query(Worker).filter(Worker.id == worker_id).first()
    if not worker:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="打手不存在"
        )
    return worker

@router.put("/{worker_id}", response_model=WorkerSchema, dependencies=[Depends(get_current_user)])
async def update_worker(worker_id: int, worker_update: WorkerUpdate, db: Session = Depends(get_db)):
    worker = db.query(Worker).filter(Worker.id == worker_id).first()
    if not worker:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="打手不存在"
        )
    
    # 更新打手信息
    update_data = worker_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(worker, key, value)
    
    db.commit()
    db.refresh(worker)
    return worker

@router.delete("/{worker_id}", dependencies=[Depends(get_admin_user)])
async def delete_worker(worker_id: int, db: Session = Depends(get_db)):
    worker = db.query(Worker).filter(Worker.id == worker_id).first()
    if not worker:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="打手不存在"
        )

    # A 策略：只要被引用就绝对禁止删除
    used_in_order = db.query(Order.id).filter(Order.worker_id == worker_id).first() is not None
    used_in_settlement = db.query(Settlement.id).filter(Settlement.worker_id == worker_id).first() is not None
    if used_in_order or used_in_settlement:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该打手已被订单/结算引用，无法删除"
        )

    try:
        db.delete(worker)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该打手已被订单/结算引用，无法删除"
        )
    return {"message": "打手删除成功"}