# ── Stage 1: Build frontend ────────────────────────────────────────────────────
FROM node:20-alpine AS frontend
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

# api/ sub-modules use bare imports (e.g. "from database import ...").
# Adding /app/api to PYTHONPATH lets them resolve while uvicorn
# is launched as "api.main:app" from /app.
ENV PYTHONPATH=/app/api

# Seed demo data into the image at build time
RUN py api/seed.py

EXPOSE 8000
CMD ["/bin/sh", "-c", "uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
