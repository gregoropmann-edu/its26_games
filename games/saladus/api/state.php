<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$clientId = isset($_GET['client_id']) && is_string($_GET['client_id'])
    ? trim($_GET['client_id'])
    : null;

if ($clientId !== null && $clientId === '') {
    $clientId = null;
}

$state = identity_get_state();
identity_send_json(identity_public_state($state, $clientId));
