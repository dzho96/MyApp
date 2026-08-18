# Database Migrations


This folder holds incremental SQL migrations for the `pti_db` Postgres database,
separate from `db/schema.sql` (which reflects the full schema for a **fresh**
database). Use this folder any time you need to update an **existing** database
without losing data.


## Naming Convention


Files are numbered in the order they should be applied:


```
0001_actionable_events_and_subtasks.sql
0002_reminders.sql
0003_next_change.sql
...
```


Always create a new numbered file for each change — never edit a migration
that has already been applied to any environment (local, staging, prod).
If a past migration was wrong, write a new migration that corrects it.


## How to Run a Migration (Docker setup)


This project runs Postgres via Docker Compose (service name `db`, database
`pti_db`, user `pti_user`, per `docker-compose.yml`). To apply a migration:


1. Make sure the database container is running:


   ```
   docker compose up -d db
   ```


2. Pipe the migration file into `psql` inside the running container.


   **macOS/Linux (bash/zsh):**


   ```bash
   docker compose exec -T db psql -U pti_user -d pti_db < db/migrations/0001_actionable_events_and_subtasks.sql
   ```


   **Windows (PowerShell):** PowerShell does not support the bash-style `<`
   stdin redirect — it will raise `RedirectionNotSupported`. Use `Get-Content`
   piped in instead:


   ```powershell
   Get-Content db/migrations/0001_actionable_events_and_subtasks.sql | docker compose exec -T db psql -U pti_user -d pti_db
   ```


   `-T` disables pseudo-TTY allocation, which is required for piping input
   into the container on both platforms.


3. Verify it applied cleanly — check for new columns/tables:


   ```
   docker compose exec db psql -U pti_user -d pti_db -c "\d events"
   docker compose exec db psql -U pti_user -d pti_db -c "\d event_tasks"
   docker compose exec db psql -U pti_user -d pti_db -c "\d reminders"
   ```


If you're running Postgres outside Docker (e.g. a managed cloud instance),
connect directly with `psql`:


```
psql -h <host> -U pti_user -d pti_db -f db/migrations/0001_actionable_events_and_subtasks.sql
```


## Before Running Any Migration


- **Back up first** if this is a database you care about:


  ```bash
  docker compose exec db pg_dump -U pti_user pti_db > backup_$(date +%Y%m%d_%H%M%S).sql
  ```


  PowerShell equivalent:


  ```powershell
  docker compose exec db pg_dump -U pti_user pti_db > "backup_$(Get-Date -Format yyyyMMdd_HHmmss).sql"
  ```


- Check for data that might conflict with new constraints. For example,
  migration `0001` adds a `CHECK (category IN ('personal', 'work', 'games'))`
  constraint — inspect existing values first:


  ```
  docker compose exec db psql -U pti_user -d pti_db -c "SELECT DISTINCT category FROM events;"
  ```


  If you have category values other than `personal`/`work`/`games`, edit the
  migration's `UPDATE` statements to map your actual legacy values before
  running it, otherwise those rows will have `category` set to `NULL`.


## Applying All Migrations in Order (fresh or catching up)


Run them in numeric order — each file is written to be safe to re-run
(idempotent), so running an already-applied migration again is a no-op.


**macOS/Linux (bash/zsh):**


```bash
for f in db/migrations/*.sql; do
  echo "Applying $f..."
  docker compose exec -T db psql -U pti_user -d pti_db < "$f"
done
```


**Windows (PowerShell):**


```powershell
Get-ChildItem db/migrations/*.sql | Sort-Object Name | ForEach-Object {
    Write-Host "Applying $($_.Name)..."
    Get-Content $_.FullName | docker compose exec -T db psql -U pti_user -d pti_db
}
```


## Migration Log


| File | Summary |
|---|---|
| `0001_actionable_events_and_subtasks.sql` | Adds `requires_action`/`completed` to `events`, restricts `category` to `personal`/`work`/`games`, adds the `event_tasks` sub-task table and supporting indexes. |
| `0002_reminders.sql` | Adds the `reminders` table (per-event scheduled notifications, supports multiple reminders per event, snooze via `snoozed_from_id` self-reference, `push`/`web_push` delivery methods) and supporting indexes. |
