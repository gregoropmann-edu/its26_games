(function () {
  const API = "api";

  const screens = {
    landing: document.getElementById("screenLanding"),
    analysis: document.getElementById("screenAnalysis"),
    gate: document.getElementById("screenGate"),
    revealed: document.getElementById("screenRevealed"),
  };

  const btnStart = document.getElementById("btnStart");
  const btnReveal = document.getElementById("btnReveal");
  const btnAgain = document.getElementById("btnAgain");
  const overlayScan = document.getElementById("overlayScan");
  const scanCanvas = document.getElementById("scanCanvas");
  const scanReadout = document.getElementById("scanReadout");
  const progressFill = document.getElementById("progressFill");
  const progressPct = document.getElementById("progressPct");
  const logFeed = document.getElementById("logFeed");
  const analysisFootnote = document.getElementById("analysisFootnote");
  const revealName = document.getElementById("revealName");
  const revealBlast = document.getElementById("revealBlast");
  const sysTag = document.getElementById("sysTag");

  let clientId = localStorage.getItem("identity_ai_client_id");
  if (!clientId) {
    clientId = crypto.randomUUID?.() || "id-" + Math.random().toString(36).slice(2);
    try {
      localStorage.setItem("identity_ai_client_id", clientId);
    } catch (e) {}
  }

  let pollTimer = null;
  let heartbeatTimer = null;
  let scanRaf = 0;
  let scanOverlayTimer = null;
  let analysisTimer = null;
  let progress = 0;
  let serverReady = false;
  let serverRevealed = false;
  let runActive = false;
  let hasRevealed = false;
  let analysisDurationMs = 28000 + Math.random() * 12000;

  const scanMetrics = [
    "Aura sagedus: 420 MHz",
    "Digitaalne jalajälg: 7.3 kolmeetri list",
    "Kvantentroopia: stabiilne",
    "WiFi-isiksuse hash: 0xDEADBEEF",
    "NPC tõenäosus: arvutamisel…",
    "Kolmas silm: offline (hea)",
  ];

  const messagesEarly = [
    "Kalibreerin sinu isiksuse WiFi-signaali…",
    "Ühendun NASA serveritega…",
    "Leidsin 3 kahtlast mõtet…",
    "Võrdlen sinu aura kaarti klassi keskmisega…",
    "Skaneerin küpsiste filosoofilist tähendust…",
  ];

  const messagesMid = [
    "Kontrollin, kas oled NPC…",
    "Sa oled kuidagi tuttav…",
    "Analüüsin su Discordi olekut aastast 2019…",
    "Krüptograafiline aura: kompaktne, aga kahtlane",
    "Küsin luba sinu unenägudelt…",
    "Leidsin varjatud seose kasvataja serveriga…",
  ];

  const messagesLate = [
    "Hoiatus: isiksus liiga tõeline, võib olla inimene",
    "Üritan deaktiveerida sinu ironiat… ebaõnnestus",
    "Tuvastatud: 99% tõenäosus, et sa oled see, kelleks admin vajutab",
    "Laen alla täiendavaid pseudoteaduslikke teeke…",
    "Sinu nimi algab tähega… või numbriga… või väljamõeldisega",
    "Quantum™ ütleb: JAH",
    "Palun ära vaata ekraani taga olevat inimest",
    "ME TEAME. ( veel mitte, aga varsti )",
  ];

  function showScreen(name) {
    Object.keys(screens).forEach((key) => {
      screens[key].classList.toggle("is-active", key === name);
    });
  }

  async function apiGet(path) {
    const res = await fetch(`${API}/${path}?client_id=${encodeURIComponent(clientId)}`, {
      credentials: "same-origin",
    });
    if (!res.ok) throw new Error("api_error");
    return res.json();
  }

  async function apiPost(path, body) {
    const res = await fetch(`${API}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
    let data = {};
    try {
      data = await res.json();
    } catch (e) {}
    return { ok: res.ok, status: res.status, data };
  }

  function startPolling() {
    stopPolling();
    const tick = async () => {
      try {
        const data = await apiGet("state.php");

        if (!data.isActiveClient) return;

        if (data.ready || data.phase === "ready") serverReady = true;

        if (data.phase === "revealed" && data.displayName && !hasRevealed) {
          serverRevealed = true;
          finishReveal(data.displayName);
        }
      } catch (e) {}
    };
    tick();
    pollTimer = setInterval(tick, 800);
  }

  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  function startHeartbeat() {
    stopHeartbeat();
    const beat = () => {
      apiPost("heartbeat.php", { client_id: clientId }).catch(() => {});
    };
    beat();
    heartbeatTimer = setInterval(beat, 12000);
  }

  function stopHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  function randomFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function pickMessage(pct) {
    if (pct < 30) return randomFrom(messagesEarly);
    if (pct < 70) return randomFrom(messagesMid);
    return randomFrom(messagesLate);
  }

  function openResultGate() {
    showScreen("gate");
    btnReveal.disabled = false;
    stopAnalysisTimer();
  }

  function setProgress(pct) {
    let value = pct;
    if (!serverReady && value > 94) value = 94;
    if (serverReady && !serverRevealed && value > 97) value = 97;
    if (serverRevealed) value = 100;

    progress = value;
    progressFill.style.width = value + "%";
    progressPct.textContent = value.toFixed(value % 1 ? 1 : 0) + "%";

    logFeed.textContent = pickMessage(value);
    logFeed.classList.remove("is-silly", "is-chaos");
    if (value >= 50) logFeed.classList.add("is-silly");
    if (value >= 80) logFeed.classList.add("is-chaos");

    if (value >= 40) {
      analysisFootnote.textContent =
        "Mõttelugemismoodul: aktiivne* (* teaduslikult ebapiisav)";
    }
    if (value >= 85) {
      sysTag.textContent = "HYPERCOGNITION ENGAGED";
    }

    if (serverReady && value >= 97 && !serverRevealed) {
      openResultGate();
    }
  }

  function stopAnalysisTimer() {
    if (analysisTimer) clearInterval(analysisTimer);
    analysisTimer = null;
  }

  function startAnalysis() {
    showScreen("analysis");
    const start = performance.now();

    stopAnalysisTimer();
    analysisTimer = setInterval(() => {
      const elapsed = performance.now() - start;
      const t = Math.min(1, elapsed / analysisDurationMs);
      const eased = 1 - Math.pow(1 - t, 2.2);
      let pct = eased * 99;
      if (serverReady && pct > 97) pct = 97;
      setProgress(pct);
    }, 200);
  }

  function stopScanVisual() {
    if (scanRaf) cancelAnimationFrame(scanRaf);
    scanRaf = 0;
    if (scanOverlayTimer) clearTimeout(scanOverlayTimer);
    scanOverlayTimer = null;
    overlayScan.classList.remove("is-active");
  }

  function startScanVisual() {
    stopScanVisual();
    overlayScan.classList.add("is-active");
    const ctx = scanCanvas.getContext("2d");
    let metricIdx = 0;
    let metricTimer = 0;

    const draw = (t) => {
      const w = scanCanvas.width;
      const h = scanCanvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const r = w * 0.42;

      ctx.fillStyle = "rgba(3, 7, 18, 0.35)";
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = "rgba(34, 211, 238, 0.25)";
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      const sweep = (t * 0.002) % (Math.PI * 2);
      ctx.strokeStyle = "rgba(34, 211, 238, 0.85)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(sweep) * r, cy + Math.sin(sweep) * r);
      ctx.stroke();

      for (let i = 0; i < 4; i++) {
        const blink = 0.15 + 0.85 * Math.abs(Math.sin(t * 0.003 + i));
        ctx.strokeStyle = `rgba(34, 211, 238, ${blink * 0.35})`;
        ctx.beginPath();
        ctx.arc(cx, cy, r * (0.3 + i * 0.18), 0, Math.PI * 2);
        ctx.stroke();
      }

      if (t - metricTimer > 900) {
        metricTimer = t;
        scanReadout.textContent = scanMetrics[metricIdx % scanMetrics.length];
        metricIdx++;
      }

      scanRaf = requestAnimationFrame(draw);
    };

    scanRaf = requestAnimationFrame(draw);

    scanOverlayTimer = setTimeout(() => {
      stopScanVisual();
      startAnalysis();
    }, 4500);
  }

  function playRevealSound() {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(110, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(55, ac.currentTime + 0.4);
      gain.gain.setValueAtTime(0.15, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + 0.55);
    } catch (e) {}
  }

  function finishReveal(name) {
    if (hasRevealed) return;
    hasRevealed = true;
    runActive = false;

    stopPolling();
    stopHeartbeat();
    stopAnalysisTimer();
    stopScanVisual();

    document.body.classList.add("is-reveal");
    revealBlast.classList.add("is-on");
    setTimeout(() => revealBlast.classList.remove("is-on"), 600);
    playRevealSound();
    revealName.textContent = name;
    showScreen("revealed");
    btnReveal.disabled = true;
    if (btnAgain) btnAgain.disabled = false;
    if (btnStart) btnStart.disabled = false;
  }

  function resetForNewRun() {
    stopPolling();
    stopHeartbeat();
    stopAnalysisTimer();
    stopScanVisual();

    serverReady = false;
    serverRevealed = false;
    runActive = false;
    hasRevealed = false;
    progress = 0;
    analysisDurationMs = 28000 + Math.random() * 12000;

    document.body.classList.remove("is-reveal");
    if (sysTag) sysTag.textContent = "SÜSTEEM AKTIIVNE";
    progressFill.style.width = "0%";
    progressPct.textContent = "0%";
    logFeed.textContent = "Initsialiseerin kwantandmebaasi…";
    logFeed.classList.remove("is-silly", "is-chaos");
    if (analysisFootnote) analysisFootnote.textContent = "";
    btnReveal.disabled = true;
    btnReveal.textContent = "Paljasta minu identiteet";
  }

  async function beginDetection(disableBtn) {
    if (disableBtn) disableBtn.disabled = true;

    let res;
    try {
      res = await apiPost("start-scan.php", { client_id: clientId });
    } catch (e) {
      alert("Serveriga ei saa ühendust. Kas PHP server töötab?");
      if (disableBtn) disableBtn.disabled = false;
      return;
    }

    if (!res.ok) {
      const msg =
        res.status === 409
          ? res.data.message || "Teine skänn on juba käimas."
          : "Skänni ei saanud alustada.";
      alert(msg);
      if (disableBtn) disableBtn.disabled = false;
      return;
    }

    runActive = true;
    hasRevealed = false;
    startPolling();
    startHeartbeat();
    startScanVisual();
  }

  btnStart.addEventListener("click", () => beginDetection(btnStart));

  if (btnAgain) {
    btnAgain.addEventListener("click", () => {
      resetForNewRun();
      beginDetection(btnAgain);
    });
  }

  btnReveal.addEventListener("click", async () => {
    btnReveal.textContent = "Ootan süsteemi kinnitust…";
    try {
      const data = await apiGet("state.php");
      if (data.phase === "revealed" && data.displayName) {
        finishReveal(data.displayName);
      }
    } catch (e) {
      btnReveal.textContent = "Paljasta minu identiteet";
    }
  });
})();
