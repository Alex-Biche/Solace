/* ═══════════════════════════════════════════════════════════════════════════════
   Solace Browser — Session Manager
   Save, restore, and schedule tab sessions
   ═══════════════════════════════════════════════════════════════════════════════ */

"use strict";

var SolaceSessions = {
  _panel: null,
  _visible: false,
  _sessions: [],

  init() {
    this._loadSessions();
  },

  toggle() {
    if (this._visible) this.hide();
    else this.show();
  },

  show() {
    if (!this._panel) this._buildUI();
    this._visible = true;
    this._panel.style.display = "flex";
    this._renderSessionList();
  },

  hide() {
    if (!this._panel) return;
    this._visible = false;
    this._panel.style.display = "none";
  },

  saveCurrentSession(name) {
    const sessionName = name || prompt("Session name:", `Session ${new Date().toLocaleDateString()}`);
    if (!sessionName) return;

    const tabs = [];
    for (const tab of gBrowser.tabs) {
      tabs.push({
        url: tab.linkedBrowser?.currentURI?.spec || "about:blank",
        title: tab.label,
        pinned: tab.pinned,
        favicon: tab.image,
      });
    }

    const session = {
      id: "session-" + Date.now(),
      name: sessionName,
      tabs,
      created: Date.now(),
      tabCount: tabs.length,
    };

    this._sessions.unshift(session);
    this._saveSessions();

    if (this._visible) this._renderSessionList();
  },

  restoreSession(sessionId) {
    const session = this._sessions.find((s) => s.id === sessionId);
    if (!session) return;

    for (const tabInfo of session.tabs) {
      const newTab = gBrowser.addTab(tabInfo.url, {
        triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
      });
      if (tabInfo.pinned) gBrowser.pinTab(newTab);
    }
  },

  deleteSession(sessionId) {
    this._sessions = this._sessions.filter((s) => s.id !== sessionId);
    this._saveSessions();
    if (this._visible) this._renderSessionList();
  },

  // ── Scheduled tab opener ───────────────────────────────────────────────────

  scheduleOpen(url, time) {
    const [hours, minutes] = time.split(":").map(Number);
    const now = new Date();
    const target = new Date(now);
    target.setHours(hours, minutes, 0, 0);

    if (target <= now) target.setDate(target.getDate() + 1);

    const delay = target - now;
    setTimeout(() => {
      gBrowser.addTab(url, {
        triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
      });
    }, delay);
  },

  _buildUI() {
    const panel = document.createElement("div");
    panel.id = "solace-sessions-panel";
    panel.style.cssText = `
      position: fixed; right: 0; top: 0; bottom: 0; width: 350px;
      background: var(--solace-glass-bg);
      backdrop-filter: blur(var(--solace-glass-blur)) saturate(var(--solace-glass-saturate));
      border-left: 1px solid var(--solace-glass-border);
      z-index: var(--solace-z-panel); display: none; flex-direction: column;
      font-family: var(--solace-font-family); box-shadow: var(--solace-shadow-lg);
    `;

    panel.innerHTML = `
      <div style="display:flex; align-items:center; padding:12px 16px; border-bottom:1px solid var(--solace-border);">
        <span style="font-size:14px; font-weight:600; color:var(--solace-text-primary); flex:1;">Sessions</span>
        <div id="solace-sessions-save" style="cursor:pointer; padding:4px 12px; border-radius:100px; font-size:12px; background:var(--solace-purple); color:white;">Save Current</div>
        <div id="solace-sessions-close" style="cursor:pointer; padding:4px 8px; border-radius:6px; color:var(--solace-text-secondary); font-size:14px; margin-left:8px;">✕</div>
      </div>
      <div id="solace-sessions-list" style="flex:1; overflow-y:auto; padding:8px;"></div>
    `;

    document.documentElement.appendChild(panel);
    this._panel = panel;

    panel.querySelector("#solace-sessions-close").addEventListener("click", () => this.hide());
    panel.querySelector("#solace-sessions-save").addEventListener("click", () => this.saveCurrentSession());
  },

  _renderSessionList() {
    const list = this._panel.querySelector("#solace-sessions-list");
    list.innerHTML = "";

    if (this._sessions.length === 0) {
      list.innerHTML = `<div style="text-align:center; padding:24px; color:var(--solace-text-tertiary); font-size:13px;">No saved sessions</div>`;
      return;
    }

    for (const session of this._sessions) {
      const item = document.createElement("div");
      item.style.cssText = `
        padding:12px; border-radius:8px; margin-bottom:6px;
        background:var(--solace-bg-secondary); border:1px solid var(--solace-border);
        transition: border-color 120ms;
      `;
      item.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
          <span style="font-size:13px; font-weight:500; color:var(--solace-text-primary); flex:1;">${session.name}</span>
          <span style="font-size:11px; color:var(--solace-text-tertiary);">${session.tabCount} tabs</span>
        </div>
        <div style="font-size:11px; color:var(--solace-text-tertiary); margin-bottom:8px;">
          ${new Date(session.created).toLocaleString()}
        </div>
        <div style="display:flex; gap:6px;">
          <button class="restore-btn" style="padding:4px 10px; border:none; border-radius:6px; background:var(--solace-purple); color:white; cursor:pointer; font-size:11px; font-family:var(--solace-font-family);">Restore</button>
          <button class="delete-btn" style="padding:4px 10px; border:1px solid var(--solace-border); border-radius:6px; background:transparent; color:var(--solace-text-secondary); cursor:pointer; font-size:11px; font-family:var(--solace-font-family);">Delete</button>
        </div>
      `;

      item.querySelector(".restore-btn").addEventListener("click", () => this.restoreSession(session.id));
      item.querySelector(".delete-btn").addEventListener("click", () => this.deleteSession(session.id));

      list.appendChild(item);
    }
  },

  _loadSessions() {
    try {
      const dir = Services.dirsvc.get("ProfD", Ci.nsIFile);
      const file = dir.clone(); file.append("solace"); file.append("sessions.json");
      if (!file.exists()) return;
      this._sessions = JSON.parse(IOUtils.readUTF8(file.path)) || [];
    } catch (e) { /* ignore */ }
  },

  _saveSessions() {
    try {
      const dir = Services.dirsvc.get("ProfD", Ci.nsIFile);
      const solace = dir.clone(); solace.append("solace");
      if (!solace.exists()) solace.create(Ci.nsIFile.DIRECTORY_TYPE, 0o755);
      const file = solace.clone(); file.append("sessions.json");
      IOUtils.writeUTF8(file.path, JSON.stringify(this._sessions));
    } catch (e) { /* ignore */ }
  },

  uninit() {},
};
