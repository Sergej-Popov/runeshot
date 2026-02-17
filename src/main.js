const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const healthTextEl = document.getElementById("healthText");
const healthBarEl = document.getElementById("healthBar");
const ammoEl = document.getElementById("ammo");
const enemyEl = document.getElementById("enemy");

const MAP = [
  "################",
  "#..............#",
  "#..####........#",
  "#..............#",
  "#......####....#",
  "#..............#",
  "#...#..........#",
  "#...#.....######",
  "#...#..........#",
  "#..............#",
  "#......#.......#",
  "#......#.......#",
  "#..............#",
  "#..............#",
  "#..............#",
  "################",
];

const MAP_W = MAP[0].length;
const MAP_H = MAP.length;

const FOV = Math.PI / 3;
const HALF_FOV = FOV / 2;
const RAY_COUNT = 320;
const MAX_DEPTH = 24;

const PLAYER = {
  x: 2.2,
  y: 2.2,
  angle: 0,
  speed: 3.5,
  turnSpeed: 2.2,
  radius: 0.2,
  maxHealth: 100,
  health: 100,
  ammo: 40,
};

const ENEMY_SPAWNS = [
  { x: 11.5, y: 10.5 },
  { x: 12.5, y: 3.5 },
  { x: 8.5, y: 12.5 },
  { x: 4.5, y: 9.5 },
];

const ENEMY_TEMPLATE = {
  radius: 0.3,
  speed: 1.0,
  health: 2,
  meleeCooldown: 0,
  rangedCooldown: 0,
  alive: true,
};

const input = {
  KeyW: false,
  KeyA: false,
  KeyS: false,
  KeyD: false,
  ArrowLeft: false,
  ArrowRight: false,
  Space: false,
  shootRequested: false,
};

const enemies = [];
const enemyShots = [];

let lastTime = 0;
let fireCooldown = 0;
let muzzleFlash = 0;
let gameOver = false;
let victory = false;
let hasPointerLock = false;
let audioCtx = null;

function isWall(x, y) {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return true;
  return MAP[Math.floor(y)][Math.floor(x)] === "#";
}

function normalizeAngle(a) {
  while (a < -Math.PI) a += Math.PI * 2;
  while (a > Math.PI) a -= Math.PI * 2;
  return a;
}

function initAudio() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

function playTone({
  type = "square",
  startFreq = 440,
  endFreq = 220,
  duration = 0.12,
  gain = 0.08,
  noise = false,
}) {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const attack = 0.005;
  const release = Math.max(0.03, duration - attack);
  const out = audioCtx.createGain();
  out.gain.setValueAtTime(0.0001, now);
  out.gain.exponentialRampToValueAtTime(gain, now + attack);
  out.gain.exponentialRampToValueAtTime(0.0001, now + attack + release);
  out.connect(audioCtx.destination);

  if (noise) {
    const size = Math.floor(audioCtx.sampleRate * duration);
    const buffer = audioCtx.createBuffer(1, size, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i += 1) data[i] = (Math.random() * 2 - 1) * 0.9;
    const src = audioCtx.createBufferSource();
    const filter = audioCtx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(Math.max(120, startFreq), now);
    filter.Q.value = 1.5;
    src.buffer = buffer;
    src.connect(filter);
    filter.connect(out);
    src.start(now);
    src.stop(now + duration);
    return;
  }

  const osc = audioCtx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(startFreq, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(50, endFreq), now + duration);
  osc.connect(out);
  osc.start(now);
  osc.stop(now + duration);
}

function playGunSound() {
  playTone({ type: "square", startFreq: 170, endFreq: 70, duration: 0.08, gain: 0.09 });
  playTone({ startFreq: 1800, endFreq: 300, duration: 0.07, gain: 0.045, noise: true });
}

function playCatMeowSound() {
  playTone({ type: "triangle", startFreq: 620, endFreq: 420, duration: 0.09, gain: 0.06 });
  playTone({ type: "triangle", startFreq: 520, endFreq: 760, duration: 0.08, gain: 0.05 });
}

