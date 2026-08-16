<?php
declare(strict_types=1);
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/precache.php';

header('Content-Type: application/json');

function fail(int $status, string $message): never {
    http_response_code($status);
    echo json_encode(['ok' => false, 'error' => $message]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail(405, 'POST only.');
}
if (!isLoggedIn()) {
    fail(401, 'Not logged in.');
}
if (!checkCsrf($_POST['csrf'] ?? null)) {
    fail(403, 'Missing or invalid CSRF token -- reload the admin page and try again.');
}

$path = (string)($_POST['path'] ?? '');

// A single regex covers every check that matters: no leading slash/drive
// letter, no ".." traversal (the character class only allows path-safe
// characters -- there's nowhere to hide ".." in it), restricted to the
// three writable top-level folders, and restricted to the exact file
// extensions the game's own asset pipeline produces. Anything that
// doesn't match this shape is not a legitimate save target, full stop.
$allowedDirs = implode('|', array_map('preg_quote', ALLOWED_SAVE_DIRS));
$allowedExts = implode('|', array_map('preg_quote', ALLOWED_SAVE_EXTENSIONS));
$pattern = '#^(' . $allowedDirs . ')(/[A-Za-z0-9._-]+)+\.(' . $allowedExts . ')$#';
if (!preg_match($pattern, $path)) {
    fail(400, 'Path not allowed: ' . $path);
}

if (!isset($_FILES['file']) || !is_uploaded_file($_FILES['file']['tmp_name'])) {
    fail(400, 'No file uploaded.');
}
if ($_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    fail(400, 'Upload failed (error code ' . $_FILES['file']['error'] . ').');
}
if ($_FILES['file']['size'] > MAX_UPLOAD_BYTES) {
    fail(413, 'File too large.');
}

// Resolve against the real project root and, as defense in depth beyond
// the regex above, re-confirm the resolved directory is still actually
// inside it (guards against e.g. a symlink planted inside elements/
// pointing back out) before ever writing anything.
$target = PROJECT_ROOT . '/' . $path;
$targetDir = dirname($target);
if (!is_dir($targetDir) && !mkdir($targetDir, 0775, true) && !is_dir($targetDir)) {
    fail(500, 'Could not create directory.');
}
$realTargetDir = realpath($targetDir);
if ($realTargetDir === false || strpos($realTargetDir, PROJECT_ROOT . DIRECTORY_SEPARATOR) !== 0) {
    fail(400, 'Resolved path escapes the project root.');
}

if (!move_uploaded_file($_FILES['file']['tmp_name'], $target)) {
    fail(500, 'Could not write file -- check that the web server user has write permission.');
}

// The file is on disk now, and every browser that has played the game
// before is still holding the previous copy in its service worker cache
// (which a hard reload does not touch). Tell the worker something moved,
// the same way a release does -- see includes/precache.php. A failure
// here is reported, never fatal: the save itself succeeded.
[$offlineUpdated, $offlineNote] = refreshPrecache($path);

echo json_encode([
    'ok' => true,
    'path' => $path,
    'offline' => ['updated' => $offlineUpdated, 'note' => $offlineNote],
]);
