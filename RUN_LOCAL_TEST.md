# 本地打包运行测试（club_paly）

## 你已经拥有的打包目录

本项目的可上传目录是 `club_paly/`，里面包含：

- `backend/`：FastAPI 后端
- `frontend/src/`：前端源码（React + Ant Design）
- `deploy/`：Nginx / systemd 示例
- `DEPLOY_UPLOAD_GUIDE.md`：上传与部署指引

> 重要：当前 Cursor 环境里缺少 `vite`/`npm`，因此无法在此环境完成前端 `dist` 构建与预览测试。
> 但后端在 `club_paly/backend` 下已可独立启动并通过健康检查。

---

## 1) 启动后端（本机）

在 `club_paly/backend` 目录：

```bash
python -m uvicorn main:app --host 127.0.0.1 --port 8001
```

验证：

- 打开 `http://127.0.0.1:8001/` 应返回 `{"message":"爆肝电竞俱乐部 API"}`
- API 前缀为 `/api`

---

## 2) 构建并运行前端（需要 Node/npm）

你需要在 **有 Node.js + npm** 的终端执行（本机或服务器均可）。

推荐结构：

- 在 `club_paly/frontend/` 补齐前端工程化文件（`package.json`/`vite.config` 等）后 `npm install && npm run build`
- 或按你现有工程方式，执行 Vite 构建输出 `dist/`

构建完成后：

- 由 Nginx 托管 `frontend/dist`
- Nginx 反代 `/api/` 到后端 `127.0.0.1:8001/api/`

可直接参考：

- `club_paly/deploy/nginx.conf.example`
- `club_paly/deploy/club-backend.service.example`

---

## 3) 服务器部署建议

- 后端使用 `gunicorn`（见 `DEPLOY_UPLOAD_GUIDE.md`）
- 前端走 Nginx 静态托管 + API 反代

