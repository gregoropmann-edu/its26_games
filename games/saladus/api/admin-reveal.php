<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    identity_send_json(['error' => 'method_not_allowed'], 405);
}

$state = identity_get_state();
$phase = (string) ($state['phase'] ?? 'idle');

if (!in_array($phase, ['scanning', 'ready'], true)) {
    identity_send_json(['error' => 'cannot_reveal'], 409);
}

if (empty($state['chosen_display_name']) || empty($state['chosen_slug'])) {
    identity_send_json(['error' => 'no_selection'], 409);
}

if (!identity_client_alive($state)) {
    identity_send_json(['error' => 'client_offline'], 409);
}

identity_patch_state([
    'phase' => 'revealed',
    'revealed_at' => identity_now(),
]);

identity_send_json(identity_admin_state());
