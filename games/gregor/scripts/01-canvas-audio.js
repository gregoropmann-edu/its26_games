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

