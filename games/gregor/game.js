import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, doc, getDoc, setDoc, getDocs, query, orderBy, limit, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { getAuth, signInWithPopup, signInWithRedirect, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDCl5gu6Xavdsi8ImqZxQjdpy9EHZBUeiU",
    authDomain: "treumuth-its26games-gregor.firebaseapp.com",
    projectId: "treumuth-its26games-gregor",
    storageBucket: "treumuth-its26games-gregor.firebasestorage.app",
    messagingSenderId: "848537370538",
    appId: "1:848537370538:web:b2679c9d56bacf010375d3",
    measurementId: "G-2KNME0CSZZ"
};

// Initialize Firebase Services
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// UI hint only: pre-selects voco.ee accounts in the Google picker.
// Real enforcement is the onAuthStateChanged check below + Firestore rules.
googleProvider.setCustomParameters({
    'hd': 'voco.ee'
});

let currentUser = null;
let isMobileDevice = false;

// All gameplay randomness is driven by this run seed (Mulberry32 PRNG).
let activeSeed = 0;
let seededState = 0;
function normalizeSeed(value) {
    const n = Number(String(value).trim());
    return Number.isSafeInteger(n) && n >= 0 && n <= 4294967295 ? n >>> 0 : null;
}
function createRandomSeed() {
    if (window.crypto && crypto.getRandomValues) {
        const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0];
    }
    return (Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0;
}
function setRunSeed(seed) {
    activeSeed = normalizeSeed(seed) ?? createRandomSeed();
    seededState = activeSeed >>> 0;
    const input = document.getElementById('seed-input');
    if (input) input.value = String(activeSeed);
    const display = document.getElementById('active-seed');
    if (display) display.textContent = String(activeSeed);
}
function seededRandom() {
    let t = seededState += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}


// Escape text before putting it into innerHTML (prevents stored XSS from leaderboard names)
function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[c]));
}

// Auto-Detect Device Capabilities
function detectDevice() {
    const userAgentMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const hasTouchScreen = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const smallScreen = window.innerWidth <= 820;

    isMobileDevice = userAgentMobile || (hasTouchScreen && smallScreen);

    const deviceBadgeIcon = document.getElementById('device-icon');
    const deviceBadgeText = document.getElementById('device-text');
    const fullscreenBtn = document.getElementById('btn-fullscreen');
    const mobileOverlay = document.getElementById('mobile-controls');

    if (isMobileDevice) {
        if (deviceBadgeIcon) deviceBadgeIcon.innerText = '📱';
        if (deviceBadgeText) deviceBadgeText.innerText = 'Mobile Mode';
        if (fullscreenBtn) fullscreenBtn.classList.remove('hidden');
        if (mobileOverlay) mobileOverlay.classList.remove('hidden');
    } else {
        if (deviceBadgeIcon) deviceBadgeIcon.innerText = '💻';
        if (deviceBadgeText) deviceBadgeText.innerText = 'Desktop Mode';
        if (fullscreenBtn) fullscreenBtn.classList.add('hidden');
        if (mobileOverlay) mobileOverlay.classList.add('hidden');
    }
}

function requestFullscreenMode() {
    const docEl = document.documentElement;
    if (docEl.requestFullscreen) {
        docEl.requestFullscreen();
    } else if (docEl.webkitRequestFullscreen) {
        docEl.webkitRequestFullscreen();
    } else if (docEl.msRequestFullscreen) {
        docEl.msRequestFullscreen();
    }
}

document.getElementById('btn-fullscreen')?.addEventListener('click', requestFullscreenMode);

// Sync UI components based on user login status
function updateAuthUI(user) {
    const displayNameElem = document.getElementById('user-display-name');
    const loginBtn = document.getElementById('btn-google-login');
    const submitBtn = document.getElementById('btn-submit-score');

    if (user) {
        if (displayNameElem) displayNameElem.innerText = `👤 ${user.displayName || 'Player'}`;
        if (loginBtn) loginBtn.classList.add('hidden');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = 'Submit Score to Global Leaderboard';
            submitBtn.className = 'w-full bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs font-bold px-4 py-2.5 rounded-xl transition cursor-pointer';
        }
    } else {
        if (displayNameElem) displayNameElem.innerText = 'Not signed in';
        if (loginBtn) loginBtn.classList.remove('hidden');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerText = 'Sign in to Submit Score';
            submitBtn.className = 'w-full bg-slate-700 text-slate-500 text-xs font-bold px-4 py-2.5 rounded-xl cursor-not-allowed transition';
        }
    }
}

// Track Google Auth State Changes
onAuthStateChanged(auth, async (user) => {
    if (user) {
        if (!user.email || !user.email.endsWith('@voco.ee')) {
            alert('Access restricted! Please sign in with your official @voco.ee account.');
            await signOut(auth);
            currentUser = null;
            updateAuthUI(null);
            return;
        }
        currentUser = user;
        updateAuthUI(user);
    } else {
        currentUser = null;
        updateAuthUI(null);
    }
});

async function handleGoogleLogin() {
    try {
        if (isMobileDevice) {
            await signInWithRedirect(auth, googleProvider);
        } else {
            await signInWithPopup(auth, googleProvider);
        }
    } catch (error) {
        console.warn("Auth mode failed, using fallback:", error);
        if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
            await signInWithRedirect(auth, googleProvider);
        }
    }
}

// --- Game Engine Logic ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const minimapCanvas = document.getElementById('minimapCanvas');
const mmCtx = minimapCanvas.getContext('2d');

const fogCanvas = document.createElement('canvas');
const fCtx = fogCanvas.getContext('2d');

const TILE_SIZE = 48;

let MAP_GRID = [];
let MAP_ROWS = 41;
let MAP_COLS = 41;

class AudioSynth {
    constructor() {
        this.ctx = null;
    }
    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }
    playTone(freq, type, duration, vol = 0.1) {
        if (!this.ctx) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            gain.gain.setValueAtTime(vol, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch(e) {}
    }
    footstep(isCrouch) {
        if (seededRandom() < 0.3) {
            this.playTone(isCrouch ? 60 : 110, 'triangle', 0.08, isCrouch ? 0.02 : 0.08);
        }
    }
    swordSwing() {
        this.init();
        if (!this.ctx) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(500, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.18);
            gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.18);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.18);
        } catch(e) {}
    }
    rockThud() {
        this.playTone(180, 'sine', 0.15, 0.2);
    }
    guardHit() {
        this.playTone(130, 'sawtooth', 0.12, 0.3);
    }
    alarm() {
        this.playTone(750, 'square', 0.35, 0.15);
    }
    itemPick() {
        this.playTone(523.25, 'triangle', 0.15, 0.2);
        setTimeout(() => this.playTone(659.25, 'triangle', 0.25, 0.2), 90);
    }
}
const sfx = new AudioSynth();

const unlockAudio = () => {
    sfx.init();
    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
};
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);

function generateCleanMazeGrid(rows, cols) {
    rows = rows % 2 === 0 ? rows + 1 : rows;
    cols = cols % 2 === 0 ? cols + 1 : cols;
    MAP_ROWS = rows;
    MAP_COLS = cols;

    const grid = Array.from({ length: rows }, () => Array(cols).fill(1));

    for (let r = 0; r < 5; r++) {
        for (let c = 0; c < cols; c++) {
            if (r === 0 || c === 0 || c === cols - 1) {
                grid[r][c] = 7;
            } else {
                grid[r][c] = 10;
            }
        }
    }

    const gateCol = Math.floor(cols / 2);
    for (let i = 0; i < 12; i++) {
        const tr = Math.floor(seededRandom() * 3) + 1;
        const tc = Math.floor(seededRandom() * (cols - 4)) + 2;
        if (Math.abs(tc - gateCol) > 3) {
            grid[tr][tc] = 7;
        }
    }

    grid[1][2] = 2;
    grid[1][3] = 2;
    grid[2][2] = 2;
    grid[2][3] = 2;

    const castleStartRow = 5;
    for (let c = 0; c < cols; c++) {
        grid[castleStartRow][c] = 1;
    }

    grid[castleStartRow][gateCol - 1] = 9;
    grid[castleStartRow][gateCol] = 9;
    grid[castleStartRow][gateCol + 1] = 9;

    const mazeStartRow = castleStartRow + 1;
    const mazeEndRow = rows - 2;

    function inMazeBounds(r, c) {
        return r >= mazeStartRow && r <= mazeEndRow && c >= 1 && c <= cols - 2;
    }

    const stack = [];
    const startCell = { r: mazeStartRow + 1, c: gateCol };
    grid[startCell.r][startCell.c] = 0;
    stack.push(startCell);

    while (stack.length > 0) {
        const current = stack[stack.length - 1];
        const neighbors = [];

        const dirs = [
            { dr: -2, dc: 0 },
            { dr: 2, dc: 0 },
            { dr: 0, dc: -2 },
            { dr: 0, dc: 2 }
        ];

        for (let d of dirs) {
            const nr = current.r + d.dr;
            const nc = current.c + d.dc;
            if (inMazeBounds(nr, nc) && grid[nr][nc] === 1) {
                neighbors.push({ r: nr, c: nc, dr: d.dr, dc: d.dc });
            }
        }

        if (neighbors.length > 0) {
            const next = neighbors[Math.floor(seededRandom() * neighbors.length)];
            grid[current.r + next.dr / 2][current.c + next.dc / 2] = 0;
            grid[next.r][next.c] = 0;
            stack.push({ r: next.r, c: next.c });
        } else {
            stack.pop();
        }
    }

    for (let r = castleStartRow + 1; r <= mazeStartRow + 2; r++) {
        grid[r][gateCol] = 0;
        grid[r][gateCol - 1] = 0;
    }

    for (let r = mazeStartRow + 2; r < mazeEndRow; r += 3) {
        for (let c = 2; c < cols - 2; c += 3) {
            if (grid[r][c] === 1 && seededRandom() < 0.35) {
                grid[r][c] = 0;
            }
        }
    }

    // Add a handful of optional loops so layouts are less corridor-like on replay.
    for (let i = 0; i < 9; i++) {
        const rr = mazeStartRow + 2 + Math.floor(seededRandom() * Math.max(1, mazeEndRow - mazeStartRow - 3));
        const cc = 2 + Math.floor(seededRandom() * Math.max(1, cols - 4));
        if (grid[rr][cc] === 1 && (grid[rr-1][cc] === 0 || grid[rr+1][cc] === 0 || grid[rr][cc-1] === 0 || grid[rr][cc+1] === 0)) grid[rr][cc] = 0;
    }

    const armoryR = Math.floor(rows * 0.4);
    const armoryC = cols - 4;
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            grid[armoryR + dr][armoryC + dc] = 0;
        }
    }
    grid[armoryR][armoryC] = 5;
    grid[armoryR + 1][armoryC] = 6;
    grid[armoryR][armoryC - 2] = 4;

    const westR = Math.floor(rows * 0.4);
    const westC = 4;
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            grid[westR + dr][westC + dc] = 0;
        }
    }
    grid[westR][westC] = 6;

    const sanctumR = rows - 4;
    const sanctumC = Math.floor(cols / 2);

    for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -3; dc <= 3; dc++) {
            const r = sanctumR + dr;
            const c = sanctumC + dc;
            if (r >= mazeStartRow && r < rows - 1 && c > 0 && c < cols - 1) {
                grid[r][c] = 0;
            }
        }
    }
    grid[sanctumR][sanctumC] = 3;

    for (let r = mazeStartRow + 2; r < rows - 2; r += 4) {
        for (let c = 2; c < cols - 2; c += 4) {
            if (grid[r][c] === 1 && (grid[r+1][c] === 0 || grid[r-1][c] === 0)) {
                grid[r][c] = 8;
            }
        }
    }

    return grid;
}

