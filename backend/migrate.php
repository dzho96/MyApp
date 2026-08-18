<?php
// Run this script to create the initial schema in the configured Postgres DB.
require_once __DIR__ . '/db.php';

try {
    $pdo = get_pdo();
    $schemaPaths = [
        __DIR__ . '/../db/schema.sql',
        '/srv/db/schema.sql'
    ];
    $sql = false;
    foreach ($schemaPaths as $path) {
        $sql = @file_get_contents($path);
        if ($sql !== false) {
            break;
        }
    }
    if ($sql === false) {
        throw new Exception('Unable to read schema.sql');
    }
    // Execute the SQL blob. For simplicity, assume the driver accepts multiple statements.
    $pdo->exec($sql);
    echo "Migration applied successfully\n";
} catch (Exception $e) {
    fwrite(STDERR, "Migration failed: " . $e->getMessage() . "\n");
    exit(1);
}
