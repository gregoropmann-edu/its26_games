(function () {
  "use strict";

  var TAGLINES = [
    "Jänes ei maksa makse. Porgandid ka mitte. Filosoofiline.",
    "Kui jänes sööb, siis maailm nutab. Või mitte. Aga sina küll.",
    "See mäng on tasemel: see tase on madal ja see on OK.",
    "Porgand on juur. Jänes on probleem. Kivi on lahendus.",
    "Teadus ei tea, miks see mäng on. Aga Margus teab.",
    "Hoiatus: ei sisalda tegelikku toitumisalast teavet."
  ];

  var canvas = document.getElementById("game");
  var ctx = canvas.getContext("2d");
  var taglineEl = document.getElementById("tagline");
  var scoreEl = document.getElementById("score");
  var rageEl = document.getElementById("rabbitRage");
  var bestEl = document.getElementById("best");
  var overlay = document.getElementById("gameOver");
  var goTitle = document.getElementById("goTitle");
  var goText = document.getElementById("goText");
  var btnRestart = document.getElementById("btnRestart");
  var btnPlant = document.getElementById("btnPlant");
  var btnRock = document.getElementById("btnRock");

  var LS_KEY = "margus_porgand_rekord";

  var W = 800;
  var H = 480;
  var groundY = H * 0.72;

  var mode = "plant";
  var carrots = [];
  var projectiles = [];
  var particles = [];
  var nextId = 1;

  var rabbit = {
    x: W * 0.5,
    y: groundY - 8,
    vx: 0,
    stunnedUntil: 0,
    munchUntil: 0,
    hop: 0,
    facing: 1,
  };

  var score = 0;
  var rabbitRage = 0;
  var best = 0;
  var gameOver = false;
  var lastT = 0;
  var taglineIx = 0;
  var taglineSwap = 0;
  var screenShake = 0;

  var GROWTH_PER_SEC = 0.22;
  var RABBIT_SPEED = 115;
  var RABBIT_SPEED_ANGRY = 165;
  var EAT_RADIUS = 38;
  var STUN_MS = 2200;
  var ROCK_SPEED = 520;
  var RAGE_PER_EAT = 14;
  var RAGE_ON_HIT = -18;
  var RAGE_MAX = 100;
  var MUNCH_LOCK_MS = 400;

  function loadBest() {
    try {
      var v = parseInt(localStorage.getItem(LS_KEY), 10);
      best = isNaN(v) ? 0 : v;
    } catch (e) {
      best = 0;
    }
    bestEl.textContent = String(best);
  }

  function saveBest() {
    if (score > best) {
      best = score;
      try {
        localStorage.setItem(LS_KEY, String(best));
      } catch (e) {}
      bestEl.textContent = String(best);
    }
  }

  function resize() {
    var wrap = canvas.parentElement;
    var cw = Math.min(wrap.clientWidth, 920);
    var ch = (cw / W) * H;
    canvas.style.width = cw + "px";
    canvas.style.height = ch + "px";
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function toWorld(clientX, clientY) {
    var r = canvas.getBoundingClientRect();
    var sx = W / r.width;
    var sy = H / r.height;
    return {
      x: (clientX - r.left) * sx,
      y: (clientY - r.top) * sy,
    };
  }

  function setMode(m) {
    mode = m;
    btnPlant.classList.toggle("tool--active", m === "plant");
    btnRock.classList.toggle("tool--active", m === "rock");
  }

  btnPlant.addEventListener("click", function () {
    setMode("plant");
  });
  btnRock.addEventListener("click", function () {
    setMode("rock");
  });

  function nearestCarrot(rx) {
    var bestC = null;
    var bestD = 1e9;
    for (var i = 0; i < carrots.length; i++) {
      var c = carrots[i];
      if (c.growth >= 1) continue;
      var d = Math.abs(c.x - rx);
      if (d < bestD) {
        bestD = d;
        bestC = c;
      }
    }
    return bestC;
  }

  function spawnParticles(x, y, color, n) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = 40 + Math.random() * 120;
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 40,
        life: 0.45 + Math.random() * 0.25,
        t: 0,
        color: color,
      });
    }
  }

  function plantCarrot(wx, wy) {
    if (wy < groundY - 50) return;
    if (wx < 24 || wx > W - 24) return;
    carrots.push({
      id: nextId++,
      x: wx,
      growth: 0.05,
    });
  }

  function throwRock(tx, ty) {
    var ox = W * 0.48;
    var oy = groundY - 4;
    var dx = tx - ox;
    var dy = ty - oy;
    var len = Math.hypot(dx, dy) || 1;
    projectiles.push({
      x: ox,
      y: oy,
      vx: (dx / len) * ROCK_SPEED,
      vy: (dy / len) * ROCK_SPEED,
    });
  }

  function hitRabbit() {
    var now = performance.now();
    rabbit.stunnedUntil = now + STUN_MS;
    rabbit.munchUntil = 0;
    rabbitRage = Math.max(0, rabbitRage + RAGE_ON_HIT);
    screenShake = 12;
    spawnParticles(rabbit.x, rabbit.y - 25, "#fbbf24", 14);
    spawnParticles(rabbit.x, rabbit.y - 25, "#94a3b8", 8);
  }

  function lose() {
    if (gameOver) return;
    gameOver = true;
    saveBest();
    goTitle.textContent = "Jänes võitis (füüsiliselt ja emotsionaalselt)";
    goText.textContent =
      "Sinu porgandid said sõpradeks jänesekõhuga. Skoor: " +
      score +
      ". Proovi uuesti — jänes unustab, aga mitte kunagi täiesti.";
    overlay.classList.remove("hidden");
  }

  function resetGame() {
    carrots.length = 0;
    projectiles.length = 0;
    particles.length = 0;
    score = 0;
    rabbitRage = 0;
    gameOver = false;
    rabbit.x = W * 0.5;
    rabbit.vx = 0;
    rabbit.stunnedUntil = 0;
    rabbit.munchUntil = 0;
    rabbit.facing = 1;
    overlay.classList.add("hidden");
    scoreEl.textContent = "0";
    rageEl.textContent = "0%";
    loadBest();
  }

  function onPointerDown(ev) {
    if (gameOver) return;
    ev.preventDefault();
    var p = toWorld(ev.clientX, ev.clientY);
    if (mode === "plant") plantCarrot(p.x, p.y);
    else throwRock(p.x, p.y);
  }

  canvas.addEventListener("pointerdown", onPointerDown);

  function update(dt, now) {
    if (gameOver) return;

    taglineSwap += dt;
    if (taglineSwap > 6) {
      taglineSwap = 0;
      taglineIx = (taglineIx + 1) % TAGLINES.length;
      taglineEl.textContent = TAGLINES[taglineIx];
    }

    if (screenShake > 0) screenShake = Math.max(0, screenShake - dt * 80);

    var stunned = now < rabbit.stunnedUntil;
    var munching = now < rabbit.munchUntil;

    for (var ci = carrots.length - 1; ci >= 0; ci--) {
      var c = carrots[ci];
      if (c.growth < 1) {
        c.growth = Math.min(1, c.growth + GROWTH_PER_SEC * dt);
      } else {
        score += 1;
        scoreEl.textContent = String(score);
        saveBest();
        carrots.splice(ci, 1);
        spawnParticles(c.x, groundY - 8, "#22c55e", 6);
        spawnParticles(c.x, groundY - 8, "#fb923c", 5);
      }
    }

    if (!stunned && !munching) {
      var target = nearestCarrot(rabbit.x);
      var speed = rabbitRage > 55 ? RABBIT_SPEED_ANGRY : RABBIT_SPEED;
      if (target) {
        var dir = target.x > rabbit.x ? 1 : -1;
        rabbit.facing = dir;
        rabbit.x += dir * speed * dt;
        rabbit.hop += dt * 14;
        if (Math.abs(rabbit.x - target.x) < EAT_RADIUS) {
          rabbit.munchUntil = now + MUNCH_LOCK_MS;
          for (var j = carrots.length - 1; j >= 0; j--) {
            if (carrots[j].id === target.id) {
              carrots.splice(j, 1);
              break;
            }
          }
          rabbitRage = Math.min(RAGE_MAX, rabbitRage + RAGE_PER_EAT);
          rageEl.textContent = Math.round(rabbitRage) + "%";
          spawnParticles(target.x, groundY - 5, "#fecaca", 10);
          if (rabbitRage >= RAGE_MAX) lose();
        }
      } else {
        rabbit.vx *= 0.9;
        rabbit.x += rabbit.vx * dt;
        rabbit.hop += dt * 8;
      }
    }

    rabbit.x = Math.max(40, Math.min(W - 40, rabbit.x));

    for (var pi = projectiles.length - 1; pi >= 0; pi--) {
      var pr = projectiles[pi];
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.vy += 380 * dt;
      if (pr.x < -20 || pr.x > W + 20 || pr.y > H + 20) {
        projectiles.splice(pi, 1);
        continue;
      }
      var rdx = pr.x - rabbit.x;
      var rdy = pr.y - (rabbit.y - 35);
      if (Math.hypot(rdx, rdy) < 42 && !stunned) {
        projectiles.splice(pi, 1);
        hitRabbit();
        stunned = now < rabbit.stunnedUntil;
      }
    }

    for (var qi = particles.length - 1; qi >= 0; qi--) {
      var q = particles[qi];
      q.t += dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vy += 200 * dt;
      if (q.t > q.life) particles.splice(qi, 1);
    }

    rageEl.textContent = Math.round(rabbitRage) + "%";
  }

  function drawSky() {
    var g = ctx.createLinearGradient(0, 0, 0, groundY);
    g.addColorStop(0, "#1e3a5f");
    g.addColorStop(0.45, "#4c7c5c");
    g.addColorStop(1, "#3d6b32");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, groundY);
  }

  function drawGround() {
    ctx.fillStyle = "#2d5016";
    ctx.fillRect(0, groundY, W, H - groundY);
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 2;
    for (var i = 0; i < 20; i++) {
      ctx.beginPath();
      ctx.moveTo((i / 20) * W, groundY);
      ctx.lineTo((i / 20) * W + 40, H);
      ctx.stroke();
    }
  }

  function drawCarrot(c) {
    var gy = groundY - 4;
    var h = 8 + c.growth * 36;
    var w = 6 + c.growth * 10;
    ctx.save();
    ctx.translate(c.x, gy);
    var sway = Math.sin(performance.now() / 400 + c.id) * 0.08 * c.growth;
    ctx.rotate(sway);
    ctx.fillStyle = "#166534";
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.35);
    ctx.lineTo(-4, -h - 4);
    ctx.lineTo(0, -h * 0.5);
    ctx.lineTo(4, -h - 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ea580c";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-w * 0.5, -h * 0.25);
    ctx.quadraticCurveTo(-w, -h * 0.55, 0, -h);
    ctx.quadraticCurveTo(w, -h * 0.55, w * 0.5, -h * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#9a3412";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  function drawRabbit(now) {
    var stunned = now < rabbit.stunnedUntil;
    var bounce = Math.abs(Math.sin(rabbit.hop)) * 10;
    var x = rabbit.x;
    var y = rabbit.y - bounce;
    var rage = rabbitRage / RAGE_MAX;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(rabbit.facing, 1);

    ctx.fillStyle = "#f1f5f9";
    ctx.beginPath();
    ctx.ellipse(0, -28, 26, 22, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fda4af";
    ctx.beginPath();
    ctx.ellipse(-14, -48, 7, 22, -0.25, 0, Math.PI * 2);
    ctx.ellipse(14, -48, 7, 22, 0.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f1f5f9";
    ctx.beginPath();
    ctx.ellipse(-14, -48, 4, 14, -0.25, 0, Math.PI * 2);
    ctx.ellipse(14, -48, 4, 14, 0.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = stunned ? "#a78bfa" : rage > 0.65 ? "#ef4444" : "#0f172a";
    ctx.beginPath();
    ctx.arc(-9, -26, 4, 0, Math.PI * 2);
    ctx.arc(9, -26, 4, 0, Math.PI * 2);
    ctx.fill();

    if (rage > 0.45) {
      ctx.strokeStyle = "rgba(239,68,68,0.7)";
      ctx.lineWidth = 2;
      for (var i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-18 - i * 5, -40 - i * 3);
        ctx.lineTo(-28 - i * 5, -48 - i * 3);
        ctx.stroke();
      }
    }

    ctx.fillStyle = "#fda4af";
    ctx.beginPath();
    ctx.ellipse(0, -18, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    if (stunned) {
      ctx.font = "bold 22px system-ui";
      ctx.fillStyle = "#fde047";
      ctx.rotate(-rabbit.facing * 0.15);
      ctx.fillText("★ @#$%", -22, -62);
    }

    ctx.restore();
  }

  function drawProjectiles() {
    for (var i = 0; i < projectiles.length; i++) {
      var p = projectiles[i];
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.fillStyle = "#64748b";
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#475569";
      ctx.beginPath();
      ctx.arc(-3, -3, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawParticles(now) {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var a = 1 - p.t / p.life;
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function frame(now) {
    var dt = Math.min(0.05, (now - lastT) / 1000 || 0);
    lastT = now;
    update(dt, now);

    ctx.save();
    if (screenShake > 0) {
      var s = screenShake * 0.08;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }

    drawSky();
    drawGround();
    for (var i = 0; i < carrots.length; i++) drawCarrot(carrots[i]);
    drawRabbit(now);
    drawProjectiles();
    drawParticles(now);

    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(0, groundY - 2, W, 4);

    ctx.restore();
    requestAnimationFrame(frame);
  }

  btnRestart.addEventListener("click", resetGame);

  taglineEl.textContent = TAGLINES[0];
  loadBest();
  resize();
  window.addEventListener("resize", resize);
  requestAnimationFrame(function (t) {
    lastT = t;
    requestAnimationFrame(frame);
  });
})();
