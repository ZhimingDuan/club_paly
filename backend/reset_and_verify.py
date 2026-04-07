#!/usr/bin/env python3

"""
重置密码并验证脚本
"""

from database import SessionLocal, engine, Base
from models import User, RoleEnum
from utils import get_password_hash, verify_password

# 确保数据库表存在
Base.metadata.create_all(bind=engine)

def reset_and_verify():
    """重置密码并验证"""
    # 创建数据库会话
    db = SessionLocal()
    
    try:
        # 查找管理员用户
        admin = db.query(User).filter(User.role == RoleEnum.admin).first()
        
        if not admin:
            print("未找到管理员用户，正在创建...")
            # 创建管理员用户
            admin = User(
                username="boss_duan",
                password_hash=get_password_hash("BossDuan123"),
                role=RoleEnum.admin,
                is_active=True
            )
            db.add(admin)
            db.commit()
            print("管理员用户已创建，用户名: boss_duan，密码设置为: BossDuan123")
        else:
            # 重置管理员密码
            # 如历史默认账号仍为 admin，则迁移为 boss_duan（若未冲突）
            if admin.username == "admin":
                conflict = db.query(User).filter(User.username == "boss_duan").first()
                if not conflict:
                    admin.username = "boss_duan"
            new_password = "BossDuan123"
            admin.password_hash = get_password_hash(new_password)
            db.commit()
            print(f"管理员密码已重置为: {new_password}")
            print(f"用户名: {admin.username}")
        
        # 重新查询用户以确保获取最新数据
        admin = db.query(User).filter(User.role == RoleEnum.admin).first()
        
        # 测试密码
        print("\n测试密码验证:")
        print(f"验证密码 'BossDuan123': {verify_password('BossDuan123', admin.password_hash)}")
        print(f"验证密码 '123456': {verify_password('123456', admin.password_hash)}")
        
    except Exception as e:
        print(f"错误: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    reset_and_verify()