let gameState = 'START';
let gameTime = 0;
let lastTime = 0;
let alarmTriggered = false;
let flagCaptured = false;
let swordEquipped = false;
let guardKills = 0;

let cameraX = 0;
let cameraY = 0;

let mouseX = 0;
let mouseY = 0;
let worldMouseX = 0;
let worldMouseY = 0;

class Player {
    constructor(x, y, startingRocks = 10) {
        this.x = x;
        this.y = y;
        this.radius = 13;
        this.hp = 100;
        this.maxHp = 100;
        this.stamina = 100;
        this.maxStamina = 100;
        this.angle = 0;
        this.state = 'NORMAL';
        this.isSprinting = false;
        this.speed = 3.2;
        this.isAttacking = false;
        this.attackCooldown = 0;
        this.rockCooldown = 0;
        this.rocksRemaining = startingRocks;
        this.attackArc = Math.PI / 1.3;
        this.attackRange = 48;
        this.noiseRadius = 120;
        this.stepTimer = 0;
    }

    update(dt) {
        let moveSpeed = this.speed;
        const isCrouching = keyState.crouch;

        if (keyState.sprint && !isCrouching) {
            if (this.isSprinting) {
                if (this.stamina <= 0) this.isSprinting = false;
            } else {
                if (this.stamina >= 12) this.isSprinting = true;
            }
        } else {
            this.isSprinting = false;
        }

        if (isCrouching) {
            this.state = 'CROUCH';
            moveSpeed = this.speed * 0.45;
            this.noiseRadius = 30;
        } else if (this.isSprinting) {
            this.state = 'SPRINT';
            moveSpeed = this.speed * 1.65;
            this.stamina = Math.max(0, this.stamina - dt * 30);
            this.noiseRadius = 320;
        } else {
            this.state = 'NORMAL';
            this.stamina = Math.min(this.maxStamina, this.stamina + dt * 22);
            this.noiseRadius = 130;
        }

        if (this.state === 'CROUCH') {
            this.stamina = Math.min(this.maxStamina, this.stamina + dt * 15);
        }

        let dx = 0;
        let dy = 0;

        if (keyState.up) dy -= 1;
        if (keyState.down) dy += 1;
        if (keyState.left) dx -= 1;
        if (keyState.right) dx += 1;

        if (dx !== 0 && dy !== 0) {
            dx *= 0.7071;
            dy *= 0.7071;
        }

        if (dx !== 0 || dy !== 0) {
            this.stepTimer += dt;
            const stepInterval = this.state === 'SPRINT' ? 0.2 : (this.state === 'CROUCH' ? 0.5 : 0.32);
            if (this.stepTimer >= stepInterval) {
                sfx.footstep(this.state === 'CROUCH');
                this.stepTimer = 0;
            }
        }

        this.moveWithCollision(dx * moveSpeed * dt * 60, dy * moveSpeed * dt * 60);

        if (isMobileDevice) {
            let closestGuard = null;
            let minDistance = 280;

            for (let g of guards) {
                if (g.hp > 0) {
                    const dist = Math.hypot(g.x - this.x, g.y - this.y);
                    if (dist < minDistance) {
                        minDistance = dist;
                        closestGuard = g;
                    }
                }
            }

            if (closestGuard) {
                this.angle = Math.atan2(closestGuard.y - this.y, closestGuard.x - this.x);
                worldMouseX = closestGuard.x;
                worldMouseY = closestGuard.y;
            } else if (dx !== 0 || dy !== 0) {
                this.angle = Math.atan2(dy, dx);
                worldMouseX = this.x + dx * 150;
                worldMouseY = this.y + dy * 150;
            }
        } else {
            this.angle = Math.atan2(worldMouseY - this.y, worldMouseX - this.x);
        }

        if (this.attackCooldown > 0) {
            this.attackCooldown -= dt;
            if (this.attackCooldown <= 0) {
                this.isAttacking = false;
            }
        }

        if (this.rockCooldown > 0) {
            this.rockCooldown -= dt;
        }
    }

    moveWithCollision(vx, vy) {
        if (vx !== 0) {
            let nextX = this.x + vx;
            if (!checkTileCollision(nextX, this.y, this.radius)) {
                this.x = nextX;
            }
        }
        if (vy !== 0) {
            let nextY = this.y + vy;
            if (!checkTileCollision(this.x, nextY, this.radius)) {
                this.y = nextY;
            }
        }
    }

    throwRock() {
        if (this.rocksRemaining <= 0) {
            showFloatingText("No Rocks Left!", this.x, this.y - 18, "#ef4444");
            return;
        }
        if (this.rockCooldown > 0) return;

        this.rocksRemaining--;
        this.rockCooldown = 4.0;
        let targetX = worldMouseX;
        let targetY = worldMouseY;

        if (targetX === 0 && targetY === 0) {
            targetX = this.x + Math.cos(this.angle) * 180;
            targetY = this.y + Math.sin(this.angle) * 180;
        }

        const dist = Math.hypot(targetX - this.x, targetY - this.y);
        const maxDist = 260;
        if (dist > maxDist) {
            const ratio = maxDist / dist;
            targetX = this.x + (targetX - this.x) * ratio;
            targetY = this.y + (targetY - this.y) * ratio;
        }

        rockProjectiles.push({
            startX: this.x,
            startY: this.y,
            x: this.x,
            y: this.y,
            targetX: targetX,
            targetY: targetY,
            progress: 0,
            speed: 400
        });

        showFloatingText(`Rock Thrown! (${this.rocksRemaining} left)`, this.x, this.y - 18, "#fef08a");
    }

    attack() {
        if (this.attackCooldown > 0) return;

        this.isAttacking = true;
        this.attackCooldown = 0.35;

        if (swordEquipped) {
            sfx.swordSwing();
            createSlashEffect(this.x, this.y, this.angle, this.attackRange);
            emitNoise(this.x, this.y, 250);

            const hitTileX = Math.floor((this.x + Math.cos(this.angle) * 32) / TILE_SIZE);
            const hitTileY = Math.floor((this.y + Math.sin(this.angle) * 32) / TILE_SIZE);
            if (hitTileY >= 0 && hitTileY < MAP_ROWS && hitTileX >= 0 && hitTileX < MAP_COLS) {
                if (MAP_GRID[hitTileY][hitTileX] === 4) {
                    MAP_GRID[hitTileY][hitTileX] = 0;
                    sfx.guardHit();
                    showFloatingText("WALL BROKEN!", this.x, this.y - 20, "#f59e0b");
                }
            }

            guards.forEach(guard => {
                if (guard.hp <= 0) return;
                const dist = Math.hypot(guard.x - this.x, guard.y - this.y);
                if (dist < this.attackRange + guard.radius) {
                    const angleToGuard = Math.atan2(guard.y - this.y, guard.x - this.x);
                    let angleDiff = Math.abs(this.angle - angleToGuard);
                    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                    angleDiff = Math.abs(angleDiff);

                    if (angleDiff < this.attackArc / 2 + 0.35) {
                        guard.takeDamage(45, this.x, this.y);
                    }
                }
            });
        }
    }
}

function lerpAngle(current, target, turnSpeed, dt) {
    let diff = target - current;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;

    const maxStep = turnSpeed * dt;
    if (Math.abs(diff) <= maxStep) {
        return target;
    }
    return current + Math.sign(diff) * maxStep;
}

