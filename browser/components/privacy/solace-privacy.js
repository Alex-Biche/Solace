/* ═══════════════════════════════════════════════════════════════════════════════
   Solace Browser — Privacy & Network Routing Panel
   Comprehensive privacy controls + VPN/Proxy/Tor/I2P routing toggle
   ═══════════════════════════════════════════════════════════════════════════════ */

"use strict";

var SolacePrivacy = {
  _panel: null,
  _visible: false,
  _currentRouting: "direct", // "direct", "proxy", "tor", "i2p"

  ROUTING_MODES: {
    direct: {
      label: "Direct",
      icon: "🌐",
      desc: "No proxy — standard connection",
      color: "#00b894",
    },
    proxy: {
      label: "Proxy",
      icon: "🔀",
      desc: "Route through SOCKS5 or HTTP proxy",
      color: "#0984e3",
    },
    tor: {
      label: "Tor",
      icon: "🧅",
      desc: "Route through the Tor network (requires Tor running)",
      color: "#6C5CE7",
    },
    i2p: {
      label: "I2P",
      icon: "🔒",
      desc: "Route through I2P network (requires I2P running)",
      color: "#e17055",
    },
  },

  // All privacy toggles with their associated preferences
  PRIVACY_TOGGLES: [
    // Tracking protection
    { id: "tracking-protection", label: "Enhanced Tracking Protection", category: "Tracking",
      pref: "privacy.trackingprotection.enabled", type: "bool", default: true,
      desc: "Block known trackers, cryptominers, and fingerprinters" },
    { id: "social-tracking", label: "Social Media Tracker Blocking", category: "Tracking",
      pref: "privacy.trackingprotection.socialtracking.enabled", type: "bool", default: true,
      desc: "Block social media tracking widgets" },
    { id: "cryptomining", label: "Cryptominer Blocking", category: "Tracking",
      pref: "privacy.trackingprotection.cryptomining.enabled", type: "bool", default: true,
      desc: "Block in-browser cryptocurrency miners" },
    { id: "fingerprint-block", label: "Known Fingerprinter Blocking", category: "Tracking",
      pref: "privacy.trackingprotection.fingerprinting.enabled", type: "bool", default: true,
      desc: "Block known fingerprinting scripts" },

    // Fingerprinting
    { id: "resist-fingerprinting", label: "Fingerprint Resistance", category: "Fingerprinting",
      pref: "privacy.resistFingerprinting", type: "bool", default: true,
      desc: "Randomize browser fingerprint and reduce uniqueness" },
    { id: "rfp-randomization", label: "Fingerprint Randomization", category: "Fingerprinting",
      pref: "privacy.resistFingerprinting.randomization", type: "bool", default: true,
      desc: "Randomize canvas, WebGL, and audio fingerprints per-session" },
    { id: "rfp-letterboxing", label: "Letterboxing", category: "Fingerprinting",
      pref: "privacy.resistFingerprinting.letterboxing", type: "bool", default: false,
      desc: "Add padding to window to prevent size-based fingerprinting" },
    { id: "webgl-disable", label: "Disable WebGL", category: "Fingerprinting",
      pref: "webgl.disabled", type: "bool", default: false,
      desc: "Block WebGL entirely (breaks some sites, prevents GPU fingerprinting)" },

    // Cookies & Storage
    { id: "first-party-isolation", label: "First-Party Isolation", category: "Cookies & Storage",
      pref: "privacy.firstparty.isolate", type: "bool", default: true,
      desc: "Isolate cookies and storage to the first-party domain" },
    { id: "cookie-behavior", label: "Block Third-Party Cookies", category: "Cookies & Storage",
      pref: "network.cookie.cookieBehavior", type: "int", default: 5, trueVal: 5, falseVal: 0,
      desc: "Reject cookies from third-party domains" },
    { id: "cookie-lifetime", label: "Session-Only Cookies", category: "Cookies & Storage",
      pref: "network.cookie.lifetimePolicy", type: "int", default: 0, trueVal: 2, falseVal: 0,
      desc: "Delete all cookies when browser closes" },
    { id: "dom-storage-isolate", label: "Isolate DOM Storage", category: "Cookies & Storage",
      pref: "dom.storage.next_gen", type: "bool", default: true,
      desc: "Use next-gen storage partitioning for better isolation" },

    // Network
    { id: "https-only", label: "HTTPS-Only Mode", category: "Network",
      pref: "dom.security.https_only_mode", type: "bool", default: true,
      desc: "Refuse all HTTP connections — force HTTPS everywhere" },
    { id: "doh", label: "DNS over HTTPS", category: "Network",
      pref: "network.trr.mode", type: "int", default: 3, trueVal: 3, falseVal: 0,
      desc: "Encrypt DNS queries to prevent snooping" },
    { id: "disable-prefetch", label: "Disable Prefetching", category: "Network",
      pref: "network.prefetch-next", type: "bool", default: false, invert: true,
      desc: "Don't prefetch linked pages (prevents DNS leaks)" },
    { id: "dns-prefetch", label: "Disable DNS Prefetching", category: "Network",
      pref: "network.dns.disablePrefetch", type: "bool", default: true,
      desc: "Don't resolve DNS for links on the page" },
    { id: "speculative-connections", label: "Disable Speculative Connections", category: "Network",
      pref: "network.http.speculative-parallel-limit", type: "int", default: 0, trueVal: 0, falseVal: 6,
      desc: "Don't open connections before you click" },
    { id: "socks-dns", label: "Proxy DNS Queries", category: "Network",
      pref: "network.proxy.socks_remote_dns", type: "bool", default: true,
      desc: "Route DNS through proxy to prevent leaks" },
    { id: "disable-webrtc-leak", label: "WebRTC Leak Protection", category: "Network",
      pref: "media.peerconnection.ice.default_address_only", type: "bool", default: true,
      desc: "Prevent WebRTC from leaking your real IP" },
    { id: "disable-webrtc-host", label: "Hide Local IP from WebRTC", category: "Network",
      pref: "media.peerconnection.ice.no_host", type: "bool", default: true,
      desc: "Don't expose local network addresses via WebRTC" },

    // Telemetry (all should be off)
    { id: "telemetry", label: "Block All Telemetry", category: "Telemetry",
      pref: "toolkit.telemetry.enabled", type: "bool", default: false, invert: true,
      desc: "Prevent any telemetry data from being collected" },
    { id: "health-report", label: "Block Health Reports", category: "Telemetry",
      pref: "datareporting.healthreport.uploadEnabled", type: "bool", default: false, invert: true,
      desc: "Don't send browser health data" },
    { id: "normandy", label: "Block Remote Experiments", category: "Telemetry",
      pref: "app.normandy.enabled", type: "bool", default: false, invert: true,
      desc: "Prevent Mozilla from remotely modifying browser behavior" },
    { id: "safe-browsing-remote", label: "Block Remote Safe Browsing", category: "Telemetry",
      pref: "browser.safebrowsing.downloads.remote.enabled", type: "bool", default: false, invert: true,
      desc: "Don't send download hashes to Google" },

    // Advanced
    { id: "referrer-policy", label: "Strict Referrer Policy", category: "Advanced",
      pref: "network.http.referer.XOriginPolicy", type: "int", default: 2, trueVal: 2, falseVal: 0,
      desc: "Only send referrer to same-origin requests" },
    { id: "referrer-trimming", label: "Trim Referrer", category: "Advanced",
      pref: "network.http.referer.XOriginTrimmingPolicy", type: "int", default: 2, trueVal: 2, falseVal: 0,
      desc: "Strip path from referrer for cross-origin requests" },
    { id: "beacon", label: "Disable Beacon API", category: "Advanced",
      pref: "beacon.enabled", type: "bool", default: false, invert: true,
      desc: "Block analytics beacons sent when you leave a page" },
    { id: "battery-api", label: "Disable Battery API", category: "Advanced",
      pref: "dom.battery.enabled", type: "bool", default: false, invert: true,
      desc: "Prevent sites from reading battery status (fingerprinting)" },
    { id: "gamepad-api", label: "Disable Gamepad API", category: "Advanced",
      pref: "dom.gamepad.enabled", type: "bool", default: false, invert: true,
      desc: "Prevent gamepad-based fingerprinting" },
    { id: "media-devices", label: "Restrict Media Devices", category: "Advanced",
      pref: "media.navigator.enabled", type: "bool", default: false, invert: true,
      desc: "Don't enumerate camera/microphone devices" },
  ],

  init() {
    this._loadRoutingMode();
  },

  toggle() {
    if (this._visible) this.hide();
    else this.show();
  },

  show() {
    if (!this._panel) this._buildPanel();
    this._visible = true;
    this._panel.style.display = "flex";
    this._renderPanel();
  },

  hide() {
    if (!this._panel) return;
    this._visible = false;
    this._panel.style.display = "none";
  },

  _buildPanel() {
    const panel = document.createElement("div");
    panel.id = "solace-privacy-panel";
    panel.style.cssText = `
      position:fixed; right:0; top:0; bottom:0; width:420px;
      background:var(--solace-glass-bg);
      backdrop-filter:blur(20px) saturate(var(--solace-glass-saturate));
      -webkit-backdrop-filter:blur(20px) saturate(var(--solace-glass-saturate));
      border-left:1px solid var(--solace-glass-border);
      z-index:var(--solace-z-panel);
      display:none; flex-direction:column;
      font-family:var(--solace-font-family);
      box-shadow:var(--solace-shadow-lg);
    `;

    // Header
    const header = document.createElement("div");
    header.style.cssText = `
      display:flex; align-items:center; padding:14px 18px;
      border-bottom:1px solid var(--solace-border); flex-shrink:0;
    `;
    const titleEl = document.createElement("span");
    titleEl.textContent = "Privacy & Network";
    titleEl.style.cssText = "font-size:15px; font-weight:600; color:var(--solace-text-primary); flex:1;";
    const closeBtn = document.createElement("div");
    closeBtn.textContent = "\u2715";
    closeBtn.style.cssText = "cursor:pointer; padding:4px 8px; border-radius:6px; color:var(--solace-text-secondary); font-size:14px;";
    closeBtn.addEventListener("click", () => this.hide());
    header.append(titleEl, closeBtn);

    // Body
    const body = document.createElement("div");
    body.id = "solace-privacy-body";
    body.style.cssText = "flex:1; overflow-y:auto; padding:16px 18px;";

    panel.append(header, body);
    document.documentElement.appendChild(panel);
    this._panel = panel;
  },

  _renderPanel() {
    const body = this._panel.querySelector("#solace-privacy-body");
    while (body.firstChild) body.firstChild.remove();

    // ── Network Routing Section ──────────────────────────────────
    const routingHeader = document.createElement("div");
    routingHeader.textContent = "Network Routing";
    routingHeader.style.cssText = `
      font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:0.8px;
      color:var(--solace-text-tertiary); margin-bottom:10px;
    `;
    body.appendChild(routingHeader);

    const routingGrid = document.createElement("div");
    routingGrid.style.cssText = "display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:20px;";

    for (const [mode, info] of Object.entries(this.ROUTING_MODES)) {
      const card = document.createElement("div");
      const isActive = this._currentRouting === mode;
      card.style.cssText = `
        padding:14px; border-radius:12px; cursor:pointer;
        border:1px solid ${isActive ? info.color + "80" : "var(--solace-border)"};
        background:${isActive ? info.color + "15" : "var(--solace-bg-secondary)"};
        transition:all 150ms; text-align:center;
      `;

      const icon = document.createElement("div");
      icon.textContent = info.icon;
      icon.style.cssText = "font-size:24px; margin-bottom:6px;";

      const label = document.createElement("div");
      label.textContent = info.label;
      label.style.cssText = `font-size:13px; font-weight:600; color:${isActive ? info.color : "var(--solace-text-primary)"}; margin-bottom:2px;`;

      const desc = document.createElement("div");
      desc.textContent = info.desc;
      desc.style.cssText = "font-size:10px; color:var(--solace-text-tertiary); line-height:1.3;";

      if (isActive) {
        const badge = document.createElement("div");
        badge.textContent = "ACTIVE";
        badge.style.cssText = `
          font-size:9px; font-weight:700; letter-spacing:1px;
          color:${info.color}; margin-top:6px;
        `;
        card.append(icon, label, desc, badge);
      } else {
        card.append(icon, label, desc);
      }

      card.addEventListener("click", () => this._setRouting(mode));
      card.addEventListener("mouseenter", () => {
        if (!isActive) card.style.borderColor = info.color + "40";
      });
      card.addEventListener("mouseleave", () => {
        if (!isActive) card.style.borderColor = "var(--solace-border)";
      });

      routingGrid.appendChild(card);
    }
    body.appendChild(routingGrid);

    // Proxy config (shown when proxy mode is selected)
    if (this._currentRouting === "proxy") {
      this._renderProxyConfig(body);
    }

    // Tor/I2P status indicator
    if (this._currentRouting === "tor" || this._currentRouting === "i2p") {
      const statusBox = document.createElement("div");
      statusBox.style.cssText = `
        padding:12px; border-radius:8px; margin-bottom:16px;
        background:var(--solace-bg-secondary); border:1px solid var(--solace-border);
        font-size:12px; color:var(--solace-text-secondary); line-height:1.5;
      `;
      if (this._currentRouting === "tor") {
        statusBox.innerHTML = `
          <strong style="color:var(--solace-text-primary);">Tor Configuration</strong><br>
          Ensure Tor is running on <code style="background:var(--solace-bg-hover); padding:1px 4px; border-radius:3px;">127.0.0.1:9050</code><br>
          Traffic is routed through SOCKS5 proxy to Tor.
        `;
      } else {
        statusBox.innerHTML = `
          <strong style="color:var(--solace-text-primary);">I2P Configuration</strong><br>
          Ensure I2P router is running on <code style="background:var(--solace-bg-hover); padding:1px 4px; border-radius:3px;">127.0.0.1:4444</code><br>
          HTTP traffic is routed through I2P HTTP proxy.
        `;
      }
      body.appendChild(statusBox);
    }

    // ── Separator ─────────────────────────────────────────────────
    const sep = document.createElement("div");
    sep.style.cssText = "height:1px; background:var(--solace-border); margin:8px 0 16px;";
    body.appendChild(sep);

    // ── Privacy Toggles ───────────────────────────────────────────
    let currentCategory = "";
    for (const toggle of this.PRIVACY_TOGGLES) {
      if (toggle.category !== currentCategory) {
        currentCategory = toggle.category;
        const catHeader = document.createElement("div");
        catHeader.textContent = currentCategory;
        catHeader.style.cssText = `
          font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.8px;
          color:var(--solace-text-tertiary); margin:16px 0 8px;
        `;
        body.appendChild(catHeader);
      }

      this._renderToggle(body, toggle);
    }
  },

  _renderToggle(container, toggle) {
    const row = document.createElement("div");
    row.style.cssText = `
      display:flex; align-items:center; gap:10px; padding:8px 10px;
      border-radius:8px; transition:background 120ms; cursor:pointer;
    `;
    row.addEventListener("mouseenter", () => { row.style.background = "var(--solace-bg-hover)"; });
    row.addEventListener("mouseleave", () => { row.style.background = ""; });

    const textCol = document.createElement("div");
    textCol.style.cssText = "flex:1; min-width:0;";

    const label = document.createElement("div");
    label.textContent = toggle.label;
    label.style.cssText = "font-size:13px; color:var(--solace-text-primary); font-weight:500;";

    const desc = document.createElement("div");
    desc.textContent = toggle.desc;
    desc.style.cssText = "font-size:11px; color:var(--solace-text-tertiary); margin-top:1px; line-height:1.3;";

    textCol.append(label, desc);

    // Read current pref value
    let isOn = false;
    try {
      if (toggle.type === "bool") {
        isOn = Services.prefs.getBoolPref(toggle.pref, toggle.default);
        if (toggle.invert) isOn = !isOn;
      } else if (toggle.type === "int") {
        const val = Services.prefs.getIntPref(toggle.pref, toggle.default);
        isOn = val === (toggle.trueVal !== undefined ? toggle.trueVal : toggle.default);
        if (toggle.invert) isOn = !isOn;
      }
    } catch (e) {
      isOn = false;
    }

    const sw = document.createElement("div");
    sw.style.cssText = `
      width:38px; height:20px; border-radius:10px; flex-shrink:0;
      position:relative; cursor:pointer; transition:background 200ms;
      background:${isOn ? "var(--solace-purple)" : "rgba(255,255,255,0.1)"};
    `;
    const knob = document.createElement("div");
    knob.style.cssText = `
      position:absolute; top:2px; width:16px; height:16px; border-radius:50%;
      background:white; transition:transform 200ms;
      transform:translateX(${isOn ? "20px" : "2px"});
    `;
    sw.appendChild(knob);

    const toggleAction = () => {
      isOn = !isOn;
      sw.style.background = isOn ? "var(--solace-purple)" : "rgba(255,255,255,0.1)";
      knob.style.transform = `translateX(${isOn ? "20px" : "2px"})`;

      try {
        let val = isOn;
        if (toggle.invert) val = !val;

        if (toggle.type === "bool") {
          Services.prefs.setBoolPref(toggle.pref, val);
        } else if (toggle.type === "int") {
          const intVal = isOn
            ? (toggle.trueVal !== undefined ? toggle.trueVal : toggle.default)
            : (toggle.falseVal !== undefined ? toggle.falseVal : 0);
          Services.prefs.setIntPref(toggle.pref, toggle.invert ? (isOn ? toggle.falseVal : toggle.trueVal) : intVal);
        }
      } catch (e) {
        console.error("[Solace Privacy] Failed to set pref:", toggle.pref, e);
      }
    };

    row.addEventListener("click", toggleAction);
    row.append(textCol, sw);
    container.appendChild(row);
  },

  _renderProxyConfig(container) {
    const box = document.createElement("div");
    box.style.cssText = `
      padding:12px; border-radius:8px; margin-bottom:16px;
      background:var(--solace-bg-secondary); border:1px solid var(--solace-border);
    `;

    const fields = [
      { label: "Proxy Type", id: "proxy-type", type: "select", options: ["SOCKS5", "HTTP", "HTTPS"], pref: "solace.proxy.type" },
      { label: "Host", id: "proxy-host", type: "text", placeholder: "127.0.0.1", pref: "network.proxy.socks" },
      { label: "Port", id: "proxy-port", type: "number", placeholder: "1080", pref: "network.proxy.socks_port" },
    ];

    for (const field of fields) {
      const row = document.createElement("div");
      row.style.cssText = "margin-bottom:8px;";

      const lbl = document.createElement("label");
      lbl.textContent = field.label;
      lbl.style.cssText = "display:block; font-size:11px; color:var(--solace-text-secondary); margin-bottom:3px;";

      let input;
      if (field.type === "select") {
        input = document.createElement("select");
        for (const opt of field.options) {
          const o = document.createElement("option");
          o.value = opt.toLowerCase();
          o.textContent = opt;
          input.appendChild(o);
        }
      } else {
        input = document.createElement("input");
        input.type = field.type;
        input.placeholder = field.placeholder || "";
      }
      input.style.cssText = `
        width:100%; padding:6px 8px; background:var(--solace-bg-tertiary);
        border:1px solid var(--solace-border); border-radius:6px;
        color:var(--solace-text-primary); font-family:var(--solace-font-mono);
        font-size:12px; outline:none;
      `;

      // Load saved value
      try {
        if (field.type === "number") {
          input.value = Services.prefs.getIntPref(field.pref, 0) || "";
        } else {
          input.value = Services.prefs.getStringPref(field.pref, "");
        }
      } catch (e) {}

      input.addEventListener("change", () => {
        try {
          if (field.type === "number") {
            Services.prefs.setIntPref(field.pref, parseInt(input.value) || 0);
          } else {
            Services.prefs.setStringPref(field.pref, input.value);
          }
        } catch (e) {}
      });

      row.append(lbl, input);
      box.appendChild(row);
    }

    const applyBtn = document.createElement("button");
    applyBtn.textContent = "Apply Proxy Settings";
    applyBtn.style.cssText = `
      width:100%; padding:8px; border:none; border-radius:6px;
      background:var(--solace-purple); color:white; cursor:pointer;
      font-family:var(--solace-font-family); font-size:12px; font-weight:500;
      margin-top:4px;
    `;
    applyBtn.addEventListener("click", () => this._applyProxySettings());
    box.appendChild(applyBtn);

    container.appendChild(box);
  },

  // ── Network Routing Implementation ─────────────────────────────────────

  _setRouting(mode) {
    this._currentRouting = mode;
    Services.prefs.setStringPref("solace.privacy.routing", mode);

    switch (mode) {
      case "direct":
        this._setDirectConnection();
        break;
      case "proxy":
        // User must configure and apply manually
        break;
      case "tor":
        this._setTorRouting();
        break;
      case "i2p":
        this._setI2PRouting();
        break;
    }

    this._renderPanel();
  },

  _setDirectConnection() {
    Services.prefs.setIntPref("network.proxy.type", 0); // Direct
    Services.prefs.setStringPref("network.proxy.socks", "");
    Services.prefs.setIntPref("network.proxy.socks_port", 0);
    Services.prefs.setStringPref("network.proxy.http", "");
    Services.prefs.setIntPref("network.proxy.http_port", 0);
  },

  _setTorRouting() {
    Services.prefs.setIntPref("network.proxy.type", 1); // Manual
    Services.prefs.setStringPref("network.proxy.socks", "127.0.0.1");
    Services.prefs.setIntPref("network.proxy.socks_port", 9050);
    Services.prefs.setIntPref("network.proxy.socks_version", 5);
    Services.prefs.setBoolPref("network.proxy.socks_remote_dns", true);

    // Tor-specific privacy hardening
    Services.prefs.setBoolPref("privacy.resistFingerprinting", true);
    Services.prefs.setBoolPref("privacy.firstparty.isolate", true);
    Services.prefs.setBoolPref("media.peerconnection.ice.default_address_only", true);
    Services.prefs.setBoolPref("media.peerconnection.ice.no_host", true);

    // Disable features that could leak
    Services.prefs.setBoolPref("network.prefetch-next", false);
    Services.prefs.setBoolPref("network.dns.disablePrefetch", true);
    Services.prefs.setIntPref("network.http.speculative-parallel-limit", 0);
  },

  _setI2PRouting() {
    Services.prefs.setIntPref("network.proxy.type", 1); // Manual
    Services.prefs.setStringPref("network.proxy.http", "127.0.0.1");
    Services.prefs.setIntPref("network.proxy.http_port", 4444);
    Services.prefs.setStringPref("network.proxy.ssl", "127.0.0.1");
    Services.prefs.setIntPref("network.proxy.ssl_port", 4445);
    Services.prefs.setBoolPref("network.proxy.socks_remote_dns", true);

    // I2P privacy hardening
    Services.prefs.setBoolPref("privacy.resistFingerprinting", true);
    Services.prefs.setBoolPref("javascript.enabled", true); // I2P sites often need JS
  },

  _applyProxySettings() {
    try {
      const host = Services.prefs.getStringPref("network.proxy.socks", "127.0.0.1");
      const port = Services.prefs.getIntPref("network.proxy.socks_port", 1080);

      Services.prefs.setIntPref("network.proxy.type", 1); // Manual
      Services.prefs.setStringPref("network.proxy.socks", host);
      Services.prefs.setIntPref("network.proxy.socks_port", port);
      Services.prefs.setIntPref("network.proxy.socks_version", 5);
      Services.prefs.setBoolPref("network.proxy.socks_remote_dns", true);
    } catch (e) {
      console.error("[Solace Privacy] Failed to apply proxy:", e);
    }
  },

  _loadRoutingMode() {
    try {
      this._currentRouting = Services.prefs.getStringPref("solace.privacy.routing", "direct");
    } catch (e) {
      this._currentRouting = "direct";
    }
  },

  uninit() {},
};
