// Everything that makes the game installable: registering the service
// worker that keeps it playable offline (see service-worker.js), the
// INSTALL GAME button, the iPhone instructions that stand in for one, and
// the landscape lock the installed game asks for.
//
// All of it is optional by design. A browser with no service worker, no
// install prompt and no orientation lock still gets exactly the game it
// got before any of this existed -- nothing here is on the path between
// a keypress and a ball popping.

// Same-folder paths throughout, never absolute: the game is served from a
// subdirectory on GitHub Pages project sites, and "/service-worker.js"
// would look for it at the domain root.
const SERVICE_WORKER = './service-worker.js';

// Held from the beforeinstallprompt event so the button can show it later
// -- the browser only accepts the prompt from a user gesture, which is
// exactly why the event hands it over instead of prompting itself.
let deferredPrompt = null;

// True when the game is running as an installed app rather than in a
// browser tab: display-mode matches the manifest's `display` (and the
// modes it falls back through), and navigator.standalone is the iOS
// spelling of the same question.
export function isStandalone() {
  const modes = ['fullscreen', 'standalone', 'minimal-ui'];
  return modes.some((mode) => window.matchMedia?.(`(display-mode: ${mode})`).matches)
    || window.navigator.standalone === true;
}

export function isIOS() {
  const ua = navigator.userAgent || '';
  // iPadOS reports itself as a Mac; the touch points are what give it away.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // After load: the worker's own install fetches every file in the game
  // into its cache, and doing that while the first screen is still
  // loading would have the two competing for the same connection.
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(SERVICE_WORKER).catch(() => {
      /* Not served over https (or file://) -- the game runs, just not offline. */
    });
  });
}

// The INSTALL GAME button and, where there is no such prompt to offer,
// the iOS instructions. `onChange` is called whenever either of them
// should become visible or hidden, so the caller (see ui.js) owns the DOM
// and this owns the rules:
//
//   button   only once the browser has said the game is installable, and
//            never again once it has been installed
//   hint     only on iOS, which has no beforeinstallprompt at all, and
//            only while the game is NOT already running from the home
//            screen -- there is nothing to add once it is there
export function initInstall(onChange) {
  const state = { canInstall: false, showIOSHint: isIOS() && !isStandalone() };
  const publish = () => onChange({ ...state });

  window.addEventListener('beforeinstallprompt', (event) => {
    // Keeps the browser's own mini-infobar off the screen -- the button
    // in the menu is where installing lives.
    event.preventDefault();
    deferredPrompt = event;
    state.canInstall = !isStandalone();
    publish();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    state.canInstall = false;
    state.showIOSHint = false;
    publish();
  });

  // Launched from the home screen mid-session (or the display mode
  // changing under it): neither offer belongs on screen any more.
  window.matchMedia?.('(display-mode: fullscreen)').addEventListener?.('change', () => {
    if (!isStandalone()) return;
    state.canInstall = false;
    state.showIOSHint = false;
    publish();
  });

  publish();
}

// Shows the browser's install prompt. Resolves to whether the game was
// actually installed; a prompt can only be shown once, so a dismissed one
// is dropped and the button goes away with it.
export async function promptInstall() {
  if (!deferredPrompt) return false;
  const prompt = deferredPrompt;
  deferredPrompt = null;
  try {
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    return outcome === 'accepted';
  } catch {
    return false;
  }
}

// Asks for landscape and keeps it. Only ever works from a fullscreen
// (and user-gesture) context on the browsers that support it at all --
// iOS Safari has no Screen Orientation lock, and desktop browsers refuse
// it outright. Failure is silent and costs nothing: the game is still
// playable in portrait, with the ROTATE YOUR PHONE prompt over it (see
// style.css) telling the player what would be better.
export function lockLandscape() {
  try {
    Promise.resolve(screen.orientation?.lock?.('landscape')).catch(() => {});
  } catch {
    /* unsupported -- see above */
  }
}
