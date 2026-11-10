(function () {
  const API = "api";

  const adminStatus = document.getElementById("adminStatus");
  const scanHint = document.getElementById("scanHint");
  const pillGrid = document.getElementById("pillGrid");
  const btnReveal = document.getElementById("btnReveal");

  const players = Array.isArray(window.ITS126_PLAYERS) ? window.ITS126_PLAYERS : [];
  let selectedSlug = null;
  let pollTimer = null;

  async function adminGet(path) {
    const res = await fetch(`${API}/${path}`, { credentials: "same-origin" });
    return res.json();
  }

  async function adminPost(path, body) {
    const res = await fetch(`${API}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body || {}),
    });
    return { ok: res.ok, data: await res.json() };
  }

  function formatElapsed(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return (m > 0 ? m + " min " : "") + s + " s";
  }

  function phaseLabel(phase) {
    const map = {
      idle: "Ootel",
      scanning: "Skännib",
      ready: "Valik tehtud",
      revealed: "Paljastatud",
    };
    return map[phase] || phase;
  }

  function renderPills(state) {
    const canPick =
      state.clientAlive && (state.phase === "scanning" || state.phase === "ready");
    const chosen = state.chosenSlug;

    if (selectedSlug && chosen && selectedSlug !== chosen) {
      selectedSlug = chosen;
    }
    if (chosen) selectedSlug = chosen;

    pillGrid.innerHTML = "";
    players.forEach((p) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pill";
      btn.textContent = p.displayName;
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-selected", p.slug === selectedSlug ? "true" : "false");
      if (p.slug === selectedSlug) btn.classList.add("is-selected");
      btn.disabled = !canPick;
      btn.addEventListener("click", () => selectPlayer(p));
      pillGrid.appendChild(btn);
    });
  }

  async function selectPlayer(player) {
    selectedSlug = player.slug;
    const res = await adminPost("admin-select.php", {
      slug: player.slug,
      displayName: player.displayName,
    });
    if (res.ok) applyState(res.data);
  }

  function applyState(state) {
    const phase = state.phase || "idle";
    const alive = !!state.clientAlive;
    const elapsed = state.elapsedSeconds || 0;

    adminStatus.textContent =
      phaseLabel(phase) +
      (alive ? " · aktiivne klient" : "") +
      (elapsed > 0 && phase !== "idle" ? " · " + formatElapsed(elapsed) : "");

    if (phase === "idle" || (!alive && phase !== "revealed")) {
      scanHint.textContent =
        "Oota, kuni keegi vajutab „Alusta tuvastamist“ mängija lehel.";
    } else if (phase === "scanning") {
      scanHint.textContent = "Keegi on skännis — vali õige nimi.";
    } else if (phase === "ready") {
      scanHint.textContent =
        "Valitud: " +
        (state.chosenDisplayName || "?") +
        ". Vajuta „Paljasta mängijale“, kui oled valmis.";
    } else if (phase === "revealed") {
      scanHint.textContent =
        "Paljastatud: " +
        (state.chosenDisplayName || "?") +
        ". Järgmine võib alustada uut skänni.";
    }

    const canReveal =
      alive &&
      (phase === "ready" || phase === "scanning") &&
      state.chosenDisplayName &&
      state.chosenSlug;
    btnReveal.disabled = !canReveal || phase === "revealed";

    if (phase === "scanning" && !state.chosenSlug) {
      selectedSlug = null;
    }

    renderPills(state);
  }

  async function poll() {
    try {
      const data = await adminGet("admin-state.php");
      applyState(data);
    } catch (e) {
      adminStatus.textContent = "API viga (kas PHP server töötab?)";
    }
  }

  btnReveal.addEventListener("click", async () => {
    btnReveal.disabled = true;
    const res = await adminPost("admin-reveal.php");
    if (res.ok) applyState(res.data);
    else btnReveal.disabled = false;
  });

  poll();
  pollTimer = setInterval(poll, 500);
})();
