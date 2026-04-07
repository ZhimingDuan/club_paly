from sqlalchemy import create_engine, text
from sqlalchemy import event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 使用SQLite数据库
SQLALCHEMY_DATABASE_URL = "sqlite:///./studio_bms.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False}  # SQLite需要这个参数
)

# 确保 SQLite 外键约束生效（否则删除被引用记录会“看似成功”但产生脏数据）
@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    try:
        cursor.execute("PRAGMA foreign_keys=ON")
    finally:
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def migrate_orders_worker_id_nullable() -> None:
    """
    将 SQLite 中 orders.worker_id 从 NOT NULL 迁移为可空。

    说明：
    - SQLAlchemy 的 create_all 不会自动修改既有表结构
    - SQLite 也无法直接 ALTER COLUMN 修改 NULL 约束
    - 采用“新建表 -> 拷贝数据 -> 删除旧表 -> 重命名”的方式迁移
    """
    with engine.connect() as conn:
        try:
            table_info = conn.execute(text("PRAGMA table_info(orders)")).fetchall()
        except Exception:
            # orders 表还不存在
            return

        if not table_info:
            return

        # PRAGMA table_info: cid, name, type, notnull, dflt_value, pk
        worker_row = next((r for r in table_info if r[1] == "worker_id"), None)
        if worker_row is None:
            return

        notnull = int(worker_row[3] or 0)

        status_row = next((r for r in table_info if r[1] == "status"), None)
        create_time_row = next((r for r in table_info if r[1] == "create_time"), None)
        status_default_missing = bool(status_row) and (status_row[4] in (None, "NULL"))
        create_time_default_missing = bool(create_time_row) and (create_time_row[4] in (None, "NULL"))

        # 需要迁移的情况：
        # 1) worker_id 仍为 NOT NULL
        # 2) 或者之前迁移过但丢失了 status/create_time 的默认值
        if notnull == 0 and not (status_default_missing or create_time_default_missing):
            return

        # 开始迁移
        conn.execute(text("PRAGMA foreign_keys=OFF"))
        conn.execute(text("BEGIN"))
        try:
            conn.execute(
                text(
                    """
                    CREATE TABLE orders__new (
                        id INTEGER NOT NULL PRIMARY KEY,
                        boss_name VARCHAR NOT NULL,
                        worker_id INTEGER NULL,
                        remarks VARCHAR,
                        status VARCHAR DEFAULT 'pending',
                        create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(worker_id) REFERENCES workers (id)
                    )
                    """
                )
            )
            conn.execute(
                text(
                    """
                    INSERT INTO orders__new (id, boss_name, worker_id, remarks, status, create_time)
                    SELECT
                        id,
                        boss_name,
                        worker_id,
                        remarks,
                        COALESCE(status, 'pending'),
                        COALESCE(create_time, CURRENT_TIMESTAMP)
                    FROM orders
                    """
                )
            )
            conn.execute(text("DROP TABLE orders"))
            conn.execute(text("ALTER TABLE orders__new RENAME TO orders"))
            conn.execute(text("COMMIT"))
        except Exception:
            conn.execute(text("ROLLBACK"))
            raise
        finally:
            conn.execute(text("PRAGMA foreign_keys=ON"))


def migrate_users_permissions_column() -> None:
    """
    为 users 表补充 permissions 列（用于记账员功能勾选）
    """
    with engine.connect() as conn:
        try:
            table_info = conn.execute(text("PRAGMA table_info(users)")).fetchall()
        except Exception:
            return
        if not table_info:
            return

        has_permissions = any(r[1] == "permissions" for r in table_info)
        if has_permissions:
            return

        conn.execute(text("ALTER TABLE users ADD COLUMN permissions VARCHAR DEFAULT ''"))


def migrate_default_admin_username() -> None:
    """
    将历史默认管理员用户名 admin 迁移为 boss_duan（若未冲突）
    """
    with engine.connect() as conn:
        try:
            users_exist = conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
            ).fetchone()
        except Exception:
            return
        if not users_exist:
            return

        admin_row = conn.execute(
            text("SELECT id FROM users WHERE username='admin' LIMIT 1")
        ).fetchone()
        if not admin_row:
            return

        boss_row = conn.execute(
            text("SELECT id FROM users WHERE username='boss_duan' LIMIT 1")
        ).fetchone()
        if boss_row:
            return

        conn.execute(
            text("UPDATE users SET username='boss_duan' WHERE username='admin'")
        )
        conn.commit()