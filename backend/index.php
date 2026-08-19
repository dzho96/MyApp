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
    exit;
}



require_once __DIR__ . '/db.php';



$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);



const ALLOWED_CATEGORIES = ['personal', 'work', 'games'];



function pg_bool($value) {
    return $value ? 'true' : 'false';
}



function to_iso8601($value) {
    if (empty($value)) return null;
    try {
        $date = new DateTime($value);
        return $date->format(DateTime::ATOM);
    } catch (Exception $e) {
        return $value;
    }
}



function sync_event_requires_action($pdo, $eventId) {
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



try {
    if ($path === '/api') {
        echo json_encode(['service' => 'Personal Time API', 'version' => '0.1']);
        exit;
    }



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



    // ---- Reminders: /api/events/{id}/reminders, /api/reminders/{id}, /api/reminders/{id}/snooze ----
    $reminderListMatches = [];
    if (preg_match('#^/api/events/(\d+)/reminders$#', $path, $reminderListMatches)) {
        $eventId = (int)$reminderListMatches[1];


        if ($method === 'GET') {
            try {
                $pdo = get_pdo();
                $stmt = $pdo->prepare('SELECT id, event_id, remind_at, method, completed, dismissed, dispatched_at, snoozed_from_id FROM reminders WHERE event_id = :event_id ORDER BY remind_at ASC');
                $stmt->execute([':event_id' => $eventId]);
                $reminders = $stmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($reminders as &$reminder) {
                    $reminder['completed'] = (bool)$reminder['completed'];
                    $reminder['dismissed'] = (bool)$reminder['dismissed'];
                    $reminder['remind_at'] = to_iso8601($reminder['remind_at']);
                    $reminder['dispatched_at'] = to_iso8601($reminder['dispatched_at']);
                }
                unset($reminder);
            } catch (Exception $e) {
                $reminders = [];
            }
            echo json_encode(['reminders' => $reminders]);
            exit;
        }


        if ($method === 'POST') {
            $body = json_decode(file_get_contents('php://input'), true);
            if (!$body || empty($body['remind_at'])) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid payload: remind_at is required']);
                exit;
            }
            $remindAt = null;
            $errors = [];
            try { $remindAt = new DateTime($body['remind_at']); } catch (Exception $e) { $errors[] = 'remind_at: invalid format'; }
            $method_val = $body['method'] ?? 'push';
            if (!in_array($method_val, ['push', 'web_push'], true)) $errors[] = "method: must be 'push' or 'web_push'";
            if (!empty($errors)) {
                http_response_code(400);
                echo json_encode(['error' => 'validation_failed', 'details' => $errors]);
                exit;
            }
            try {
                $pdo = get_pdo();
                $sql = 'INSERT INTO reminders (event_id, remind_at, method) VALUES (:event_id, :remind_at, :method) RETURNING id';
                $stmt = $pdo->prepare($sql);
                $stmt->execute([
                    ':event_id' => $eventId,
                    ':remind_at' => $remindAt->format(DateTime::ATOM),
                    ':method' => $method_val
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


        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
        exit;
    }


    $reminderSnoozeMatches = [];
    if (preg_match('#^/api/reminders/(\d+)/snooze$#', $path, $reminderSnoozeMatches)) {
        $reminderId = (int)$reminderSnoozeMatches[1];


        if ($method === 'POST') {
            $body = json_decode(file_get_contents('php://input'), true);
            $minutes = isset($body['minutes']) ? (int)$body['minutes'] : null;
            $untilIso = $body['until'] ?? null;
            if (!$minutes && !$untilIso) {
                http_response_code(400);
                echo json_encode(['error' => "Invalid payload: provide either 'minutes' or 'until'"]);
                exit;
            }
            $pdo = get_pdo();
            try {
                $stmt = $pdo->prepare('SELECT * FROM reminders WHERE id = :id');
                $stmt->execute([':id' => $reminderId]);
                $original = $stmt->fetch(PDO::FETCH_ASSOC);
                if (!$original) {
                    http_response_code(404);
                    echo json_encode(['error' => 'Reminder not found']);
                    exit;
                }
                if ($untilIso) {
                    try { $newTime = new DateTime($untilIso); } catch (Exception $e) {
                        http_response_code(400);
                        echo json_encode(['error' => "until: invalid format"]);
                        exit;
                    }
                } else {
                    $newTime = new DateTime('now', new DateTimeZone('UTC'));
                    $newTime->modify("+{$minutes} minutes");
                }


                $pdo->beginTransaction();
                $updateStmt = $pdo->prepare('UPDATE reminders SET dismissed = true, updated_at = now() WHERE id = :id');
                $updateStmt->execute([':id' => $reminderId]);


                $insertStmt = $pdo->prepare('INSERT INTO reminders (event_id, remind_at, method, snoozed_from_id) VALUES (:event_id, :remind_at, :method, :snoozed_from_id) RETURNING id');
                $insertStmt->execute([
                    ':event_id' => $original['event_id'],
                    ':remind_at' => $newTime->format(DateTime::ATOM),
                    ':method' => $original['method'],
                    ':snoozed_from_id' => $reminderId
                ]);
                $newId = $insertStmt->fetchColumn();
                $pdo->commit();


                http_response_code(201);
                echo json_encode(['id' => $newId, 'remind_at' => $newTime->format(DateTime::ATOM)]);
                exit;
            } catch (Exception $e) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                http_response_code(500);
                echo json_encode(['error' => 'Snooze failed']);
                exit;
            }
        }


        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
        exit;
    }


    $reminderMatches = [];
    if (preg_match('#^/api/reminders/(\d+)$#', $path, $reminderMatches)) {
        $reminderId = (int)$reminderMatches[1];


        if ($method === 'PUT') {
            $body = json_decode(file_get_contents('php://input'), true);
            $errors = [];
            $remindAt = null;
            if (isset($body['remind_at'])) {
                try { $remindAt = new DateTime($body['remind_at']); } catch (Exception $e) { $errors[] = 'remind_at: invalid format'; }
            }
            if (isset($body['method']) && !in_array($body['method'], ['push', 'web_push'], true)) {
                $errors[] = "method: must be 'push' or 'web_push'";
            }
            if (!empty($errors)) {
                http_response_code(400);
                echo json_encode(['error' => 'validation_failed', 'details' => $errors]);
                exit;
            }
            try {
                $pdo = get_pdo();
                $sql = 'UPDATE reminders SET remind_at = COALESCE(:remind_at, remind_at), method = COALESCE(:method, method), completed = COALESCE(:completed, completed), dismissed = COALESCE(:dismissed, dismissed), updated_at = now() WHERE id = :id';
                $stmt = $pdo->prepare($sql);
                $stmt->execute([
                    ':remind_at' => $remindAt ? $remindAt->format(DateTime::ATOM) : null,
                    ':method' => $body['method'] ?? null,
                    ':completed' => isset($body['completed']) ? pg_bool($body['completed']) : null,
                    ':dismissed' => isset($body['dismissed']) ? pg_bool($body['dismissed']) : null,
                    ':id' => $reminderId
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
                $stmt = $pdo->prepare('DELETE FROM reminders WHERE id = :id');
                $stmt->execute([':id' => $reminderId]);
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


    // ---- Recurrence: /api/events/{id}/recurrence, /api/events/{id}/occurrences ----
    // Recurrence rules are stored as a small JSON object in recurring_events.rrule
    // (e.g. {"frequency":"weekly","interval":1,"until":"2026-12-31","count":null})
    // rather than full RFC 5545 RRULE syntax, since the mobile UI only needs a
    // handful of simple patterns and this keeps encode/decode trivial on both ends.
    $recurrenceMatches = [];
    if (preg_match('#^/api/events/(\d+)/recurrence$#', $path, $recurrenceMatches)) {
        $eventId = (int)$recurrenceMatches[1];

        if ($method === 'GET') {
            try {
                $pdo = get_pdo();
                $stmt = $pdo->prepare('SELECT id, event_id, rrule, created_at FROM recurring_events WHERE event_id = :event_id LIMIT 1');
                $stmt->execute([':event_id' => $eventId]);
                $row = $stmt->fetch(PDO::FETCH_ASSOC);
                if (!$row) {
                    echo json_encode(['recurrence' => null]);
                    exit;
                }
                $rule = json_decode($row['rrule'], true);
                echo json_encode(['recurrence' => [
                    'id' => $row['id'],
                    'event_id' => $row['event_id'],
                    'frequency' => $rule['frequency'] ?? null,
                    'interval' => $rule['interval'] ?? 1,
                    'until' => $rule['until'] ?? null,
                    'count' => $rule['count'] ?? null
                ]]);
                exit;
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(['error' => 'Fetch failed']);
                exit;
            }
        }

        if ($method === 'POST') {
            $body = json_decode(file_get_contents('php://input'), true);
            $allowedFrequencies = ['daily', 'weekly', 'monthly'];
            $errors = [];
            if (!$body || empty($body['frequency']) || !in_array($body['frequency'], $allowedFrequencies, true)) {
                $errors[] = 'frequency: must be one of ' . implode(', ', $allowedFrequencies);
            }
            $interval = isset($body['interval']) ? (int)$body['interval'] : 1;
            if ($interval < 1) $errors[] = 'interval: must be at least 1';
            $until = null;
            if (!empty($body['until'])) {
                try { $until = new DateTime($body['until']); } catch (Exception $e) { $errors[] = 'until: invalid format'; }
            }
            $count = isset($body['count']) ? (int)$body['count'] : null;
            if ($count !== null && $count < 1) $errors[] = 'count: must be at least 1';
            if (!empty($errors)) {
                http_response_code(400);
                echo json_encode(['error' => 'validation_failed', 'details' => $errors]);
                exit;
            }

            $ruleJson = json_encode([
                'frequency' => $body['frequency'],
                'interval' => $interval,
                'until' => $until ? $until->format('Y-m-d') : null,
                'count' => $count
            ]);

            try {
                $pdo = get_pdo();
                // One recurrence rule per event: replace any existing rule
                // rather than accumulating duplicates.
                $del = $pdo->prepare('DELETE FROM recurring_events WHERE event_id = :event_id');
                $del->execute([':event_id' => $eventId]);

                $stmt = $pdo->prepare('INSERT INTO recurring_events (event_id, rrule) VALUES (:event_id, :rrule) RETURNING id');
                $stmt->execute([':event_id' => $eventId, ':rrule' => $ruleJson]);
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

        if ($method === 'DELETE') {
            try {
                $pdo = get_pdo();
                $stmt = $pdo->prepare('DELETE FROM recurring_events WHERE event_id = :event_id');
                $stmt->execute([':event_id' => $eventId]);
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


    // Expands a recurrence rule into concrete occurrence start/end
    // datetimes for display (e.g. on the calendar). Caps at 100 occurrences
    // as a safety limit against rules with no 'until'/'count' bound, or
    // an accidentally huge range.
    $occurrenceMatches = [];
    if (preg_match('#^/api/events/(\d+)/occurrences$#', $path, $occurrenceMatches)) {
        $eventId = (int)$occurrenceMatches[1];

        if ($method === 'GET') {
            try {
                $pdo = get_pdo();
                $eventStmt = $pdo->prepare('SELECT id, name, start_time, end_time FROM events WHERE id = :id');
                $eventStmt->execute([':id' => $eventId]);
                $event = $eventStmt->fetch(PDO::FETCH_ASSOC);
                if (!$event || !$event['start_time']) {
                    echo json_encode(['occurrences' => []]);
                    exit;
                }

                $ruleStmt = $pdo->prepare('SELECT rrule FROM recurring_events WHERE event_id = :event_id LIMIT 1');
                $ruleStmt->execute([':event_id' => $eventId]);
                $ruleRow = $ruleStmt->fetch(PDO::FETCH_ASSOC);
                if (!$ruleRow) {
                    echo json_encode(['occurrences' => []]);
                    exit;
                }
                $rule = json_decode($ruleRow['rrule'], true);

                $start = new DateTime($event['start_time']);
                $end = $event['end_time'] ? new DateTime($event['end_time']) : null;
                $durationSeconds = $end ? ($end->getTimestamp() - $start->getTimestamp()) : null;

                $interval = max(1, (int)($rule['interval'] ?? 1));
                $until = !empty($rule['until']) ? new DateTime($rule['until'] . ' 23:59:59') : null;
                $count = $rule['count'] ?? null;
                $maxOccurrences = 100;
                $limit = $count ? min((int)$count, $maxOccurrences) : $maxOccurrences;

                $stepSpec = null;
                switch ($rule['frequency'] ?? '') {
                    case 'daily':
                        $stepSpec = "+{$interval} day";
                        break;
                    case 'weekly':
                        $stepSpec = "+{$interval} week";
                        break;
                    case 'monthly':
                        $stepSpec = "+{$interval} month";
                        break;
                    default:
                        echo json_encode(['occurrences' => []]);
                        exit;
                }

                $occurrences = [];
                $cursor = clone $start;
                for ($i = 0; $i < $limit; $i++) {
                    if ($until && $cursor > $until) break;
                    $occurrenceEnd = $durationSeconds !== null
                        ? (clone $cursor)->modify("+{$durationSeconds} seconds")
                        : null;
                    $occurrences[] = [
                        'start_time' => $cursor->format(DateTime::ATOM),
                        'end_time' => $occurrenceEnd ? $occurrenceEnd->format(DateTime::ATOM) : null
                    ];
                    $cursor = (clone $cursor)->modify($stepSpec);
                }

                echo json_encode(['occurrences' => $occurrences]);
                exit;
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(['error' => 'Occurrence expansion failed']);
                exit;
            }
        }

        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
        exit;
    }



    if (strpos($path, '/api/events') === 0) {
        $matches = [];



        if ($method === 'GET') {
            try {
                $pdo = get_pdo();
                $stmt = $pdo->query('SELECT id, name, description, start_time, end_time, category, requires_action, completed FROM events ORDER BY start_time NULLS LAST LIMIT 100');
                $events = $stmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($events as &$event) {
                    $event['requires_action'] = (bool)$event['requires_action'];
                    $event['completed'] = (bool)$event['completed'];
                    $event['start_time'] = to_iso8601($event['start_time']);
                    $event['end_time'] = to_iso8601($event['end_time']);
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
