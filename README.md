# 词境 WordScape

词境 WordScape 是一个 AI 驱动的词汇精读应用，用故事语境帮助用户学习和复现目标词汇。

## 本地开发

### 前端

```bash
cd frontend
pnpm install
pnpm dev
```

前端默认运行在 `http://localhost:3000`。

### 后端

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

后端默认运行在 `http://localhost:8000`。

## 当前开发计划

- MVP 阶段（已完成）：见 `docs/development-plan.md`。
- 体验优化批次 A–F（已完成）：见 `docs/optimization-plan.md`。
- 当前执行中：数据可信、自动化验证与内测准备，见 `docs/next-stage-execution-plan.md`。
