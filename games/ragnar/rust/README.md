DECKFIGHT — Cargo-01

FIXED BUILD
- Fixed the ReferenceError in buildStairs: the ship deck material is now passed into the staircase builder.
- This is a single-player browser prototype with training targets. Online multiplayer is not implemented yet.

HOW TO RUN (recommended)
1. Extract this folder.
2. Open a terminal / Command Prompt in this folder.
3. Run: python -m http.server 8000
4. Open: http://localhost:8000

If Python is unavailable, use VS Code's Live Server extension.

The game loads Three.js from jsDelivr, so an internet connection is required. Avoid opening index.html directly with a file:/// URL; serving it over localhost avoids browser file-origin restrictions.
Controls: WASD move, mouse look, Space jump, Shift sprint, click to fire. Click the game screen if mouse look is not locked.
