# Backend (PHP)

This is a minimal PHP API stub for local development.

Start a development server with the PHP built-in server:

```bash
cd backend
php -S localhost:8000
```

Visit `http://localhost:8000/api` to see the stub response.

Later steps: replace this stub with a proper framework (Slim/Laravel) and
implement PostgreSQL connectivity.

Quick API examples (assuming server at http://localhost:8000):

# List events
```bash
curl http://localhost:8000/api/events
```

# Create event
```bash
curl -X POST http://localhost:8000/api/events -H "Content-Type: application/json" -d '{"name":"Test event","description":"Demo","start_time":null}'
```

# Update event (id 1)
```bash
curl -X PUT http://localhost:8000/api/events/1 -H "Content-Type: application/json" -d '{"name":"Updated name","description":"New"}'
```

# Delete event (id 1)
```bash
curl -X DELETE http://localhost:8000/api/events/1
```

Docker notes:
- Start services: `docker compose up -d`
- Run migrations: `docker compose exec api php migrate.php`

