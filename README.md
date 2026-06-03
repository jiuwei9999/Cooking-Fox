# 狐闹厨房 · Cooking-Fox

面向厨房新手与菜谱研究的"自由烹饪沙盒"MVP：支持几乎无步骤限制的操作记录，并给出可解释的预期味道与成品结果。

## 运行

```bash
cd server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8787
```

浏览器打开 `http://127.0.0.1:8787/`。

## 服务器部署（宝塔 / 自建反代）

**在服务器上**（项目已在 `/opt/cookingsim` 等目录）：

```bash
cd /opt/cookingsim
chmod +x scripts/deploy-server.sh
./scripts/deploy-server.sh
```

会安装 `server/.venv` 依赖，并生成 **`server/start.sh`**（不装 systemd、不装 Nginx）。

宝塔里：Python 项目 / Supervisor → 运行目录 `server/`，启动命令填 `server/start.sh`；网站反代到 `http://127.0.0.1:8787`（AI 建议超时 ≥600 秒）。

部署脚本**不会**自动生成 `server/.env`；请自行 `cp server/.env.example server/.env` 并填入 `AI_API_KEY`，再在宝塔里重启项目。

**在 Mac 上**打包上传并远程部署：

```bash
chmod +x scripts/upload-from-mac.sh
./scripts/upload-from-mac.sh root@你的服务器IP
```

## 目录

- `web/`: 前端静态资源（原生 ES Modules）
- `server/`: FastAPI 后端（食谱 Provider、模拟引擎、保存与导出）

