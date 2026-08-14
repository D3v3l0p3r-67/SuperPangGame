// A static file server for the smoke tests, so running them is one
// command rather than "start a server in another terminal first".
//
// Written out by hand rather than pulled in: the game is served as plain
// files by whatever is hosting it, and about thirty lines of node:http is
// a smaller thing to own than another dependency. Everything the game
// asks for is here -- there is no routing, no index rewriting and no
// caching, because the real host does not do any of that either.
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { join, normalize, extname, sep } from 'node:path';
import { ROOT } from '../helpers.mjs';

const TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.ogg': 'audio/ogg',
};

export async function serve() {
  const server = createServer((req, res) => {
    // Query strings are the game's own (?debug=1); the path is all that
    // names a file. normalize + the startsWith check below is what keeps
    // a "../.." out of the repo's parent.
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = normalize(join(ROOT, path === '/' ? 'index.html' : path));
    // ROOT + separator, not ROOT: a "../" that climbs out and back into a
    // sibling whose name merely STARTS with the repo's would otherwise
    // pass a bare prefix check.
    if (!file.startsWith(ROOT + sep)) {
      res.writeHead(403).end();
      return;
    }
    try {
      statSync(file);
    } catch {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  // Port 0: the OS picks a free one, so two runs at once (or a server
  // already sitting on a fixed port) cannot collide.
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
