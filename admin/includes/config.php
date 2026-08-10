<?php
// Shared constants for the PHP half of the admin tool (see save.php/
// auth.php). Kept separate from auth.php so both index.php (which needs
// the project root/allowed dirs for nothing, actually -- just CSRF/login)
// and save.php (which needs the write whitelist) can include only what
// they need.

declare(strict_types=1);

// admin/ lives one level inside the project root -- everything the admin
// tool ever reads or writes (elements/, levels/, assets/) is relative to
// this, never to admin/ itself.
define('PROJECT_ROOT', realpath(__DIR__ . '/../..'));

// Every top-level folder save.php is allowed to write into. Deliberately
// does NOT include "admin" itself -- an admin tool that could overwrite
// its own PHP source (or upload new PHP anywhere) would defeat its own
// login gate. Matches exactly what js/assets.js's path helpers already
// generate (elements/*.json, levels/level_NN.json, assets/**).
define('ALLOWED_SAVE_DIRS', ['elements', 'levels', 'assets']);

// Every file extension the game's own asset pipeline ever produces (see
// the root README's "Swapping graphics"/"Swapping sounds") -- nothing
// else is ever a legitimate save target, and this is what actually
// blocks someone from using the save endpoint to drop a .php file
// somewhere the web server would execute it.
define('ALLOWED_SAVE_EXTENSIONS', ['json', 'webp', 'png', 'ogg']);

// Generous but bounded -- the biggest legitimate asset today (a level
// background image) is a few KB; this just guards against something
// wildly wrong being uploaded.
define('MAX_UPLOAD_BYTES', 5 * 1024 * 1024);
