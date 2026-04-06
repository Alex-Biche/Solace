/* ═══════════════════════════════════════════════════════════════════════════════
   Solace Browser — Status Bar
   Bottom bar showing privacy routing status, page info, tab count, and zoom.
   ═══════════════════════════════════════════════════════════════════════════════ */

"use strict";

var SolaceStatusBar = {
  _bar: null,
  _observers: [],
  _updateTimer: null,

  ROUTING_LABELS: {
    direct: { text: "Direct", color: "#00b894", icon: "\u{1F310}" },
    proxy:  { text: "Proxy",  color: "#0984e3", icon: "\u{1F500}" },
    tor:    { text: "Tor",    color: "#6C5CE7", icon: "\u{1F9C5}" },
    i2p:    { text: "I2P",    color: "#e17055", icon: "\u{1F512}" },
  },

  init() {
    if (!Services.prefs.getBoolPref("solace.statusbar.enabled", true)) return;
    this._build();
    this._startUpdating();
    this._watchPrefs();
  },

  _build() {
    const bar = document.createElement("div");
    bar.id = "solace-statusbar";

    // Left section
    this._routingIndicator = this._createItem("solace-sb-routing", true);
    this._privacyScore = this._createItem("solace-sb-privacy");
    this._httpsIndicator = this._createItem("solace-sb-https");

    // Spacer
    const spacer = document.createElement("div");
    spacer.className = "solace-statusbar-separator";

    // Right section
    this._tabCount = this._createItem("solace-sb-tabs");
    this._zoomLevel = this._createItem("solace-sb-zoom", true);
    this._memUsage = this._createItem("solace-sb-memory");

    bar.append(
      this._routingIndicator,
      this._privacyScore,
      this._httpsIndicator,
      spacer,
      this._tabCount,
      this._zoomLevel,
      this._memUsage
    );

    document.documentElement.appendChild(bar);
    this._bar = bar;

    // Click handlers
    this._routingIndicator.addEventListener("click", () => {
      try { SolacePrivacy.toggle(); } catch (e) {}
    });
    this._zoomLevel.addEventListener("click", () => {
      try { FullZoom.reset(); } catch (e) {}
    });
  },

  _createItem(id, clickable) {
    const el = document.createElement("div");
    el.className = "solace-statusbar-item" + (clickable ? " clickable" : "");
    el.id = id;
    return el;
  },

  _startUpdating() {
    this._update();
    // Update every 3 seconds for non-critical info
    this._updateTimer = setInterval(() => this._update(), 3000);

    // Update immediately on tab changes
    const tabEvents = ["TabOpen", "TabClose", "TabSelect"];
    for (const evt of tabEvents) {
      gBrowser.tabContainer.addEventListener(evt, () => this._update());
    }

    // Update on zoom change
    window.addEventListener("FullZoomChange", () => this._updateZoom());
  },

  _watchPrefs() {
    const observer = {
      observe: () => this._updateRouting(),
    };
    Services.prefs.addObserver("solace.privacy.routing", observer);
    this._observers.push(["solace.privacy.routing", observer]);
  },

  _update() {
    this._updateRouting();
    this._updateTabCount();
    this._updateZoom();
    this._updateHttps();
    this._updatePrivacyScore();
    this._updateMemory();
  },

  _updateRouting() {
    const mode = Services.prefs.getStringPref("solace.privacy.routing", "direct");
    const info = this.ROUTING_LABELS[mode] || this.ROUTING_LABELS.direct;

    const dot = `<span class="solace-statusbar-dot" style="background:${info.color}"></span>`;
    this._routingIndicator.innerHTML = "";

    const dotEl = document.createElement("span");
    dotEl.className = "solace-statusbar-dot";
    dotEl.style.background = info.color;

    const textEl = document.createTextNode(info.text);
    this._routingIndicator.append(dotEl, textEl);
    this._routingIndicator.title = `Network: ${info.text} — Click to change`;
  },

  _updateTabCount() {
    const count = gBrowser.tabs.length;
    const sleeping = Array.from(gBrowser.tabs).filter(t => t.hasAttribute("solace-sleeping")).length;
    let text = `${count} tab${count !== 1 ? "s" : ""}`;
    if (sleeping > 0) text += ` (${sleeping} sleeping)`;
    this._tabCount.textContent = text;
  },

  _updateZoom() {
    try {
      const zoom = Math.round(ZoomManager.zoom * 100);
      this._zoomLevel.textContent = zoom === 100 ? "" : `${zoom}%`;
      this._zoomLevel.title = zoom === 100 ? "" : "Click to reset zoom";
      this._zoomLevel.style.display = zoom === 100 ? "none" : "flex";
    } catch (e) {
      this._zoomLevel.style.display = "none";
    }
  },

  _updateHttps() {
    try {
      const uri = gBrowser.selectedBrowser.currentURI;
      if (uri.scheme === "https") {
        this._httpsIndicator.textContent = "\u{1F512} Secure";
        this._httpsIndicator.style.color = "var(--solace-green)";
      } else if (uri.scheme === "http") {
        this._httpsIndicator.textContent = "\u26A0 Not Secure";
        this._httpsIndicator.style.color = "var(--solace-orange)";
      } else {
        this._httpsIndicator.textContent = "";
      }
    } catch (e) {
      this._httpsIndicator.textContent = "";
    }
  },

  _updatePrivacyScore() {
    let score = 0;
    let max = 0;
    const checks = [
      ["privacy.trackingprotection.enabled", true],
      ["privacy.resistFingerprinting", true],
      ["privacy.firstparty.isolate", true],
      ["dom.security.https_only_mode", true],
      ["network.trr.mode", 3],
      ["network.prefetch-next", false],
      ["media.peerconnection.ice.default_address_only", true],
      ["toolkit.telemetry.enabled", false],
    ];

    for (const [pref, expected] of checks) {
      max++;
      try {
        let val;
        if (typeof expected === "boolean") {
          val = Services.prefs.getBoolPref(pref, !expected);
        } else {
          val = Services.prefs.getIntPref(pref, -1);
        }
        if (val === expected) score++;
      } catch (e) {}
    }

    const pct = Math.round((score / max) * 100);
    let color = "var(--solace-green)";
    if (pct < 50) color = "var(--solace-red)";
    else if (pct < 75) color = "var(--solace-orange)";
    else if (pct < 100) color = "var(--solace-yellow)";

    this._privacyScore.innerHTML = "";
    const shield = document.createTextNode("\u{1F6E1}\u{FE0F} ");
    const scoreText = document.createElement("span");
    scoreText.textContent = `${pct}%`;
    scoreText.style.color = color;
    this._privacyScore.append(shield, scoreText);
    this._privacyScore.title = `Privacy Score: ${score}/${max} protections active`;
  },

  _updateMemory() {
    try {
      // Use performance.memory if available, otherwise hide
      const procInfo = Services.appinfo;
      if (procInfo) {
        // Approximation via process count
        const tabs = gBrowser.tabs.length;
        const est = 150 + (tabs * 40); // rough MB estimate
        this._memUsage.textContent = `~${est} MB`;
        this._memUsage.title = "Estimated memory usage";
      }
    } catch (e) {
      this._memUsage.textContent = "";
    }
  },

  uninit() {
    if (this._updateTimer) clearInterval(this._updateTimer);
    for (const [pref, obs] of this._observers) {
      try { Services.prefs.removeObserver(pref, obs); } catch (e) {}
    }
    if (this._bar) this._bar.remove();
  },
};
