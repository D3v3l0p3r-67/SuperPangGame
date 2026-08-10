<?php
// Real server-side session auth for the admin tool -- replaces the
// previous client-side-only gate (a hardcoded check in JS, which could
// never actually keep anyone out since the "secret" shipped in the page
// source). Every admin page includes this first; requireLogin() is the
// actual gate.
//
// This is still a minimal, single-shared-account login meant for one or
// two trusted admins, not a public-facing auth system -- there's no
// per-user accounts, no rate limiting/lockout, no password reset. If
// this tool is ever exposed beyond a small trusted group, put it behind
// something sturdier (a reverse-proxy auth layer, a real user table).

declare(strict_types=1);

require_once __DIR__ . '/config.php';

const ADMIN_USERNAME = 'bos';
// password_hash('newpass', PASSWORD_DEFAULT) -- change the credential by
// generating a new hash (`php -r "echo password_hash('newpass', PASSWORD_DEFAULT);"`)
// and pasting it here, rather than storing the password itself anywhere.
const ADMIN_PASSWORD_HASH = '$2y$12$qXJRiRXKr.OKyvmNklhtzOTOU45uO70PyDfsbb4pHxlplr6izbVEu';

function adminStartSession(): void {
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => dirname($_SERVER['SCRIPT_NAME'] ?? '/'),
        'httponly' => true,
        'samesite' => 'Strict',
        'secure' => $isHttps,
    ]);
    session_start();
}

function isLoggedIn(): bool {
    adminStartSession();
    return !empty($_SESSION['admin_user']);
}

// Redirects to the login page (preserving where the visitor was headed)
// and halts execution -- call at the top of every protected page.
function requireLogin(): void {
    if (isLoggedIn()) {
        return;
    }
    $target = $_SERVER['REQUEST_URI'] ?? 'index.php';
    header('Location: login.php?next=' . urlencode($target));
    exit;
}

function attemptLogin(string $username, string $password): bool {
    adminStartSession();
    // hash_equals-safe comparison for the username too, even though it's
    // not secret, just to keep both checks constant-time/consistent.
    $userOk = hash_equals(ADMIN_USERNAME, $username);
    $passOk = password_verify($password, ADMIN_PASSWORD_HASH);
    if ($userOk && $passOk) {
        session_regenerate_id(true);
        $_SESSION['admin_user'] = $username;
        return true;
    }
    return false;
}

function logout(): void {
    adminStartSession();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
    }
    session_destroy();
}

// One CSRF token per session, used by both the login form and every
// save.php request (see js/fsSave.js) -- generated once, reused for the
// session's lifetime rather than rotated per-request, which would break
// a page left open in a background tab.
function csrfToken(): string {
    adminStartSession();
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

function checkCsrf(?string $token): bool {
    adminStartSession();
    return isset($_SESSION['csrf']) && is_string($token) && $token !== '' && hash_equals($_SESSION['csrf'], $token);
}
