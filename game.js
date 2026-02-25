// ---------- ICON SYSTEM (einfach austauschbar) ----------
function renderIcon(iconDef, extraClass = "") {
  if (iconDef.type === "img") {
    return `<span class="icon ${extraClass}"><img src="${iconDef.value}" alt=""></span>`;
  }
  return `<span class="icon ${extraClass}">${iconDef.value}</span>`;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

document.addEventListener("DOMContentLoaded", () => {
  // ---------- Spielzustand ----------
  let cookies = 0;
  let cookiesPerClick = 1; // CPC
  let totalCps = 0;        // CPS

  // Cursor = Klick-Upgrade, keine CPS
  const upgradeDefinitions = [
    { id: "cursor",   name: "Cursor",        icon: { type: "emoji", value: "🖱️" }, baseCost: 15,      baseCpc: 1, baseCps: 0 },
    { id: "grandma",  name: "Oma",           icon: { type: "emoji", value: "👵" }, baseCost: 100,     baseCps: 1,      requires: "cursor" },
    { id: "farm",     name: "Farm",          icon: { type: "emoji", value: "🌾" }, baseCost: 1100,    baseCps: 8,      requires: "grandma" },
    { id: "mine",     name: "Mine",          icon: { type: "emoji", value: "⛏️" }, baseCost: 12000,   baseCps: 47,     requires: "farm" },
    { id: "factory",  name: "Fabrik",        icon: { type: "emoji", value: "🏭" }, baseCost: 130000,  baseCps: 260,    requires: "mine" },
    { id: "bank",     name: "Bank",          icon: { type: "emoji", value: "🏦" }, baseCost: 1400000, baseCps: 1400,   requires: "factory" },
    { id: "temple",   name: "Tempel",        icon: { type: "emoji", value: "⛪" }, baseCost: 20000000,baseCps: 7800,   requires: "bank" },
    { id: "wizard",   name: "Zauberturm",    icon: { type: "emoji", value: "🧙‍♂️" }, baseCost: 330000000, baseCps: 44000,  requires: "temple" },
    { id: "shipment", name: "Raumschiff",    icon: { type: "emoji", value: "🚀" }, baseCost: 5100000000, baseCps: 260000, requires: "wizard" },
    { id: "alchemy",  name: "Alchemielabor", icon: { type: "emoji", value: "⚗️" }, baseCost: 75000000000, baseCps: 1600000, requires: "shipment" }
  ];

  const upgradesState = {};
  upgradeDefinitions.forEach(u => upgradesState[u.id] = { count: 0 });

  // ---------- DOM ----------
  const cookieCountEl = document.getElementById("cookieCount");
  const cpsValueEl = document.getElementById("cpsValue");
  const cpcValueEl = document.getElementById("cpcValue");
  const bigCookieEl = document.getElementById("bigCookie");
  const upgradesGridEl = document.getElementById("upgradesGrid");
  const totalProductionTextEl = document.getElementById("totalProductionText");
  const totalUpgradesTextEl = document.getElementById("totalUpgradesText");
  const scatterFieldEl = document.getElementById("scatterField");

  // ---------- Helpers ----------
  function getUpgradeCost(def) {
    const count = upgradesState[def.id].count;
    return Math.floor(def.baseCost * Math.pow(1.15, count));
  }

  function isUpgradeUnlocked(def) {
    if (!def.requires) return true;
    return upgradesState[def.requires].count > 0;
  }

  // Beim Kauf: Icon zufällig platzieren (robust)
  function addScatterToken(def) {
    if (!scatterFieldEl) {
      console.warn("scatterFieldEl fehlt! Prüfe id='scatterField' in index.html");
      return;
    }

    const token = document.createElement("div");
    token.className = "scatter-token pop-in";
    token.innerHTML = renderIcon(def.icon);

    scatterFieldEl.appendChild(token);

    // Position erst nach dem Einfügen berechnen
    requestAnimationFrame(() => {
      const tokenSize = token.offsetWidth || 34;
      const rect = scatterFieldEl.getBoundingClientRect();

      const w = Math.max(rect.width, 200);
      const h = Math.max(rect.height, 200);

      const pad = 6;
      const maxX = Math.max(pad, w - tokenSize - pad);
      const maxY = Math.max(pad, h - tokenSize - pad);

      const x = clamp(pad + Math.random() * (maxX - pad), pad, maxX);
      const y = clamp(pad + Math.random() * (maxY - pad), pad, maxY);

      token.style.left = `${x}px`;
      token.style.top  = `${y}px`;
    });

    token.addEventListener("animationend", () => {
      token.classList.remove("pop-in");
    }, { once: true });
  }

  // ---------- UI Aufbau ----------
  function createUpgradeButtons() {
    upgradesGridEl.innerHTML = "";

    for (const def of upgradeDefinitions) {
      const btn = document.createElement("button");
      btn.className = "upgrade-btn";
      btn.dataset.upgradeId = def.id;

      const metaText = def.baseCpc
        ? `+${def.baseCpc} Cookie/Klick`
        : `+${def.baseCps} Cookies/Sek.`;

      btn.innerHTML = `
        <div class="upgrade-header">
          <div class="upgrade-name">
            ${renderIcon(def.icon)}
            <span>${def.name}</span>
          </div>
          <span class="upgrade-count" id="upgradeCount-${def.id}">x0</span>
        </div>
        <div class="upgrade-body">
          <span class="upgrade-cost" id="upgradeCost-${def.id}">Kosten: 0</span>
          <span class="upgrade-meta">${metaText}</span>
        </div>
        <div class="locked-label" id="lockedLabel-${def.id}" style="display:none;">Gesperrt</div>
      `;

      btn.addEventListener("click", () => buyUpgrade(def.id));
      upgradesGridEl.appendChild(btn);
    }
  }

  // ---------- Produktion berechnen ----------
  function updateProduction() {
    let cps = 0;
    let cpc = 1; // Basis
    let totalUpgrades = 0;

    for (const def of upgradeDefinitions) {
      const count = upgradesState[def.id].count;

      if (typeof def.baseCps === "number") cps += def.baseCps * count;
      if (typeof def.baseCpc === "number") cpc += def.baseCpc * count;

      totalUpgrades += count;
    }

    totalCps = cps;
    cookiesPerClick = cpc;

    totalUpgradesTextEl.textContent = totalUpgrades.toLocaleString("de-DE");
  }

  // ---------- UI aktualisieren ----------
  function updateUI() {
    cookieCountEl.textContent = cookies.toLocaleString("de-DE", { maximumFractionDigits: 2 });
    cpsValueEl.textContent = totalCps.toLocaleString("de-DE", { maximumFractionDigits: 2 });
    cpcValueEl.textContent = cookiesPerClick.toLocaleString("de-DE", { maximumFractionDigits: 0 });

    totalProductionTextEl.textContent =
      `${totalCps.toLocaleString("de-DE", { maximumFractionDigits: 2 })} Cookies/Sekunde`;

    for (const def of upgradeDefinitions) {
      const count = upgradesState[def.id].count;
      const cost = getUpgradeCost(def);
      const unlocked = isUpgradeUnlocked(def);

      const btn = upgradesGridEl.querySelector(`.upgrade-btn[data-upgrade-id="${def.id}"]`);
      const countEl = document.getElementById(`upgradeCount-${def.id}`);
      const costEl = document.getElementById(`upgradeCost-${def.id}`);
      const lockedLabelEl = document.getElementById(`lockedLabel-${def.id}`);

      if (countEl) countEl.textContent = `x${count}`;
      if (costEl) costEl.textContent = `Kosten: ${cost.toLocaleString("de-DE")} Cookies`;

      if (btn) {
        if (!unlocked) {
          btn.classList.add("locked");
          btn.disabled = true;
          if (lockedLabelEl) lockedLabelEl.style.display = "block";
        } else {
          btn.classList.remove("locked");
          if (lockedLabelEl) lockedLabelEl.style.display = "none";
          btn.disabled = cookies < cost;
        }
      }
    }
  }

  // ---------- Kaufen ----------
  function buyUpgrade(id) {
    const def = upgradeDefinitions.find(u => u.id === id);
    if (!def) return;
    if (!isUpgradeUnlocked(def)) return;

    const cost = getUpgradeCost(def);
    if (cookies < cost) return;

    cookies -= cost;
    upgradesState[id].count += 1;

    addScatterToken(def);

    updateProduction();
    updateUI();
  }

  // ---------- Klick ----------
  function clickCookie() {
    cookies += cookiesPerClick;
    updateUI();
  }

  bigCookieEl.addEventListener("click", clickCookie);
  bigCookieEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      clickCookie();
    }
  });

  // ✅ Passive Produktion — NICHT runden!
  const TICK_RATE = 20;
  setInterval(() => {
    cookies += Number(totalCps) / TICK_RATE;
    updateUI();
  }, 1000 / TICK_RATE);

