<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    identity_send_json(['error' => 'method_not_allowed'], 405);
}

identity_patch_state([
    'phase' => 'idle',
    'active_client_id' => null,
    'scan_started_at' => null,
    'last_heartbeat_at' => null,
    'chosen_slug' => null,
    'chosen_display_name' => null,
    'revealed_at' => null,
]);

identity_send_json(identity_admin_state());
