(() => {
'use strict';

/* ---------- Setup ---------- */
const W = 800, H = 450;                      // loogiline (landscape 16:9) lahutus
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const stage = document.getElementById('stage');
const hud = document.getElementById('hud');
const pauseBtn = document.getElementById('pauseBtn');
const menuBtn = document.getElementById('menuBtn');
const fsBtn = document.getElementById('fsBtn');
const rotateOverlay = document.getElementById('rotate');

// Seadme tuvastus: algne arvamus + uuendus iga sisendi järgi (toetab hübriidseadmeid)
let isTouchDevice = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
let inputMode = isTouchDevice ? 'touch' : 'mouse';
function setInputMode(m) {
  if (m === inputMode) return;
  inputMode = m;
  document.body.classList.toggle('touch', m === 'touch');
  if (m === 'touch') resetKnife();
}
document.body.classList.toggle('touch', inputMode === 'touch');

let scale = 1, dpr = 1;

/* ---------- Salvestus ---------- */
const store = {
  get(k, d) { try { const v = parseInt(localStorage.getItem(k)); return isNaN(v) ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} }
};
const high = { maxLevel: store.get('banaani_high_level', 1), totalCuts: store.get('banaani_total_cuts', 0) };
function saveStats(lvl, cuts) {
  if (lvl > high.maxLevel) { high.maxLevel = lvl; store.set('banaani_high_level', lvl); }
  high.totalCuts += cuts; store.set('banaani_total_cuts', high.totalCuts);
}

/* ---------- Andmed ---------- */
const SKINS = [
  { name: 'Kollane (Klassikaline)', color: '#ffe135', type: 'classic' },
  { name: 'Roheline (Toores)',      color: '#7ccd32', type: 'classic' },
  { name: 'Anatoomiline Käe-Banaan 🖐️', color: '#f1c27d', type: 'hand' },
  { name: 'Pruun (Üleküpsenud)',    color: '#6e3c14', type: 'classic' },
  { name: 'Roosa (Rave)',           color: '#ff69b4', type: 'classic' }
];
let skinIdx = 0;
try { const s = parseInt(localStorage.getItem('banaani_skin')); if (s >= 0 && s < SKINS.length) skinIdx = s; } catch {}

const BOARDS = [
  { wood: '#a0522d', border: '#654321', name: 'Klassikaline Puit' },
  { wood: '#2e4053', border: '#1b2631', name: 'Tumesinine Marmor' },
  { wood: '#1e8449', border: '#145a32', name: 'Smaragdroheline' },
  { wood: '#7d6608', border: '#4d3e05', name: 'Kuldne Puit' },
  { wood: '#6c3483', border: '#4a235a', name: 'Müstiline Violetne' },
  { wood: '#ba4a00', border: '#7e2e00', name: 'Marmorpruun' },
  { wood: '#117a65', border: '#0e6251', name: 'Türkiissinine Marmor' },
  { wood: '#7b7d7d', border: '#4d5656', name: 'Kiviplaat' },
  { wood: '#9a7d0a', border: '#7d6608', name: 'Pronks' },
  { wood: '#b03a2e', border: '#78281f', name: 'Rubiin' }
];
const MAX_LEVELS = 10;
const MIN_STROKE_LEN = 24;                   // minimaalne tõmbe pikkus, et see loeks

/* ---------- Mängu olek ---------- */
let state = 'MENU';                          // MENU | GAME | PAUSED | LEVELUP | GAME_OVER
let level = 1, cutsCount = 0, totalRunCuts = 0, targetCuts = 50, timeLeft = 60;
let isVictory = false, stateSince = 0, levelUpUntil = 0;
let cuts = [], currentCut = null, drips = [], isCutting = false;
const pointer = { x: W / 2, y: H / 2 };
const REST = { x: 690, y: 405 };
const knife = { x: REST.x, y: REST.y, held: false };

const board = { x: 70, y: 66, w: 660, h: 340 };
const targetFor = l => 50 + (l - 1) * 25;
const timeFor = l => 25 + l * 35;
const boardFor = l => BOARDS[(l - 1) % BOARDS.length];

// Menüü nooled
const arrowL = { x: 120, y: 92, w: 56, h: 44 };
const arrowR = { x: W - 120 - 56, y: 92, w: 56, h: 44 };
const resumeB = { x: W / 2 - 110, y: 190, w: 220, h: 52 };
const toMenuB = { x: W / 2 - 110, y: 256, w: 220, h: 52 };

const inside = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

/* ---------- Suuruse muutmine ---------- */
function resize() {
  const vw = window.innerWidth, vh = window.innerHeight;
  scale = Math.min(vw / W, vh / H);
  dpr = Math.min(window.devicePixelRatio || 1, 3);
  const cw = Math.floor(W * scale), ch = Math.floor(H * scale);
  stage.style.width = cw + 'px'; stage.style.height = ch + 'px';
  canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
  canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
  updateRotate();
}
function updateRotate() {
  const portrait = window.innerHeight > window.innerWidth;
  const show = isTouchDevice && portrait;
  rotateOverlay.classList.toggle('show', show);
  if (show && state === 'GAME') pauseGame();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 150));
resize();

/* ---------- Sisend ---------- */
function toLogical(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
}
function knifeHit(p) {
  return p.x > REST.x - 60 && p.x < REST.x + 90 && p.y > REST.y - 45 && p.y < REST.y + 40;
}
function startCut(p) {
  isCutting = true;
  currentCut = { pts: [{ x: p.x, y: p.y }], len: 0 };
}
function extendCut(p) {
  const last = currentCut.pts[currentCut.pts.length - 1];
  const d = Math.hypot(p.x - last.x, p.y - last.y);
  if (d < 5) return;
  currentCut.pts.push({ x: p.x, y: p.y });
  currentCut.len += d;
  for (let i = 0; i < 2; i++) {
    drips.push({ x: p.x + Math.random() * 10 - 5, y: p.y + Math.random() * 10 - 5,
                 r: Math.random() * 3.5 + 1.5, vy: Math.random() * 1.2 + 0.4, life: 1 });
  }
  if (drips.length > 500) drips.splice(0, drips.length - 500);
}
function endCut() {
  if (!isCutting) return;
  if (currentCut && currentCut.len >= MIN_STROKE_LEN) {
    cuts.push(currentCut);
    cutsCount++; totalRunCuts++;
    if (cutsCount >= targetCuts) levelComplete();
  }
  isCutting = false; currentCut = null;
}
function resetKnife() {
  endCut();
  knife.held = false; knife.x = REST.x; knife.y = REST.y;
}
function setSkin(i) {
  skinIdx = (i + SKINS.length) % SKINS.length;
  try { localStorage.setItem('banaani_skin', skinIdx); } catch {}
}

canvas.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  setInputMode(e.pointerType === 'mouse' ? 'mouse' : 'touch');
  try { canvas.setPointerCapture(e.pointerId); } catch {}
  const p = toLogical(e); pointer.x = p.x; pointer.y = p.y;

  if (state === 'MENU') {
    if (inside(p, arrowL)) setSkin(skinIdx - 1);
    else if (inside(p, arrowR)) setSkin(skinIdx + 1);
    else startGame();
  } else if (state === 'GAME') {
    if (inputMode === 'touch') {
      knife.held = true; knife.x = p.x; knife.y = p.y; startCut(p);
    } else if (!knife.held) {
      if (knifeHit(p)) { knife.held = true; knife.x = p.x; knife.y = p.y; }
    } else {
      startCut(p);
    }
  } else if (state === 'PAUSED') {
    if (inside(p, resumeB)) resumeGame();
    else if (inside(p, toMenuB)) goToMenu();
  } else if (state === 'GAME_OVER') {
    if (performance.now() - stateSince > 600) goToMenu();
  }
  syncUI();
});
canvas.addEventListener('pointermove', e => {
  const p = toLogical(e); pointer.x = p.x; pointer.y = p.y;
  if (state === 'GAME' && knife.held) {
    knife.x = p.x; knife.y = p.y;
    if (isCutting && currentCut) extendCut(p);
  }
});
const up = e => {
  if (inputMode === 'touch' || e.pointerType === 'touch') {
    if (state === 'GAME') { endCut(); knife.held = false; knife.x = REST.x; knife.y = REST.y; }
  } else {
    endCut();
  }
};
canvas.addEventListener('pointerup', up);
canvas.addEventListener('pointercancel', up);
canvas.addEventListener('contextmenu', e => { e.preventDefault(); if (state === 'GAME' && knife.held) resetKnife(); });

