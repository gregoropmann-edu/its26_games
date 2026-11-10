<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    identity_send_json(['error' => 'method_not_allowed'], 405);
}

$body = identity_read_json_body();
$clientId = isset($body['client_id']) ? trim((string) $body['client_id']) : '';
if ($clientId === '' || strlen($clientId) > 64) {
    identity_send_json(['error' => 'invalid_client_id'], 400);
}

$state = identity_get_state();
$now = identity_now();
$phase = (string) ($state['phase'] ?? 'idle');
$activeId = $state['active_client_id'] ?? null;

$alive = identity_client_alive($state);

if ($activeId !== null && $activeId !== $clientId && $alive && in_array($phase, ['scanning', 'ready'], true)) {
    identity_send_json([
        'error' => 'scan_in_progress',
        'message' => 'Teine identiteedi skänn on juba käimas.',
    ], 409);
}

if ($activeId === $clientId && in_array($phase, ['scanning', 'ready'], true) && $alive) {
    identity_patch_state(['last_heartbeat_at' => $now]);
    identity_send_json(identity_public_state(identity_get_state(), $clientId));
}

identity_patch_state([
    'phase' => 'scanning',
    'active_client_id' => $clientId,
    'scan_started_at' => $now,
    'last_heartbeat_at' => $now,
    'chosen_slug' => null,
    'chosen_display_name' => null,
    'revealed_at' => null,
]);

identity_send_json(identity_public_state(identity_get_state(), $clientId));
