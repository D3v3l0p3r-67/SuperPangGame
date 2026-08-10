<?php
declare(strict_types=1);
require_once __DIR__ . '/includes/auth.php';
requireLogin();
$csrf = csrfToken();
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
      <span id="fs-status-text"></span>
      <button id="btn-pick-folder">Choose project folder…</button>
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
