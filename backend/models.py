from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from database import Base

# 角色枚举
class RoleEnum(str, enum.Enum):
    admin = "admin"
    clerk = "clerk"

# 订单状态枚举
class OrderStatusEnum(str, enum.Enum):
    pending = "pending"
    completed = "completed"

# 用户表
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(Enum(RoleEnum), nullable=False, default=RoleEnum.clerk)
    is_active = Column(Boolean, default=True)
    # 记账员功能权限（逗号分隔），管理员默认拥有全部权限
    permissions = Column(String, nullable=True, default="")

# 打手表
class Worker(Base):
    __tablename__ = "workers"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    commission_rate = Column(Float, nullable=False)  # 抽成比例
    
    # 关联关系
    orders = relationship("Order", back_populates="worker")
    settlements = relationship("Settlement", back_populates="worker")

# 物资表
class Item(Base):
    __tablename__ = "items"
    
    id = Column(Integer, primary_key=True, index=True)
    item_name = Column(String, nullable=False)
    unit_qty = Column(Float, nullable=False)  # 单位数量
    unit_price = Column(Float, nullable=False)  # 单价
    
    # 关联关系
    order_items = relationship("OrderItem", back_populates="item")
    settlement_items = relationship("SettlementItem", back_populates="item")

# 订单主表
class Order(Base):
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, index=True)
    boss_name = Column(String, nullable=False)
    worker_id = Column(Integer, ForeignKey("workers.id"), nullable=True)
    remarks = Column(String, nullable=True)
    status = Column(Enum(OrderStatusEnum), default=OrderStatusEnum.pending)
    create_time = Column(DateTime(timezone=True), server_default=func.now())
    
    # 关联关系
    worker = relationship("Worker", back_populates="orders")
    order_items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    settlements = relationship("Settlement", back_populates="order")

# 订单物资副表
class OrderItem(Base):
    __tablename__ = "order_items"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    target_qty = Column(Float, nullable=False)  # 目标数量
    premium_rate = Column(Float, default=1.0)  # 溢价率
    
    # 关联关系
    order = relationship("Order", back_populates="order_items")
    item = relationship("Item", back_populates="order_items")

# 结算主表
class Settlement(Base):
    __tablename__ = "settlements"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    worker_id = Column(Integer, ForeignKey("workers.id"), nullable=False)
    datetime = Column(DateTime(timezone=True), server_default=func.now())
    
    # 关联关系
    order = relationship("Order", back_populates="settlements")
    worker = relationship("Worker", back_populates="settlements")
    settlement_items = relationship("SettlementItem", back_populates="settlement", cascade="all, delete-orphan")

# 结算物资副表
class SettlementItem(Base):
    __tablename__ = "settlement_items"
    
    id = Column(Integer, primary_key=True, index=True)
    settlement_id = Column(Integer, ForeignKey("settlements.id"), nullable=False)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    submit_qty = Column(Float, nullable=False)  # 提交数量
    total_value = Column(Float, nullable=False)  # 总价值
    club_cut = Column(Float, nullable=False)  # 俱乐部抽成
    worker_pay = Column(Float, nullable=False)  # 打手应得
    
    # 关联关系
    settlement = relationship("Settlement", back_populates="settlement_items")
    item = relationship("Item", back_populates="settlement_items")