function playEnemyDeathSound() {
  playTone({ type: "sawtooth", startFreq: 220, endFreq: 110, duration: 0.14, gain: 0.07 });
  playTone({ startFreq: 900, endFreq: 180, duration: 0.12, gain: 0.035, noise: true });
}

function playPlayerDeathSound() {
  playTone({ type: "sawtooth", startFreq: 170, endFreq: 55, duration: 0.26, gain: 0.09 });
  playTone({ startFreq: 480, endFreq: 80, duration: 0.24, gain: 0.04, noise: true });
}

function lineOfSight(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.001) return true;

  const step = 0.08;
  let x = ax;
  let y = ay;
  let t = 0;
  while (t < dist) {
    x += (dx / dist) * step;
    y += (dy / dist) * step;
    if (isWall(x, y)) return false;
    t += step;
  }
  return true;
}

function livingEnemyCount() {
  return enemies.filter((e) => e.alive).length;
}

function resetGame() {
  PLAYER.x = 2.2;
  PLAYER.y = 2.2;
  PLAYER.angle = 0;
  PLAYER.health = PLAYER.maxHealth;
  PLAYER.ammo = 40;

  enemies.length = 0;
  enemyShots.length = 0;

  for (const spawn of ENEMY_SPAWNS) {
    enemies.push({
      ...ENEMY_TEMPLATE,
      x: spawn.x,
      y: spawn.y,
      meleeCooldown: Math.random() * 0.4,
      rangedCooldown: Math.random() * 1.2,
      health: 2,
      alive: true,
    });
  }

  fireCooldown = 0;
  muzzleFlash = 0;
  gameOver = false;
  victory = false;
  updateHud();
}

function updateHud() {
  const hp = Math.max(0, Math.floor(PLAYER.health));
  const hpPercent = Math.max(0, Math.min(100, (PLAYER.health / PLAYER.maxHealth) * 100));

  healthTextEl.textContent = `Health: ${hp}`;
  healthBarEl.style.width = `${hpPercent}%`;
  ammoEl.textContent = `Ammo: ${PLAYER.ammo}`;

  const alive = livingEnemyCount();
  enemyEl.textContent = `Cat Fiends: ${alive}/${enemies.length}`;
}

function tryMove(nx, ny) {
  const r = PLAYER.radius;
  if (!isWall(nx - r, PLAYER.y) && !isWall(nx + r, PLAYER.y)) {
    PLAYER.x = nx;
  }
  if (!isWall(PLAYER.x, ny - r) && !isWall(PLAYER.x, ny + r)) {
    PLAYER.y = ny;
  }
}

function castRay(rayAngle) {
  const step = 0.03;
  let depth = 0;
  let x = PLAYER.x;
  let y = PLAYER.y;

  while (depth < MAX_DEPTH) {
    x += Math.cos(rayAngle) * step;
    y += Math.sin(rayAngle) * step;
    depth += step;
    if (isWall(x, y)) break;
  }

  const corrected = depth * Math.cos(rayAngle - PLAYER.angle);
  return Math.max(0.0001, corrected);
}

