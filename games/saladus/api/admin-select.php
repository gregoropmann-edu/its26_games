<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    identity_send_json(['error' => 'method_not_allowed'], 405);
}

$body = identity_read_json_body();
$slug = isset($body['slug']) ? trim((string) $body['slug']) : '';
$displayName = isset($body['displayName']) ? trim((string) $body['displayName']) : '';

if ($slug === '' || $displayName === '') {
    identity_send_json(['error' => 'invalid_payload'], 400);
}

$state = identity_get_state();
$phase = (string) ($state['phase'] ?? 'idle');

if (!in_array($phase, ['scanning', 'ready'], true)) {
    identity_send_json(['error' => 'no_active_scan'], 409);
}

if (!identity_client_alive($state)) {
    identity_send_json(['error' => 'client_offline'], 409);
}

identity_patch_state([
    'phase' => 'ready',
    'chosen_slug' => $slug,
    'chosen_display_name' => $displayName,
]);

identity_send_json(identity_admin_state());
