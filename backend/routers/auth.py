from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from dependencies import get_db
from models import User, RoleEnum
from schemas import Token, User as UserSchema, UserLogin
from utils import verify_password, create_access_token, get_password_hash, validate_password_complexity
from datetime import datetime, timedelta, timezone

router = APIRouter()

LOCK_THRESHOLD = 5
LOCK_MINUTES = 15
_user_fail_state: dict[str, dict] = {}
_ip_fail_state: dict[str, dict] = {}


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _extract_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _is_locked(state_map: dict[str, dict], key: str) -> tuple[bool, int]:
    row = state_map.get(key)
    if not row or not row.get("lock_until"):
        return False, 0
    now = _now_utc()
    lock_until = row["lock_until"]
    if now < lock_until:
        remain = int((lock_until - now).total_seconds())
        return True, max(remain, 1)
    # 锁已到期，清空状态
    state_map.pop(key, None)
    return False, 0


def _register_fail(state_map: dict[str, dict], key: str) -> None:
    now = _now_utc()
    row = state_map.get(key) or {"count": 0, "lock_until": None}
    row["count"] = int(row.get("count", 0)) + 1
    if row["count"] >= LOCK_THRESHOLD:
        row["lock_until"] = now + timedelta(minutes=LOCK_MINUTES)
        row["count"] = 0
    state_map[key] = row


def _clear_fail(state_map: dict[str, dict], key: str) -> None:
    state_map.pop(key, None)

@router.post("/login", response_model=Token)
async def login(user_login: UserLogin, request: Request, db: Session = Depends(get_db)):
    username_key = (user_login.username or "").strip().lower()
    ip_key = _extract_ip(request)

    user_locked, user_remain = _is_locked(_user_fail_state, username_key)
    ip_locked, ip_remain = _is_locked(_ip_fail_state, ip_key)
    if user_locked or ip_locked:
        remain = max(user_remain, ip_remain)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"登录尝试过多，请在 {remain} 秒后重试"
        )

    # 查找用户
    user = db.query(User).filter(User.username == user_login.username).first()
    if not user or not verify_password(user_login.password, user.password_hash):
        _register_fail(_user_fail_state, username_key)
        _register_fail(_ip_fail_state, ip_key)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )

    _clear_fail(_user_fail_state, username_key)
    _clear_fail(_ip_fail_state, ip_key)
    
    # 创建访问令牌
    access_token_expires = timedelta(minutes=30)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    
    # 转换用户模型为Schema
    user_schema = UserSchema(
        id=user.id,
        username=user.username,
        role=user.role,
        is_active=user.is_active,
        permissions=user.permissions or "",
    )
    
    return Token(access_token=access_token, token_type="bearer", user=user_schema)

@router.post("/init-admin")
async def init_admin(db: Session = Depends(get_db)):
    """初始化管理员账户"""
    # 检查是否已存在管理员
    admin = db.query(User).filter(User.role == RoleEnum.admin).first()
    if admin:
        return {"message": "管理员账户已存在"}
    
    # 创建管理员账户
    default_password = "BossDuan123"
    ok, msg = validate_password_complexity(default_password)
    if not ok:
        raise HTTPException(status_code=500, detail=f"默认管理员密码不符合复杂度要求: {msg}")

    admin_user = User(
        username="boss_duan",
        password_hash=get_password_hash(default_password),
        role=RoleEnum.admin,
        is_active=True
    )
    db.add(admin_user)
    db.commit()
    db.refresh(admin_user)
    
    return {"message": "管理员账户初始化成功"}