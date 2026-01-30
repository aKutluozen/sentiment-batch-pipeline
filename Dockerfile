# A CLEAN environment setup!

# Minimal OS for running a Python 3.11 application
FROM python:3.11-slim

# Keep Python artifacts out of the container
ENV PYTHONDONTWRITEBYTECODE=1
# Keep stdout and stderr unbuffered - TODO: TRY REMOVING THIS
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# CA certificates are often needed for HTTPS requests, Hugging Face needs this
# TODO: TRY REMOVING THIS
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "-m", "app.main"]
