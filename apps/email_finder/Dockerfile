FROM python:3.12-slim

# Playwright/Chromium system deps (for crawl4ai browser automation).
# Mirrors what `playwright install --with-deps chromium` would do, but
# done at image-build time so the container starts with everything ready.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libpango-1.0-0 libcairo2 libasound2 libatspi2.0-0 \
    fonts-liberation libappindicator3-1 libxshmfence1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && python -m playwright install chromium

COPY . .

ENV PYTHONUNBUFFERED=1
ENV PORT=8002

EXPOSE 8002

CMD ["python", "main.py"]
