import { WEAPON_TYPES } from './config.js';
import { POWERUP_TYPES } from './elements.js';

// weaponType names a WEAPON_TYPES key -- normally a level's own `weapon`
// field (see LevelManager/GameScene.loadLevel), falling back to 'harpoon'
// for anything unset/unrecognized (custom/editor levels before a weapon
// is chosen, or an older level file predating this field).
export function createWeaponState(weaponType = 'harpoon') {
  const base = WEAPON_TYPES[weaponType] || WEAPON_TYPES.harpoon;
  return {
    maxActiveShots: base.baseMaxActiveShots,
    pierce: base.basePierce,
    widthMultiplier: 1,
  };
}

// Tracks which power-up effects are currently active and reverts them on
// expiry. Each power-up's apply()/revert() live in config.js, so this class
// never needs to know what a given effect actually does.
export class EffectManager {
  constructor() {
    this.active = new Map(); // type -> expiresAt (ms, on the game's elapsed clock)
  }

  apply(type, game, nowMs) {
    const def = POWERUP_TYPES[type];
    if (!def) return;
    def.apply(game);
    if (!def.instant && def.durationMs > 0) {
      this.active.set(type, nowMs + def.durationMs);
    }
  }

  update(game, nowMs) {
    for (const [type, expiresAt] of this.active) {
      if (nowMs >= expiresAt) {
        POWERUP_TYPES[type].revert(game);
        this.active.delete(type);
      }
    }
  }

  reset(game) {
    for (const type of this.active.keys()) POWERUP_TYPES[type].revert(game);
    this.active.clear();
  }
}
