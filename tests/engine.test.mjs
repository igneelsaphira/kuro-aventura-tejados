import test from 'node:test';
import assert from 'node:assert/strict';
import { CAT, STEP, configFor, createWorld, jump, resizeWorld, tick } from '../src/game/engine.mjs';
const config = configFor(1280, 800);
const advance = (world, count) => { for (let i = 0; i < count; i++) world = tick(world, config); return world; };

test('no input walks off a real roof and falls below the screen', () => {
  let world = createWorld(config, 'playing');
  let sawFall = false;
  for (let i = 0; i < 600 && world.status === 'playing'; i++) {
    world = tick({ ...world, obstacles: [] }, config);
    if (world.y > config.ground - CAT.height + 5) sawFall = true;
  }
  assert.ok(sawFall);
  assert.equal(world.status, 'ended');
  assert.equal(world.reason, 'fall');
  assert.ok(world.y > config.height);
});

test('a timed double jump crosses a gap and resets jumps on the next roof', () => {
  let world = createWorld(config, 'playing');
  const foot = CAT.x + CAT.foot;
  while (world.roofs[0].x + world.roofs[0].width - foot > 18) world = tick(world, config);
  world = jump(world);
  world = advance(world, 15);
  world = jump(world);
  assert.equal(world.jumps, 2);
  assert.equal(jump(world).vy, world.vy, 'third jump must not add an impulse');
  for (let i = 0; i < 80 && !world.grounded; i++) world = tick(world, config);
  assert.equal(world.status, 'playing');
  assert.ok(world.grounded);
  assert.equal(world.jumps, 0);
  const supportingRoof = world.roofs.find((roof) => foot >= roof.x && foot <= roof.x + roof.width);
  assert.equal(supportingRoof.id, 1);
});

test('a late jump cannot pull Kuro back through the side of a building', () => {
  let world = createWorld(config, 'playing');
  while (world.y < config.ground - CAT.height + 20) world = tick(world, config);
  const late = jump(world);
  assert.ok(late.vy >= 0);
  world = advance(late, 180);
  assert.equal(world.status, 'ended');
});

test('brief edge grace allows a forgiving jump just after leaving a roof', () => {
  let world = createWorld(config, 'playing');
  while (world.grounded) world = tick(world, config);
  world = advance(world, 2);
  assert.ok(jump(world).vy < 0);
});

test('paused simulation freezes and resize preserves the current run', () => {
  let world = advance(createWorld(config, 'playing'), 30);
  world = { ...world, status: 'paused' };
  assert.strictEqual(tick(world, config), world);
  const phone = configFor(390, 844);
  const resized = resizeWorld(world, config, phone);
  assert.equal(resized.distance, world.distance);
  assert.equal(resized.status, 'paused');
  assert.ok(Math.abs(resized.y + CAT.height - phone.ground) < 0.001);
  assert.ok(Math.abs(phone.width * phone.scale - 390) < 0.001);
  assert.ok(Math.abs(phone.height * phone.scale - 844) < 0.001);
});

test('star collection increments once and follows the same world scroll as roofs', () => {
  let world = createWorld(config, 'playing');
  world.collectibles = [{ id: 'test', x: CAT.x + 20, y: world.y + 10 }];
  world = tick(world, config, STEP);
  assert.equal(world.stars, 1);
  assert.equal(advance(world, 3).stars, 1);
});

test('successive gaps remain traversable as the run speeds up', () => {
  let world = createWorld(config, 'playing');
  // This is a movement test; obstacle collisions are covered separately.
  world = { ...world, obstacles: [] };
  let airborneFrames = 0;
  for (let i = 0; i < 8000; i++) {
    const foot = CAT.x + CAT.foot;
    const roof = world.roofs.find((r) => foot >= r.x && foot <= r.x + r.width);
    if (world.grounded) {
      airborneFrames = 0;
      if (roof && roof.x + roof.width - foot < 18) world = jump(world);
    } else {
      airborneFrames++;
      if (airborneFrames === 15) world = jump(world);
    }
    world = tick({ ...world, obstacles: [] }, config);
    assert.equal(world.status, 'playing', `run failed at simulation frame ${i}`);
  }
  assert.ok(world.distance > 2000);
  assert.ok(world.roofs[0].id > 50);
});


test('nights increase speed and widen gaps progressively', () => {
  const nightOne = createWorld(config, 'playing', 1);
  const nightThree = createWorld(config, 'playing', 3);
  const oneFrame = tick(nightOne, config);
  const threeFrame = tick(nightThree, config);
  assert.ok(threeFrame.scroll > oneFrame.scroll);
  assert.ok(nightThree.roofs[1].x > nightOne.roofs[1].x);
});

test('the first mission completes after reaching its distance target', () => {
  let world = createWorld(config, 'playing', 1);
  assert.equal(world.mission.completed, false);
  world = { ...world, distance: world.mission.target - 0.1, obstacles: [] };
  world = tick(world, config);
  assert.equal(world.mission.target, 300);
  assert.equal(world.mission.completed, true);
});

test('touching a beetle costs one heart and leaves it harmlessly behind', () => {
  let world = createWorld(config, 'playing', 1);
  world = {
    ...world,
    obstacles: [{ id: 'beetle-test', x: CAT.x + 10, y: world.y, width: 52, height: 44 }],
  };
  world = tick(world, config);
  assert.equal(world.status, 'playing');
  assert.equal(world.hearts, 2);
  assert.equal(world.obstacles[0].state, 'passed');
  assert.ok(world.invulnerable > 1);
  world = advance(world, 4);
  assert.equal(world.hearts, 2, 'the same beetle must not deal repeated damage');
  assert.ok(world.obstacles[0].x < CAT.x, 'the harmless beetle should remain behind Kuro');
});

test('losing the final heart ends the run', () => {
  let world = createWorld(config, 'playing', 1);
  world = {
    ...world,
    hearts: 1,
    obstacles: [{ id: 'beetle-final-heart', x: CAT.x + 10, y: world.y, width: 52, height: 44 }],
  };
  world = tick(world, config);
  assert.equal(world.hearts, 0);
  assert.equal(world.status, 'ended');
  assert.equal(world.reason, 'obstacle');
});

test('landing on a beetle defeats it, bounces Kuro, and makes it fall', () => {
  let world = createWorld(config, 'playing', 1);
  const beetleY = config.ground - 92;
  world = {
    ...world,
    y: beetleY - CAT.height - 1,
    vy: 120,
    grounded: false,
    jumps: 1,
    obstacles: [{ id: 'beetle-stomp', x: CAT.x + 12, y: beetleY, width: 52, height: 44 }],
  };

  world = tick(world, config, STEP);
  assert.equal(world.status, 'playing');
  assert.equal(world.hearts, 3, 'a successful stomp should not cost a heart');
  assert.ok(world.vy < 0, 'stomping should bounce Kuro upward');
  assert.equal(world.obstacles[0].state, 'defeated');

  const defeatedY = world.obstacles[0].y;
  const defeatedX = world.obstacles[0].x;
  world = advance(world, 12);
  assert.equal(world.obstacles[0].y, defeatedY, 'the squashed pose should remain visible briefly');
  assert.ok(defeatedX - world.obstacles[0].x < 8, 'the defeated beetle should linger near the impact');
  world = advance(world, 24);
  assert.ok(world.obstacles[0].y > defeatedY, 'the defeated beetle should fall downward');
  assert.equal(world.status, 'playing');
});