// Grid A* keeps guards from walking into walls during pursuit.
function findGuardPath(startX, startY, targetX, targetY) {
    const toCell = (x, y) => ({ c: Math.max(0, Math.min(MAP_COLS - 1, Math.floor(x / TILE_SIZE))), r: Math.max(0, Math.min(MAP_ROWS - 1, Math.floor(y / TILE_SIZE))) });
    const start = toCell(startX, startY), goal = toCell(targetX, targetY);
    const key = (r, c) => `${r},${c}`;
    const blocked = (r, c) => r < 0 || c < 0 || r >= MAP_ROWS || c >= MAP_COLS || [1, 4, 7].includes(MAP_GRID[r][c]);
    if (blocked(goal.r, goal.c)) return [];
    const open = [{ r: start.r, c: start.c, g: 0, f: Math.abs(goal.r-start.r)+Math.abs(goal.c-start.c) }];
    const came = new Map(), cost = new Map([[key(start.r,start.c), 0]]), closed = new Set();
    while (open.length && closed.size < MAP_ROWS * MAP_COLS) {
        open.sort((a,b) => a.f-b.f);
        const cur = open.shift(), ck = key(cur.r,cur.c);
        if (closed.has(ck)) continue;
        if (cur.r === goal.r && cur.c === goal.c) {
            const path = [{ r: goal.r, c: goal.c }];
            let k = ck;
            while (came.has(k)) { const prev = came.get(k); path.push({ r: prev.r, c: prev.c }); k = key(prev.r,prev.c); }
            path.reverse(); path.shift();
            return path.map(cell => ({ x: cell.c*TILE_SIZE+TILE_SIZE/2, y: cell.r*TILE_SIZE+TILE_SIZE/2 }));
        }
        closed.add(ck);
        for (const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
            const nr=cur.r+dr,nc=cur.c+dc,nk=key(nr,nc);
            if (blocked(nr,nc) || closed.has(nk)) continue;
            const ng=cur.g+1;
            if (ng < (cost.get(nk) ?? Infinity)) {
                came.set(nk,{r:cur.r,c:cur.c}); cost.set(nk,ng);
                open.push({r:nr,c:nc,g:ng,f:ng+Math.abs(goal.r-nr)+Math.abs(goal.c-nc)});
            }
        }
    }
    return [];
}

class Guard {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 14;
        this.hp = 80;
        this.maxHp = 80;
        this.angle = seededRandom() * Math.PI * 2;
        this.targetAngle = this.angle;
        this.speed = 1.3;
        this.chaseSpeed = 2.3;
        this.turnSpeed = 2.2;
        this.chaseTurnSpeed = 3.8;
        this.state = 'PATROL';
        this.visionRadius = 240;
        this.visionAngle = Math.PI / 3.4;
        this.suspicionTimer = 0;
        this.targetLastKnown = null;
        this.attackCooldown = 0;
        this.patrolTimer = 0;
        this.patrolState = 'WALK';
        this.waitTime = 0;
        this.chaseTimer = 0;
        this.searchTimer = 0;
        this.path = [];
        this.pathIndex = 0;
        this.pathRefresh = 0;
    }

    update(dt) {
        if (this.hp <= 0) return;

        if (this.attackCooldown > 0) {
            this.attackCooldown -= dt;
        }

        const distToPlayer = Math.hypot(player.x - this.x, player.y - this.y);
        const canSee = this.canSeePlayer();
        const canHear = distToPlayer < player.noiseRadius && player.state !== 'CROUCH';

        if (alarmTriggered && this.state === 'PATROL') {
            this.state = 'SUSPICIOUS';
            this.suspicionTimer = 1.4;
            this.targetLastKnown = { x: player.x, y: player.y };
        }

        switch (this.state) {
            case 'PATROL':
                if (canSee || canHear) {
                    this.state = 'SUSPICIOUS';
                    this.suspicionTimer = 0.8;
                    this.targetLastKnown = { x: player.x, y: player.y };
                } else {
                    this.patrolRandomly(dt);
                }
                break;

            case 'SUSPICIOUS':
                if (canSee) {
                    this.targetLastKnown = { x: player.x, y: player.y };
                    this.suspicionTimer += dt * 2.2;
                    if (this.suspicionTimer > 1.0) {
                        this.state = 'CHASE';
                        this.chaseTimer = 7;
                        triggerAlarm();
                    }
                } else if (canHear) {
                    this.targetLastKnown = { x: player.x, y: player.y };
                    this.suspicionTimer = Math.max(this.suspicionTimer, 1.5);
                }
                if (this.targetLastKnown) {
                    const searchDistance = Math.hypot(this.targetLastKnown.x-this.x, this.targetLastKnown.y-this.y);
                    if (searchDistance > 18) this.moveTowards(this.targetLastKnown.x, this.targetLastKnown.y, this.speed * 0.85, this.turnSpeed, dt);
                    else {
                        this.angle += dt * 1.1;
                        this.searchTimer = Math.max(0, this.searchTimer - dt);
                    }
                }
                this.suspicionTimer -= dt * 0.3;
                if (this.suspicionTimer <= 0) {
                    this.state = 'PATROL';
                    this.targetLastKnown = null;
                    this.path = [];
                }
                break;

            case 'CHASE':
                if (canSee) {
                    this.targetLastKnown = { x: player.x, y: player.y };
                    this.chaseTimer = 7;
                } else {
                    this.chaseTimer -= dt;
                }
                if (this.targetLastKnown) {
                    this.moveTowards(this.targetLastKnown.x, this.targetLastKnown.y, this.chaseSpeed, this.chaseTurnSpeed, dt);
                }
                if (distToPlayer < this.radius + player.radius + 8 && this.attackCooldown <= 0) {
                    player.hp -= 16;
                    this.attackCooldown = 0.75;
                    sfx.guardHit();
                    createBloodParticles(player.x, player.y);
                    showFloatingText("-16", player.x, player.y, "#ef4444");
                    if (player.hp <= 0) triggerGameOver();
                }
                if (this.chaseTimer <= 0 && !canSee) {
                    this.state = 'SUSPICIOUS';
                    this.suspicionTimer = 2.8;
                    this.searchTimer = 2.8;
                    this.path = [];
                }
                break;
        }
    }

    canSeePlayer() {
        const dist = Math.hypot(player.x - this.x, player.y - this.y);
        const maxDist = player.state === 'CROUCH' ? this.visionRadius * 0.5 : this.visionRadius;

        if (dist > maxDist) return false;

        const angleToPlayer = Math.atan2(player.y - this.y, player.x - this.x);
        let angleDiff = Math.abs(this.angle - angleToPlayer);
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        angleDiff = Math.abs(angleDiff);

        if (angleDiff > this.visionAngle / 2) return false;

        return !hasLineOfSightObstruction(this.x, this.y, player.x, player.y);
    }

    patrolRandomly(dt) {
        if (this.patrolState === 'WAIT') {
            this.waitTime -= dt;
            this.angle = lerpAngle(this.angle, this.targetAngle, this.turnSpeed * 0.7, dt);
            if (this.waitTime <= 0) {
                this.patrolState = 'WALK';
                this.patrolTimer = 0;
            }
            return;
        }

        this.angle = lerpAngle(this.angle, this.targetAngle, this.turnSpeed, dt);

        this.patrolTimer += dt;
        if (this.patrolTimer > 3.5) {
            if (seededRandom() < 0.35) {
                this.patrolState = 'WAIT';
                this.waitTime = 1.2 + seededRandom() * 1.5;
                this.targetAngle = this.angle + (seededRandom() - 0.5) * (Math.PI * 0.8);
                return;
            } else {
                this.targetAngle = this.angle + (seededRandom() - 0.5) * (Math.PI * 0.7);
                this.patrolTimer = 0;
            }
        }

        const probeDist = 24;
        const probeX = this.x + Math.cos(this.angle) * probeDist;
        const probeY = this.y + Math.sin(this.angle) * probeDist;

        if (checkTileCollision(probeX, probeY, this.radius)) {
            const anglesToTry = [Math.PI / 2, -Math.PI / 2, Math.PI * 0.75, -Math.PI * 0.75, Math.PI];
            let foundNewDir = false;
            for (let da of anglesToTry) {
                const testAngle = this.angle + da;
                const testX = this.x + Math.cos(testAngle) * (probeDist + 8);
                const testY = this.y + Math.sin(testAngle) * (probeDist + 8);
                if (!checkTileCollision(testX, testY, this.radius)) {
                    this.targetAngle = testAngle;
                    foundNewDir = true;
                    break;
                }
            }
            if (!foundNewDir) {
                this.targetAngle = this.angle + Math.PI;
            }
        } else {
            const frameScale = dt * 60;
            const vx = Math.cos(this.angle) * this.speed * frameScale;
            const vy = Math.sin(this.angle) * this.speed * frameScale;

            let nextX = this.x + vx;
            let nextY = this.y + vy;

            if (!checkTileCollision(nextX, this.y, this.radius)) this.x = nextX;
            if (!checkTileCollision(this.x, nextY, this.radius)) this.y = nextY;
        }
    }

    moveTowards(tx, ty, speed, turnSpeed, dt) {
        this.pathRefresh -= dt;
        if (this.pathRefresh <= 0 || !this.path.length) {
            this.path = findGuardPath(this.x, this.y, tx, ty);
            this.pathIndex = 0;
            this.pathRefresh = 0.45;
        }
        let waypoint = this.path[this.pathIndex];
        if (!waypoint) {
            // If the target is in the same open cell, direct movement is safe.
            waypoint = { x: tx, y: ty };
        }
        if (Math.hypot(waypoint.x-this.x, waypoint.y-this.y) < 9 && this.pathIndex < this.path.length-1) {
            this.pathIndex++;
            waypoint = this.path[this.pathIndex];
        }
        const targetAngle = Math.atan2(waypoint.y-this.y, waypoint.x-this.x);
        this.angle = lerpAngle(this.angle, targetAngle, turnSpeed, dt);
        const step = speed * dt * 60;
        const vx = Math.cos(this.angle) * step, vy = Math.sin(this.angle) * step;
        const nextX=this.x+vx, nextY=this.y+vy;
        if (!checkTileCollision(nextX,this.y,this.radius)) this.x=nextX;
        if (!checkTileCollision(this.x,nextY,this.radius)) this.y=nextY;
    }

    takeDamage(amount, attackerX, attackerY) {
        this.hp -= amount;
        sfx.guardHit();
        createBloodParticles(this.x, this.y);
        showFloatingText(`-${amount}`, this.x, this.y, "#f59e0b");

        this.state = 'CHASE';
        triggerAlarm();

        if (this.hp <= 0) {
            guardKills++;
            createBloodParticles(this.x, this.y, 25);
        }
    }
}

