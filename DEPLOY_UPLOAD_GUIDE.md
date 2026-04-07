# 部署上传指南（腾讯轻量云）

## 1) 需要上传的目录/文件

- `backend/`
- `frontend/`
- `requirements.txt`（如果你有额外脚本依赖）
- `DEPLOY_UPLOAD_GUIDE.md`（可选，给自己留档）
- `RUN_LOCAL_TEST.md`（可选，本地验证说明）

## 2) 不要上传的内容（务必排除）

- `frontend/node_modules/`
- `backend/venv/` 或 `backend/.venv/`
- `awesome-design-md-main/`（设计参考仓库，生产不需要）
- `.claude/`
- `agent-transcripts/`
- `terminals/`
- `__pycache__/`
- `*.log`
- 本地数据库备份或临时文件

## 3) 服务器上必须准备的配置文件

### 后端环境变量（`backend/.env`）

可从 `backend/.env.example` 复制并修改：

- `SECRET_KEY`：必须改成随机长字符串
- `JWT_ALGORITHM=HS256`
- `ACCESS_TOKEN_EXPIRE_MINUTES=30`

### 前端环境变量（`frontend/.env.production`）

可从 `frontend/.env.production.example` 复制：

- `VITE_API_BASE=/api`

## 4) 运行方式（建议）

- 后端：`gunicorn main:app -k uvicorn.workers.UvicornWorker -w 2 -b 127.0.0.1:8001`
- 前端：进入 `frontend/` 执行 `npm install` → `npm run build`，然后交由 Nginx 托管 `frontend/dist`
- Nginx 反向代理：
  - `/` -> 前端静态文件
  - `/api/` -> `127.0.0.1:8001/api/`
  - 可参考 `deploy/nginx.conf.example`
  - systemd 可参考 `deploy/club-backend.service.example`

## 5) 防爆破相关注意点（你已启用）

当前后端已实现：

- 同账号或同 IP 连错 5 次，锁定 15 分钟

为确保 IP 识别准确，Nginx 里建议设置：

```nginx
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $remote_addr;
```

不要用 `$proxy_add_x_forwarded_for`（会把客户端伪造头拼进去，影响安全判断）。

另外若你要做 Nginx 层限流，请在 `/etc/nginx/nginx.conf` 的 `http {}` 里增加：

```nginx
limit_req_zone $binary_remote_addr zone=login_limit:10m rate=5r/m;
```

## 6) 上线后第一步

- 用 `boss_duan` 登录后立即修改管理员密码
- 禁止保留任何默认口令