// Speichert den aktuellen Stand im LocalStorage
function saveGame() {
  const gameState = {
    cookies: cookies,
    upgrades: upgradesState,
    timestamp: Date.now()
  };
  localStorage.setItem("cookieClickerSave", JSON.stringify(gameState));
}

// Lädt den Stand und stellt die Variablen wieder her
function loadGame() {
  const savedData = localStorage.getItem("cookieClickerSave");
  if (!savedData) return;

  const gameState = JSON.parse(savedData);
  cookies = gameState.cookies || 0;

  // Upgrades im State wiederherstellen
  if (gameState.upgrades) {
    for (const id in gameState.upgrades) {
      if (upgradesState[id]) {
        upgradesState[id].count = gameState.upgrades[id].count;
      }
    }
  }
}

  // ---------- Init ----------
  function init() {
  if (scatterFieldEl) scatterFieldEl.innerHTML = "";
  createUpgradeButtons();
  
  // 1. Spielstand laden
  loadGame(); 
  
  // 2. Icons für geladene Upgrades wiederherstellen
  for (const id in upgradesState) {
    const count = upgradesState[id].count;
    const def = upgradeDefinitions.find(u => u.id === id);
    for (let i = 0; i < count; i++) {
      addScatterToken(def); // Platziert die Icons wieder auf dem Feld
    }
  }

  // 3. UI und Produktion basierend auf geladenen Daten aktualisieren
  updateProduction();
  updateUI();

  // 4. Auto-Save Intervall starten (alle 30 Sek.)
  setInterval(saveGame, 30000);
}

  init();
  window.addEventListener("beforeunload", saveGame);
});

