const c = document.getElementById("game");
const ctx = c.getContext("2d");
ctx.imageSmoothingEnabled = false;

const W = c.width;
const H = c.height;
const keys = {};

addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  keys[key] = true;
  if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
    e.preventDefault();
  }
});

addEventListener("keyup", (e) => {
  keys[e.key.toLowerCase()] = false;
});

const map = { x: 70, y: 55, w: 1140, h: 610 };

let player, structures, enemies, boss, bullets, enemyBullets, particles, ship, gameOver, win, level, phase, captureTimer, lastTime;
let message = "";
let messageTime = 0;

function reset() {
  player = {
    x: 640,
    y: 360,
    r: 17,
    hp: 100,
    max: 100,
    speed: 190,
    attackCd: 0,
    spinCd: 0,
    powerCd: 0,
    power: 0,
    attackAnim: 0,
    dir: 0,
  };

  structures = [
    { x: 190, y: 150, got: false },
    { x: 1090, y: 150, got: false },
    { x: 190, y: 570, got: false },
    { x: 1090, y: 570, got: false },
    { x: 640, y: 130, got: false },
  ];

  enemies = [];
  bullets = [];
  enemyBullets = [];
  particles = [];
  boss = null;
  ship = null;
  gameOver = false;
  win = false;
  phase = "structures";
  captureTimer = 0;
  level = 1;
  message = "RECUPERA LAS 5 ESTRUCTURAS";
  messageTime = 3;
  document.getElementById("death").style.display = "none";
}

function restart() {
  reset();
}

reset();

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function hit(a, b, r) {
  return dist(a, b) < r;
}

function say(t) {
  message = t;
  messageTime = 2.5;
}

function spawnEnemy(s, type) {
  const ang = Math.random() * Math.PI * 2;
  const rr = 58 + Math.random() * 35;
  enemies.push({
    x: s.x + Math.cos(ang) * rr,
    y: s.y + Math.sin(ang) * rr,
    r: 14,
    type,
    hp: type === "range" ? 25 : 50,
    max: type === "range" ? 25 : 50,
    shoot: 4.5,
    phase: Math.random() * 6,
    orbit: ang,
  });
}

function spawnGuardians(s) {
  for (let i = 0; i < 6; i++) {
    spawnEnemy(s, i < 3 ? "range" : "melee");
  }
}

function fire(x, y, tx, ty, damage, owner, speed = 300) {
  const a = Math.atan2(ty - y, tx - x);
  (owner === "player" ? bullets : enemyBullets).push({
    x,
    y,
    vx: Math.cos(a) * speed,
    vy: Math.sin(a) * speed,
    r: 5,
    damage,
    life: 4,
    owner,
  });
}

function sword() {
  if (player.attackCd > 0 || gameOver) return;
  player.attackCd = 0.48;
  player.attackAnim = 0.18;
  const power = player.power > 0 ? 1.7 : 1;
  enemies.forEach((e) => {
    if (hit(player, e, 60)) e.hp -= 25 * power;
  });
  if (boss && hit(player, boss, 70)) boss.hp -= 22 * power;
  beep();
}

function spin() {
  if (player.spinCd > 0 || gameOver) return;
  player.spinCd = 10;
  player.attackAnim = 0.35;
  const power = player.power > 0 ? 1.8 : 1;
  enemies.forEach((e) => {
    if (hit(player, e, 92)) e.hp -= 38 * power;
  });
  if (boss && hit(player, boss, 105)) boss.hp -= 30 * power;
  beep();
}

function activatePower() {
  if (player.powerCd > 0 || player.power > 0 || gameOver) return;
  player.powerCd = 15;
  player.power = 7;
  say("¡PODER DE LA ESPADA!");
}

function beep() {
  try {
    const ctxAudio = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = ctxAudio.createOscillator();
    const gain = ctxAudio.createGain();
    oscillator.type = "square";
    oscillator.frequency.value = 170;
    gain.gain.value = 0.035;
    oscillator.connect(gain);
    gain.connect(ctxAudio.destination);
    oscillator.start();
    oscillator.stop(ctxAudio.currentTime + 0.09);
  } catch (e) {
    // No audio support, nothing to do.
  }
}

function captureCheck() {
  structures.forEach((s) => {
    if (!s.got && dist(player, s) < 46) {
      s.got = true;
      spawnGuardians(s);
      const count = structures.filter((q) => q.got).length;
      say("ESTRUCTURA RECUPERADA · " + count + "/5");
      if (count === 5) {
        phase = "bossWaiting";
        captureTimer = 2;
        say("¡EL JEFE APARECERÁ EN 2 SEGUNDOS!");
      }
    }
  });
}

