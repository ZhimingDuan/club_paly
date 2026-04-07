from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from dependencies import get_db, get_current_user, get_admin_user
from models import User
from schemas import User as UserSchema, UserCreate, UserUpdate
from utils import get_password_hash, validate_password_complexity
from typing import List

router = APIRouter()


def _normalize_permissions(role, permissions: str | None) -> str:
    # 管理员不需要存勾选权限；记账员存去重后的逗号分隔值
    if str(role) == "RoleEnum.admin" or str(role) == "admin":
        return ""
    if not permissions:
        return ""
    parts = [p.strip() for p in permissions.split(",") if p and p.strip()]
    uniq = []
    for p in parts:
        if p not in uniq:
            uniq.append(p)
    return ",".join(uniq)

@router.get("/me", response_model=UserSchema)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user

@router.get("/", response_model=List[UserSchema], dependencies=[Depends(get_admin_user)])
async def get_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    users = db.query(User).offset(skip).limit(limit).all()
    return users

@router.post("/", response_model=UserSchema, dependencies=[Depends(get_admin_user)])
async def create_user(user: UserCreate, db: Session = Depends(get_db)):
    # 检查用户名是否已存在
    db_user = db.query(User).filter(User.username == user.username).first()
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户名已存在"
        )
    
    ok, msg = validate_password_complexity(user.password)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=msg
        )

    # 创建新用户
    hashed_password = get_password_hash(user.password)
    db_user = User(
        username=user.username,
        password_hash=hashed_password,
        role=user.role,
        permissions=_normalize_permissions(user.role, user.permissions),
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.get("/{user_id}", response_model=UserSchema, dependencies=[Depends(get_admin_user)])
async def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    return user

@router.put("/{user_id}", response_model=UserSchema, dependencies=[Depends(get_admin_user)])
async def update_user(user_id: int, user_update: UserUpdate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    # 更新用户信息
    update_data = user_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if key == "password":
            ok, msg = validate_password_complexity(value)
            if not ok:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=msg
                )
            # 对密码进行哈希处理，写入实际字段 password_hash
            user.password_hash = get_password_hash(value)
            continue
        if key == "permissions":
            user.permissions = _normalize_permissions(user.role, value)
            continue
        setattr(user, key, value)

    # 如果角色被改为管理员，清空权限串；如果改为记账员则保留当前权限串（已在上方可单独更新）
    if "role" in update_data and user.role.value == "admin":
        user.permissions = ""
    
    db.commit()
    db.refresh(user)
    return user

@router.delete("/{user_id}", dependencies=[Depends(get_admin_user)])
async def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    db.delete(user)
    db.commit()
    return {"message": "用户删除成功"}