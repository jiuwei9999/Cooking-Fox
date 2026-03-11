# CookingSim Web MVP

面向厨房新手与菜谱研究的“自由烹饪沙盒”MVP：支持几乎无步骤限制的操作记录，并给出可解释的预期味道与成品结果。

## 运行

```bash
cd server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8787
```

浏览器打开 `http://127.0.0.1:8787/`。

## 目录

- `web/`: 前端静态资源（原生 ES Modules）
- `server/`: FastAPI 后端（食谱 Provider、模拟引擎、保存与导出）

