export const CAT = { x: 58, width: 64, height: 44, foot: 42 };
export const STEP = 1 / 60;
export const FIRST_MISSION_DISTANCE = 300;
export const BEETLE = { width: 52, height: 44 };
const GRAVITY = 1050;
const JUMP = -370;
const STOMP_BOUNCE = -285;
const DEFEATED_HOLD_TIME = 0.34;
const DEFEATED_FALL_GRAVITY = 520;

export function configFor(width, height) {
  const scale = Math.min(width / 390, height / 420);
  return { width: width / scale, height: height / scale, ground: height / scale * 0.7, scale };
}

function extendWorld(world, config) {
  const roofs = [...world.roofs];
  const stars = [...world.collectibles];
  const obstacles = [...world.obstacles];
  const difficulty = Math.max(0, world.night - 1);
  let last = roofs[roofs.length - 1];
  while (last.x + last.width < config.width + 380) {
    const id = last.id + 1;
    const gap = 76 + (id * 13 % 29) + Math.min(34, difficulty * 7);
    const x = last.x + last.width + gap;
    last = { id, x, width: Math.max(170, 220 + (id * 37 % 81) - Math.min(70, difficulty * 10)), y: config.ground };
    roofs.push(last);
    // Stars trace the jump across each gap, above the landing edge.
    stars.push({ id: `${id}-a`, x: x - gap / 2, y: config.ground - 85 });
    stars.push({ id: `${id}-b`, x: x + 40, y: config.ground - 65 });
    if (id % 3 === 0) obstacles.push({ id: `beetle-${id}`, x: x + 92, y: config.ground - BEETLE.height, width: BEETLE.width, height: BEETLE.height });
  }
  return { ...world, roofs, collectibles: stars, obstacles };
}

export function createWorld(config, status = 'start', night = 1) {
  return extendWorld({ status, night, mission: { id: 'distance', target: FIRST_MISSION_DISTANCE + (night - 1) * 100, completed: false }, time: 0, scroll: 0, distance: 0, stars: 0,
    y: config.ground - CAT.height, vy: 0, grounded: true, jumps: 0,
    coyote: 0.1, buffer: 0, roofs: [{ id: 0, x: -80, width: 450, y: config.ground }],
    collectibles: [], obstacles: [], reason: null }, config);
}

export function resizeWorld(world, previous, config) {
  const dy = config.ground - previous.ground;
  return extendWorld({ ...world, y: world.y + dy,
    roofs: world.roofs.map((roof) => ({ ...roof, y: roof.y + dy })),
    collectibles: world.collectibles.map((star) => ({ ...star, y: star.y + dy })),
    obstacles: world.obstacles.map((obstacle) => ({ ...obstacle, y: obstacle.y + dy })) }, config);
}

export function jump(world) {
  if (world.status !== 'playing') return world;
  // Once below the roof line, falling is committed; no jumping up through walls.
  if (world.jumps >= 2 || (!world.grounded && world.vy > 0 && world.coyote <= 0 && world.jumps === 0)) {
    return { ...world, buffer: 0.1 };
  }
  return { ...world, vy: JUMP, grounded: false, jumps: world.jumps + 1, coyote: 0, buffer: 0 };
}

export function tick(world, config, dt = STEP) {
  if (world.status !== 'playing') return world;
  const speed = Math.min(300, 145 + (world.night - 1) * 18 + world.time * 1.1);
  const travel = speed * dt;
  const roofs = world.roofs.map((roof) => ({ ...roof, x: roof.x - travel }))
    .filter((roof) => roof.x + roof.width > -100);
  let vy = Math.min(680, world.vy + GRAVITY * dt);
  let y = world.y + vy * dt;
  let grounded = false;
  let jumps = world.jumps;
  let coyote = Math.max(0, world.coyote - dt);
  const foot = CAT.x + CAT.foot;
  const oldBottom = world.y + CAT.height;
  const bottom = y + CAT.height;
  for (const roof of roofs) {
    if (foot >= roof.x && foot <= roof.x + roof.width && vy >= 0 && oldBottom <= roof.y + 0.01 && bottom >= roof.y) {
      y = roof.y - CAT.height;
      vy = 0;
      grounded = true;
      jumps = 0;
      coyote = 0.1;
      break;
    }
  }
  // A roof edge is a solid wall, not a new floor to snap up onto.
  const wall = roofs.some((roof) => foot >= roof.x && foot <= roof.x + roof.width &&
    oldBottom > roof.y + 4 && world.y < config.height);
  let obstacles = world.obstacles.map((obstacle) => {
    const moved = { ...obstacle, x: obstacle.x - travel };
    if (obstacle.state !== 'defeated') return moved;
    const defeatAge = Math.max(0, world.time - obstacle.defeatedAt);
    if (defeatAge < DEFEATED_HOLD_TIME) return { ...moved, fallVy: 0 };
    const fallVy = Math.min(420, (obstacle.fallVy ?? 0) + DEFEATED_FALL_GRAVITY * dt);
    return { ...moved, y: obstacle.y + fallVy * dt, fallVy };
  }).filter((obstacle) => obstacle.x + obstacle.width > -80 && obstacle.y < config.height + 120);

  const overlapsHorizontally = (obstacle) =>
    CAT.x + CAT.width - 8 > obstacle.x && CAT.x + 8 < obstacle.x + obstacle.width;
  const stomped = obstacles.find((obstacle) => obstacle.state !== 'defeated' &&
    overlapsHorizontally(obstacle) && vy > 0 && oldBottom <= obstacle.y + 9 &&
    y + CAT.height >= obstacle.y && y + CAT.height <= obstacle.y + obstacle.height * 0.55
  );
  if (stomped) {
    obstacles = obstacles.map((obstacle) => obstacle.id === stomped.id
      ? { ...obstacle, state: 'defeated', defeatedAt: world.time + dt, fallVy: 0 }
      : obstacle);
    y = stomped.y - CAT.height;
    vy = STOMP_BOUNCE;
    grounded = false;
    jumps = 1;
    coyote = 0;
  }
  const hitObstacle = obstacles.some((obstacle) => obstacle.state !== 'defeated' &&
    overlapsHorizontally(obstacle) &&
    y + CAT.height - 6 > obstacle.y && y + 8 < obstacle.y + obstacle.height
  );
  const status = hitObstacle || y > config.height + CAT.height ? 'ended' : 'playing';
  let stars = world.stars;
  const distance = world.distance + travel * 0.08;
  const collectibles = world.collectibles.map((star) => ({ ...star, x: star.x - travel }))
    .filter((star) => {
      if (star.x < -24) return false;
      if (star.x + 14 > CAT.x + 15 && star.x < CAT.x + CAT.width - 4 && star.y + 14 > y && star.y < y + CAT.height) {
        stars += 1;
        return false;
      }
      return true;
    });
  let next = extendWorld({ ...world, time: world.time + dt, scroll: world.scroll + travel,
    distance, mission: { ...world.mission, completed: world.mission.completed || distance >= world.mission.target }, stars, y, vy, grounded, jumps, coyote,
    buffer: Math.max(0, world.buffer - dt), roofs, collectibles, obstacles, status,
    reason: status === 'ended' ? (hitObstacle ? 'obstacle' : 'fall') : world.reason }, config);
  if (wall) next = { ...next, jumps: 2, coyote: 0 };
  if (grounded && next.buffer > 0) next = jump(next);
  return next;
}
