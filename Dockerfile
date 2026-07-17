FROM node:20-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ backend/
COPY --from=frontend-build /app/frontend/dist frontend/dist

EXPOSE 8000
# Railway/Render/Fly assign the port dynamically via $PORT and route traffic
# to whatever that is — a hardcoded --port 8000 would silently not receive
# any traffic on those platforms. Shell form (not exec/JSON-array form) so
# $PORT actually gets substituted; falls back to 8000 for local `docker run`.
CMD python -m uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}
