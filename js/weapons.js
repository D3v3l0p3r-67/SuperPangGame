import { WEAPON_TYPES, POWERUP_TYPES } from './config.js';
import { Projectile } from './entities.js';

export function createWeaponState() {
  const base = WEAPON_TYPES.harpoon;
  return {
    maxActiveShots: base.baseMaxActiveShots,
    pierce: base.basePierce,
    widthMultiplier: 1,
  };
}

export function tryFire(weaponState, projectiles, x, y) {
  const activeCount = projectiles.reduce((n, p) => n + (p.active ? 1 : 0), 0);
  if (activeCount >= weaponState.maxActiveShots) return false;
  const base = WEAPON_TYPES.harpoon;
  const width = base.width * weaponState.widthMultiplier;
  projectiles.push(new Projectile(x, y, width, base.shotSpeed, weaponState.pierce));
  return true;
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
