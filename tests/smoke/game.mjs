// Opening the real game in a real browser, and the few things every
// smoke test does with it once it is up.
//
// Playwright is imported dynamically so that a checkout without it
// installed fails with the one line that says so (see requirePlaywright)
// rather than an import error before any test has run -- the rest of the
// suite has no dependencies at all (tests/README.md), and this is the one
// corner that does.
import { serve } from './server.mjs';

// Where the pre-installed browser lives when there is one (this project's
// CI and dev container both set it); Playwright's own lookup is used
// otherwise.
const BROWSER_PATH = process.env.PLAYWRIGHT_CHROMIUM_PATH;

export async function requirePlaywright() {
  try {
    return (await import('playwright')).chromium;
  } catch {
    throw new Error(
      'the smoke tests need Playwright: npm install (see tests/README.md). '
      + 'The rest of the suite -- node --test tests/*.test.mjs -- needs nothing.',
    );
  }
}

// The game, loaded and past its loading screen, plus everything the test
// needs to drive or inspect it. Always closed through `close()`, which
// takes the server down with the browser.
export async function openGame({ debug = false } = {}) {
  const chromium = await requirePlaywright();
  const server = await serve();
  const browser = await chromium.launch(BROWSER_PATH ? { executablePath: BROWSER_PATH } : {});
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  // Neutered for the duration: the real worker would spend the test
  // fetching all ~270 precached files, and then answer from a cache whose
  // whole point is to outlive the page -- neither of which is what is
  // being tested here. An empty script registers and does nothing.
  await context.route('**/service-worker.js', (route) => route.fulfill({
    status: 200, contentType: 'text/javascript', body: '',
  }));

  const page = await context.newPage();
  // Anything the game throws, and anything it logs as an error, is a
  // failure -- collected here rather than asserted here, so a test can
  // say WHICH of the things it did produced it.
  const errors = [];
  page.on('pageerror', (e) => errors.push(`uncaught: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('requestfailed', (r) => errors.push(`failed request: ${r.url()}`));

  await page.goto(`${server.url}/index.html${debug ? '?debug=1' : ''}`);
  // The game exists once Phaser has built it; ElementsScene and BootScene
  // have loaded every element, level and graphic by the time GameScene
  // reports a state.
  await page.waitForFunction(() => window.game?.scene?.getScene('Game')?.state, null, { timeout: 90000 });

  return {
    page,
    errors,
    // Reads something out of the live GameScene. Everything below goes
    // through this rather than reaching for globals, so what a test
    // depends on is visible in the test.
    //
    // The function is shipped to the browser as SOURCE, so it cannot
    // close over anything -- no imports, no consts from the test file.
    // Take what it needs through `arg`, and reach for modules by
    // importing them onto `window` once, up front (a dynamic import here
    // would let real frames run mid-read, see tests/README.md).
    scene: (fn, arg) => page.evaluate(
      ([body, a]) => new Function('scene', 'arg', body)(window.game.scene.getScene('Game'), a),
      [`return (${fn.toString()})(scene, arg)`, arg ?? null],
    ),
    // Steps the real game loop `n` frames. Nothing here fakes time:
    // waiting for actual frames is what makes this a test of the game
    // rather than of a stand-in for it.
    frames: (n = 2) => page.evaluate((count) => new Promise((resolve) => {
      let left = count;
      const step = () => (left-- > 0 ? requestAnimationFrame(step) : resolve());
      step();
    }), n),
    close: async () => {
      await browser.close();
      await server.close();
    },
  };
}
