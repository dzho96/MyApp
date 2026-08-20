# MyApp

Personal Project — a personal time-sensitive information hub (schedule,
reminders, game event tracking) with a web app, a mobile app, and a
shared PHP + PostgreSQL backend.

## Documentation

| Doc | What it's for |
|---|---|
| [`docs/SETUP_WEB.md`](docs/SETUP_WEB.md) | Get the web app + backend + database running locally (Docker) |
| [`docs/SETUP_MOBILE.md`](docs/SETUP_MOBILE.md) | Get the Expo mobile app running locally, including physical-device setup |
| [`docs/USER_MANUAL.md`](docs/USER_MANUAL.md) | Full usage guide: API reference, troubleshooting, native (non-Docker) setup |
| [`docs/DESIGN.md`](docs/DESIGN.md) | Original design document — project vision, architecture, and roadmap |
| [`db/migrations/README.md`](db/migrations/README.md) | How to write and apply database migrations |

## Quick Start

```bash
docker compose up -d
docker compose exec api php migrate.php
cd web && npm install && npm run dev
```

See `docs/SETUP_WEB.md` for full details, and `docs/SETUP_MOBILE.md` if
you also want to run the mobile app.