let particles = [];
let rockProjectiles = [];
let noiseRipples = [];
let floatingTexts = [];
let player = null;
let guards = [];
let margusNPC = null;
let margusFound = false;
let margusNear = false;
let margusChallengeDone = false;
let exitLockOpened = false;
let exitLockDismissed = false;
let lockSequence = [2, 4, 1];
let lockProgress = 0;
let codeBlocks = [];

function getStartingRocksForGame() {
    const saved = localStorage.getItem('shadow_castle_v3_rocks');
    if (saved === null) return 10;
    const parsed = parseInt(saved, 10);
    return isNaN(parsed) ? 10 : Math.max(3, parsed);
}

function initLevel() {
    MAP_GRID = generateCleanMazeGrid(41, 41);

    const gateCol = Math.floor(MAP_COLS / 2);
    const startingRocks = getStartingRocksForGame();
    player = new Player((gateCol) * TILE_SIZE + TILE_SIZE / 2, 2.5 * TILE_SIZE, startingRocks);

    if (checkTileCollision(player.x, player.y, player.radius)) {
        player.x = gateCol * TILE_SIZE + TILE_SIZE / 2;
        player.y = 1.5 * TILE_SIZE;
    }

    guards = [];
    // Margus hides in a quiet corner of the western chamber.
    const margusRow = Math.floor(MAP_ROWS * 0.4) + 1;
    const margusCol = 5;
    margusNPC = { x: margusCol * TILE_SIZE + TILE_SIZE / 2, y: margusRow * TILE_SIZE + TILE_SIZE / 2 };
    margusFound = false;
    margusNear = false;
    margusChallengeDone = false;
    exitLockOpened = false;
    exitLockDismissed = false;
    window.exitLockNoticeShown = false;
    lockSequence = Array.from({length: 3}, () => 1 + Math.floor(seededRandom() * 4));
    lockProgress = 0;
    codeBlocks = [];
    particles = [];
    rockProjectiles = [];
    noiseRipples = [];
    floatingTexts = [];
    alarmTriggered = false;
    flagCaptured = false;
    swordEquipped = false;
    guardKills = 0;
    gameTime = 0;
    resetKeys();

    for (let r = 7; r < MAP_ROWS - 3; r += 4) {
        for (let c = 3; c < MAP_COLS - 3; c += 4) {
            if (MAP_GRID[r][c] === 0 && Math.hypot(c * TILE_SIZE + TILE_SIZE/2 - margusNPC.x, r * TILE_SIZE + TILE_SIZE/2 - margusNPC.y) > TILE_SIZE * 2 && seededRandom() < 0.6) {
                guards.push(new Guard(c * TILE_SIZE + TILE_SIZE/2, r * TILE_SIZE + TILE_SIZE/2));
            }
        }
    }
}

function checkTileCollision(x, y, radius) {
    const minCol = Math.floor((x - radius) / TILE_SIZE);
    const maxCol = Math.floor((x + radius) / TILE_SIZE);
    const minRow = Math.floor((y - radius) / TILE_SIZE);
    const maxRow = Math.floor((y + radius) / TILE_SIZE);

    for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
            if (r < 0 || r >= MAP_ROWS || c < 0 || c >= MAP_COLS) return true;
            const tile = MAP_GRID[r][c];
            if (tile === 1 || tile === 4 || tile === 7) {
                return true;
            }
        }
    }
    return false;
}

function hasLineOfSightObstruction(x1, y1, x2, y2) {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(1, Math.ceil(dist / 12));
    const dx = (x2 - x1) / steps;
    const dy = (y2 - y1) / steps;

    let curX = x1;
    let curY = y1;

    for (let i = 0; i < steps; i++) {
        curX += dx;
        curY += dy;
        const col = Math.floor(curX / TILE_SIZE);
        const row = Math.floor(curY / TILE_SIZE);

        if (row >= 0 && row < MAP_ROWS && col >= 0 && col < MAP_COLS) {
            const tile = MAP_GRID[row][col];
            if (tile === 1 || tile === 4 || tile === 7) {
                return true;
            }
        }
    }
    return false;
}

function triggerAlarm() {
    if (!alarmTriggered) {
        alarmTriggered = true;
        sfx.alarm();
        showBannerAlert("ALARM TRIGGERED! GUARDS ALERTED!");
        guards.forEach(g => {
            if (g.hp > 0) {
                g.state = 'CHASE';
                g.chaseTimer = 7;
                g.targetLastKnown = { x: player.x, y: player.y };
                g.path = [];
            }
        });
    }
}

function emitNoise(x, y, radius) {
    noiseRipples.push({
        x, y, maxRadius: radius, radius: 10, life: 0.4
    });

    guards.forEach(g => {
        if (g.hp <= 0) return;
        const d = Math.hypot(g.x - x, g.y - y);
        if (d < radius && g.state === 'PATROL') {
            g.state = 'SUSPICIOUS';
            g.suspicionTimer = 1.0;
            g.targetLastKnown = { x, y };
        }
    });
}

function createBloodParticles(x, y, count = 12) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x, y,
            vx: (seededRandom() - 0.5) * 4.5,
            vy: (seededRandom() - 0.5) * 4.5,
            radius: seededRandom() * 3 + 1,
            color: '#dc2626',
            life: 0.55
        });
    }
}

function createSlashEffect(x, y, angle, range) {
    for (let i = 0; i < 18; i++) {
        const spread = (seededRandom() - 0.5) * 0.95;
        const pAngle = angle + spread;
        const speed = seededRandom() * 3.5 + 2;
        particles.push({
            x: x + Math.cos(angle) * 16,
            y: y + Math.sin(angle) * 16,
            vx: Math.cos(pAngle) * speed,
            vy: Math.sin(pAngle) * speed,
            radius: seededRandom() * 2.5 + 1,
            color: '#fef08a',
            life: 0.28
        });
    }
}

function showFloatingText(str, x, y, color = '#fff') {
    floatingTexts.push({
        text: str, x, y, color, life: 1.0, vy: -1.3
    });
}

function showBannerAlert(msg) {
    const banner = document.getElementById('banner-alert');
    const bg = document.getElementById('banner-bg');
    bg.innerText = msg;
    banner.classList.remove('opacity-0', '-translate-y-4');
    banner.classList.add('opacity-100', 'translate-y-0');

    setTimeout(() => {
        banner.classList.remove('opacity-100', 'translate-y-0');
        banner.classList.add('opacity-0', '-translate-y-4');
    }, 3200);
}

function render() {
    if (!player) return;

    ctx.clearRect(0, 0, canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight);

    const viewW = canvas.clientWidth || window.innerWidth;
    const viewH = canvas.clientHeight || window.innerHeight;
    cameraX = Math.max(0, Math.min(player.x - viewW / 2, MAP_COLS * TILE_SIZE - viewW));
    cameraY = Math.max(0, Math.min(player.y - viewH / 2, MAP_ROWS * TILE_SIZE - viewH));

    ctx.save();
    ctx.translate(-cameraX, -cameraY);

    drawMap();
    drawInteractiveItems();
    drawMargusNPC();

    noiseRipples.forEach(r => {
        ctx.strokeStyle = 'rgba(245, 158, 11, ' + (r.life * 2) + ')';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.stroke();
    });

    rockProjectiles.forEach(rock => {
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(rock.x, rock.y, 4, 0, Math.PI * 2);
        ctx.fill();
    });

    guards.forEach(g => {
        if (g.hp <= 0) return;
        drawGuardVisionCone(g);

        ctx.save();
        ctx.translate(g.x, g.y);
        ctx.rotate(g.angle);

        ctx.fillStyle = g.state === 'CHASE' ? '#ef4444' : (g.state === 'SUSPICIOUS' ? '#eab308' : '#3b82f6');
        ctx.beginPath();
        ctx.arc(0, 0, g.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.arc(6, 0, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        if (g.state === 'SUSPICIOUS') {
            ctx.fillStyle = '#f59e0b';
            ctx.font = '900 20px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('?', g.x, g.y - g.radius - 8);
        } else if (g.state === 'CHASE') {
            ctx.fillStyle = '#ef4444';
            ctx.font = '900 22px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('!', g.x, g.y - g.radius - 8);
        }

        if (g.hp < g.maxHp) {
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(g.x - 16, g.y - 22, 32, 5);
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(g.x - 15, g.y - 21, (g.hp / g.maxHp) * 30, 3);
        }
    });

    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);

    if (player.state === 'SPRINT') {
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, player.noiseRadius, 0, Math.PI * 2);
        ctx.stroke();
    }

    ctx.fillStyle = player.state === 'CROUCH' ? '#065f46' : '#10b981';
    ctx.beginPath();
    ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#022c22';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.strokeStyle = swordEquipped ? '#38bdf8' : '#fbbf24';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(player.radius + 6, 0);
    ctx.stroke();

    ctx.restore();

    particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.life * 2);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    });

    // Reset alignment (guard "?"/"!" labels leave it centered)
    ctx.textAlign = 'left';
    floatingTexts.forEach(ft => {
        ctx.fillStyle = ft.color;
        ctx.font = 'bold 12px Inter';
        ctx.globalAlpha = Math.max(0, ft.life);
        ctx.fillText(ft.text, ft.x - 10, ft.y);
        ctx.globalAlpha = 1.0;
    });

    drawDarknessFog();

    ctx.restore();

    drawMinimap();
}

