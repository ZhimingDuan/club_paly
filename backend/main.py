from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from database import (
    engine,
    Base,
    migrate_orders_worker_id_nullable,
    migrate_users_permissions_column,
    migrate_default_admin_username,
    migrate_items_is_commissioned_column,
)
from routers import auth, users, workers, items, orders, settlements, reports

# 本地/服务器：允许通过 backend/.env 提供环境变量（若不存在则忽略）
load_dotenv()

# 迁移：允许订单不绑定打手（worker_id 可空）
migrate_orders_worker_id_nullable()
# 迁移：用户权限勾选字段
migrate_users_permissions_column()
# 迁移：默认管理员用户名 admin -> boss_duan
migrate_default_admin_username()
# 迁移：物资是否参与分成配置
migrate_items_is_commissioned_column()

# 创建数据库表
Base.metadata.create_all(bind=engine)

app = FastAPI(title="爆肝电竞俱乐部 API")

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 在生产环境中应该设置具体的前端域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(workers.router, prefix="/api/workers", tags=["workers"])
app.include_router(items.router, prefix="/api/items", tags=["items"])
app.include_router(orders.router, prefix="/api/orders", tags=["orders"])
app.include_router(settlements.router, prefix="/api/settlements", tags=["settlements"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])

@app.get("/")
async def root():
    return {"message": "爆肝电竞俱乐部 API"}