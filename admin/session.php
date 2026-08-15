<?php
// Tells a same-origin page whether this browser is logged into the admin
// tool, and hands it the session's CSRF token if it is.
//
// It exists for the GAME's level editor (see ../js/levelFile.js). That
// editor is visual and lives in the game, but it had no way to write a
// file -- Save went to localStorage and Export downloaded something you
// then moved by hand. save.php can write levels/, and the session cookie
// is sent with a request to it from any page on this origin; the only
// thing the game page was missing was the token.
//
// Handing that token out here is safe for the reason CSRF tokens work at
// all: the same-origin policy. A page on another origin can send a
// forged request but cannot READ this response, so it never learns the
// token -- which is why no CORS header may ever be added below. What
// stops a stranger is still the login; this only reports it.

declare(strict_types=1);
require_once __DIR__ . '/includes/auth.php';

header('Content-Type: application/json');
// Never cached, by anything. The answer is per-session and changes the
// moment someone logs in or out. (The game's service worker is told to
// keep its hands off admin/ entirely -- see ../service-worker.js -- and
// this is the belt to that pair of braces.)
header('Cache-Control: no-store');

if (!isLoggedIn()) {
    echo json_encode(['loggedIn' => false]);
    exit;
}

echo json_encode(['loggedIn' => true, 'csrf' => csrfToken()]);
