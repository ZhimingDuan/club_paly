from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum
from typing import List, Optional, Union

# 角色枚举
class RoleEnum(str, Enum):
    admin = "admin"
    clerk = "clerk"

# 订单状态枚举
class OrderStatusEnum(str, Enum):
    pending = "pending"
    completed = "completed"

# 用户相关模型
class UserBase(BaseModel):
    username: str
    role: RoleEnum = RoleEnum.clerk
    permissions: Optional[str] = ""

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    role: Optional[RoleEnum] = None
    is_active: Optional[bool] = None
    permissions: Optional[str] = None

class UserInDB(UserBase):
    id: int
    is_active: bool
    
    class Config:
        from_attributes = True

class User(UserInDB):
    pass

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

# 打手表相关模型
class WorkerBase(BaseModel):
    name: str
    commission_rate: float = Field(..., ge=0, le=1)

class WorkerCreate(WorkerBase):
    pass

class WorkerUpdate(BaseModel):
    name: Optional[str] = None
    commission_rate: Optional[float] = Field(None, ge=0, le=1)

class Worker(WorkerBase):
    id: int
    
    class Config:
        from_attributes = True

# 物资表相关模型
class ItemBase(BaseModel):
    item_name: str
    unit_qty: float = Field(..., gt=0)
    unit_price: float = Field(..., gt=0)
    is_commissioned: bool = True

class ItemCreate(ItemBase):
    pass

class ItemUpdate(BaseModel):
    item_name: Optional[str] = None
    unit_qty: Optional[float] = Field(None, gt=0)
    unit_price: Optional[float] = Field(None, gt=0)
    is_commissioned: Optional[bool] = None

class Item(ItemBase):
    id: int
    
    class Config:
        from_attributes = True

# 订单物资副表相关模型
class OrderItemBase(BaseModel):
    item_id: int
    target_qty: Union[float, str]
    premium_rate: float = Field(1.0, ge=0)

class OrderItemCreate(OrderItemBase):
    pass

class OrderItemUpdate(BaseModel):
    target_qty: Optional[Union[float, str]] = None
    premium_rate: Optional[float] = Field(None, ge=0)

class OrderItem(OrderItemBase):
    id: int
    order_id: int
    item: Item
    delivered_qty: float = 0.0
    
    class Config:
        from_attributes = True

# 订单主表相关模型
class OrderBase(BaseModel):
    boss_name: str
    worker_id: Optional[int] = None
    remarks: Optional[str] = None

class OrderCreate(OrderBase):
    order_items: List[OrderItemCreate]

class OrderUpdate(BaseModel):
    boss_name: Optional[str] = None
    worker_id: Optional[int] = None
    remarks: Optional[str] = None
    status: Optional[OrderStatusEnum] = None

class Order(OrderBase):
    id: int
    display_id: Optional[str] = None
    status: OrderStatusEnum
    create_time: datetime
    worker: Optional[Worker] = None
    order_items: List[OrderItem]
    
    class Config:
        from_attributes = True

# 结算物资副表相关模型
class SettlementItemBase(BaseModel):
    item_id: int
    submit_qty: Union[float, str]

class SettlementItemCreate(SettlementItemBase):
    pass

class SettlementItem(SettlementItemBase):
    id: int
    settlement_id: int
    item: Item
    total_value: float
    club_cut: float
    worker_pay: float
    
    class Config:
        from_attributes = True

# 结算主表相关模型
class SettlementBase(BaseModel):
    order_id: int
    worker_id: int

class SettlementCreate(SettlementBase):
    settlement_items: List[SettlementItemCreate]

class Settlement(SettlementBase):
    id: int
    display_id: Optional[str] = None
    datetime: datetime
    order: Order
    worker: Worker
    settlement_items: List[SettlementItem]
    
    class Config:
        from_attributes = True

# 报表相关模型
class ReportParams(BaseModel):
    start_date: datetime
    end_date: datetime