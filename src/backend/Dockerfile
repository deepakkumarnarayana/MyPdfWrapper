# Stage 1: Builder - Install dependencies
FROM python:3.11-slim-bullseye AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y build-essential

# Set up virtual environment
ENV VIRTUAL_ENV=/app/venv
RUN python -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Copy and install requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Stage 2: Final - Create the production image
FROM python:3.11-slim-bullseye AS final

WORKDIR /app

# Copy virtual environment from builder
COPY --from=builder /app/venv /app/venv

# Activate virtual environment
ENV PATH="/app/venv/bin:$PATH"

# Copy application code
COPY . .

# Expose the port the app runs on
EXPOSE 8000

# Command to run the application
# Use gunicorn for production with uvicorn workers
CMD ["gunicorn", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "main:app", "-b", "0.0.0.0:8000"]
