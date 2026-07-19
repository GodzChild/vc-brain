# Backend (FastAPI) container — deployable to Render, Fly.io, Cloud Run, etc.
FROM python:3.12-slim

# libgomp1 is a runtime dependency of onnxruntime (pulled in transitively by
# chromadb). Without it the container crashes on first vector-store use.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first so this layer caches across code changes.
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Application code + seeded demo/live datasets.
COPY backend ./backend

EXPOSE 8000
# Hosts (Render, Cloud Run, …) inject $PORT; default to 8000 for local runs.
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
