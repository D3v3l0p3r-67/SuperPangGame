<?php
declare(strict_types=1);
require_once __DIR__ . '/includes/auth.php';

adminStartSession();

if (isLoggedIn()) {
    header('Location: index.php');
    exit;
}

$error = null;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!checkCsrf($_POST['csrf'] ?? null)) {
        $error = 'Your session expired -- reload the page and try again.';
    } elseif (attemptLogin((string)($_POST['username'] ?? ''), (string)($_POST['password'] ?? ''))) {
        $next = (string)($_GET['next'] ?? 'index.php');
        // Only ever follow a same-folder relative redirect -- never an
        // absolute/protocol-relative URL an attacker could smuggle into
        // `next` (an open-redirect vector).
        if ($next === '' || $next[0] !== '/' || (strlen($next) > 1 && $next[1] === '/')) {
            $next = 'index.php';
        }
        header('Location: ' . $next);
        exit;
    } else {
        $error = 'Invalid username or password.';
    }
}

$csrf = csrfToken();
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Balloon Buster -- Admin Login</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<div id="login-screen">
  <div class="login-box">
    <h1>BALLOON BUSTER<br>ADMIN</h1>
    <form method="post" autocomplete="off">
      <input type="hidden" name="csrf" value="<?= htmlspecialchars($csrf, ENT_QUOTES) ?>">
      <label>Username <input name="username" autocomplete="username" autocapitalize="off" autofocus></label>
      <label>Password <input name="password" type="password" autocomplete="current-password"></label>
      <button type="submit">Log in</button>
      <?php if ($error !== null): ?>
        <p class="error"><?= htmlspecialchars($error, ENT_QUOTES) ?></p>
      <?php endif; ?>
    </form>
    <p class="note">Server-side login (PHP session) -- see admin/includes/auth.php. This tool needs a PHP-capable host to run at all; it won't work served as plain static files.</p>
  </div>
</div>
</body>
</html>
