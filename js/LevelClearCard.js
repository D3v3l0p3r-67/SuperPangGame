import { GAME_STATES, COLORS } from './constants.js';
import { hexColor } from './colors.js';
import { buildCenteredRow } from './introText.js';
import { formatLevelTime } from './storage.js';

const TEXT = hexColor(COLORS.text);
const SUCCESS = hexColor(COLORS.success);
const RECORD_BLINK_MS = 220;

// What the cleared level took, shown on the celebration screen: the run's
// own time, and -- when it beat the level's record -- a blinking line
// saying so (see storage's saveLevelTime, which decides that, and
// GameScene.levelClear, which asks it).
//
// Same "no drawn text" rule as the HUD and the level-intro card: composed
// from the intro font spritesheet (see introText.js). It sits low on the
// playfield, under the player's victory animation and clear of the HUD's
// own time-bonus tally, so the two readouts about time are never side by
// side saying different things.
const TIME_ROW_Y = 250;
const RECORD_ROW_Y = 276;

export class LevelClearCard {
  constructor(scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(25).setVisible(false);
    this.images = [];
    this.recordImages = [];
    this.builtFor = null; // "<seconds>:<record?>" cache key
  }

  ensureBuilt() {
    const g = this.scene;
    const seconds = g.clearTimeSec;
    const isRecord = g.clearIsRecord;
    const key = `${seconds}:${isRecord}`;
    if (this.builtFor === key) return;
    this.builtFor = key;

    for (const img of [...this.images, ...this.recordImages]) img.destroy();
    this.images = [];
    this.recordImages = [];
    if (seconds === null) return;

    const time = buildCenteredRow(g, this.container, `TIME ${formatLevelTime(seconds)}`, TIME_ROW_Y, 2, TEXT);
    this.images = time.images;
    if (isRecord) {
      const record = buildCenteredRow(g, this.container, 'NEW RECORD', RECORD_ROW_Y, 2, SUCCESS);
      this.recordImages = record.images;
    }
  }

  render() {
    const g = this.scene;
    if (g.state !== GAME_STATES.LEVEL_CLEAR || g.clearTimeSec === null) {
      this.container.setVisible(false);
      // Next clear is a different time -- force a rebuild rather than
      // leaving the last level's card composed and ready to flash.
      this.builtFor = null;
      return;
    }

    this.ensureBuilt();
    this.container.setVisible(true);
    const blinkOn = Math.floor((g.levelClearElapsed * 1000) / RECORD_BLINK_MS) % 2 === 0;
    for (const img of this.recordImages) img.setVisible(blinkOn);
  }
}
