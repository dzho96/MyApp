FROM php:8.1-cli

# Install system deps required for pdo_pgsql
RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq-dev git unzip zlib1g-dev \
    && docker-php-ext-install pdo_pgsql \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv/backend

# Copy backend sources and shared DB schema
COPY backend /srv/backend
COPY db /srv/db

EXPOSE 8000

CMD ["php", "-S", "0.0.0.0:8000", "-t", "/srv/backend"]
