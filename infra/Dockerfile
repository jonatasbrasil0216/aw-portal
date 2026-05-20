# ── Stage 1: Build frontend ────────────────────────────────────────────────────
FROM node:18-alpine AS frontend
WORKDIR /repo

# Install deps (copy manifests first for layer caching)
COPY package.json ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY apps/web/package.json             ./apps/web/
RUN npm install

# Copy source and build
COPY packages/shared-types/ ./packages/shared-types/
COPY apps/web/              ./apps/web/
RUN npm run build --workspace=apps/web

# ── Stage 2: Python backend ────────────────────────────────────────────────────
FROM python:3.11-slim
WORKDIR /app

COPY apps/api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY apps/api/ ./api/
COPY --from=frontend /repo/apps/web/dist/ ./web/dist/

EXPOSE 8000
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
