from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
import re
import os

# 密码加密上下文
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

# JWT配置
SECRET_KEY = os.getenv("SECRET_KEY", "change-this-in-production")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

# 验证密码
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

# 获取密码哈希
def get_password_hash(password):
    # bcrypt要求密码长度不能超过72字节
    if len(password) > 72:
        password = password[:72]
    return pwd_context.hash(password)


def validate_password_complexity(password: str) -> tuple[bool, str]:
    """
    密码复杂度要求：
    - 长度必须大于 8
    - 至少包含 1 个大写字母
    - 至少包含 1 个小写字母
    - 至少包含 1 个数字
    """
    if len(password or "") <= 8:
        return False, "密码长度必须大于8位"
    if not re.search(r"[A-Z]", password):
        return False, "密码必须包含至少一个大写字母"
    if not re.search(r"[a-z]", password):
        return False, "密码必须包含至少一个小写字母"
    if not re.search(r"\d", password):
        return False, "密码必须包含至少一个数字"
    return True, ""

# 创建访问令牌
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# 解析JWT令牌
def decode_access_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None

# 智能数量解析（支持w单位）
def parse_quantity(quantity_str: str) -> float:
    """将字符串数量解析为浮点数，支持w单位（1w=10000）"""
    # 移除空格
    quantity_str = quantity_str.strip()
    
    # 检查是否包含w
    if 'w' in quantity_str.lower():
        # 提取数字部分
        num_part = quantity_str.lower().replace('w', '')
        try:
            num = float(num_part)
            return num * 10000
        except ValueError:
            raise ValueError(f"无效的数量格式: {quantity_str}")
    else:
        # 直接转换为浮点数
        try:
            return float(quantity_str)
        except ValueError:
            raise ValueError(f"无效的数量格式: {quantity_str}")