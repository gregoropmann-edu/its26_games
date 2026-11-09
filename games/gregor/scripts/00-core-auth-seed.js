// Firebase SDK functions are supplied by the module bootstrap (game.js).
const {
    initializeApp, getFirestore, collection, doc, getDoc, setDoc,
    getDocs, query, orderBy, limit, serverTimestamp, getAnalytics,
    getAuth, signInWithPopup, signInWithRedirect, GoogleAuthProvider,
    onAuthStateChanged, signOut
} = window.__shadowCastleFirebase;


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
