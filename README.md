# AW Client Report Portal

Internal web application for Windbrook Solutions — a small financial planning firm. Replaces a manual, full-day process of pulling balances from multiple sources and assembling reports in Canva/Word.

## Architecture

The project is a monorepo with two apps: a Python FastAPI backend (`apps/api`) serving a SQLite database via SQLAlchemy, and a Vite + Vanilla TypeScript frontend (`apps/web`). The backend handles all business logic — SACS cash flow calculations, TCC net worth calculations, and PDF generation via ReportLab. The frontend is a single-page app with a hash-based router, communicating with the backend via a typed fetch wrapper. Both apps are deployable as a single Docker container on Railway, where the API serves the built frontend as static files.

## Local Setup

### Prerequisites
- Node.js 18+
- Python 3.11+
- npm 9+

### Install dependencies

```bash
# Frontend + root devDependencies
npm install

# Backend
cd apps/api
pip install -r requirements.txt
cd ../..
```

### Seed the database

```bash
npm run seed
```

### Start development servers

```bash
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:8000
- API docs: http://localhost:8000/docs

### Run backend tests

```bash
npm run test:api
```

## Environment Variables

Copy `.env.example` to `.env` in `apps/api/` and adjust as needed.

## Key Business Rules

1. **Liabilities are never subtracted from net worth** — shown separately in TCC report
2. **Trust value is excluded from Non-Retirement Total** — it has its own line in grand total
3. **Private Reserve Target = 6 × monthly outflow** (insurance deductibles added in V2)
4. **No external API calls in V1** — all data is manually entered
