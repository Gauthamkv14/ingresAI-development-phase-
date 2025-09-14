# backend/Dockerfile
FROM python:3.11-slim

ARG PIP_DEFAULT_TIMEOUT=100

ENV PIP_DEFAULT_TIMEOUT=${PIP_DEFAULT_TIMEOUT}
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies (compact & noninteractive)
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y \
    gcc \
    g++ \
    postgresql-client \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (cache-friendly)
COPY requirements.txt .

# Upgrade pip/tools then install requirements
RUN python -m pip install --upgrade pip setuptools wheel \
 && pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p uploads data logs

# Healthcheck (expects /health)
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

EXPOSE 8000

# Run the application (adjust if you use uvicorn/gunicorn)
CMD ["python", "mcp_server.py"]
