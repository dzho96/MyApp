<?php
// Simple PDO-based Postgres connector using environment variables.
function get_db_config() {
    return [
        'host' => getenv('DB_HOST') ?: '127.0.0.1',
        'port' => getenv('DB_PORT') ?: 5432,
        'dbname' => getenv('DB_NAME') ?: 'pti_db',
        'user' => getenv('DB_USER') ?: 'pti_user',
        'pass' => getenv('DB_PASS') ?: 'pti_pass'
    ];
}

function get_pdo() {
    static $pdo = null;
    if ($pdo) return $pdo;
    $c = get_db_config();
    $dsn = sprintf('pgsql:host=%s;port=%s;dbname=%s', $c['host'], $c['port'], $c['dbname']);
    try {
        $pdo = new PDO($dsn, $c['user'], $c['pass'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    } catch (Exception $e) {
        // Do not expose credentials; throw a generic exception
        throw new Exception('Unable to connect to database: ' . $e->getMessage());
    }
    return $pdo;
}
