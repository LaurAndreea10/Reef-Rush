const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const coinsEl = document.getElementById("coins");
const comboEl = document.getElementById("combo");
const startScreen = document.getElementById("startScreen");
const gameOverScreen = document.getElementById("gameOverScreen");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");
const soundBtn = document.getElementById("soundBtn");
const themeBtn = document.getElementById("themeBtn");
const modeButtons = document.querySelectorAll(".mode");
const missionProgress = document.getElementById("missionProgress");
const missionText = document.getElementById("missionText");
const finalScore = document.getElementById("finalScore");
const finalCoins = document.getElementById("finalCoins");
const finalWave = document.getElementById("finalWave");
const resultTitle = document.getElementById("resultTitle");
const resultText = document.getElementById("resultText");
const achievementsEl = document.getElementById("achievements");

const leftBtn = document.getElementById("leftBtn");
const rightBtn = document.getElementById("rightBtn");
const jumpBtn = document.getElementById("jumpBtn");

const W = canvas.width;
const H = canvas.height;

let raf;
let lastTime = 0;
let mode = "classic";
let running = false;
let soundOn = true;
let dark = true;

let best = Number(localStorage.getItem("surfRun2Best") || 0);
bestEl.textContent = best;

const keys = {
  left: false,
  right: false,
  jump: false
};

const state = {
  score: 0,
  coins: 0,
  combo: 1,
  comboTimer: 0,
  lives: 3,
  wave: 1,
  speed: 4.2,
  elapsed: 0,
  timeLimit: 90,
  shake: 0,
  magnet: 0,
  turbo: 0,
  shield: 0,
  gameOver: false,
  spawnTimer: 0,
  coinTimer: 0,
  powerTimer: 0,
  difficultyTimer: 0
};

const player = {
  x: 170,
  y: 330,
  w: 58,
  h: 70,
  vy: 0,
  grounded: true,
  lane: 1,
  invincible: 0,
  lean: 0
};

let obstacles = [];
let coins = [];
let powers = [];
let particles = [];
let splashes = [];
let stars = [];
let floatingText = [];

const achievements = [
  {
    id: "firstRide",
    label: "First Ride",
    icon: "🏄",
    test: () => state.score > 100
  },
  {
    id: "shellHunter",
    label: "Shell Hunter",
    icon: "🐚",
    test: () => state.coins >= 15
  },
  {
    id: "comboWave",
    label: "Combo Wave",
    icon: "⚡",
    test: () => state.combo >= 5
  },
  {
    id: "stormSurvivor",
    label: "Storm Survivor",
    icon: "🌩️",
    test: () => mode === "storm" && state.score > 900
  }
];

let unlocked = JSON.parse(localStorage.getItem("surfRun2Achievements") || "[]");

function renderAchievements() {
  achievementsEl.innerHTML = achievements
    .map((a) => {
      const ok = unlocked.includes(a.id);
      return `
        <div class="achievement ${ok ? "unlocked" : ""}">
          <span>${a.icon}</span>
          <strong>${a.label}</strong>
        </div>
      `;
    })
    .join("");
}

renderAchievements();