window.addEventListener('keydown', e => {
  const k = e.key;
  if (state === 'MENU') {
    if (k === 'ArrowRight') setSkin(skinIdx + 1);
    else if (k === 'ArrowLeft') setSkin(skinIdx - 1);
    else if (k === 'Enter' || k === ' ') { e.preventDefault(); startGame(); }
  } else if (state === 'GAME') {
    if (k === 'Escape' || k === 'p' || k === 'P') pauseGame();
    else if (k === 'c' || k === 'C') { cuts = []; drips = []; }       // puhastab ainult jäljed, mitte skoori
    else if (k === 'f' || k === 'F') toggleFullscreen();
  } else if (state === 'PAUSED') {
    if (k === 'Escape' || k === 'p' || k === 'P') resumeGame();
  } else if (state === 'GAME_OVER') {
    if ((k === 'Enter' || k === ' ') && performance.now() - stateSince > 600) goToMenu();
  }
});

/* ---------- Nupud ---------- */
function toggleFullscreen() {
  const d = document;
  if (!d.fullscreenElement && !d.webkitFullscreenElement) {
    const el = d.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (req) {
      const r = req.call(el);
      const lock = () => { try { screen.orientation.lock('landscape').catch(() => {}); } catch {} };
      if (r && r.then) r.then(lock).catch(() => {}); else lock();
    }
  } else {
    (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    try { screen.orientation.unlock(); } catch {}
  }
}
fsBtn.addEventListener('click', toggleFullscreen);
pauseBtn.addEventListener('click', () => { if (state === 'GAME') pauseGame(); else if (state === 'PAUSED') resumeGame(); });
menuBtn.addEventListener('click', goToMenu);
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'GAME') pauseGame(); });