function renderEnemySprite(enemy, wallDepths, tint) {
  const dx = enemy.x - PLAYER.x;
  const dy = enemy.y - PLAYER.y;
  const dist = Math.hypot(dx, dy);
  const angleToEnemy = Math.atan2(dy, dx);
  const relative = normalizeAngle(angleToEnemy - PLAYER.angle);

  if (Math.abs(relative) > HALF_FOV + 0.25) return;

  const screenX = ((relative + HALF_FOV) / FOV) * canvas.width;
  const spriteSize = Math.min(canvas.height, (canvas.height * 0.75) / dist);
  const left = screenX - spriteSize / 2;
  const top = canvas.height / 2 - spriteSize / 2;

  const rayIdx = Math.max(0, Math.min(RAY_COUNT - 1, Math.floor((screenX / canvas.width) * RAY_COUNT)));
  if (dist > wallDepths[rayIdx]) return;

  ctx.save();
  ctx.translate(left, top);

  ctx.fillStyle = tint;
  ctx.fillRect(spriteSize * 0.18, spriteSize * 0.2, spriteSize * 0.64, spriteSize * 0.62);

  ctx.fillStyle = tint;
  ctx.beginPath();
  ctx.moveTo(spriteSize * 0.18, spriteSize * 0.2);
  ctx.lineTo(spriteSize * 0.32, 0);
  ctx.lineTo(spriteSize * 0.45, spriteSize * 0.2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(spriteSize * 0.82, spriteSize * 0.2);
  ctx.lineTo(spriteSize * 0.68, 0);
  ctx.lineTo(spriteSize * 0.55, spriteSize * 0.2);
  ctx.fill();

  ctx.fillStyle = "#1a1313";
  ctx.fillRect(spriteSize * 0.33, spriteSize * 0.45, spriteSize * 0.08, spriteSize * 0.08);
  ctx.fillRect(spriteSize * 0.59, spriteSize * 0.45, spriteSize * 0.08, spriteSize * 0.08);
  ctx.fillRect(spriteSize * 0.45, spriteSize * 0.58, spriteSize * 0.1, spriteSize * 0.08);

  if (enemy.rangedCooldown < 0.2) {
    ctx.fillStyle = "#ffcc66";
    ctx.fillRect(spriteSize * 0.44, spriteSize * 0.68, spriteSize * 0.12, spriteSize * 0.08);
  }

  ctx.restore();
}

function renderShot(shot, wallDepths) {
  const dx = shot.x - PLAYER.x;
  const dy = shot.y - PLAYER.y;
  const dist = Math.hypot(dx, dy);
  const angleToShot = Math.atan2(dy, dx);
  const relative = normalizeAngle(angleToShot - PLAYER.angle);

  if (Math.abs(relative) > HALF_FOV + 0.1) return;

  const screenX = ((relative + HALF_FOV) / FOV) * canvas.width;
  const size = Math.min(50, (canvas.height * 0.18) / dist);
  const rayIdx = Math.max(0, Math.min(RAY_COUNT - 1, Math.floor((screenX / canvas.width) * RAY_COUNT)));
  if (dist > wallDepths[rayIdx]) return;

  ctx.fillStyle = "#ff7452";
  ctx.beginPath();
  ctx.arc(screenX, canvas.height / 2, Math.max(2, size * 0.2), 0, Math.PI * 2);
  ctx.fill();
}

function render3D() {
  const w = canvas.width;
  const h = canvas.height;

  ctx.fillStyle = "#7f6d56";
  ctx.fillRect(0, 0, w, h / 2);
  ctx.fillStyle = "#352821";
  ctx.fillRect(0, h / 2, w, h / 2);

  const wallDepths = new Float32Array(RAY_COUNT);
  const colW = w / RAY_COUNT;

  for (let i = 0; i < RAY_COUNT; i += 1) {
    const rayRatio = i / RAY_COUNT;
    const rayAngle = PLAYER.angle - HALF_FOV + rayRatio * FOV;
    const dist = castRay(rayAngle);
    wallDepths[i] = dist;

    const wallH = Math.min(h, (h * 0.9) / dist);
    const y = (h - wallH) / 2;

    const shade = Math.max(20, Math.floor(210 - dist * 24));
    ctx.fillStyle = `rgb(${shade}, ${Math.floor(shade * 0.8)}, ${Math.floor(shade * 0.65)})`;
    ctx.fillRect(i * colW, y, colW + 1, wallH);
  }

  const sprites = [];
  for (const enemy of enemies) {
    if (enemy.alive) sprites.push({ type: "enemy", entity: enemy, dist: Math.hypot(enemy.x - PLAYER.x, enemy.y - PLAYER.y) });
  }
  for (const shot of enemyShots) {
    sprites.push({ type: "shot", entity: shot, dist: Math.hypot(shot.x - PLAYER.x, shot.y - PLAYER.y) });
  }

  sprites.sort((a, b) => b.dist - a.dist);
  for (const sprite of sprites) {
    if (sprite.type === "enemy") {
      const tint = sprite.entity.health === 1 ? "#dc93a8" : "#f2a8b8";
      renderEnemySprite(sprite.entity, wallDepths, tint);
    } else {
      renderShot(sprite.entity, wallDepths);
    }
  }

  renderWeapon();
  renderCrosshair();
}

function renderWeapon() {
  const w = canvas.width;
  const h = canvas.height;
  const bob = Math.sin(performance.now() * 0.007) * 3;

  ctx.fillStyle = "#23262c";
  ctx.fillRect(w * 0.4, h * 0.8 + bob, w * 0.2, h * 0.18);
  ctx.fillStyle = "#434a52";
  ctx.fillRect(w * 0.45, h * 0.7 + bob, w * 0.1, h * 0.14);

  if (muzzleFlash > 0) {
    ctx.fillStyle = "#ffcf66";
    ctx.beginPath();
    ctx.moveTo(w * 0.45, h * 0.69 + bob);
    ctx.lineTo(w * 0.5, h * 0.64 + bob);
    ctx.lineTo(w * 0.55, h * 0.69 + bob);
    ctx.lineTo(w * 0.5, h * 0.72 + bob);
    ctx.closePath();
    ctx.fill();
  }
}

function renderCrosshair() {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy);
  ctx.lineTo(cx + 8, cy);
  ctx.moveTo(cx, cy - 8);
  ctx.lineTo(cx, cy + 8);
  ctx.stroke();
}

