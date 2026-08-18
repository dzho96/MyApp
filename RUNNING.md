# Quick Run Steps

Minimal steps to get the project running locally (recommended: Docker).

1) Start services with Docker Compose

```bash
# From the repository root
docker compose up -d
```

2) Apply database migrations

```bash
docker compose exec api php migrate.php
```

3) Start the web dev server

```bash
cd web
npm install
npm run dev
```

Windows PowerShell note
- If PowerShell shows `npm.ps1 cannot be loaded because running scripts is disabled`, use `npm.cmd` instead:

```bash
cd web
npm.cmd install
npm.cmd run dev
```

- Optional permanent fix (run PowerShell as your user):

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

4) Open the web app

Visit the Vite dev URL (typically http://localhost:5173) and the API at http://localhost:8000/api

Notes
- If you do not have PHP with `pdo_pgsql` available inside the `api` container, run `php migrate.php` on a machine with PHP + `pdo_pgsql` configured, or install the extension in the container before running migrations.
- For mobile testing with a physical device, update the `VITE_API_BASE` or use your PC's local IP address so the device can reach the backend.

Production deploy (Docker Compose)

1. Copy the example env and edit values:

```bash
cp .env.production.example .env.production
# edit .env.production as needed
```

2. Build and start production services:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

3. Apply migrations (run inside `api` container):

```bash
docker compose -f docker-compose.prod.yml exec api php migrate.php
```

The web UI will be available on port 80 by default.

