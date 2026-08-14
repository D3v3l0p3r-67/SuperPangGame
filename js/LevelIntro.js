import { VIRTUAL_W, GAME_STATES, COLORS, LEVEL_INTRO_SEC, LEVEL_INTRO_GO_SEC, LEVEL_INTRO_SET_SEC } from './constants.js';
import { hexColor } from './colors.js';
import { buildTextRow, buildDigitsRow, buildCenteredRow } from './introText.js';
import { bestLevelTime, formatLevelTime } from './storage.js';

const TEXT = hexColor(COLORS.text);
const READY_BLINK_MS = 250;

// The graphic level-intro overlay: "LEVEL <n>", the level's name, then a
// three-beat countdown -- blinking "READY", then blinking "SET", then a
// solid "GO!", one per phase (see constants.js's LEVEL_INTRO_*_SEC;
// GameScene.startLevelIntro sounds a cue on each) --
// entirely composed from loaded images (assets/intro/font_alpha.webp +
// the HUD's digit strip), same "no drawn text" rule as Hud.js. Drawn with
// no dimming behind it, over the frozen (see GameScene.startLevelIntro)
// gameplay, matching the old DOM screen's transparent background.
export class LevelIntro {
  constructor(scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(25).setVisible(false);
    this.rowImages = [];
    this.readyImages = [];
    this.setImages = [];
    this.goImages = [];
    this.builtFor = null; // "<levelNumber>:<name>" cache key
  }

  // Rebuilds the level-specific rows (LEVEL number + name) only when they
  // actually changed -- cheap to call every frame while LEVEL_INTRO is
  // active, since it's normally a no-op after the first call.
  ensureBuilt() {
    const g = this.scene;
    const levelNum = g.levelIndex + 1;
    const name = g.currentLevelDef?.name ?? '';
    // The record only exists for a campaign level -- an editor playtest and
    // Panic Mode are not levels anything is kept for (see storage's
    // saveLevelTime / GameScene.levelClear).
    const best = g.isCustomLevel || g.isPanicMode ? null : bestLevelTime(g.levelIndex);
    const key = `${levelNum}:${name}:${best ?? ''}`;
    if (this.builtFor === key) return;
    this.builtFor = key;

    for (const img of [...this.rowImages, ...this.readyImages, ...this.setImages, ...this.goImages]) img.destroy();
    this.rowImages = [];
    this.readyImages = [];
    this.setImages = [];
    this.goImages = [];

    const centerX = VIRTUAL_W / 2;
    const GAP = 8;

    const levelText = buildTextRow(g, this.container, 'LEVEL', 0, 70, 3);
    const digits = buildDigitsRow(g, this.container, levelNum, 0, 70);
    let rowX = centerX - (levelText.width + GAP + digits.width) / 2;
    for (const img of levelText.images) img.x += rowX;
    rowX += levelText.width + GAP;
    for (const img of digits.images) img.x += rowX;
    this.rowImages = [...levelText.images, ...digits.images];

    const nameRow = buildTextRow(g, this.container, name, 0, 102, 2);
    const nameX = centerX - nameRow.width / 2;
    for (const img of nameRow.images) img.x += nameX;
    this.rowImages.push(...nameRow.images);

    // The level's record, so the target is on screen before the level
    // starts rather than only after it ends. Drawn in the plain text color
    // (the rows above it are the accent) so the card still reads title
    // first, and left out entirely on a level with no record yet -- an
    // empty "BEST --:--" would be a row of nothing to aim at.
    if (best !== null) {
      const bestRow = buildCenteredRow(g, this.container, `BEST ${formatLevelTime(best)}`, 160, 2, TEXT);
      this.rowImages.push(...bestRow.images);
    }

    // All three countdown words share the same row -- only one is ever
    // visible at a time (see render()), each centred on its own width.
    const readyRow = buildTextRow(g, this.container, 'READY', 0, 132, 3);
    for (const img of readyRow.images) img.x += centerX - readyRow.width / 2;
    this.readyImages = readyRow.images;

    const setRow = buildTextRow(g, this.container, 'SET', 0, 132, 3);
    for (const img of setRow.images) img.x += centerX - setRow.width / 2;
    this.setImages = setRow.images;

    const goRow = buildTextRow(g, this.container, 'GO!', 0, 132, 3);
    for (const img of goRow.images) img.x += centerX - goRow.width / 2;
    this.goImages = goRow.images;
  }

  render() {
    const g = this.scene;
    if (g.state !== GAME_STATES.LEVEL_INTRO) {
      this.container.setVisible(false);
      this.builtFor = null; // next intro may be a different level -- force a rebuild
      return;
    }

    this.ensureBuilt();
    this.container.setVisible(true);

    // The countdown runs backwards through the phases as stateTimer drains:
    // READY while more than SET+GO is left, SET while more than GO is, then
    // GO for the last stretch.
    // During a lead-in (GameScene holds the countdown while the run-start
    // fanfare plays) the countdown hasn't begun -- only the LEVEL/name
    // title card shows, so none of the three words are up yet.
    const leadingIn = g.introLeadInSec > 0;
    const isGoPhase = !leadingIn && g.stateTimer <= LEVEL_INTRO_GO_SEC;
    const isSetPhase = !leadingIn && !isGoPhase && g.stateTimer <= LEVEL_INTRO_GO_SEC + LEVEL_INTRO_SET_SEC;
    const isReadyPhase = !leadingIn && !isGoPhase && !isSetPhase;

    for (const img of this.goImages) img.setVisible(isGoPhase);

    // READY and SET blink (the waiting beats); GO! above stays solid. The
    // blink is timed from the START OF ITS OWN PHASE rather than from the
    // raw countdown, so each word is always visible on the very frame its
    // phase begins -- which is the frame GameScene sounds its cue on. Timed
    // off the shared countdown instead, a word could open on the blink's
    // "off" half and appear a moment after its own sound.
    const phaseElapsed = isReadyPhase
      ? LEVEL_INTRO_SEC - g.stateTimer
      : LEVEL_INTRO_GO_SEC + LEVEL_INTRO_SET_SEC - g.stateTimer;
    const blinkOn = Math.floor((phaseElapsed * 1000) / READY_BLINK_MS) % 2 === 0;
    for (const img of this.readyImages) img.setVisible(isReadyPhase && blinkOn);
    for (const img of this.setImages) img.setVisible(isSetPhase && blinkOn);
  }
}