function audioBeep(freq = 440, duration = 0.06, type = "sine", volume = 0.05) {
  if (!soundOn) return;

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  const audio = new AudioContext();
  const osc = audio.createOscillator();
  const gain = audio.createGain();

  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = volume;

  osc.connect(gain);
  gain.connect(audio.destination);

  osc.start();
  osc.stop(audio.currentTime + duration);

  osc.onended = () => audio.close();
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function rectsHit(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function resetGame() {
  state.score = 0;
  state.coins = 0;
  state.combo = 1;
  state.comboTimer = 0;
  state.lives = mode === "zen" ? 999 : 3;
  state.wave = 1;
  state.speed = mode === "storm" ? 5.2 : 4.2;
  state.elapsed = 0;
  state.shake = 0;
  state.magnet = 0;
  state.turbo = 0;
  state.shield = 0;
  state.gameOver = false;
  state.spawnTimer = 0;
  state.coinTimer = 0;
  state.powerTimer = 6;
  state.difficultyTimer = 0;

  player.x = 170;
  player.y = 330;
  player.vy = 0;
  player.grounded = true;
  player.invincible = 0;
  player.lean = 0;

  obstacles = [];
  coins = [];
  powers = [];
  particles = [];
  splashes = [];
  floatingText = [];

  createStars();
  updateUI();
}

function createStars() {
  stars = Array.from({ length: 90 }, () => ({
    x: rand(0, W),
    y: rand(0, H * 0.55),
    r: rand(0.6, 2.2),
    s: rand(0.2, 0.9),
    a: rand(0.25, 0.9)
  }));
}

function startGame() {
  resetGame();
  running = true;
  startScreen.classList.add("hidden");
  gameOverScreen.classList.add("hidden");
  lastTime = performance.now();
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(loop);
  audioBeep(660, 0.08, "triangle", 0.07);
  setTimeout(() => audioBeep(880, 0.08, "triangle", 0.06), 90);
}

function endGame(reason = "wipeout") {
  running = false;
  state.gameOver = true;
  cancelAnimationFrame(raf);

  if (state.score > best) {
    best = Math.floor(state.score);
    localStorage.setItem("surfRun2Best", best);
    resultTitle.textContent = "New Best!";
    resultText.textContent = "You carved the cleanest line through the reef.";
  } else if (reason === "time") {
    resultTitle.textContent = "Time!";
    resultText.textContent = "The tide clock ran out, but your run counted.";
  } else {
    resultTitle.textContent = mode === "zen" ? "Zen Run Complete" : "Wipeout!";
    resultText.textContent = "You reached the reef line. Try a cleaner combo next run.";
  }

  finalScore.textContent = Math.floor(state.score);
  finalCoins.textContent = state.coins;
  finalWave.textContent = state.wave;
  bestEl.textContent = best;

  gameOverScreen.classList.remove("hidden");
  audioBeep(180, 0.18, "sawtooth", 0.04);
}

function updateUI() {
  scoreEl.textContent = Math.floor(state.score);
  bestEl.textContent = best;
  coinsEl.textContent = state.coins;
  comboEl.textContent = `x${state.combo}`;

  const progress = clamp((state.coins / 15) * 100, 0, 100);
  missionProgress.style.width = `${progress}%`;

  if (mode === "time") {
    const left = Math.max(0, Math.ceil(state.timeLimit - state.elapsed));
    missionText.textContent = `Time Attack: ${left}s left. Collect shells for bonus score.`;
  } else if (mode === "storm") {
    missionText.textContent = "Storm Tide: survive fast hazards and reach 900+ score.";
  } else if (mode === "zen") {
    missionText.textContent = "Zen: relax, collect shells, no crash penalty.";
  } else {
    missionText.textContent = "Collect 15 shells and keep a combo above x3.";
  }
}

function unlockCheck() {
  let changed = false;

  achievements.forEach((a) => {
    if (!unlocked.includes(a.id) && a.test()) {
      unlocked.push(a.id);
      changed = true;
      addText(player.x, player.y - 30, `${a.icon} ${a.label}`);
      audioBeep(980, 0.12, "triangle", 0.07);
    }
  });

  if (changed) {
    localStorage.setItem("surfRun2Achievements", JSON.stringify(unlocked));
    renderAchievements();
  }
}

function addText(x, y, text) {
  floatingText.push({
    x,
    y,
    text,
    life: 1,
    vy: -1.2
  });
}

function spawnObstacle() {
  const types = ["reef", "buoy", "driftwood", "jelly"];
  const type = types[Math.floor(Math.random() * types.length)];
  const baseY = type === "jelly" ? rand(245, 310) : rand(348, 388);

  obstacles.push({
    type,
    x: W + 40,
    y: baseY,
    w: type === "reef" ? 72 : type === "buoy" ? 48 : 62,
    h: type === "jelly" ? 54 : type === "reef" ? 54 : 44,
    passed: false,
    bob: rand(0, 10)
  });
}

function spawnCoinCluster() {
  const y = rand(235, 345);
  const count = Math.floor(rand(4, 7));

  for (let i = 0; i < count; i++) {
    coins.push({
      x: W + 30 + i * 46,
      y: y + Math.sin(i) * 22,
      w: 24,
      h: 24,
      spin: rand(0, Math.PI * 2)
    });
  }
}

function spawnPower() {
  const types = ["shield", "turbo", "magnet"];
  const type = types[Math.floor(Math.random() * types.length)];

  powers.push({
    type,
    x: W + 60,
    y: rand(235, 330),
    w: 34,
    h: 34,
    spin: 0
  });
}

function addSplash(x, y, amount = 12) {
  for (let i = 0; i < amount; i++) {
    splashes.push({
      x,
      y,
      vx: rand(-2.4, 2.4),
      vy: rand(-3.4, -0.6),
      r: rand(2, 5),
      life: rand(0.45, 0.9)
    });
  }
}

function addParticles(x, y, color = "rgba(93,247,255,") {
  for (let i = 0; i < 16; i++) {
    particles.push({
      x,
      y,
      vx: rand(-2, 2),
      vy: rand(-2, 2),
      r: rand(2, 5),
      life: rand(0.4, 0.9),
      color
    });
  }
}

function jump() {
  if (player.grounded || mode === "zen") {
    player.vy = -12.8;
    player.grounded = false;
    addSplash(player.x + 18, player.y + player.h, 10);
    audioBeep(560, 0.05, "triangle", 0.045);
  }
}

function update(dt) {
  const scaled = dt / 16.67;

  state.elapsed += dt / 1000;
  state.score += (0.18 * state.combo + state.speed * 0.04) * scaled;

  if (mode === "time" && state.elapsed >= state.timeLimit) {
    endGame("time");
    return;
  }

  state.difficultyTimer += dt / 1000;
  if (state.difficultyTimer > 10) {
    state.difficultyTimer = 0;
    state.wave += 1;
    state.speed += mode === "storm" ? 0.55 : 0.32;
    addText(W / 2 - 40, 140, `Wave ${state.wave}`);
  }

  if (state.turbo > 0) {
    state.turbo -= dt / 1000;
  }

  if (state.magnet > 0) {
    state.magnet -= dt / 1000;
  }

  if (state.shield > 0) {
    state.shield -= dt / 1000;
  }

  if (player.invincible > 0) {
    player.invincible -= dt / 1000;
  }

  if (state.comboTimer > 0) {
    state.comboTimer -= dt / 1000;
  } else {
    state.combo = 1;
  }

  const speedBoost = state.turbo > 0 ? 1.45 : 1;
  const worldSpeed = state.speed * speedBoost * scaled;

  if (keys.left) {
    player.x -= 6.2 * scaled;
    player.lean = -0.16;
  } else if (keys.right) {
    player.x += 6.2 * scaled;
    player.lean = 0.16;
  } else {
    player.lean *= 0.85;
  }

  if (keys.jump) {
    jump();
    keys.jump = false;
  }

  player.x = clamp(player.x, 30, W - player.w - 30);

  player.vy += 0.68 * scaled;
  player.y += player.vy * scaled;

  const waterLine = 348 + Math.sin(state.elapsed * 2.2) * 8;

  if (player.y >= waterLine - player.h) {
    player.y = waterLine - player.h;
    player.vy = 0;

    if (!player.grounded) {
      addSplash(player.x + 22, player.y + player.h, 9);
    }

    player.grounded = true;
  } else {
    player.grounded = false;
  }

  state.spawnTimer -= dt / 1000;
  state.coinTimer -= dt / 1000;
  state.powerTimer -= dt / 1000;

  if (state.spawnTimer <= 0) {
    spawnObstacle();
    state.spawnTimer = rand(1.1, 1.75) / (mode === "storm" ? 1.25 : 1);
  }

  if (state.coinTimer <= 0) {
    spawnCoinCluster();
    state.coinTimer = rand(1.3, 2.4);
  }

  if (state.powerTimer <= 0) {
    spawnPower();
    state.powerTimer = rand(8, 14);
  }

  obstacles.forEach((o) => {
    o.x -= worldSpeed;
    o.bob += 0.05 * scaled;

    if (o.type === "jelly") {
      o.y += Math.sin(o.bob) * 0.7;
    }

    if (!o.passed && o.x + o.w < player.x) {
      o.passed = true;
      state.score += 20 * state.combo;
      state.combo = clamp(state.combo + 1, 1, 9);
      state.comboTimer = 3;
      addText(o.x, o.y - 20, `+${20 * state.combo}`);
    }

    if (rectsHit(player, o) && player.invincible <= 0) {
      handleHit(o);
    }
  });

  obstacles = obstacles.filter((o) => o.x > -120);

  coins.forEach((c) => {
    c.x -= worldSpeed;
    c.spin += 0.12 * scaled;

    if (state.magnet > 0) {
      const dx = player.x + player.w / 2 - c.x;
      const dy = player.y + player.h / 2 - c.y;
      const d = Math.hypot(dx, dy);

      if (d < 170) {
        c.x += dx * 0.055 * scaled;
        c.y += dy * 0.055 * scaled;
      }
    }

    if (rectsHit(player, c)) {
      c.collected = true;
      state.coins += 1;
      state.score += 35 * state.combo;
      state.combo = clamp(state.combo + 1, 1, 9);
      state.comboTimer = 3.5;
      addParticles(c.x, c.y, "rgba(255,206,93,");
      addText(c.x, c.y - 12, "+ shell");
      audioBeep(820 + state.combo * 20, 0.04, "sine", 0.045);
    }
  });

  coins = coins.filter((c) => !c.collected && c.x > -60);

  powers.forEach((p) => {
    p.x -= worldSpeed;
    p.spin += 0.08 * scaled;

    if (rectsHit(player, p)) {
      p.collected = true;
      activatePower(p.type);
    }
  });

  powers = powers.filter((p) => !p.collected && p.x > -60);

  particles.forEach((p) => {
    p.x += p.vx * scaled;
    p.y += p.vy * scaled;
    p.life -= 0.025 * scaled;
  });

  splashes.forEach((s) => {
    s.x += s.vx * scaled;
    s.y += s.vy * scaled;
    s.vy += 0.12 * scaled;
    s.life -= 0.028 * scaled;
  });

  floatingText.forEach((t) => {
    t.y += t.vy * scaled;
    t.life -= 0.016 * scaled;
  });

  particles = particles.filter((p) => p.life > 0);
  splashes = splashes.filter((s) => s.life > 0);
  floatingText = floatingText.filter((t) => t.life > 0);

  if (state.shake > 0) {
    state.shake *= 0.86;
  }

  unlockCheck();
  updateUI();
}

function activatePower(type) {
  if (type === "shield") {
    state.shield = 12;
    addText(player.x, player.y - 28, "Bubble Shield");
    audioBeep(720, 0.1, "triangle", 0.06);
  }

  if (type === "turbo") {
    state.turbo = 7;
    addText(player.x, player.y - 28, "Turbo Fin");
    audioBeep(980, 0.08, "sawtooth", 0.045);
  }

  if (type === "magnet") {
    state.magnet = 9;
    addText(player.x, player.y - 28, "Magnet Shell");
    audioBeep(620, 0.1, "sine", 0.06);
  }

  addParticles(player.x + player.w / 2, player.y + 20, "rgba(129,255,176,");
}

function handleHit(obstacle) {
  player.invincible = 1.3;
  state.shake = 12;
  state.combo = 1;
  state.comboTimer = 0;
  addSplash(player.x + player.w / 2, player.y + player.h, 22);
  addParticles(player.x + player.w / 2, player.y + 24, "rgba(255,93,143,");

  if (state.shield > 0) {
    state.shield = 0;
    addText(player.x, player.y - 34, "Shield saved you!");
    audioBeep(260, 0.08, "square", 0.045);
    return;
  }

  if (mode !== "zen") {
    state.lives -= 1;
    addText(player.x, player.y - 34, `-${obstacle.type}`);
  } else {
    addText(player.x, player.y - 34, "Zen save");
  }

  audioBeep(130, 0.13, "sawtooth", 0.035);

  if (state.lives <= 0) {
    endGame("hit");
  }
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#071529");
  sky.addColorStop(0.45, "#103459");
  sky.addColorStop(1, "#0a7891");

  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  stars.forEach((s) => {
    s.x -= s.s * 0.2;
    if (s.x < -5) s.x = W + 5;

    ctx.globalAlpha = s.a;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.globalAlpha = 1;

  ctx.fillStyle = "rgba(255, 206, 93, 0.9)";
  ctx.beginPath();
  ctx.arc(740, 94, 38, 0, Math.PI * 2);
  ctx.fill();

  drawMountains();
  drawWater();
}

function drawMountains() {
  ctx.fillStyle = "rgba(4, 20, 38, 0.55)";
  ctx.beginPath();
  ctx.moveTo(0, 260);
  ctx.lineTo(110, 150);
  ctx.lineTo(250, 255);
  ctx.lineTo(390, 130);
  ctx.lineTo(570, 265);
  ctx.lineTo(760, 145);
  ctx.lineTo(900, 250);
  ctx.lineTo(900, 520);
  ctx.lineTo(0, 520);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(93, 247, 255, 0.1)";
  for (let x = -80; x < W + 80; x += 160) {
    ctx.beginPath();
    ctx.ellipse(x + ((state.elapsed * 22) % 160), 286, 80, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawWater() {
  const water = ctx.createLinearGradient(0, 280, 0, H);
  water.addColorStop(0, "rgba(69, 224, 255, 0.42)");
  water.addColorStop(0.55, "rgba(0, 122, 175, 0.72)");
  water.addColorStop(1, "rgba(0, 49, 96, 0.96)");
  ctx.fillStyle = water;

  ctx.beginPath();
  ctx.moveTo(0, 330);

  for (let x = 0; x <= W; x += 18) {
    const y =
      330 +
      Math.sin(x * 0.022 + state.elapsed * 2.8) * 12 +
      Math.sin(x * 0.049 + state.elapsed * 1.6) * 7;
    ctx.lineTo(x, y);
  }

  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.38)";
  ctx.lineWidth = 2;

  for (let row = 0; row < 4; row++) {
    ctx.beginPath();
    const offset = (state.elapsed * (35 + row * 12)) % 180;

    for (let x = -180; x <= W + 20; x += 24) {
      const px = x + offset;
      const py = 360 + row * 34 + Math.sin(px * 0.04 + state.elapsed * 3) * 6;
      if (x === -180) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }

    ctx.stroke();
  }
}

function drawPlayer() {
  ctx.save();

  const blink = player.invincible > 0 && Math.floor(performance.now() / 90) % 2 === 0;
  if (blink) ctx.globalAlpha = 0.5;

  ctx.translate(player.x + player.w / 2, player.y + player.h / 2);
  ctx.rotate(player.lean);

  if (state.shield > 0) {
    ctx.strokeStyle = "rgba(129,255,176,0.9)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 48 + Math.sin(state.elapsed * 8) * 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (state.turbo > 0) {
    ctx.fillStyle = "rgba(255,206,93,0.35)";
    ctx.beginPath();
    ctx.ellipse(-34, 32, 42, 10, -0.25, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#ffce5d";
  ctx.beginPath();
  ctx.ellipse(0, 34, 48, 11, -0.15, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#fff2bf";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-36, 30);
  ctx.quadraticCurveTo(0, 45, 38, 29);
  ctx.stroke();

  ctx.fillStyle = "#f7b58a";
  ctx.beginPath();
  ctx.arc(0, -28, 13, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#2de1ff";
  ctx.beginPath();
  ctx.roundRect(-14, -14, 28, 34, 10);
  ctx.fill();

  ctx.strokeStyle = "#f7b58a";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-10, -5);
  ctx.lineTo(-28, 10);
  ctx.moveTo(10, -4);
  ctx.lineTo(28, 8);
  ctx.moveTo(-8, 18);
  ctx.lineTo(-22, 36);
  ctx.moveTo(8, 18);
  ctx.lineTo(23, 35);
  ctx.stroke();

  ctx.fillStyle = "#14304b";
  ctx.beginPath();
  ctx.arc(-4, -31, 2, 0, Math.PI * 2);
  ctx.arc(6, -31, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawObstacle(o) {
  ctx.save();
  ctx.translate(o.x + o.w / 2, o.y + o.h / 2);

  if (o.type === "reef") {
    ctx.fillStyle = "#f45d8f";
    ctx.beginPath();
    ctx.moveTo(-34, 22);
    ctx.lineTo(-16, -20);
    ctx.lineTo(0, 12);
    ctx.lineTo(16, -26);
    ctx.lineTo(34, 22);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.24)";
    ctx.beginPath();
    ctx.arc(10, 4, 5, 0, Math.PI * 2);
    ctx.arc(-16, 10, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  if (o.type === "buoy") {
    ctx.fillStyle = "#ffce5d";
    ctx.beginPath();
    ctx.roundRect(-20, -22, 40, 44, 12);
    ctx.fill();

    ctx.fillStyle = "#ff5d8f";
    ctx.fillRect(-20, -4, 40, 10);
  }

  if (o.type === "driftwood") {
    ctx.rotate(-0.16);
    ctx.fillStyle = "#7a4a2c";
    ctx.beginPath();
    ctx.roundRect(-34, -12, 68, 24, 12);
    ctx.fill();

    ctx.strokeStyle = "#c79262";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-20, -4);
    ctx.lineTo(22, -4);
    ctx.moveTo(-12, 6);
    ctx.lineTo(30, 6);
    ctx.stroke();
  }

  if (o.type === "jelly") {
    ctx.fillStyle = "rgba(157, 113, 255, 0.85)";
    ctx.beginPath();
    ctx.arc(0, -8, 23, Math.PI, 0);
    ctx.lineTo(23, 6);
    ctx.quadraticCurveTo(0, 22, -23, 6);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.65)";
    ctx.lineWidth = 3;

    for (let i = -14; i <= 14; i += 14) {
      ctx.beginPath();
      ctx.moveTo(i, 8);
      ctx.quadraticCurveTo(i + 8, 22, i, 36);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawCoin(c) {
  ctx.save();
  ctx.translate(c.x + c.w / 2, c.y + c.h / 2);
  ctx.scale(Math.cos(c.spin) * 0.45 + 0.55, 1);

  ctx.fillStyle = "#ffce5d";
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

function drawPower(p) {
  ctx.save();
  ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
  ctx.rotate(p.spin);

  const colors = {
    shield: "#81ffb0",
    turbo: "#ffce5d",
    magnet: "#5df7ff"
  };

  const icons = {
    shield: "🫧",
    turbo: "⚡",
    magnet: "🧲"
  };

  ctx.fillStyle = colors[p.type];
  ctx.beginPath();
  ctx.arc(0, 0, 19, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(-p.spin);
  ctx.font = "20px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(icons[p.type], 0, 1);

  ctx.restore();
}

function drawParticles() {
  particles.forEach((p) => {
    ctx.globalAlpha = clamp(p.life, 0, 1);
    ctx.fillStyle = `${p.color}${p.life})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  });

  splashes.forEach((s) => {
    ctx.globalAlpha = clamp(s.life, 0, 1);
    ctx.fillStyle = `rgba(255,255,255,${s.life})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.globalAlpha = 1;
}

function drawFloatingText() {
  ctx.save();
  ctx.font = "800 18px Inter, system-ui";
  ctx.textAlign = "center";

  floatingText.forEach((t) => {
    ctx.globalAlpha = clamp(t.life, 0, 1);
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 8;
    ctx.fillText(t.text, t.x, t.y);
  });

  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawStatusBadges() {
  const badges = [];

  if (state.shield > 0) badges.push(`🫧 ${Math.ceil(state.shield)}s`);
  if (state.turbo > 0) badges.push(`⚡ ${Math.ceil(state.turbo)}s`);
  if (state.magnet > 0) badges.push(`🧲 ${Math.ceil(state.magnet)}s`);

  ctx.save();
  ctx.font = "800 15px Inter, system-ui";
  ctx.textAlign = "left";

  badges.forEach((b, i) => {
    const x = 18;
    const y = 24 + i * 34;

    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.roundRect(x - 8, y - 18, 96, 27, 12);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.fillText(b, x, y);
  });

  if (mode !== "zen") {
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.roundRect(W - 124, 12, 106, 34, 14);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "right";
    ctx.fillText(`Lives ${"♥".repeat(state.lives)}`, W - 30, 34);
  }

  ctx.restore();
}

function draw() {
  ctx.save();

  if (state.shake > 0) {
    ctx.translate(rand(-state.shake, state.shake), rand(-state.shake, state.shake));
  }

  drawBackground();

  coins.forEach(drawCoin);
  powers.forEach(drawPower);
  obstacles.forEach(drawObstacle);
  drawPlayer();
  drawParticles();
  drawFloatingText();
  drawStatusBadges();

  ctx.restore();

  if (mode === "storm") {
    drawStormOverlay();
  }
}

function drawStormOverlay() {
  ctx.save();

  ctx.fillStyle = "rgba(7, 10, 25, 0.18)";
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1;

  for (let i = 0; i < 60; i++) {
    const x = (i * 37 + state.elapsed * 220) % (W + 140) - 80;
    const y = (i * 19 + state.elapsed * 450) % H;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 18, y + 26);
    ctx.stroke();
  }

  ctx.restore();
}

function loop(now) {
  if (!running) return;

  const dt = Math.min(32, now - lastTime);
  lastTime = now;

  update(dt);
  draw();

  raf = requestAnimationFrame(loop);
}

function setButtonControl(btn, keyName) {
  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    keys[keyName] = true;
  });

  btn.addEventListener("pointerup", () => {
    keys[keyName] = false;
  });

  btn.addEventListener("pointercancel", () => {
    keys[keyName] = false;
  });

  btn.addEventListener("pointerleave", () => {
    keys[keyName] = false;
  });
}

document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") keys.left = true;
  if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") keys.right = true;
  if (e.key === " " || e.key === "ArrowUp" || e.key.toLowerCase() === "w") {
    e.preventDefault();
    keys.jump = true;
  }

  if (e.key.toLowerCase() === "p" && running) {
    running = false;
    cancelAnimationFrame(raf);
    startScreen.classList.remove("hidden");
  }
});

document.addEventListener("keyup", (e) => {
  if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") keys.left = false;
  if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") keys.right = false;
});

let touchStartX = 0;
let touchStartY = 0;

canvas.addEventListener("pointerdown", (e) => {
  touchStartX = e.clientX;
  touchStartY = e.clientY;
});

canvas.addEventListener("pointerup", (e) => {
  const dx = e.clientX - touchStartX;
  const dy = e.clientY - touchStartY;

  if (Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy)) {
    player.x += dx > 0 ? 70 : -70;
  }

  if (dy < -25 || Math.abs(dx) < 18) {
    jump();
  }
});

setButtonControl(leftBtn, "left");
setButtonControl(rightBtn, "right");

jumpBtn.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  jump();
});

modeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    modeButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    mode = btn.dataset.mode;
    audioBeep(520, 0.04, "triangle", 0.04);
  });
});

startBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", startGame);

soundBtn.addEventListener("click", () => {
  soundOn = !soundOn;
  soundBtn.textContent = soundOn ? "🔊" : "🔇";
});

themeBtn.addEventListener("click", () => {
  dark = !dark;
  document.body.classList.toggle("light", !dark);
  themeBtn.textContent = dark ? "🌙" : "☀️";
});

if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    this.beginPath();
    this.moveTo(x + radius, y);
    this.arcTo(x + w, y, x + w, y + h, radius);
    this.arcTo(x + w, y + h, x, y + h, radius);
    this.arcTo(x, y + h, x, y, radius);
    this.arcTo(x, y, x + w, y, radius);
    this.closePath();
    return this;
  };
}

createStars();
drawBackground();
drawPlayer();
