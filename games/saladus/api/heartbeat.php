<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    identity_send_json(['error' => 'method_not_allowed'], 405);
}

$body = identity_read_json_body();
$clientId = isset($body['client_id']) ? trim((string) $body['client_id']) : '';
if ($clientId === '') {
    identity_send_json(['error' => 'invalid_client_id'], 400);
}

$state = identity_get_state();
$activeId = $state['active_client_id'] ?? null;

if ($activeId !== $clientId) {
    identity_send_json(['error' => 'not_active_client'], 403);
}

identity_patch_state(['last_heartbeat_at' => identity_now()]);
identity_send_json(identity_public_state(identity_get_state(), $clientId));
