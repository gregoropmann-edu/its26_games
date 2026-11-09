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

const bootGame = () => {
    const initialSeed = new URLSearchParams(window.location.search).get('seed');
    setRunSeed(normalizeSeed(initialSeed) ?? createRandomSeed());
    resizeCanvas();
    detectDevice();
    loadHighScores();
    initLevel();
    requestAnimationFrame(gameLoop);
};

if (document.readyState === 'complete') {
    bootGame();
} else {
    window.addEventListener('load', bootGame, { once: true });
}
