const PLAYERS = window.ITS126_PLAYERS;

const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function renderCards() {
  const grid = document.getElementById("card-grid");
  if (!grid || !Array.isArray(PLAYERS) || PLAYERS.length === 0) return;

  const frag = document.createDocumentFragment();

  PLAYERS.forEach((player, index) => {
    const { displayName, slug, tagline, accentHue } = player;
    const hue = typeof accentHue === "number" ? accentHue : 195;

    const a = document.createElement("a");
    a.className = "player-card";
    a.href = `games/${encodeURIComponent(slug)}/`;
    a.style.setProperty("--accent-hue", String(hue));
    a.style.setProperty("--stagger", String(index));
    a.setAttribute("role", "listitem");
    a.setAttribute("aria-label", `${displayName}: ava mäng`);

    a.innerHTML = `
      <span class="card-glare"></span>
      <div class="card-frame">
        <span class="corner-deco tl" aria-hidden="true"></span>
        <span class="corner-deco br" aria-hidden="true"></span>
        <div>
          <span class="card-tag">${escapeHtml(tagline ?? "")}</span>
          <div class="card-name">${escapeHtml(displayName)}</div>
        </div>
        <div>
          <span class="card-cta">Ava mäng <span aria-hidden="true">→</span></span>
          <div class="card-meta-bar">
            <span>/games/${escapeHtml(slug)}/</span>
            <span class="pulse-dot" aria-hidden="true"></span>
          </div>
        </div>
      </div>
    `;

    frag.appendChild(a);
  });

  grid.appendChild(frag);
}

function attachTilt() {
  if (prefersReducedMotion()) return;

  const cards = document.querySelectorAll(".player-card");
  const max = 11;

  cards.forEach((card) => {
    const onMove = (e) => {
      const rect = card.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / (rect.width / 2);
      const dy = (e.clientY - cy) / (rect.height / 2);
      const rx = (-dy * max).toFixed(2);
      const ry = (dx * max).toFixed(2);
      card.style.setProperty("--rx", `${rx}deg`);
      card.style.setProperty("--ry", `${ry}deg`);
    };

    const reset = () => {
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--ry", "0deg");
    };

    card.addEventListener("pointermove", onMove);
    card.addEventListener("pointerleave", reset);
  });
}

function initStarfield() {
  const canvas = document.getElementById("bg-canvas");
  if (!canvas || prefersReducedMotion()) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let stars = [];
  let raf = 0;
  let w = 0;
  let h = 0;
  let dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = Math.min(220, Math.floor((w * h) / 9000));
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.4 + 0.2,
      base: Math.random() * Math.PI * 2,
      speed: 0.4 + Math.random() * 1.2,
    }));
  }

  function tick(t) {
    ctx.clearRect(0, 0, w, h);
    const time = t * 0.001;
    for (const s of stars) {
      const tw = 0.35 + 0.65 * Math.sin(time * s.speed + s.base);
      ctx.beginPath();
      ctx.fillStyle = `rgba(200, 230, 255, ${0.12 + tw * 0.35})`;
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    raf = requestAnimationFrame(tick);
  }

  resize();
  window.addEventListener("resize", () => {
    resize();
  });

  raf = requestAnimationFrame(tick);
}

renderCards();
attachTilt();
initStarfield();