function damagePlayer(amount) {
  PLAYER.health -= amount;
  if (PLAYER.health <= 0) {
    PLAYER.health = 0;
    gameOver = true;
    playPlayerDeathSound();
  }
  updateHud();
}

function enemyShoot(enemy) {
  const dx = PLAYER.x - enemy.x;
  const dy = PLAYER.y - enemy.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.001) return;

  enemyShots.push({
    x: enemy.x,
    y: enemy.y,
    dx: dx / dist,
    dy: dy / dist,
    speed: 6,
    life: 2,
    damage: 8,
    radius: 0.12,
  });
  playCatMeowSound();
}

function updateEnemyShots(dt) {
  for (let i = enemyShots.length - 1; i >= 0; i -= 1) {
    const shot = enemyShots[i];
    shot.x += shot.dx * shot.speed * dt;
    shot.y += shot.dy * shot.speed * dt;
    shot.life -= dt;

    if (shot.life <= 0 || isWall(shot.x, shot.y)) {
      enemyShots.splice(i, 1);
      continue;
    }

    const distToPlayer = Math.hypot(shot.x - PLAYER.x, shot.y - PLAYER.y);
    if (distToPlayer < PLAYER.radius + shot.radius) {
      damagePlayer(shot.damage);
      enemyShots.splice(i, 1);
    }
  }
}

function updateEnemies(dt) {
  if (gameOver) return;

  for (const enemy of enemies) {
    if (!enemy.alive) continue;

    const dx = PLAYER.x - enemy.x;
    const dy = PLAYER.y - enemy.y;
    const dist = Math.hypot(dx, dy);
    const canSee = lineOfSight(enemy.x, enemy.y, PLAYER.x, PLAYER.y);

    if (canSee && dist > 1.05) {
      const nx = enemy.x + (dx / dist) * enemy.speed * dt;
      const ny = enemy.y + (dy / dist) * enemy.speed * dt;
      if (!isWall(nx, enemy.y)) enemy.x = nx;
      if (!isWall(enemy.x, ny)) enemy.y = ny;
    }

    enemy.meleeCooldown -= dt;
    if (dist < 1.15 && enemy.meleeCooldown <= 0) {
      damagePlayer(9);
      enemy.meleeCooldown = 0.9;
    }

    enemy.rangedCooldown -= dt;
    if (canSee && dist > 1.6 && dist < 9 && enemy.rangedCooldown <= 0) {
      enemyShoot(enemy);
      enemy.rangedCooldown = 1.2 + Math.random() * 0.6;
    }
  }

  if (!gameOver && livingEnemyCount() === 0) {
    victory = true;
  }
}