function syncUI() {
  hud.classList.toggle('show', state === 'GAME' || state === 'PAUSED');
  pauseBtn.textContent = state === 'PAUSED' ? '▶ Jätka' : '⏸ Paus';
  fsBtn.style.display = (state === 'MENU' || state === 'PAUSED' || state === 'GAME_OVER') ? 'block' : 'none';
}

/* ---------- Mängu voog ---------- */
function resetLevel() {
  cutsCount = 0; cuts = []; drips = []; currentCut = null; isCutting = false;
  targetCuts = targetFor(level); timeLeft = timeFor(level);
  knife.held = false; knife.x = REST.x; knife.y = REST.y;
}
function startGame() {
  level = 1; totalRunCuts = 0; isVictory = false;
  resetLevel(); state = 'GAME'; stateSince = performance.now(); syncUI();
}
function pauseGame() { endCut(); state = 'PAUSED'; syncUI(); }
function resumeGame() { state = 'GAME'; syncUI(); }
function goToMenu() {
  if (totalRunCuts > 0 && state !== 'GAME_OVER') saveStats(level, totalRunCuts);
  totalRunCuts = 0; level = 1;
  resetLevel(); state = 'MENU'; syncUI();
}
function levelComplete() {
  isCutting = false; currentCut = null; knife.held = false;
  if (level >= MAX_LEVELS) { finish(true); return; }
  state = 'LEVELUP'; levelUpUntil = performance.now() + 1400; syncUI();
}
function finish(victory) {
  isVictory = victory;
  saveStats(victory ? MAX_LEVELS : level, totalRunCuts);
  state = 'GAME_OVER'; stateSince = performance.now(); syncUI();
}

