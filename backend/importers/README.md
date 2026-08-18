Genshin Importer Prototype
==========================

This folder contains a simple prototype importer that reads a JSON feed
of events and upserts them into the `events` table. It's intended as a
starting point for building robust importers (HTTP fetching, HTML
parsing, rate-limiting, and user confirmation workflows).

Usage

```bash
php importers/genshin_importer.php path/to/feed.json
# or a URL
php importers/genshin_importer.php https://example.com/feed.json
```

The script will mark inserted events as `is_automatic = true` and set
`source = 'genshin_importer'` and store the `source_url` when available.

Next steps
- Add HTTP fetch error handling and caching
- Add HTML parsing for sources without JSON feeds
- Add a confirmation workflow so imported events can be reviewed
  before becoming active
