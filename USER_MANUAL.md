# Personal Time & Information — User Manual

This manual explains how to set up, run, and use the monorepo for the
Personal Time & Information project. It includes developer-focused
run steps, API reference, and troubleshooting tips.

**Contents**
- Overview
- Prerequisites
- Quick start (Docker)
- Native setup (no Docker)
- Web development
- Mobile development (Expo)
- Backend API reference
- Database & migrations
- Troubleshooting
- Contributing

Overview
--------

The repository contains a small PHP backend (simple REST API), a React
web client (Vite), and notes for a React Native mobile app (Expo).

Prerequisites
-------------

- Docker & Docker Compose (recommended)
- Node.js (16+) and npm/yarn for the web client
- PHP 8+ with `pdo_pgsql` if you plan to run migrations or the API
  natively

Quick start (recommended: Docker)
---------------------------------

1. Start services

```bash
docker compose up -d
```

2. Apply database schema

```bash
docker compose exec api php migrate.php
```

3. Start the web client

```bash
cd web
npm install
npm run dev
```

4. Open the app in the browser

Visit the Vite URL (http://localhost:5173 by default) and the API root at http://localhost:8000/api

Native setup (without Docker)
-----------------------------

1. PostgreSQL — install and start Postgres. Create a DB and user (or use
   the defaults in `backend/.env.example`).

2. Set environment variables for the backend (or copy `.env.example` to
   `.env` and edit accordingly):

```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=pti_db
DB_USER=pti_user
DB_PASS=pti_pass
```

3. Run the PHP built-in server from `backend/`:

```bash
cd backend
php -S localhost:8000
```

4. Run migrations (host PHP must have `pdo_pgsql` enabled):

```bash
php migrate.php
```

Web development
---------------

The web client is a Vite + React app in the `web/` folder.

Commands

```bash
cd web
npm install
npm run dev    # start development server (Vite)
npm run build  # produce production build
```

Windows PowerShell note

- If you see `npm.ps1 cannot be loaded because running scripts is disabled`, run:

```bash
cd web
npm.cmd install
npm.cmd run dev
```

- Optional policy fix:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Configuration

- The web client reads `VITE_API_BASE` from `web/.env` to target the API.

Mobile development (Expo)
-------------------------

The `mobile/README.md` contains notes. To create and run an Expo app:

```bash
cd mobile
npx create-expo-app .
npm install
npx expo start
```

When testing on a physical device, ensure the mobile app can reach the
backend API by using your machine's LAN IP address instead of `localhost`.

Backend API reference
---------------------

Base URL: `http://<host>:8000`

Endpoints

- GET /api — service info

- GET /api/events
  - Response: { events: [ { id, name, description, start_time, end_time, category } ] }

- POST /api/events
  - Request JSON body (example):
    {
      "name": "Event name",
      "description": "Optional",
      "start_time": "2026-08-13T12:00:00Z",  // ISO 8601 or null
      "end_time": "2026-08-13T14:00:00Z",    // ISO 8601 or null
      "category": "work"
    }
  - Responses:
    - 201: { id: <new id> }
    - 400: validation errors (missing name, invalid datetime, start> end)

- PUT /api/events/{id}
  - Body similar to POST; updates the event. Returns 200 on success.

- DELETE /api/events/{id}
  - Deletes the event. Returns 200 with { status: 'deleted' } on success.

Examples (curl)

```bash
# List events
curl http://localhost:8000/api/events

# Create event
curl -X POST http://localhost:8000/api/events -H "Content-Type: application/json" -d '{"name":"Demo","start_time":"2026-08-13T12:00:00Z"}'

# Update event id 1
curl -X PUT http://localhost:8000/api/events/1 -H "Content-Type: application/json" -d '{"name":"Updated"}'

# Delete id 1
curl -X DELETE http://localhost:8000/api/events/1
```

Database & migrations
---------------------

- Schema is in `db/schema.sql` and is applied by `backend/migrate.php`.
- The migration script uses PDO to connect to Postgres using the usual
  environment variables (`DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`).

Troubleshooting
---------------

- PDO driver errors: the migration or API may fail if PHP does not have
  the `pdo_pgsql` extension. If you see "Unable to connect to database"
  or PDO driver errors, ensure `pdo_pgsql` is installed in your PHP
  environment or in the container image.
- Docker port conflicts: if port 5432 or 8000 is already in use, stop
  the conflicting service or change the ports in `docker-compose.yml`.
- Web client cannot reach API from device: use your machine's LAN IP or
  set up a tunnel with Expo for mobile testing.

Contributing
------------

- Follow standard GitHub flow: create branches, open PRs, run tests.
- Recommended improvements: replace the PHP stub with a lightweight
  framework (Slim/Laravel), add authentication, implement scheduler,
  and add tests.

Security notes
--------------

- This scaffold is for development. Do not use the default settings in
  production. Add authentication, rate-limiting, secure storage for
  credentials, and proper CORS policies before public deployment.
