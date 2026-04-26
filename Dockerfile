FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (for better caching)
COPY requirements.txt .

# Install Python dependencies using requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy data files
COPY data/CancerQA_data.csv data/CancerQA_data.csv
COPY data/ground-truth-retrieval_v2.csv data/ground-truth-retrieval_v2.csv

# Copy grafana configuration
COPY grafana/ grafana/

# Copy the main application
COPY Cancer_chatbot/ .

# Copy additional files that might be needed
COPY cli.py .

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV DATA_PATH=data/CancerQA_data.csv
ENV PORT=5001
ENV GROQ_API_KEY=
ENV GROQ_API_KEY_FALLBACK=
ENV GROQ_API_KEY_SECONDARY=

EXPOSE 5001

# Health check disabled for Render compatibility
# HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
#     CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5001/')" || exit 1

# Use PORT env variable and normalize fallback key aliases for Railway
CMD ["/bin/sh", "-c", "export GROQ_API_KEY_FALLBACK=\"${GROQ_API_KEY_FALLBACK:-${GROQ_API_KEY_SECONDARY:-${GROQ_API_KEY_2:-}}}\"; if [ -n \"$GROQ_API_KEY\" ] && [ -n \"$GROQ_API_KEY_FALLBACK\" ]; then echo 'Groq key mode: primary + fallback configured.'; elif [ -n \"$GROQ_API_KEY\" ]; then echo 'Groq key mode: primary only configured (no fallback).'; elif [ -n \"$GROQ_API_KEY_FALLBACK\" ]; then echo 'Groq key mode: fallback only configured (primary missing).'; else echo 'WARNING: No Groq keys configured. Set GROQ_API_KEY and/or GROQ_API_KEY_FALLBACK in Railway variables.'; fi; exec gunicorn --bind 0.0.0.0:${PORT:-5001} --workers 2 --timeout 120 app:app"]