<?php
declare(strict_types=1);
require_once __DIR__ . '/includes/auth.php';
requireLogin();
$csrf = csrfToken();

// Where saves land is fixed in code (PROJECT_ROOT, see includes/
// config.php) -- the admin never picks a folder. What CAN go wrong is the
// web server user not being allowed to write there, so check that up
// front and say so, rather than letting every individual Save fail with
// the same permission error one at a time.
$unwritableDirs = [];
foreach (ALLOWED_SAVE_DIRS as $dir) {
    if (!is_writable(PROJECT_ROOT . '/' . $dir)) {
        $unwritableDirs[] = $dir;
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Balloon Buster -- Admin</title>
<meta name="description" content="Edit Balloon Buster's graphics, sounds, elements, and levels.">
<meta name="admin-csrf" content="<?= htmlspecialchars($csrf, ENT_QUOTES) ?>">
<link rel="stylesheet" href="style.css">
</head>
<body>

<div id="app">
  <header>
    <h1>Balloon Buster -- Admin</h1>
    <div id="fs-status">
      <?php if ($unwritableDirs): ?>
        <span class="fs-warning">Saves will fail: the web server user can't write to
        <?= htmlspecialchars(implode(', ', $unwritableDirs), ENT_QUOTES) ?>
        under <code><?= htmlspecialchars(PROJECT_ROOT, ENT_QUOTES) ?></code>.</span>
      <?php else: ?>
        <span>Saves write to <code><?= htmlspecialchars(PROJECT_ROOT, ENT_QUOTES) ?></code></span>
      <?php endif; ?>
    </div>
    <a id="btn-logout" href="logout.php">Log out</a>
  </header>

  <nav id="tabs">
    <button class="tab-btn active" data-tab="graphics">Graphics</button>
    <button class="tab-btn" data-tab="sounds">Sounds</button>
    <button class="tab-btn" data-tab="elements">Elements</button>
    <button class="tab-btn" data-tab="levels">Levels</button>
  </nav>

  <main>
    <section id="tab-graphics" class="tab-panel"></section>
    <section id="tab-sounds" class="tab-panel hidden"></section>
    <section id="tab-elements" class="tab-panel hidden"></section>
    <section id="tab-levels" class="tab-panel hidden"></section>
  </main>
</div>

<script type="module" src="js/main.js"></script>
</body>
</html>