function spawnBoss() {
  boss = { x: 640, y: 360, r: 32, hp: 240, max: 240, shoot: 4.5, mortar: 0, phase: 0, alive: true };
  phase = "boss";
  say("GENERAL BUU: ¡COMIENZA LA BATALLA!");
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    particles.push({ kind: "heart", x: 640 + Math.cos(a) * 105, y: 360 + Math.sin(a) * 105, t: 999 });
  }
}

function spawnShip() {
  ship = { x: 250 + Math.random() * 780, y: 110 + Math.random() * 450, r: 25, hp: 160, ammo: 100, shoot: 0, active: false };
  say("NAVE DESBLOQUEADA · ACÉRCATE Y PRESIONA E");
  phase = "ship";
}

function update(dt) {
  if (gameOver || win) return;

  player.attackCd = Math.max(0, player.attackCd - dt);
  player.spinCd = Math.max(0, player.spinCd - dt);
  player.powerCd = Math.max(0, player.powerCd - dt);
  player.power = Math.max(0, player.power - dt);
  player.attackAnim = Math.max(0, player.attackAnim - dt);
  messageTime = Math.max(0, messageTime - dt);

  const dx = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
  const dy = (keys.s ? 1 : 0) - (keys.w ? 1 : 0);
  const sp = player.speed * (player.power > 0 ? 1.15 : 1);

  if (dx || dy) {
    const n = Math.hypot(dx, dy);
    player.x += (dx / n) * sp * dt;
    player.y += (dy / n) * sp * dt;
  }

  player.x = clamp(player.x, map.x + 20, map.x + map.w - 20);
  player.y = clamp(player.y, map.y + 20, map.y + map.h - 20);

  if (keys.l) {
    keys.l = false;
    sword();
  }
  if (keys.k) {
    keys.k = false;
    spin();
  }
  if (keys[" "]) {
    keys[" "] = false;
    activatePower();
  }

  if (keys.e) {
    keys.e = false;
    if (ship && dist(player, ship) < 65) {
      ship.active = !ship.active;
      say(ship.active ? "MODO NAVE · WADS + L DISPARA" : "MODO A PIE");
    }
  }

  if (ship && ship.active) {
    const sx = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
    const sy = (keys.s ? 1 : 0) - (keys.w ? 1 : 0);

    if (sx || sy) {
      const n = Math.hypot(sx, sy);
      ship.x += (sx / n) * 300 * dt;
      ship.y += (sy / n) * 300 * dt;
    }

    ship.x = clamp(ship.x, map.x + 30, map.x + map.w - 30);
    ship.y = clamp(ship.y, map.y + 30, map.y + map.h - 30);

    player.x = ship.x;
    player.y = ship.y;

    if (keys.l && ship.shoot <= 0) {
      keys.l = false;
      ship.shoot = 0.25;
      fire(ship.x, ship.y, ship.x + 400, ship.y, 35, "player", 550);
    }
  }

  ship && (ship.shoot = Math.max(0, ship.shoot - dt));

  captureCheck();

  if (phase === "bossWaiting") {
    captureTimer -= dt;
    if (captureTimer <= 0) spawnBoss();
  }

  enemies.forEach((e) => {
    e.shoot -= dt;
    e.phase += dt;

    if (e.type === "melee") {
      if (dist(e, player) > 85) {
        const a = Math.atan2(player.y - e.y, player.x - e.x);
        e.x += Math.cos(a) * 55 * dt;
        e.y += Math.sin(a) * 55 * dt;
      } else if (e.shoot <= 0) {
        player.hp -= 20;
        e.shoot = 1.2;
      }
    } else {
      const a = Math.atan2(player.y - e.y, player.x - e.x);
      if (dist(e, player) > 240) {
        e.x += Math.cos(a) * 28 * dt;
        e.y += Math.sin(a) * 28 * dt;
      }
      if (dist(e, player) < 480 && e.shoot <= 0) {
        fire(e.x, e.y, player.x, player.y, 30, "enemy", 240);
        e.shoot = 4.5;
      }
    }

    e.x = clamp(e.x, map.x + 12, map.x + map.w - 12);
    e.y = clamp(e.y, map.y + 12, map.y + map.h - 12);
  });

  enemies = enemies.filter((e) => e.hp > 0);

  if (boss) {
    boss.shoot -= dt;
    const a = Math.atan2(player.y - boss.y, player.x - boss.x);

    if (dist(boss, player) > 100) {
      boss.x += Math.cos(a) * 20 * dt;
      boss.y += Math.sin(a) * 20 * dt;
    }

    boss.x = clamp(boss.x, map.x + 40, map.x + map.w - 40);
    boss.y = clamp(boss.y, map.y + 40, map.y + map.h - 40);

    const enraged = boss.hp < boss.max / 2;

    if (boss.shoot <= 0) {
      const count = enraged ? 4 : 2;
      for (let i = 0; i < count; i++) {
        const aa = a + (i - (count - 1) / 2) * 0.16;
        enemyBullets.push({
          x: boss.x,
          y: boss.y,
          vx: Math.cos(aa) * 250,
          vy: Math.sin(aa) * 250,
          r: 6,
          damage: enraged ? 40 : 35,
          life: 4,
          owner: "boss",
        });
      }
      boss.shoot = 4.5;
    }

    if (enraged && Math.random() < dt * 0.22 && enemies.length < 10) {
      spawnEnemy({ x: boss.x, y: boss.y }, "range");
      enemies[enemies.length - 1].hp = enemies[enemies.length - 1].max = 60;
    }

    if (dist(boss, player) < 190 && Math.random() < dt * 0.35 && enemies.length < 12) {
      spawnEnemy({ x: boss.x, y: boss.y }, "melee");
    }

    if (boss.hp <= 0) {
      boss = null;
      spawnShip();
      say("¡JEFE DERROTADO!");
    }
  }

  for (const arr of [bullets, enemyBullets]) {
    for (let i = arr.length - 1; i >= 0; i--) {
      const b = arr[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;

      if (
        b.life <= 0 ||
        b.x < map.x ||
        b.x > map.x + map.w ||
        b.y < map.y ||
        b.y > map.y + map.h
      ) {
        arr.splice(i, 1);
        continue;
      }

      if (b.owner === "player") {
        let removed = false;
        enemies.forEach((e) => {
          if (!removed && hit(b, e, 12)) {
            e.hp -= 35;
            removed = true;
          }
        });
        if (boss && !removed && hit(b, boss, 25)) {
          boss.hp -= 35;
          removed = true;
        }
        if (removed) arr.splice(i, 1);
      } else if (hit(b, player, 18)) {
        player.hp -= b.damage;
        arr.splice(i, 1);
      }
    }
  }

  particles.forEach((p) => {
    if (p.kind === "heart" && dist(p, player) < 25) {
      if (player.hp < player.max) {
        player.hp = Math.min(player.max, player.hp + 15);
        p.t = 0;
      } else {
        p.t = 0;
      }
    }
  });

  particles = particles.filter((p) => p.t > 0);

  if (player.hp <= 0) {
    player.hp = 0;
    gameOver = true;
    document.getElementById("death").style.display = "flex";
  }

  if (phase === "ship" && !ship) return;
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = "#0d1524";
  ctx.fillRect(map.x, map.y, map.w, map.h);

  ctx.strokeStyle = "#2c3d5a";
  ctx.lineWidth = 1;

  for (let x = map.x; x <= map.x + map.w; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, map.y);
    ctx.lineTo(x, map.y + map.h);
    ctx.stroke();
  }

  for (let y = map.y; y <= map.y + map.h; y += 40) {
    ctx.beginPath();
    ctx.moveTo(map.x, y);
    ctx.lineTo(map.x + map.w, y);
    ctx.stroke();
  }

  structures.forEach((s) => {
    ctx.fillStyle = s.got ? "#35c76a" : "#e7ecf5";
    ctx.fillRect(s.x - 25, s.y - 25, 50, 50);
    ctx.fillStyle = s.got ? "#0c5437" : "#8c9bb3";
    ctx.fillRect(s.x - 13, s.y - 13, 26, 26);
  });

  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const x = 640 + Math.cos(a) * 105;
    const y = 360 + Math.sin(a) * 105;
    if (boss) heart(x, y, 13);
  }

  enemies.forEach((e) => {
    ctx.fillStyle = e.type === "range" ? "#7b869a" : "#30343d";
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(e.x - 7, e.y - 3, 4, 4);
    ctx.fillRect(e.x + 3, e.y - 3, 4, 4);
  });

  if (boss) {
    ctx.fillStyle = "#5b0b0b";
    ctx.beginPath();
    ctx.arc(boss.x, boss.y, boss.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#f4c542";
    ctx.lineWidth = 4;
    ctx.stroke();
    bar(boss.x - 50, boss.y - 50, 100, 8, boss.hp / boss.max);
  }

  if (ship) {
    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.fillStyle = "#64748b";
    roundedRect(-35, -20, 70, 40, 12);
    ctx.fill();
    ctx.fillStyle = "#111827";
    ctx.fillRect(15, -8, 30, 16);
    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(-45, -8, 15, 16);
    ctx.restore();
  }

  ctx.save();
  ctx.translate(player.x, player.y);
  if (player.power > 0) {
    ctx.strokeStyle = "#b36bff";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(0, 0, 27 + Math.sin(performance.now() / 80) * 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = "#f5f5f5";
  ctx.beginPath();
  ctx.arc(0, 4, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#111";
  ctx.beginPath();
  ctx.arc(0, -9, 18, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#222";
  ctx.fillRect(-18, -7, 36, 7);
  if (player.attackAnim > 0) {
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, 42, -0.9, 0.9);
    ctx.stroke();
  }
  ctx.restore();

  bullets.forEach((b) => proj(b, "#e8f7ff"));
  enemyBullets.forEach((b) => proj(b, b.owner === "boss" ? "#ff5364" : "#f59e0b"));

  hud();
}

function roundedRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function proj(b, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
  ctx.fill();
}

function heart(x, y, r) {
  ctx.fillStyle = "#ef476f";
  ctx.beginPath();
  ctx.moveTo(x, y + r);
  ctx.bezierCurveTo(x - r * 1.5, y, x - r, y - r, x, y - r * 0.2);
  ctx.bezierCurveTo(x + r, y - r, x + r * 1.5, y, x, y + r);
  ctx.fill();
}

function bar(x, y, w, h, p) {
  ctx.fillStyle = "#300";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#35d06f";
  ctx.fillRect(x, y, w * Math.max(0, p), h);
}

function skullIcon(x, y, crown = false) {
  ctx.fillStyle = "#eee";
  ctx.beginPath();
  ctx.arc(x, y, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#111";
  ctx.fillRect(x - 7, y - 2, 4, 5);
  ctx.fillRect(x + 3, y - 2, 4, 5);
  ctx.fillRect(x - 5, y + 7, 10, 3);
  if (crown) {
    ctx.fillStyle = "#f5c542";
    ctx.beginPath();
    ctx.moveTo(x - 13, y - 16);
    ctx.lineTo(x - 7, y - 25);
    ctx.lineTo(x, y - 17);
    ctx.lineTo(x + 7, y - 25);
    ctx.lineTo(x + 13, y - 16);
    ctx.closePath();
    ctx.fill();
  }
}

function hud() {
  ctx.fillStyle = "rgba(7, 11, 20, 0.92)";
  ctx.fillRect(15, 15, 220, 130);
  ctx.strokeStyle = "#667085";
  ctx.strokeRect(15, 15, 220, 130);

  const sx = 220 / map.w;
  const sy = 105 / map.h;

  structures.forEach((s) => {
    ctx.fillStyle = s.got ? "#22c55e" : "#fff";
    ctx.fillRect(15 + (s.x - map.x) * sx - 3, 15 + (s.y - map.y) * sy - 3, 7, 7);
  });

  enemies.forEach((e) => {
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(15 + (e.x - map.x) * sx - 2, 15 + (e.y - map.y) * sy - 2, 4, 4);
  });

  if (boss) skullIcon(210, 40, true);
  else if (enemies.length) skullIcon(210, 40, false);

  ctx.fillStyle = "#fff";
  ctx.font = "bold 14px Arial";
  ctx.fillText("CABALLERO NEGRO", 24, 36);
  ctx.fillText("ESTRUCTURAS: " + structures.filter((s) => s.got).length + "/5", 24, 160);
  ctx.fillText("VIDA", 24, 184);
  bar(70, 174, 180, 12, player.hp / player.max);
  ctx.fillText(Math.ceil(player.hp) + "/" + player.max, 258, 184);
  ctx.fillText("K: " + (player.spinCd > 0 ? player.spinCd.toFixed(1) + "s" : "LISTO"), 24, 208);
  ctx.fillText("ESPACIO: " + (player.powerCd > 0 ? player.powerCd.toFixed(1) + "s" : player.power > 0 ? "ACTIVO" : "LISTO"), 24, 232);
  if (ship && ship.active) ctx.fillText("MODO NAVE · MUNICIÓN: " + ship.ammo, 24, 256);

  if (messageTime > 0) {
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 25px Arial";
    ctx.textAlign = "center";
    ctx.fillText(message, W / 2, 35);
    ctx.textAlign = "left";
  }
}

function loop(t) {
  let dt = Math.min(0.033, (t - lastTime || 16) / 1000);
  lastTime = t;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

window.restart = restart;