function drawMap() {
    const time = performance.now() * 0.003;
    for (let r = 0; r < MAP_ROWS; r++) {
        for (let c = 0; c < MAP_COLS; c++) {
            const tile = MAP_GRID[r][c];
            const x = c * TILE_SIZE;
            const y = r * TILE_SIZE;

            if (tile === 10) {
                ctx.fillStyle = '#062016';
                ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
                ctx.fillStyle = '#0a3223';
                ctx.fillRect(x + 8, y + 8, 6, 6);
                ctx.fillRect(x + 28, y + 24, 8, 8);
            } else if (tile === 1) {
                ctx.fillStyle = '#1e293b';
                ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
                ctx.strokeStyle = '#0f172a';
                ctx.lineWidth = 2;
                ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
                ctx.strokeStyle = '#334155';
                ctx.beginPath();
                ctx.moveTo(x, y + TILE_SIZE / 2);
                ctx.lineTo(x + TILE_SIZE, y + TILE_SIZE / 2);
                ctx.stroke();
            } else if (tile === 2) {
                ctx.fillStyle = '#14532d';
                ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
                ctx.fillStyle = '#78350f';
                ctx.fillRect(x + 6, y + 10, 36, 28);
                ctx.fillStyle = '#f59e0b';
                ctx.font = 'bold 9px Inter';
                ctx.textAlign = 'left';
                ctx.fillText('ESCAPE', x + 6, y + 26);
            } else if (tile === 4) {
                ctx.fillStyle = '#334155';
                ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
                ctx.strokeStyle = '#f59e0b';
                ctx.lineWidth = 1.5;
                ctx.strokeRect(x + 4, y + 4, TILE_SIZE - 8, TILE_SIZE - 8);
            } else if (tile === 7) {
                ctx.fillStyle = '#03120c';
                ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
                ctx.fillStyle = '#092d1f';
                ctx.beginPath();
                ctx.arc(x + TILE_SIZE/2, y + TILE_SIZE/2, TILE_SIZE * 0.45, 0, Math.PI * 2);
                ctx.fill();
            } else if (tile === 8) {
                ctx.fillStyle = '#1e293b';
                ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

                const flicker = Math.sin(time + r + c) * 3;
                ctx.fillStyle = '#f59e0b';
                ctx.beginPath();
                ctx.arc(x + TILE_SIZE/2, y + TILE_SIZE/2, 6 + flicker, 0, Math.PI * 2);
                ctx.fill();
            } else if (tile === 9) {
                ctx.fillStyle = '#334155';
                ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
                ctx.fillStyle = '#78350f';
                ctx.fillRect(x + 4, y + 4, TILE_SIZE - 8, TILE_SIZE - 8);
            } else {
                ctx.fillStyle = '#0f172a';
                ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
                ctx.strokeStyle = '#1e293b';
                ctx.lineWidth = 0.5;
                ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
            }
        }
    }
}

