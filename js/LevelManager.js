import { LEVELS } from './levels.js';
import { Ball } from './Ball.js';
import { Obstacle } from './Obstacle.js';

// Loads a level definition (unchanged data from levels.js) into a
// GameScene's groups. Adding level 11+ is purely a levels.js change --
// nothing here needs to change.
export function loadLevel(scene, idx) {
  const def = LEVELS[idx];

  scene.obstacles.clear(true, true);
  scene.balls.clear(true, true);
  scene.projectiles.clear(true, true);
  scene.powerups.clear(true, true);

  for (const o of def.obstacles) {
    const obstacle = new Obstacle(scene, o.type, o.x, o.y, o.w, o.h);
    scene.obstacles.add(obstacle);
  }

  for (const b of def.balls) {
    const ball = new Ball(scene, b.shape, b.size, b.x, b.y, b.vx, undefined);
    scene.balls.add(ball);
  }

  return def;
}

export { LEVELS };
