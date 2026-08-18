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

// PDO's pgsql driver does not reliably cast native PHP booleans to Postgres
// boolean literals when bound as prepared statement parameters (it can send
// an empty string instead, which Postgres rejects for a BOOLEAN column).
// Always pass booleans through this helper before binding.
function pg_bool($value) {
    return $value ? 'true' : 'false';
}

function sync_event_requires_action($pdo, $eventId) {
    // Adding a sub-task implies the parent event is actionable.
    $stmt = $pdo->prepare('UPDATE events SET requires_action = true, updated_at = now() WHERE id = :id');
    $stmt->execute([':id' => $eventId]);
}

function get_task_summary($pdo, $eventIds) {
    if (empty($eventIds)) return [];
    $placeholders = implode(',', array_fill(0, count($eventIds), '?'));
    $stmt = $pdo->prepare("SELECT event_id, COUNT(*) AS total, SUM(CASE WHEN completed THEN 1 ELSE 0 END) AS done FROM event_tasks WHERE event_id IN ($placeholders) GROUP BY event_id");
    $stmt->execute(array_values($eventIds));
    $summary = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $summary[$row['event_id']] = ['total' => (int)$row['total'], 'done' => (int)$row['done']];
    }
    return $summary;
}

// Very small router for development.
try {
    if ($path === '/api') {
        echo json_encode(['service' => 'Personal Time API', 'version' => '0.1']);
        exit;
    }

    // ---- Sub-tasks: /api/events/{id}/tasks and /api/events/{id}/tasks/{taskId} ----
    $taskMatches = [];
    if (preg_match('#^/api/events/(\d+)/tasks/(\d+)$#', $path, $taskMatches)) {
        $eventId = (int)$taskMatches[1];
        $taskId = (int)$taskMatches[2];

        if ($method === 'PUT') {
            $body = json_decode(file_get_contents('php://input'), true);
            $errors = [];
            if (isset($body['name']) && strlen($body['name']) > 255) $errors[] = 'name: too long';
            if (!empty($errors)) {
                http_response_code(400);
                echo json_encode(['error' => 'validation_failed', 'details' => $errors]);
                exit;
            }
            try {
                $pdo = get_pdo();
                $sql = 'UPDATE event_tasks SET name = COALESCE(:name, name), completed = COALESCE(:completed, completed), updated_at = now() WHERE id = :id AND event_id = :event_id';
                $stmt = $pdo->prepare($sql);
                $stmt->execute([
                    ':name' => $body['name'] ?? null,
                    ':completed' => isset($body['completed']) ? pg_bool($body['completed']) : null,
                    ':id' => $taskId,
                    ':event_id' => $eventId
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
                $stmt = $pdo->prepare('DELETE FROM event_tasks WHERE id = :id AND event_id = :event_id');
                $stmt->execute([':id' => $taskId, ':event_id' => $eventId]);
                echo json_encode(['status' => 'deleted']);
                exit;
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(['error' => 'Delete failed']);
                exit;
            }
        }

        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
        exit;
    }

    $tasksListMatches = [];
    if (preg_match('#^/api/events/(\d+)/tasks$#', $path, $tasksListMatches)) {
        $eventId = (int)$tasksListMatches[1];

        if ($method === 'GET') {
            try {
                $pdo = get_pdo();
                $stmt = $pdo->prepare('SELECT id, event_id, name, completed, sort_order FROM event_tasks WHERE event_id = :event_id ORDER BY sort_order ASC, id ASC');
                $stmt->execute([':event_id' => $eventId]);
                $tasks = $stmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($tasks as &$task) {
                    $task['completed'] = (bool)$task['completed'];
                }
                unset($task);
            } catch (Exception $e) {
                $tasks = [];
            }
            echo json_encode(['tasks' => $tasks]);
            exit;
        }

        if ($method === 'POST') {
            $body = json_decode(file_get_contents('php://input'), true);
            if (!$body || empty($body['name'])) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid payload: name is required']);
                exit;
            }
            if (strlen($body['name']) > 255) {
                http_response_code(400);
                echo json_encode(['error' => 'validation_failed', 'details' => ['name: too long']]);
                exit;
            }
            try {
                $pdo = get_pdo();
                $sql = 'INSERT INTO event_tasks (event_id, name, completed, sort_order) VALUES (:event_id, :name, :completed, :sort_order) RETURNING id';
                $stmt = $pdo->prepare($sql);
                $stmt->execute([
                    ':event_id' => $eventId,
                    ':name' => $body['name'],
                    ':completed' => pg_bool(isset($body['completed']) ? $body['completed'] : false),
                    ':sort_order' => isset($body['sort_order']) ? (int)$body['sort_order'] : 0
                ]);
                $id = $stmt->fetchColumn();
                sync_event_requires_action($pdo, $eventId);
                http_response_code(201);
                echo json_encode(['id' => $id]);
                exit;
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(['error' => 'Insert failed']);
                exit;
            }
        }

        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
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

                $eventIds = array_map(fn($e) => $e['id'], $events);
                $taskSummary = get_task_summary($pdo, $eventIds);
                foreach ($events as &$event) {
                    $summary = $taskSummary[$event['id']] ?? null;
                    $event['task_count'] = $summary ? $summary['total'] : 0;
                    $event['completed_task_count'] = $summary ? $summary['done'] : 0;
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
                    ':is_automatic' => pg_bool(isset($body['is_automatic']) ? $body['is_automatic'] : false),
                    ':is_confirmed' => pg_bool(isset($body['is_confirmed']) ? $body['is_confirmed'] : false),
                    ':requires_action' => pg_bool(isset($body['requires_action']) ? $body['requires_action'] : false),
                    ':completed' => pg_bool(isset($body['completed']) ? $body['completed'] : false)
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
                        ':requires_action' => pg_bool(isset($body['requires_action']) ? $body['requires_action'] : false),
                        ':completed' => pg_bool(isset($body['completed']) ? $body['completed'] : false),
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