/* ---------- Joonistamine ---------- */
function rr(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
function text(str, x, y, size, color, align = 'center', weight = 'normal') {
  ctx.font = `${weight} ${size}px 'Segoe UI', Arial, sans-serif`;
  ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(str, x, y);
}
function button(r, label, fill, stroke) {
  ctx.lineWidth = 2; ctx.fillStyle = fill; ctx.strokeStyle = stroke;
  rr(r.x, r.y, r.w, r.h, 10); ctx.fill(); ctx.stroke();
  text(label, r.x + r.w / 2, r.y + r.h / 2 + 7, 19, '#fff', 'center', 'bold');
}

function drawBanana(cx, cy, skin, s = 1) {
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(s, s);
  if (skin.type === 'hand') {
    ctx.fillStyle = skin.color; ctx.strokeStyle = '#b5834a'; ctx.lineWidth = 4; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-140, 50);
    ctx.bezierCurveTo(-60, 80, 20, 50, 80, 10);
    ctx.lineTo(105, 20); ctx.lineTo(120, 5); ctx.lineTo(110, -10);
    ctx.lineTo(130, -20); ctx.lineTo(120, -35);
    ctx.lineTo(135, -50); ctx.lineTo(120, -60);
    ctx.lineTo(110, -65); ctx.lineTo(95, -50);
    ctx.lineTo(75, -55); ctx.lineTo(60, -35);
    ctx.bezierCurveTo(10, -20, -50, 0, -120, 0);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(180,100,50,.25)'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-110, 25);
    ctx.bezierCurveTo(-40, 35, 30, 15, 70, -15); ctx.stroke();
  } else {
    ctx.translate(0, -80);
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, -20, 115, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.lineWidth = 48; ctx.strokeStyle = skin.color; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -20, 115, 0.22 * Math.PI, 0.78 * Math.PI);
    ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.stroke();
    ctx.fillStyle = '#4a2e13';
    ctx.beginPath();
    ctx.arc(-100, 50, 9, 0, Math.PI * 2);
    ctx.moveTo(109, 50); ctx.arc(100, 50, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Nuga: tipp asub täpselt (x, y) juures — seal tekib ka lõige
function drawKnife(x, y, held) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(held ? -0.45 : -0.25);
  ctx.lineJoin = 'round';
  ctx.fillStyle = '#e6e6e6'; ctx.strokeStyle = '#555'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(78, -13); ctx.lineTo(78, 7); ctx.lineTo(8, 5); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.8)';
  ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(74, -10); ctx.lineTo(74, -4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#2c3e50'; ctx.fillRect(78, -12, 44, 18);
  ctx.fillStyle = '#f39c12';
  ctx.beginPath(); ctx.arc(90, -3, 2.5, 0, 7); ctx.arc(108, -3, 2.5, 0, 7); ctx.fill();
  ctx.restore();
}

function strokePath(c) {
  if (!c || c.pts.length < 2) return;
  ctx.beginPath(); ctx.moveTo(c.pts[0].x, c.pts[0].y);
  for (let i = 1; i < c.pts.length; i++) ctx.lineTo(c.pts[i].x, c.pts[i].y);
  ctx.stroke();
}

function renderMenu() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1a1a26'); g.addColorStop(1, '#0d0d14');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  text('🍌 BANAANI SIMULAATOR', W / 2, 62, 40, '#ffe135', 'center', 'bold');

  const skin = SKINS[skinIdx];
  text(skin.name, W / 2, 122, 22, '#fff');
  ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.fillStyle = 'rgba(255,255,255,.15)';
  rr(arrowL.x, arrowL.y, arrowL.w, arrowL.h, 8); ctx.fill(); ctx.stroke();
  rr(arrowR.x, arrowR.y, arrowR.w, arrowR.h, 8); ctx.fill(); ctx.stroke();
  text('◀', arrowL.x + arrowL.w / 2, arrowL.y + 30, 22, '#fff', 'center', 'bold');
  text('▶', arrowR.x + arrowR.w / 2, arrowR.y + 30, 22, '#fff', 'center', 'bold');

  drawBanana(W / 2, 250, skin, skin.type === 'classic' ? 1.15 : 1);

  text(`🏆 Rekord tase: ${high.maxLevel} / ${MAX_LEVELS}   |   Lõikeid kokku: ${high.totalCuts}`, W / 2, 372, 16, '#2ecc71');
  const t = inputMode === 'touch' ? 'Puuduta ekraani alustamiseks' : 'Vajuta [ENTER] või klõpsa alustamiseks  •  ← → vahetab skini';
  const pulse = 0.65 + 0.35 * Math.sin(performance.now() / 350);
  ctx.globalAlpha = pulse; text(t, W / 2, 412, 16, '#ccccaa'); ctx.globalAlpha = 1;
}

function renderGame() {
  ctx.fillStyle = '#2c3e50'; ctx.fillRect(0, 0, W, H);
  const b = boardFor(level);
  ctx.fillStyle = b.wood; ctx.strokeStyle = b.border; ctx.lineWidth = 10;
  rr(board.x, board.y, board.w, board.h, 24); ctx.fill(); ctx.stroke();

  const skin = SKINS[skinIdx];
  drawBanana(board.x + board.w / 2, board.y + board.h / 2, skin, skin.type === 'classic' ? 1.35 : 1.25);

  // mahl
  ctx.fillStyle = '#b30000';
  for (let i = drips.length - 1; i >= 0; i--) {
    const d = drips[i];
    ctx.globalAlpha = Math.max(0, d.life);
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill();
    if (state === 'GAME') {
      d.y += d.vy; d.r = Math.max(0.5, d.r - 0.01); d.life -= 0.0025;
      if (d.life <= 0 || d.y > H) drips.splice(i, 1);
    }
  }
  ctx.globalAlpha = 1;

  ctx.strokeStyle = '#660000'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  cuts.forEach(strokePath);
  if (isCutting && currentCut) strokePath(currentCut);

  drawKnife(knife.x, knife.y, knife.held);

  // HUD
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, W, 50);
  text(`Tase ${level}/${MAX_LEVELS}`, 16, 32, 19, '#fff', 'left', 'bold');
  text(`Kriimustusi: ${cutsCount} / ${targetCuts}`, 150, 32, 19, '#ffcc00', 'left', 'bold');
  const tl = Math.ceil(timeLeft);
  text(`Aeg: ${tl}s`, 390, 32, 19, tl <= 10 ? '#e74c3c' : '#fff', 'left', 'bold');
  // edenemise riba
  ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(0, 47, W, 3);
  ctx.fillStyle = '#2ecc71'; ctx.fillRect(0, 47, W * Math.min(1, cutsCount / targetCuts), 3);

  let hint;
  if (inputMode === 'touch') hint = 'Lohista sõrmega üle banaani lõikamiseks';
  else hint = knife.held ? '1 tõmme = 1 kriimustus  |  Paremklõps paneb noa ära  |  [P] paus' : 'Klõpsa noale, et see kätte võtta!';
  text(hint, W / 2, H - 14, 14, '#ddd');
  if (inputMode === 'mouse' && !knife.held) {
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.setLineDash([6, 5]); ctx.lineWidth = 2;
    rr(REST.x - 55, REST.y - 42, 160, 75, 10); ctx.stroke(); ctx.setLineDash([]);
  }
}

