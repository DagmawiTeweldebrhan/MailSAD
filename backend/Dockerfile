# ================================================
# Stage 1: Build dependencies
# ================================================
FROM python:3.11-slim AS builder

WORKDIR /build

# Install compilation tools needed for C-extensions (e.g. asyncpg/hiredis)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Build wheels in a wheels directory
RUN pip install --no-cache-dir --user -r requirements.txt

# ================================================
# Stage 2: Final runtime image
# ================================================
FROM python:3.11-slim AS runner

WORKDIR /app

# Install runtime database clients
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /root/.local /root/.local
COPY . /app

ENV PATH=/root/.local/bin:$PATH
ENV PYTHONPATH=/app

EXPOSE 8000

# We use uvicorn to run the app by default (this is overridden in docker-compose for the worker)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
