FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first
COPY backend/requirements.txt .
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Copy the entire backend directory structure
COPY backend/ ./backend/

# Set working directory to the backend folder
WORKDIR /app/backend

EXPOSE 8000

# Now run from the backend directory
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]