function renderPaused() {
  renderGame();
  ctx.fillStyle = 'rgba(0,0,0,.75)'; ctx.fillRect(0, 0, W, H);
  text('PAUS', W / 2, 140, 44, '#ffe135', 'center', 'bold');
  button(resumeB, 'Jätka mängu', 'rgba(46,204,113,.85)', '#27ae60');
  button(toMenuB, 'Tagasi menüüsse', 'rgba(231,76,60,.85)', '#c0392b');
}

function renderLevelUp() {
  renderGame();
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, W, H);
  text('TASE LÄBITUD! ✔', W / 2, H / 2 - 10, 42, '#2ecc71', 'center', 'bold');
  text(`Järgmine: tase ${level + 1} — ${targetFor(level + 1)} kriimustust`, W / 2, H / 2 + 34, 20, '#fff');
}

function renderGameOver() {
  ctx.fillStyle = '#0f0f14'; ctx.fillRect(0, 0, W, H);
  text(isVictory ? 'PALJU ÕNNE! VÕIT! 🍌' : 'AEG OTSAS!', W / 2, 62, 42, isVictory ? '#2ecc71' : '#e74c3c', 'center', 'bold');
  const bw = 460, bh = 230, bx = W / 2 - bw / 2, by = 92;
  ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = 2;
  rr(bx, by, bw, bh, 12); ctx.fill(); ctx.stroke();
  text('📊 MÄNGU STATISTIKA', W / 2, by + 36, 21, '#ffe135', 'center', 'bold');
  const done = isVictory ? MAX_LEVELS : level - 1;
  const avg = done > 0 ? (totalRunCuts / done).toFixed(1) : '0';
  const rows = [
    `Läbitud tasemed: ${done} / ${MAX_LEVELS}`,
    `Lõikeid selles voorus: ${totalRunCuts}`,
    `Keskmiselt lõikeid tasemel: ${avg}`,
    `Eluaegseid lõikeid kokku: ${high.totalCuts}`
  ];
  rows.forEach((r, i) => text('• ' + r, bx + 34, by + 82 + i * 35, 18, '#fff', 'left'));
  const ready = performance.now() - stateSince > 600;
  ctx.globalAlpha = ready ? 1 : 0.3;
  text(inputMode === 'touch' ? 'Puuduta ekraani menüüsse minemiseks' : 'Klõpsa või vajuta ENTER menüüsse minemiseks', W / 2, H - 50, 17, '#3498db');
  ctx.globalAlpha = 1;
}

/* ---------- Põhitsükkel (aeg dt põhjal) ---------- */
let lastT = performance.now();
function loop(now) {
  const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;

  if (state === 'GAME') {
    timeLeft -= dt;
    if (timeLeft <= 0) { timeLeft = 0; endCut(); finish(false); }
  } else if (state === 'LEVELUP' && now >= levelUpUntil) {
    level++; resetLevel(); state = 'GAME'; syncUI();
  }

  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  ctx.textBaseline = 'alphabetic';
  switch (state) {
    case 'MENU': renderMenu(); break;
    case 'GAME': renderGame(); break;
    case 'PAUSED': renderPaused(); break;
    case 'LEVELUP': renderLevelUp(); break;
    case 'GAME_OVER': renderGameOver(); break;
  }
  requestAnimationFrame(loop);
}
syncUI();
requestAnimationFrame(loop);
})();
