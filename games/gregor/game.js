import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getFirestore, collection, doc, getDoc, setDoc, getDocs,
    query, orderBy, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import {
    getAuth, signInWithPopup, signInWithRedirect, GoogleAuthProvider,
    onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

window.__shadowCastleFirebase = {
    initializeApp, getFirestore, collection, doc, getDoc, setDoc, getDocs,
    query, orderBy, limit, serverTimestamp, getAnalytics, getAuth,
    signInWithPopup, signInWithRedirect, GoogleAuthProvider,
    onAuthStateChanged, signOut
};

const gameScripts = [
    "./scripts/00-core-auth-seed.js",
    "./scripts/01-canvas-audio.js",
    "./scripts/02-maze-generation.js",
    "./scripts/03-player.js",
    "./scripts/04-guard-ai.js",
    "./scripts/05-level-render-minigames.js",
    "./scripts/06-controls-game-loop.js",
    "./scripts/07-leaderboard-menus.js"
];

async function loadGameScriptsInOrder() {
    for (const path of gameScripts) {
        await new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = new URL(path, import.meta.url).href;
            script.async = false;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`Could not load ${path}`));
            document.head.appendChild(script);
        });
    }
}

loadGameScriptsInOrder().catch(error => {
    console.error("Shadow Castle failed to load:", error);
    const message = document.createElement("p");
    message.textContent = "The game could not load. Please refresh and try again.";
    message.style.cssText = "color:#fecaca;padding:1rem;text-align:center";
    document.body.appendChild(message);
});