function shoot() {
  if (fireCooldown > 0 || gameOver) return;
  if (PLAYER.ammo <= 0) return;

  PLAYER.ammo -= 1;
  fireCooldown = 0.2;
  muzzleFlash = 0.06;
  playGunSound();

  let bestEnemy = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const enemy of enemies) {
    if (!enemy.alive) continue;

    const dx = enemy.x - PLAYER.x;
    const dy = enemy.y - PLAYER.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 11) continue;

    const enemyAngle = Math.atan2(dy, dx);
    const delta = Math.abs(normalizeAngle(enemyAngle - PLAYER.angle));
    if (delta > 0.1) continue;
    if (!lineOfSight(PLAYER.x, PLAYER.y, enemy.x, enemy.y)) continue;

    const score = delta * 3 + dist * 0.05;
    if (score < bestScore) {
      bestScore = score;
      bestEnemy = enemy;
    }
  }

  if (bestEnemy) {
    bestEnemy.health -= 1;
    if (bestEnemy.health <= 0) {
      bestEnemy.alive = false;
      playEnemyDeathSound();
    }
  }

  updateHud();
}

function update(dt) {
  if (!gameOver) {
    let moveX = 0;
    let moveY = 0;
    const forwardX = Math.cos(PLAYER.angle);
    const forwardY = Math.sin(PLAYER.angle);
    const rightX = Math.cos(PLAYER.angle + Math.PI / 2);
    const rightY = Math.sin(PLAYER.angle + Math.PI / 2);

    if (input.KeyW) {
      moveX += forwardX;
      moveY += forwardY;
    }
    if (input.KeyS) {
      moveX -= forwardX;
      moveY -= forwardY;
    }
    if (input.KeyA) {
      moveX -= rightX;
      moveY -= rightY;
    }
    if (input.KeyD) {
      moveX += rightX;
      moveY += rightY;
    }

    const length = Math.hypot(moveX, moveY);
    if (length > 0) {
      moveX /= length;
      moveY /= length;
      tryMove(PLAYER.x + moveX * PLAYER.speed * dt, PLAYER.y + moveY * PLAYER.speed * dt);
    }

    if (input.ArrowLeft) PLAYER.angle -= PLAYER.turnSpeed * dt;
    if (input.ArrowRight) PLAYER.angle += PLAYER.turnSpeed * dt;
  }

  fireCooldown = Math.max(0, fireCooldown - dt);
  muzzleFlash = Math.max(0, muzzleFlash - dt);

  if (input.shootRequested || input.Space) {
    shoot();
    input.shootRequested = false;
  }

  updateEnemies(dt);
  updateEnemyShots(dt);
}

function renderOverlay() {
  if (!gameOver && !victory) return;

  ctx.fillStyle = "#000000aa";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#f4e6cf";
  ctx.textAlign = "center";
  ctx.font = "bold 52px Trebuchet MS";
  ctx.fillText(gameOver ? "YOU GOT SCRATCHED" : "ALL CAT FIENDS DEFEATED", canvas.width / 2, canvas.height / 2 - 10);
  ctx.font = "24px Trebuchet MS";
  ctx.fillText("Press R to Restart", canvas.width / 2, canvas.height / 2 + 34);
}

function frame(time) {
  const dt = Math.min(0.033, (time - lastTime) / 1000 || 0);
  lastTime = time;

  update(dt);
  render3D();
  renderOverlay();

  requestAnimationFrame(frame);
}

document.addEventListener("keydown", (e) => {
  initAudio();
  if (e.code in input) input[e.code] = true;
  if (e.code === "KeyR") resetGame();
});

document.addEventListener("keyup", (e) => {
  if (e.code in input) input[e.code] = false;
});

canvas.addEventListener("click", () => {
  initAudio();
  input.shootRequested = true;
  if (!hasPointerLock && document.pointerLockElement !== canvas) {
    canvas.requestPointerLock();
  }
});

document.addEventListener("pointerlockchange", () => {
  hasPointerLock = document.pointerLockElement === canvas;
});

document.addEventListener("mousemove", (e) => {
  if (!hasPointerLock || gameOver) return;
  PLAYER.angle += e.movementX * 0.0022;
});

resetGame();
requestAnimationFrame(frame);
