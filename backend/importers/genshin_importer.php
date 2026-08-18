<?php
// Simple Genshin importer prototype.
// Usage: php importers/genshin_importer.php [path_or_url_to_json]

require_once __DIR__ . '/../db.php';

$source = $argv[1] ?? __DIR__ . '/../sample_genshin.json';
$content = null;
if (filter_var($source, FILTER_VALIDATE_URL)) {
    $content = @file_get_contents($source);
} else {
    $content = @file_get_contents($source);
}

if ($content === false) {
    fwrite(STDERR, "Unable to read source: $source\n");
    exit(1);
}

$items = json_decode($content, true);
if (!is_array($items)) {
    fwrite(STDERR, "Invalid JSON in source\n");
    exit(1);
}

$pdo = get_pdo();
$count = 0;
foreach ($items as $it) {
    $name = $it['name'] ?? null;
    if (!$name) continue;
    $start = !empty($it['start_time']) ? (new DateTime($it['start_time']))->format(DateTime::ATOM) : null;
    $end = !empty($it['end_time']) ? (new DateTime($it['end_time']))->format(DateTime::ATOM) : null;
    $srcUrl = $it['source_url'] ?? null;

    // Try to find an existing event matching source_url or name+start
    $found = null;
    if ($srcUrl) {
        $stmt = $pdo->prepare('SELECT id FROM events WHERE source_url = :url LIMIT 1');
        $stmt->execute([':url' => $srcUrl]);
        $found = $stmt->fetchColumn();
    }
    if (!$found) {
        $stmt = $pdo->prepare('SELECT id FROM events WHERE name = :name AND start_time = :start LIMIT 1');
        $stmt->execute([':name' => $name, ':start' => $start]);
        $found = $stmt->fetchColumn();
    }

    if ($found) {
        // Update existing
        $stmt = $pdo->prepare('UPDATE events SET description = :desc, end_time = :end_time, updated_at = now(), is_automatic = true WHERE id = :id');
        $stmt->execute([':desc' => $it['description'] ?? null, ':end_time' => $end, ':id' => $found]);
    } else {
        // Insert new
        $stmt = $pdo->prepare('INSERT INTO events (name, description, start_time, end_time, category, source, source_url, is_automatic, is_confirmed) VALUES (:name, :desc, :start_time, :end_time, :category, :source, :source_url, true, false) RETURNING id');
        $stmt->execute([
            ':name' => $name,
            ':desc' => $it['description'] ?? null,
            ':start_time' => $start,
            ':end_time' => $end,
            ':category' => $it['category'] ?? 'game',
            ':source' => 'genshin_importer',
            ':source_url' => $srcUrl
        ]);
    }
    $count++;
}

echo "Imported/updated $count items\n";
