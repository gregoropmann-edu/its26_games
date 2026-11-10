<?php
declare(strict_types=1);

const IDENTITY_HEARTBEAT_TTL = 45;

function identity_data_dir(): string
{
    return dirname(__DIR__) . DIRECTORY_SEPARATOR . 'data';
}

function identity_db_path(): string
{
    return identity_data_dir() . DIRECTORY_SEPARATOR . 'identity.db';
}

function identity_json_headers(): void
{
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
}

function identity_read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function identity_pdo(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dir = identity_data_dir();
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }

    $pdo = new PDO('sqlite:' . identity_db_path(), null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    $pdo->exec('
        CREATE TABLE IF NOT EXISTS game_state (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            phase TEXT NOT NULL DEFAULT \'idle\',
            active_client_id TEXT,
            scan_started_at INTEGER,
            last_heartbeat_at INTEGER,
            chosen_slug TEXT,
            chosen_display_name TEXT,
            revealed_at INTEGER
        );
    ');

    $row = $pdo->query('SELECT id FROM game_state WHERE id = 1')->fetch();
    if ($row === false) {
        $pdo->exec("INSERT INTO game_state (id, phase) VALUES (1, 'idle')");
    }

    return $pdo;
}

/** @return array<string, mixed> */
function identity_get_state(): array
{
    $pdo = identity_pdo();
    $stmt = $pdo->query('SELECT * FROM game_state WHERE id = 1');
    $row = $stmt->fetch();
    return $row !== false ? $row : ['phase' => 'idle'];
}

/** @param array<string, mixed> $fields */
function identity_patch_state(array $fields): void
{
    $allowed = [
        'phase', 'active_client_id', 'scan_started_at', 'last_heartbeat_at',
        'chosen_slug', 'chosen_display_name', 'revealed_at',
    ];
    $sets = [];
    $params = [];
    foreach ($fields as $key => $value) {
        if (!in_array($key, $allowed, true)) {
            continue;
        }
        $sets[] = "$key = :$key";
        $params[$key] = $value;
    }
    if ($sets === []) {
        return;
    }
    $sql = 'UPDATE game_state SET ' . implode(', ', $sets) . ' WHERE id = 1';
    $pdo = identity_pdo();
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
}

function identity_now(): int
{
    return time();
}

function identity_client_alive(?array $state): bool
{
    if (!$state || empty($state['active_client_id']) || empty($state['last_heartbeat_at'])) {
        return false;
    }
    return (identity_now() - (int) $state['last_heartbeat_at']) <= IDENTITY_HEARTBEAT_TTL;
}

/** @return array<string, mixed> */
function identity_public_state(?array $state, ?string $forClientId = null): array
{
    $state = $state ?? identity_get_state();
    $phase = (string) ($state['phase'] ?? 'idle');
    $activeId = $state['active_client_id'] ?? null;
    $isMe = $forClientId !== null && $activeId === $forClientId;

    $payload = [
        'phase' => $phase,
        'active' => identity_client_alive($state),
        'isActiveClient' => $isMe,
        'scanStartedAt' => $state['scan_started_at'] ? (int) $state['scan_started_at'] : null,
    ];

    if ($phase === 'revealed' && $isMe) {
        $payload['displayName'] = (string) ($state['chosen_display_name'] ?? '');
        $payload['slug'] = (string) ($state['chosen_slug'] ?? '');
        $payload['revealedAt'] = $state['revealed_at'] ? (int) $state['revealed_at'] : null;
    }

    if ($phase === 'ready' && $isMe) {
        $payload['ready'] = true;
    }

    return $payload;
}

/** @return array<string, mixed> */
function identity_admin_state(): array
{
    $state = identity_get_state();
    $scanStart = $state['scan_started_at'] ? (int) $state['scan_started_at'] : null;
    $elapsed = $scanStart ? identity_now() - $scanStart : 0;

    return [
        'phase' => $state['phase'] ?? 'idle',
        'activeClientId' => $state['active_client_id'] ?? null,
        'clientAlive' => identity_client_alive($state),
        'scanStartedAt' => $scanStart,
        'elapsedSeconds' => $elapsed,
        'chosenSlug' => $state['chosen_slug'] ?? null,
        'chosenDisplayName' => $state['chosen_display_name'] ?? null,
        'revealedAt' => $state['revealed_at'] ? (int) $state['revealed_at'] : null,
    ];
}

function identity_send_json(array $data, int $code = 200): void
{
    identity_json_headers();
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}
