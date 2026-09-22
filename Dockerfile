# DHRUVA — single-container deploy: builds the Vite client, runs FastAPI + serves static files same-origin.

# ---- stage 1: build the React client ----
FROM node:22-alpine AS client
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ .
RUN npm run build

# ---- stage 2: FastAPI backend ----
FROM python:3.12-slim AS backend
WORKDIR /app
COPY server/requirements.txt server/requirements.txt
RUN pip install --no-cache-dir -r server/requirements.txt
COPY server/ server/
COPY --from=client /app/client/dist client/dist
WORKDIR /app/server

ENV DATABASE_URL=sqlite:////data/dhruva.db
ENV CORS_ORIGINS=
ENV SEED_DEMO=true

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]