function drawInteractiveItems() {
    for (let r = 0; r < MAP_ROWS; r++) {
        for (let c = 0; c < MAP_COLS; c++) {
            const tile = MAP_GRID[r][c];
            const cx = c * TILE_SIZE + TILE_SIZE / 2;
            const cy = r * TILE_SIZE + TILE_SIZE / 2;

            if (tile === 3 && !flagCaptured) {
                ctx.fillStyle = '#92400e';
                ctx.beginPath();
                ctx.arc(cx, cy, 14, 0, Math.PI * 2);
                ctx.fill();

                ctx.strokeStyle = '#f59e0b';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(cx, cy - 16);
                ctx.lineTo(cx, cy + 12);
                ctx.stroke();

                ctx.fillStyle = '#ef4444';
                ctx.fillRect(cx, cy - 16, 14, 9);
            }

            if (tile === 5 && !swordEquipped) {
                ctx.fillStyle = '#1e1b4b';
                ctx.beginPath();
                ctx.arc(cx, cy, 15, 0, Math.PI * 2);
                ctx.fill();

                ctx.strokeStyle = '#38bdf8';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.moveTo(cx - 9, cy + 9);
                ctx.lineTo(cx + 9, cy - 9);
                ctx.stroke();
            }

            if (tile === 6) {
                ctx.fillStyle = '#991b1b';
                ctx.beginPath();
                ctx.arc(cx, cy, 13, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#f87171';
                ctx.lineWidth = 1.5;
                ctx.stroke();

                ctx.fillStyle = '#ffffff';
                ctx.fillRect(cx - 2.5, cy - 7, 5, 14);
                ctx.fillRect(cx - 7, cy - 2.5, 14, 5);
            }
        }
    }
}

function drawMargusNPC() {
    if (!margusNPC || margusFound) return;
    const x = margusNPC.x, y = margusNPC.y;
    ctx.save();
    ctx.translate(x, y);
    // Warm lantern-like marker, only noticeable when you get close.
    if (margusNear) {
        ctx.fillStyle = 'rgba(251, 191, 36, 0.13)';
        ctx.beginPath(); ctx.arc(0, 0, 29, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = 'rgba(2, 6, 23, 0.45)';
    ctx.beginPath(); ctx.ellipse(0, 13, 15, 6, 0, 0, Math.PI * 2); ctx.fill();
    // Deep plum travelling cloak and muted green medieval tunic.
    ctx.fillStyle = '#49334b';
    ctx.beginPath(); ctx.moveTo(-13, 3); ctx.quadraticCurveTo(-17, 12, -13, 17);
    ctx.lineTo(13, 17); ctx.quadraticCurveTo(17, 12, 13, 3); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#251d2c'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#64745a';
    ctx.beginPath(); ctx.moveTo(-8, -1); ctx.lineTo(8, -1); ctx.lineTo(10, 15); ctx.lineTo(-10, 15); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#b58a52'; ctx.fillRect(-10, 7, 20, 3);
    ctx.fillStyle = '#e5c28f'; ctx.fillRect(-2, 7, 4, 3);
    // Face and tousled chestnut hair, inspired by Margus's portrait.
    ctx.fillStyle = '#e7b995';
    ctx.beginPath(); ctx.ellipse(0, -8, 9, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#49352f';
    ctx.beginPath(); ctx.moveTo(-9, -9); ctx.quadraticCurveTo(-12, -23, -2, -22);
    ctx.quadraticCurveTo(8, -25, 10, -12); ctx.lineTo(7, -14); ctx.lineTo(3, -18);
    ctx.lineTo(-1, -14); ctx.lineTo(-5, -17); ctx.lineTo(-8, -12); ctx.closePath(); ctx.fill();
    // Signature round spectacles.
    ctx.strokeStyle = '#4b5563'; ctx.lineWidth = 1.7;
    ctx.beginPath(); ctx.ellipse(-4, -8, 3.7, 2.8, 0, 0, Math.PI * 2);
    ctx.ellipse(4, -8, 3.7, 2.8, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-0.3, -8); ctx.lineTo(0.3, -8); ctx.moveTo(-8, -9); ctx.lineTo(-10, -10); ctx.moveTo(8, -9); ctx.lineTo(10, -10); ctx.stroke();
    ctx.fillStyle = '#3f302c';
    ctx.beginPath(); ctx.arc(-4, -8, 0.8, 0, Math.PI * 2); ctx.arc(4, -8, 0.8, 0, Math.PI * 2); ctx.fill();
    // Tiny hood clasp and an old parchment tucked into his belt.
    ctx.fillStyle = '#eabf64'; ctx.beginPath(); ctx.arc(-10, 2, 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d9c9a3'; ctx.fillRect(7, 9, 3, 6);
    ctx.restore();

    if (margusNear) {
        ctx.save(); ctx.fillStyle = '#fde68a'; ctx.font = 'bold 11px Inter, sans-serif';
        ctx.textAlign = 'center'; ctx.shadowColor = '#020617'; ctx.shadowBlur = 5;
        ctx.fillText('MARGUS', x, y - 29); ctx.restore();
    }
}

function talkToMargus() {
    if (!player || !margusNPC || margusFound || !margusNear || gameState !== 'PLAYING') return;
    openMiniGame('modal-margus-code');
    codeBlocks = [];
    renderCodeBlocks();
}

function openMiniGame(id) {
    gameState = 'MINIGAME';
    resetKeys();
    const el = document.getElementById(id);
    el.classList.remove('hidden'); el.classList.add('flex');
}
function closeMiniGame(id) {
    const el = document.getElementById(id);
    el.classList.add('hidden'); el.classList.remove('flex');
    if (gameState === 'MINIGAME') gameState = 'PLAYING';
}
function renderCodeBlocks() {
    const workspace = document.getElementById('code-workspace');
    const labels = {start:'🟢 When started',set:'🟦 Set greeting = "Hello, Margus!"',say:'🟪 Say greeting',jump:'🟥 Jump 10 times'};
    workspace.innerHTML = codeBlocks.length ? codeBlocks.map((b,i)=>`<div class="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-bold">${i+1}. ${labels[b]}</div>`).join('') : '<p class="text-slate-600 text-xs">Your blocks will appear here…</p>';
}
function finishMargusChallenge() {
    margusChallengeDone = true; margusFound = true;
    player.rocksRemaining += 3; player.hp = Math.min(player.maxHp, player.hp + 15);
    sfx.itemPick();
    showFloatingText('+3 LURES  +15 HP', margusNPC.x, margusNPC.y - 28, '#fbbf24');
    showBannerAlert('MARGUS: “Brilliant! A proper little program. The flag lies in the southern sanctum!”');
    document.getElementById('btn-talk-margus')?.classList.add('hidden');
    closeMiniGame('modal-margus-code');
}
function startLockpick() {
    if (exitLockOpened || gameState !== 'PLAYING') return;
    lockProgress = 0;
    document.getElementById('lock-sequence').textContent = lockSequence.join(' · ');
    document.getElementById('lock-progress').textContent = 'Pins set: 0 / 3';
    document.getElementById('lock-feedback').textContent = 'Choose the first pin.';
    openMiniGame('modal-lockpick');
}
function chooseLockPin(pin) {
    if (pin === lockSequence[lockProgress]) {
        lockProgress++;
        document.getElementById('lock-progress').textContent = `Pins set: ${lockProgress} / 3`;
        if (lockProgress === lockSequence.length) {
            exitLockOpened = true; sfx.itemPick();
            document.getElementById('lock-feedback').textContent = 'Click! The gate is open!';
            setTimeout(() => { closeMiniGame('modal-lockpick'); if (gameState === 'PLAYING') triggerVictory(); }, 650);
        } else document.getElementById('lock-feedback').textContent = 'Good! Set the next pin.';
    } else {
        lockProgress = 0;
        document.getElementById('lock-progress').textContent = 'Pins set: 0 / 3';
        document.getElementById('lock-feedback').textContent = 'The pins slipped. Try the sequence again.';
    }
}

function drawGuardVisionCone(guard) {
    ctx.save();
    ctx.translate(guard.x, guard.y);

    const coneAngle = guard.visionAngle;
    const startAngle = guard.angle - coneAngle / 2;
    const endAngle = guard.angle + coneAngle / 2;

    const grad = ctx.createRadialGradient(0, 0, 10, 0, 0, guard.visionRadius);
    if (guard.state === 'CHASE') {
        grad.addColorStop(0, 'rgba(239, 68, 68, 0.45)');
        grad.addColorStop(1, 'rgba(239, 68, 68, 0.05)');
    } else if (guard.state === 'SUSPICIOUS') {
        grad.addColorStop(0, 'rgba(234, 179, 8, 0.45)');
        grad.addColorStop(1, 'rgba(234, 179, 8, 0.05)');
    } else {
        grad.addColorStop(0, 'rgba(34, 197, 94, 0.28)');
        grad.addColorStop(1, 'rgba(34, 197, 94, 0.02)');
    }

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, guard.visionRadius, startAngle, endAngle);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

function drawDarknessFog() {
    if (fogCanvas.width !== canvas.width || fogCanvas.height !== canvas.height) {
        fogCanvas.width = canvas.width;
        fogCanvas.height = canvas.height;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        fCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const viewW = canvas.clientWidth || window.innerWidth;
    const viewH = canvas.clientHeight || window.innerHeight;
    fCtx.globalCompositeOperation = 'source-over';
    fCtx.fillStyle = '#020617';
    fCtx.fillRect(0, 0, viewW, viewH);

    fCtx.globalCompositeOperation = 'destination-out';

    const pCamX = player.x - cameraX;
    const pCamY = player.y - cameraY;
    const visionRadius = player.state === 'CROUCH' ? 180 : 280;

    const pGrad = fCtx.createRadialGradient(pCamX, pCamY, 20, pCamX, pCamY, visionRadius);
    pGrad.addColorStop(0, 'rgba(0, 0, 0, 1)');
    pGrad.addColorStop(0.75, 'rgba(0, 0, 0, 0.7)');
    pGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    fCtx.fillStyle = pGrad;
    fCtx.beginPath();
    fCtx.arc(pCamX, pCamY, visionRadius, 0, Math.PI * 2);
    fCtx.fill();

    guards.forEach(g => {
        if (g.hp <= 0) return;
        const gCamX = g.x - cameraX;
        const gCamY = g.y - cameraY;

        const gGrad = fCtx.createRadialGradient(gCamX, gCamY, 10, gCamX, gCamY, g.visionRadius);
        gGrad.addColorStop(0, 'rgba(0, 0, 0, 0.9)');
        gGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        fCtx.fillStyle = gGrad;
        fCtx.beginPath();
        fCtx.moveTo(gCamX, gCamY);
        fCtx.arc(gCamX, gCamY, g.visionRadius, g.angle - g.visionAngle / 2, g.angle + g.visionAngle / 2);
        fCtx.closePath();
        fCtx.fill();
    });

    ctx.drawImage(fogCanvas, cameraX, cameraY, canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight);
}

function drawMinimap() {
    const mw = minimapCanvas.width, mh = minimapCanvas.height;
    mmCtx.clearRect(0, 0, mw, mh);
    mmCtx.fillStyle = 'rgba(3, 7, 18, 0.95)';
    mmCtx.fillRect(0, 0, mw, mh);

    const scaleX = mw / (MAP_COLS * TILE_SIZE);
    const scaleY = mh / (MAP_ROWS * TILE_SIZE);

    for (let r = 0; r < MAP_ROWS; r++) {
        for (let c = 0; c < MAP_COLS; c++) {
            const tile = MAP_GRID[r][c];
            if (tile === 1 || tile === 4) {
                mmCtx.fillStyle = '#475569';
                mmCtx.fillRect(c * TILE_SIZE * scaleX, r * TILE_SIZE * scaleY, Math.max(2,mw/130*3), Math.max(2,mh/130*3));
            } else if (tile === 2) {
                mmCtx.fillStyle = '#10b981';
                mmCtx.fillRect(c * TILE_SIZE * scaleX, r * TILE_SIZE * scaleY, Math.max(3,mw/130*4), Math.max(3,mh/130*4));
            } else if (tile === 3 && !flagCaptured) {
                mmCtx.fillStyle = '#f59e0b';
                mmCtx.fillRect(c * TILE_SIZE * scaleX, r * TILE_SIZE * scaleY, Math.max(4,mw/130*5), Math.max(4,mh/130*5));
            } else if (tile === 6) {
                mmCtx.fillStyle = '#ef4444';
                mmCtx.fillRect(c * TILE_SIZE * scaleX, r * TILE_SIZE * scaleY, Math.max(3,mw/130*4), Math.max(3,mh/130*4));
            }
        }
    }

    guards.forEach(g => {
        if (g.hp <= 0) return;
        mmCtx.fillStyle = g.state === 'CHASE' ? '#ef4444' : '#eab308';
        mmCtx.beginPath();
        mmCtx.arc(g.x * scaleX, g.y * scaleY, Math.max(2,mw/130*2), 0, Math.PI * 2);
        mmCtx.fill();
    });

    if (margusNPC && margusFound) {
        mmCtx.fillStyle = '#fbbf24';
        mmCtx.beginPath(); mmCtx.arc(margusNPC.x * scaleX, margusNPC.y * scaleY, 3, 0, Math.PI * 2); mmCtx.fill();
    }

    mmCtx.fillStyle = '#38bdf8';
    mmCtx.beginPath();
    mmCtx.arc(player.x * scaleX, player.y * scaleY, Math.max(3,mw/130*3), 0, Math.PI * 2);
    mmCtx.fill();
}

const keyState = {
    up: false,
    down: false,
    left: false,
    right: false,
    crouch: false,
    sprint: false
};

function resetKeys() {
    keyState.up = false;
    keyState.down = false;
    keyState.left = false;
    keyState.right = false;
    keyState.crouch = false;
    keyState.sprint = false;
}

function handleKeyEvent(e, isDown) {
    const code = e.code;
    const key = e.key;
    let handled = false;

    if (isDown && (code === 'Escape' || code === 'KeyP')) { togglePause(); handled = true; }
    if (code === 'KeyW' || code === 'ArrowUp' || key === 'w' || key === 'W' || key === 'ArrowUp') {
        keyState.up = isDown; handled = true;
    }
    if (code === 'KeyS' || code === 'ArrowDown' || key === 's' || key === 'S' || key === 'ArrowDown') {
        keyState.down = isDown; handled = true;
    }
    if (code === 'KeyA' || code === 'ArrowLeft' || key === 'a' || key === 'A' || key === 'ArrowLeft') {
        keyState.left = isDown; handled = true;
    }
    if (code === 'KeyD' || code === 'ArrowRight' || key === 'd' || key === 'D' || key === 'ArrowRight') {
        keyState.right = isDown; handled = true;
    }
    if (code === 'KeyC' || key === 'c' || key === 'C') {
        keyState.crouch = isDown; handled = true;
    }
    if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'Space' || key === 'Shift' || key === ' ') {
        keyState.sprint = isDown; handled = true;
    }
    if (isDown && (code === 'KeyE' || key === 'e' || key === 'E')) {
        if (player && gameState === 'PLAYING') player.throwRock();
        handled = true;
    }
    if (isDown && (code === 'KeyF' || key === 'f' || key === 'F')) {
        talkToMargus();
        handled = true;
    }

    if (handled && e.cancelable) {
        e.preventDefault();
    }
}

window.addEventListener('keydown', (e) => handleKeyEvent(e, true));
window.addEventListener('keyup', (e) => handleKeyEvent(e, false));
window.addEventListener('blur', () => { resetKeys(); if (gameState === 'PLAYING') togglePause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && gameState === 'PLAYING') { resetKeys(); togglePause(); } });

window.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
    worldMouseX = mouseX + cameraX;
    worldMouseY = mouseY + cameraY;
});

window.addEventListener('mousedown', (e) => {
    if (e.button === 0 && gameState === 'PLAYING' && player) {
        player.attack();
    }
});

const bindTouchBtn = (id, keyName) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); keyState[keyName] = true; btn.setPointerCapture?.(e.pointerId); });
    const release = (e) => { e.preventDefault(); keyState[keyName] = false; };
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('lostpointercapture', () => { keyState[keyName] = false; });
};

