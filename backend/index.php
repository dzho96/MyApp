<?php
header('Content-Type: application/json');

// Basic CORS for local development. Adjust in production.
if (isset($_SERVER['HTTP_ORIGIN'])) {
    header('Access-Control-Allow-Origin: ' . $_SERVER['HTTP_ORIGIN']);
} else {
    header('Access-Control-Allow-Origin: *');
}
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    // respond to preflight
    exit;
}

require_once __DIR__ . '/db.php';

$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

const ALLOWED_CATEGORIES = ['personal', 'work', 'games'];

// Very small router for development.
try {
    if ($path === '/api') {
        echo json_encode(['service' => 'Personal Time API', 'version' => '0.1']);
        exit;
    }

    if (strpos($path, '/api/events') === 0) {
        // Route: /api/events or /api/events/{id}
        // GET /api/events -> list
        // POST /api/events -> create
        // PUT /api/events/{id} -> update
        // DELETE /api/events/{id} -> delete
        $matches = [];

        if ($method === 'GET') {
            try {
                $pdo = get_pdo();
                $stmt = $pdo->query('SELECT id, name, description, start_time, end_time, category, requires_action, completed FROM events ORDER BY start_time NULLS LAST LIMIT 100');
                $events = $stmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($events as &$event) {
                    $event['requires_action'] = (bool)$event['requires_action'];
                    $event['completed'] = (bool)$event['completed'];
                }
                unset($event);
            } catch (Exception $e) {
                $events = [];
            }
            echo json_encode(['events' => $events]);
            exit;
        }

        if ($method === 'POST') {
            $body = json_decode(file_get_contents('php://input'), true);
            if (!$body || empty($body['name'])) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid payload: name is required']);
                exit;
            }
            // Basic validation: name length, category, and datetime formats
            $errors = [];
            if (strlen($body['name']) > 255) $errors[] = 'name: too long';
            if (!empty($body['category']) && !in_array($body['category'], ALLOWED_CATEGORIES, true)) {
                $errors[] = 'category: must be one of ' . implode(', ', ALLOWED_CATEGORIES);
            }
            $start = null; $end = null;
            if (!empty($body['start_time'])) {
                try { $start = new DateTime($body['start_time']); } catch (Exception $e) { $errors[] = 'start_time: invalid format'; }
            }
            if (!empty($body['end_time'])) {
                try { $end = new DateTime($body['end_time']); } catch (Exception $e) { $errors[] = 'end_time: invalid format'; }
            }
            if ($start && $end && $start > $end) $errors[] = 'start_time must be before end_time';
            if (!empty($errors)) {
                http_response_code(400);
                echo json_encode(['error' => 'validation_failed', 'details' => $errors]);
                exit;
            }
            try {
                $pdo = get_pdo();
                $sql = 'INSERT INTO events (name, description, start_time, end_time, category, game_id, user_id, source, source_url, is_automatic, is_confirmed, requires_action, completed) VALUES (:name, :description, :start_time, :end_time, :category, :game_id, :user_id, :source, :source_url, :is_automatic, :is_confirmed, :requires_action, :completed) RETURNING id';
                $stmt = $pdo->prepare($sql);
                $stmt->execute([
                    ':name' => $body['name'],
                    ':description' => $body['description'] ?? null,
                    ':start_time' => isset($body['start_time']) ? ($start ? $start->format(DateTime::ATOM) : null) : null,
                    ':end_time' => isset($body['end_time']) ? ($end ? $end->format(DateTime::ATOM) : null) : null,
                    ':category' => $body['category'] ?? null,
                    ':game_id' => $body['game_id'] ?? null,
                    ':user_id' => $body['user_id'] ?? null,
                    ':source' => $body['source'] ?? null,
                    ':source_url' => $body['source_url'] ?? null,
                    ':is_automatic' => isset($body['is_automatic']) ? (bool)$body['is_automatic'] : false,
                    ':is_confirmed' => isset($body['is_confirmed']) ? (bool)$body['is_confirmed'] : false,
                    ':requires_action' => isset($body['requires_action']) ? (bool)$body['requires_action'] : false,
                    ':completed' => isset($body['completed']) ? (bool)$body['completed'] : false
                ]);
                $id = $stmt->fetchColumn();
                http_response_code(201);
                echo json_encode(['id' => $id]);
                exit;
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(['error' => 'Insert failed']);
                exit;
            }
        }

        if (preg_match('#^/api/events/(\d+)$#', $path, $matches)) {
            $eventId = (int)$matches[1];

            if ($method === 'PUT') {
                $body = json_decode(file_get_contents('php://input'), true);
                if (!$body || empty($body['name'])) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Invalid payload: name is required']);
                    exit;
                }
                // Validation similar to create
                $errors = [];
                if (strlen($body['name']) > 255) $errors[] = 'name: too long';
                if (!empty($body['category']) && !in_array($body['category'], ALLOWED_CATEGORIES, true)) {
                    $errors[] = 'category: must be one of ' . implode(', ', ALLOWED_CATEGORIES);
                }
                $start = null; $end = null;
                if (!empty($body['start_time'])) {
                    try { $start = new DateTime($body['start_time']); } catch (Exception $e) { $errors[] = 'start_time: invalid format'; }
                }
                if (!empty($body['end_time'])) {
                    try { $end = new DateTime($body['end_time']); } catch (Exception $e) { $errors[] = 'end_time: invalid format'; }
                }
                if ($start && $end && $start > $end) $errors[] = 'start_time must be before end_time';
                if (!empty($errors)) {
                    http_response_code(400);
                    echo json_encode(['error' => 'validation_failed', 'details' => $errors]);
                    exit;
                }
                try {
                    $pdo = get_pdo();
                    $sql = 'UPDATE events SET name = :name, description = :description, start_time = :start_time, end_time = :end_time, category = :category, requires_action = :requires_action, completed = :completed, updated_at = now() WHERE id = :id';
                    $stmt = $pdo->prepare($sql);
                    $stmt->execute([
                        ':name' => $body['name'],
                        ':description' => $body['description'] ?? null,
                        ':start_time' => isset($body['start_time']) ? ($start ? $start->format(DateTime::ATOM) : null) : null,
                        ':end_time' => isset($body['end_time']) ? ($end ? $end->format(DateTime::ATOM) : null) : null,
                        ':category' => $body['category'] ?? null,
                        ':requires_action' => isset($body['requires_action']) ? (bool)$body['requires_action'] : false,
                        ':completed' => isset($body['completed']) ? (bool)$body['completed'] : false,
                        ':id' => $eventId
                    ]);
                    echo json_encode(['status' => 'ok']);
                    exit;
                } catch (Exception $e) {
                    http_response_code(500);
                    echo json_encode(['error' => 'Update failed']);
                    exit;
                }
            }

            if ($method === 'DELETE') {
                try {
                    $pdo = get_pdo();
                    $stmt = $pdo->prepare('DELETE FROM events WHERE id = :id');
                    $stmt->execute([':id' => $eventId]);
                    echo json_encode(['status' => 'deleted']);
                    exit;
                } catch (Exception $e) {
                    http_response_code(500);
                    echo json_encode(['error' => 'Delete failed']);
                    exit;
                }
            }
        }

        // unsupported method for this path
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
        exit;
    }

    http_response_code(404);
    echo json_encode(['error' => 'Not found']);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Server error']);
}
