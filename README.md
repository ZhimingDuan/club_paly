## club_paly 运行说明（最小可运行）

### 后端（FastAPI）

1. 进入 `backend/`，创建并启用虚拟环境后安装依赖：

- `pip install -r requirements.txt`

1. 配置环境变量（推荐复制示例文件）：

- 复制 `backend/.env.example` 为 `backend/.env`
- 修改 `SECRET_KEY` 为随机长字符串

1. 启动：

- `python -m uvicorn main:app --host 127.0.0.1 --port 8001`

验证：

- `http://127.0.0.1:8001/` 应返回 `{"message":"爆肝电竞俱乐部 API"}`

### 前端（Vite + React）

1. 进入 `frontend/` 安装依赖并启动：

- `npm install`
- `npm run dev`

默认访问：

- `http://localhost:3000/`

说明：

- 开发模式已在 `frontend/vite.config.ts` 配置了 `/api` 反代到 `http://127.0.0.1:8001`
- 生产环境变量示例见 `frontend/.env.production.example`