bindTouchBtn('btn-touch-up', 'up');
bindTouchBtn('btn-touch-down', 'down');
bindTouchBtn('btn-touch-left', 'left');
bindTouchBtn('btn-touch-right', 'right');
bindTouchBtn('btn-touch-crouch', 'crouch');
bindTouchBtn('btn-touch-sprint', 'sprint');

document.getElementById('btn-touch-strike')?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (player && gameState === 'PLAYING') player.attack();
});
document.getElementById('btn-touch-rock')?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (player && gameState === 'PLAYING') player.throwRock();
});
document.getElementById('btn-talk-margus')?.addEventListener('pointerdown', (e) => { e.preventDefault(); talkToMargus(); });
document.querySelectorAll('.code-block').forEach(btn => btn.addEventListener('click', () => { if (codeBlocks.length < 4) { codeBlocks.push(btn.dataset.block); renderCodeBlocks(); } }));
document.getElementById('btn-code-clear')?.addEventListener('click', () => { codeBlocks = []; renderCodeBlocks(); document.getElementById('code-feedback').textContent = 'Hint: start → set greeting → say greeting.'; });
document.getElementById('btn-code-close')?.addEventListener('click', () => closeMiniGame('modal-margus-code'));
document.getElementById('btn-code-run')?.addEventListener('click', () => {
    const correct = codeBlocks.length === 3 && codeBlocks[0] === 'start' && codeBlocks[1] === 'set' && codeBlocks[2] === 'say';
    if (correct) { document.getElementById('code-feedback').textContent = '“Hello, Margus!” — It works!'; finishMargusChallenge(); }
    else document.getElementById('code-feedback').textContent = 'Not quite. Use exactly: When started → Set greeting → Say greeting.';
});
document.querySelectorAll('.lock-pin').forEach(btn => btn.addEventListener('click', () => chooseLockPin(Number(btn.dataset.pin))));
document.getElementById('btn-lock-cancel')?.addEventListener('click', () => { exitLockDismissed = true; closeMiniGame('modal-lockpick'); });

function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    detectDevice();
}
window.addEventListener('resize', resizeCanvas);

function update(dt) {
    if (gameState !== 'PLAYING') return;

    gameTime += dt;

    player.update(dt);
    margusNear = !!(margusNPC && !margusFound && Math.hypot(player.x - margusNPC.x, player.y - margusNPC.y) < 62);
    const talkButton = document.getElementById('btn-talk-margus');
    if (talkButton) talkButton.classList.toggle('hidden', !margusNear || gameState !== 'PLAYING');

    rockProjectiles.forEach(rock => {
        rock.progress += dt * rock.speed;
        const totalDist = Math.hypot(rock.targetX - rock.startX, rock.targetY - rock.startY);
        const ratio = Math.min(1, rock.progress / Math.max(1, totalDist));

        rock.x = rock.startX + (rock.targetX - rock.startX) * ratio;
        rock.y = rock.startY + (rock.targetY - rock.startY) * ratio;

        let hitGuard = null;
        for (let g of guards) {
            if (g.hp > 0 && Math.hypot(g.x - rock.x, g.y - rock.y) < g.radius + 8) {
                hitGuard = g;
                break;
            }
        }

        if (hitGuard) {
            hitGuard.hp -= 10;
            sfx.guardHit();
            createBloodParticles(hitGuard.x, hitGuard.y, 8);
            showFloatingText("-10 HP", hitGuard.x, hitGuard.y, "#f59e0b");

            hitGuard.state = 'SUSPICIOUS';
            hitGuard.suspicionTimer = 1.5;
            hitGuard.targetLastKnown = { x: rock.x, y: rock.y };

            if (hitGuard.hp <= 0) {
                guardKills++;
                createBloodParticles(hitGuard.x, hitGuard.y, 25);
                showFloatingText("GUARD DEFEATED!", hitGuard.x, hitGuard.y - 15, "#ef4444");
            }

            emitNoise(rock.x, rock.y, 280);
            sfx.rockThud();
            rock.completed = true;
            return;
        }

        if (rock.progress >= totalDist) {
            rock.x = rock.targetX;
            rock.y = rock.targetY;
            sfx.rockThud();
            emitNoise(rock.x, rock.y, 280);
            rock.completed = true;
        }
    });
    rockProjectiles = rockProjectiles.filter(r => !r.completed);

    noiseRipples.forEach(r => {
        r.radius += dt * 450;
        r.life -= dt;
    });
    noiseRipples = noiseRipples.filter(r => r.life > 0);

    const pCol = Math.floor(player.x / TILE_SIZE);
    const pRow = Math.floor(player.y / TILE_SIZE);

    if (pRow >= 0 && pRow < MAP_ROWS && pCol >= 0 && pCol < MAP_COLS) {
        if (MAP_GRID[pRow][pCol] === 3 && !flagCaptured) {
            flagCaptured = true;
            sfx.itemPick();
            triggerAlarm();
            showBannerAlert("ROYAL FLAG STOLEN! ESCAPE OUTSIDE TO THE WAGON!");
        }

        if (MAP_GRID[pRow][pCol] === 5 && !swordEquipped) {
            swordEquipped = true;
            sfx.itemPick();
            showFloatingText("ANCIENT SWORD UNLOCKED!", player.x, player.y - 20, "#38bdf8");
            showBannerAlert("SWORD ACQUIRED! Left Click to Melee Strike!");
        }

        if (MAP_GRID[pRow][pCol] === 6) {
            if (player.hp < player.maxHp) {
                player.hp = Math.min(player.maxHp, player.hp + 50);
                MAP_GRID[pRow][pCol] = 0;
                sfx.itemPick();
                showFloatingText("+50 HP", player.x, player.y - 20, "#4ade80");
            }
        }

        if (MAP_GRID[pRow][pCol] === 2 && flagCaptured && !exitLockOpened && !exitLockDismissed) {
            if (!window.exitLockNoticeShown) { window.exitLockNoticeShown = true; showBannerAlert('THE DOOR WAS FOUND OPEN… BUT A GUARD CLOSED IT! PICK THE LOCK.'); }
            startLockpick();
        } else if (MAP_GRID[pRow][pCol] === 2 && flagCaptured && exitLockOpened) { triggerVictory(); }
    }

    guards.forEach(g => g.update(dt));

    particles.forEach(p => {
        p.x += p.vx * dt * 60;
        p.y += p.vy * dt * 60;
        p.life -= dt;
    });
    particles = particles.filter(p => p.life > 0);

    floatingTexts.forEach(ft => {
        ft.y += ft.vy * dt * 60;
        ft.life -= dt;
    });
    floatingTexts = floatingTexts.filter(ft => ft.life > 0);

    updateHUD();
}

function updateHUD() {
    const hpBar = document.getElementById('hp-bar');
    const hpText = document.getElementById('hp-text');
    const hpPct = Math.max(0, (player.hp / player.maxHp) * 100);
    hpBar.style.width = `${hpPct}%`;
    hpText.innerText = `${Math.ceil(player.hp)} / ${player.maxHp}`;

    const staminaBar = document.getElementById('stamina-bar');
    const staminaText = document.getElementById('stamina-text');
    const staminaPct = Math.max(0, (player.stamina / player.maxStamina) * 100);
    staminaBar.style.width = `${staminaPct}%`;
    staminaText.innerText = `${Math.ceil(staminaPct)}%`;

    const stealthBadge = document.getElementById('stealth-badge');
    if (stealthBadge.dataset.state !== player.state) {
        stealthBadge.dataset.state = player.state;
        if (player.state === 'CROUCH') {
            stealthBadge.innerText = 'CROUCHED (SILENT)';
            stealthBadge.className = 'px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md text-[9px] sm:text-[11px] font-black tracking-wider uppercase bg-emerald-950/80 border border-emerald-500/50 text-emerald-400';
        } else if (player.state === 'SPRINT') {
            stealthBadge.innerText = 'SPRINTING (LOUD)';
            stealthBadge.className = 'px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md text-[9px] sm:text-[11px] font-black tracking-wider uppercase bg-red-950/80 border border-red-500/50 text-red-400 animate-pulse-fast';
        } else {
            stealthBadge.innerText = 'NORMAL';
            stealthBadge.className = 'px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md text-[9px] sm:text-[11px] font-black tracking-wider uppercase bg-slate-800 border border-slate-600 text-slate-300';
        }
    }

    const flagText = document.getElementById('flag-status-text');
    if (flagCaptured) {
        flagText.innerText = 'STOLEN!';
        flagText.className = 'text-red-400 font-bold animate-pulse';
    } else {
        flagText.innerText = 'NOT TAKEN';
        flagText.className = 'text-amber-400 font-bold';
    }

    const weaponText = document.getElementById('weapon-status-text');
    if (swordEquipped) {
        weaponText.innerText = 'ANCIENT SWORD';
        weaponText.className = 'text-sky-400 font-bold';
    } else {
        weaponText.innerText = 'UNARMED';
        weaponText.className = 'text-slate-400';
    }

    const rockText = document.getElementById('rock-status-text');
    if (player.rocksRemaining <= 0) {
        rockText.innerText = '0 LEFT';
        rockText.className = 'text-red-400 font-bold';
    } else if (player.rockCooldown <= 0) {
        rockText.innerText = `READY (${player.rocksRemaining})`;
        rockText.className = 'text-emerald-400 font-bold';
    } else {
        rockText.innerText = `${Math.ceil(player.rockCooldown)}s (${player.rocksRemaining})`;
        rockText.className = 'text-slate-400 font-bold';
    }

    document.getElementById('game-timer').innerText = formatTime(gameTime);
    const objective = document.getElementById('objective-status');
    if (objective) objective.innerText = flagCaptured ? 'Escape through the north gate to the wagon' : 'Find the Royal Flag in the southern sanctum';
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
}

function gameLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
    lastTime = timestamp;

    update(dt);
    render();

    requestAnimationFrame(gameLoop);
}

function loadHighScores() {
    const bestTime = localStorage.getItem('shadow_castle_v3_time');
    const bestKills = localStorage.getItem('shadow_castle_v3_kills') || '0';
    const startingRocks = getStartingRocksForGame();

    if (bestTime) {
        document.getElementById('best-time-val').innerText = formatTime(parseFloat(bestTime));
    } else {
        document.getElementById('best-time-val').innerText = 'None';
    }
    document.getElementById('best-kills-val').innerText = bestKills;

    const rockValElem = document.getElementById('start-rocks-val');
    if (rockValElem) {
        rockValElem.innerText = `${startingRocks}`;
    }

    fetchLeaderboard();
}

async function fetchLeaderboard() {
    const listElem = document.getElementById('leaderboard-list');
    if (!listElem) return;
    try {
        const q = query(collection(db, "leaderboard"), orderBy("time", "asc"), limit(5));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            listElem.innerHTML = `<p class="text-slate-500 italic">No scores posted yet. Be the first!</p>`;
            return;
        }

        let html = '';
        let rank = 1;
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const safeName = esc(String(data.name || 'Anonymous').slice(0, 40));
            const safeTime = Number.isFinite(data.time) && data.time >= 0 && data.time < 86400 ? formatTime(data.time) : '--:--';
            const safeSeed = normalizeSeed(data.seed) === null ? 'unknown' : String(data.seed);
            html += `<div class="flex justify-between items-center border-b border-slate-900 pb-1 text-xs gap-2">
                <span class="min-w-0">#${rank++} <strong class="text-slate-200">${safeName}</strong><small class="block text-slate-500 pl-5">Seed: <span class="font-mono text-sky-300">${safeSeed}</span></small></span>
                <span class="text-amber-400 font-mono shrink-0">${safeTime}</span>
            </div>`;
        });
        listElem.innerHTML = html;
    } catch (e) {
        console.error("Error fetching leaderboard:", e);
        listElem.innerHTML = `<p class="text-red-400">Failed to load leaderboard.</p>`;
    }
}

// One entry per player (doc id = uid). Only overwritten when the new time is faster.
async function submitScore() {
    if (!currentUser || gameState !== 'VICTORY' || !Number.isFinite(gameTime) || gameTime <= 0) return;

    const btn = document.getElementById('btn-submit-score');
    if (btn) {
        btn.disabled = true;
        btn.innerText = 'Submitting...';
    }

    try {
        const ref = doc(db, "leaderboard", currentUser.uid);
        const existing = await getDoc(ref);

        if (existing.exists() && typeof existing.data().time === 'number' && existing.data().time <= gameTime) {
            if (btn) {
                btn.innerText = 'You already have a faster time on the board';
                btn.className = 'w-full bg-slate-700 text-slate-300 text-xs font-bold px-4 py-2.5 rounded-xl cursor-not-allowed transition';
            }
            return;
        }

        await setDoc(ref, {
            uid: currentUser.uid,
            name: String(currentUser.displayName || 'Anonymous').slice(0, 40),
            time: gameTime,
            kills: guardKills,
            seed: activeSeed,
            timestamp: serverTimestamp()
        });

        if (btn) {
            btn.innerText = 'Score Posted! 🎉';
            btn.className = 'w-full bg-emerald-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl';
        }
        fetchLeaderboard();
    } catch (e) {
        console.error("Error saving score: ", e);
        if (btn) {
            btn.disabled = false;
            btn.innerText = 'Retry Submission';
        }
    }
}

function togglePause() {
    if (gameState === 'PLAYING') {
        gameState = 'PAUSED';
        document.getElementById('modal-pause').classList.remove('hidden');
    } else if (gameState === 'PAUSED') {
        gameState = 'PLAYING';
        document.getElementById('modal-pause').classList.add('hidden');
    }
}

function returnToMainMenu() {
    gameState = 'START';
    resetKeys();
    loadHighScores();

    document.getElementById('modal-pause')?.classList.add('hidden');
    document.getElementById('modal-gameover')?.classList.add('hidden');
    document.getElementById('modal-victory')?.classList.add('hidden');
    document.getElementById('modal-start')?.classList.remove('hidden');
}

function triggerGameOver() {
    gameState = 'GAMEOVER';
    document.getElementById('go-flag-status').innerText = flagCaptured ? 'Yes' : 'No';
    document.getElementById('go-kills').innerText = guardKills.toString();
    document.getElementById('go-time').innerText = formatTime(gameTime);
    document.getElementById('modal-gameover').classList.remove('hidden');
}

function triggerVictory() {
    gameState = 'VICTORY';

    const currentRocks = getStartingRocksForGame();
    const nextRocks = Math.max(3, currentRocks - 1);
    localStorage.setItem('shadow_castle_v3_rocks', nextRocks.toString());

    document.getElementById('vic-time').innerText = formatTime(gameTime);
    const vicSeed = document.getElementById('vic-seed'); if (vicSeed) vicSeed.innerText = String(activeSeed);
    document.getElementById('vic-kills').innerText = guardKills.toString();
    document.getElementById('vic-sword').innerText = swordEquipped ? 'Yes' : 'No';

    let rating = 'Ghost';
    if (guardKills > 5) rating = 'Shadow Assassin';
    else if (guardKills > 0) rating = 'Infiltrator';
    else if (gameTime > 120) rating = 'Patient Thief';
    document.getElementById('vic-rating').innerText = rating;

    const bestTime = localStorage.getItem('shadow_castle_v3_time');
    const badge = document.getElementById('new-high-score-badge');

    if (!bestTime || gameTime < parseFloat(bestTime)) {
        localStorage.setItem('shadow_castle_v3_time', gameTime.toString());
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }

    const currentKills = parseInt(localStorage.getItem('shadow_castle_v3_kills') || '0', 10);
    if (guardKills > currentKills) {
        localStorage.setItem('shadow_castle_v3_kills', guardKills.toString());
    }

    updateAuthUI(currentUser);

    document.getElementById('modal-victory').classList.remove('hidden');
}

function startGame() {
    const params = new URLSearchParams(window.location.search);
    const requestedSeed = params.has('seed') ? params.get('seed') : document.getElementById('seed-input')?.value;
    setRunSeed(normalizeSeed(requestedSeed) ?? createRandomSeed());
    detectDevice();
    if (isMobileDevice) {
        try { requestFullscreenMode(); } catch(e) {}
    }
    loadHighScores();
    initLevel();
    resetKeys();
    gameState = 'PLAYING';
    lastTime = 0;
    document.getElementById('modal-start').classList.add('hidden');
    document.getElementById('modal-pause').classList.add('hidden');
    document.getElementById('modal-gameover').classList.add('hidden');
    document.getElementById('modal-victory').classList.add('hidden');
}

// Event Listeners
document.getElementById('btn-start-game').addEventListener('click', startGame);
document.getElementById('btn-pause').addEventListener('click', togglePause);
document.getElementById('btn-resume').addEventListener('click', togglePause);
document.getElementById('btn-restart-pause').addEventListener('click', startGame);
document.getElementById('btn-restart-dead').addEventListener('click', startGame);
document.getElementById('btn-restart-victory').addEventListener('click', startGame);

document.getElementById('btn-menu-pause')?.addEventListener('click', returnToMainMenu);
document.getElementById('btn-menu-dead')?.addEventListener('click', returnToMainMenu);
document.getElementById('btn-menu-victory')?.addEventListener('click', returnToMainMenu);

document.getElementById('btn-google-login')?.addEventListener('click', handleGoogleLogin);
document.getElementById('btn-submit-score')?.addEventListener('click', submitScore);

document.getElementById('btn-copy-seed')?.addEventListener('click', async () => {
    const url = new URL(window.location.href);
    url.searchParams.set('seed', String(activeSeed));
    try {
        await navigator.clipboard.writeText(url.toString());
        const btn = document.getElementById('btn-copy-seed');
        if (btn) { btn.textContent = 'Seed link copied!'; setTimeout(() => btn.textContent = 'Copy seed link', 1600); }
    } catch (e) {
        window.prompt('Copy this seed link:', url.toString());
    }
});

window.onload = () => {
    const initialSeed = new URLSearchParams(window.location.search).get('seed');
    setRunSeed(normalizeSeed(initialSeed) ?? createRandomSeed());
    resizeCanvas();
    detectDevice();
    loadHighScores();
    initLevel();
    requestAnimationFrame(gameLoop);
};
