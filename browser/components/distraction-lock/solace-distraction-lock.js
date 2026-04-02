/* ═══════════════════════════════════════════════════════════════════════════════
   Solace Browser — Distraction Lock
   Block domains for a set time with no override
   ═══════════════════════════════════════════════════════════════════════════════ */

"use strict";

var SolaceDistractionLock = {
  _active: false,
  _blockedDomains: [],
  _endTime: null,
  _timer: null,

  init() {
    // Check if a lock session is still active
    this._loadState();

    if (this._active && this._endTime > Date.now()) {
      this._installBlocker();
    } else {
      this._active = false;
      this._saveState();
    }
  },

  toggle() {
    if (this._active) {
      // Cannot override! That's the point
      alert(`Distraction Lock is active until ${new Date(this._endTime).toLocaleTimeString()}.\n\nBlocked: ${this._blockedDomains.join(", ")}\n\nThere is no override. Stay focused.`);
    } else {
      this._showSetupDialog();
    }
  },

  _showSetupDialog() {
    const dialog = document.createElement("div");
    dialog.id = "solace-distraction-lock-dialog";
    dialog.style.cssText = `
      position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
      width:400px; background:var(--solace-glass-bg);
      backdrop-filter: blur(40px) saturate(2);
      border:1px solid var(--solace-glass-border);
      border-radius:var(--solace-border-radius-lg);
      box-shadow:var(--solace-shadow-lg);
      z-index:var(--solace-z-modal); padding:24px;
      font-family:var(--solace-font-family);
      animation: solace-scale-in 200ms cubic-bezier(0.16, 1, 0.3, 1);
    `;

    dialog.innerHTML = `
      <div style="font-size:18px; font-weight:600; color:var(--solace-text-primary); margin-bottom:4px;">🔐 Distraction Lock</div>
      <div style="font-size:12px; color:var(--solace-text-tertiary); margin-bottom:20px;">
        Block distracting sites. Once locked, there is <strong>no override</strong>.
      </div>

      <div style="margin-bottom:16px;">
        <label style="font-size:12px; color:var(--solace-text-secondary); display:block; margin-bottom:6px;">Sites to block (one per line)</label>
        <textarea id="dl-domains" style="
          width:100%; height:100px; background:var(--solace-bg-secondary);
          border:1px solid var(--solace-border); border-radius:8px;
          padding:10px; color:var(--solace-text-primary);
          font-family:var(--solace-font-mono); font-size:12px;
          resize:none; outline:none;
        " placeholder="twitter.com\nreddit.com\nyoutube.com\ninstagram.com"></textarea>
      </div>

      <div style="margin-bottom:20px;">
        <label style="font-size:12px; color:var(--solace-text-secondary); display:block; margin-bottom:6px;">Duration</label>
        <div style="display:flex; gap:8px;">
          <button class="dl-duration" data-minutes="25" style="flex:1; padding:8px; border:1px solid var(--solace-border); border-radius:8px; background:transparent; color:var(--solace-text-primary); cursor:pointer; font-family:var(--solace-font-family);">25 min</button>
          <button class="dl-duration" data-minutes="60" style="flex:1; padding:8px; border:1px solid var(--solace-border); border-radius:8px; background:transparent; color:var(--solace-text-primary); cursor:pointer; font-family:var(--solace-font-family);">1 hour</button>
          <button class="dl-duration" data-minutes="120" style="flex:1; padding:8px; border:1px solid var(--solace-border); border-radius:8px; background:transparent; color:var(--solace-text-primary); cursor:pointer; font-family:var(--solace-font-family);">2 hours</button>
          <button class="dl-duration" data-minutes="240" style="flex:1; padding:8px; border:1px solid var(--solace-border); border-radius:8px; background:transparent; color:var(--solace-text-primary); cursor:pointer; font-family:var(--solace-font-family);">4 hours</button>
        </div>
      </div>

      <div style="display:flex; gap:8px;">
        <button id="dl-start" style="flex:1; padding:10px; border:none; border-radius:8px; background:var(--solace-red); color:white; cursor:pointer; font-family:var(--solace-font-family); font-weight:600;">Start Lock</button>
        <button id="dl-cancel" style="padding:10px 20px; border:1px solid var(--solace-border); border-radius:8px; background:transparent; color:var(--solace-text-secondary); cursor:pointer; font-family:var(--solace-font-family);">Cancel</button>
      </div>
    `;

    document.documentElement.appendChild(dialog);

    let selectedMinutes = 25;

    dialog.querySelectorAll(".dl-duration").forEach((btn) => {
      btn.addEventListener("click", () => {
        dialog.querySelectorAll(".dl-duration").forEach((b) => {
          b.style.background = "transparent";
          b.style.borderColor = "var(--solace-border)";
        });
        btn.style.background = "var(--solace-bg-selected)";
        btn.style.borderColor = "var(--solace-purple)";
        selectedMinutes = parseInt(btn.dataset.minutes);
      });
    });

    // Select first by default
    dialog.querySelector(".dl-duration").click();

    dialog.querySelector("#dl-cancel").addEventListener("click", () => dialog.remove());

    dialog.querySelector("#dl-start").addEventListener("click", () => {
      const domains = dialog.querySelector("#dl-domains").value
        .split("\n")
        .map((d) => d.trim().toLowerCase())
        .filter((d) => d.length > 0);

      if (domains.length === 0) {
        alert("Enter at least one domain to block.");
        return;
      }

      this._startLock(domains, selectedMinutes);
      dialog.remove();
    });
  },

  _startLock(domains, minutes) {
    this._active = true;
    this._blockedDomains = domains;
    this._endTime = Date.now() + minutes * 60 * 1000;

    this._saveState();
    this._installBlocker();

    // Timer to auto-unlock
    this._timer = setTimeout(() => {
      this._endLock();
    }, minutes * 60 * 1000);

    // Close any currently open blocked tabs
    for (const tab of [...gBrowser.tabs]) {
      try {
        const host = tab.linkedBrowser?.currentURI?.host;
        if (host && this._isDomainBlocked(host)) {
          gBrowser.removeTab(tab);
        }
      } catch (e) { /* ignore */ }
    }
  },

  _endLock() {
    this._active = false;
    this._blockedDomains = [];
    this._endTime = null;
    if (this._timer) clearTimeout(this._timer);
    this._saveState();
    this._removeBlocker();
  },

  _isDomainBlocked(host) {
    return this._blockedDomains.some((d) =>
      host === d || host.endsWith("." + d)
    );
  },

  _installBlocker() {
    // Use a web request observer to block navigation to blocked domains
    Services.obs.addObserver(this, "http-on-modify-request");
  },

  _removeBlocker() {
    try {
      Services.obs.removeObserver(this, "http-on-modify-request");
    } catch (e) { /* might not be registered */ }
  },

  observe(subject, topic) {
    if (topic !== "http-on-modify-request" || !this._active) return;

    try {
      const httpChannel = subject.QueryInterface(Ci.nsIHttpChannel);
      const host = httpChannel.URI.host;

      if (this._isDomainBlocked(host)) {
        httpChannel.cancel(Cr.NS_BINDING_ABORTED);
      }
    } catch (e) { /* ignore */ }
  },

  _loadState() {
    try {
      const dir = Services.dirsvc.get("ProfD", Ci.nsIFile);
      const file = dir.clone(); file.append("solace"); file.append("distraction-lock.json");
      if (!file.exists()) return;
      const data = JSON.parse(IOUtils.readUTF8(file.path));
      this._active = data.active || false;
      this._blockedDomains = data.domains || [];
      this._endTime = data.endTime || null;
    } catch (e) { /* ignore */ }
  },

  _saveState() {
    try {
      const dir = Services.dirsvc.get("ProfD", Ci.nsIFile);
      const solace = dir.clone(); solace.append("solace");
      if (!solace.exists()) solace.create(Ci.nsIFile.DIRECTORY_TYPE, 0o755);
      const file = solace.clone(); file.append("distraction-lock.json");
      IOUtils.writeUTF8(file.path, JSON.stringify({
        active: this._active,
        domains: this._blockedDomains,
        endTime: this._endTime,
      }));
    } catch (e) { /* ignore */ }
  },

  uninit() {
    this._removeBlocker();
    if (this._timer) clearTimeout(this._timer);
  },
};
