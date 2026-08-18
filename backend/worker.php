<?php
// Simple worker that dispatches notifications for due reminders.
require_once __DIR__ . '/db.php';

$pdo = get_pdo();

// Find reminders that are due and not dispatched
$stmt = $pdo->prepare('SELECT r.id AS rid, r.event_id, r.remind_at, e.name AS event_name, e.description FROM reminders r LEFT JOIN events e ON e.id = r.event_id WHERE r.remind_at <= now() AND r.dispatched_at IS NULL');
$stmt->execute();
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

foreach ($rows as $r) {
    // Create a notification record
    $payload = json_encode(['event_id' => $r['event_id'], 'event_name' => $r['event_name'], 'remind_at' => $r['remind_at']]);
    $ins = $pdo->prepare('INSERT INTO notifications (reminder_id, event_id, payload, sent) VALUES (:rid, :eid, :payload, false)');
    $ins->execute([':rid' => $r['rid'], ':eid' => $r['event_id'], ':payload' => $payload]);

    // Mark reminder as dispatched
    $upd = $pdo->prepare('UPDATE reminders SET dispatched_at = now() WHERE id = :id');
    $upd->execute([':id' => $r['rid']]);

    echo "Dispatched notification for reminder {$r['rid']} (event {$r['event_id']})\n";
}

if (empty($rows)) echo "No reminders to dispatch\n";
