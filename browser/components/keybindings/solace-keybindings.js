/* ═══════════════════════════════════════════════════════════════════════════════
   Solace Browser — Keybindings System
   Fully remappable keyboard shortcuts with settings UI.
   All keybindings stored in preferences as JSON, editable from settings.
   ═══════════════════════════════════════════════════════════════════════════════ */

"use strict";

var SolaceKeybindings = {
  _bindings: {},
  _panel: null,
  _visible: false,
  _recording: null,   // Which action ID is currently being recorded
  _listeners: [],

  // Default keybindings — action ID → key combo string
  DEFAULTS: {
    "command-bar":        { keys: "CmdOrCtrl+K",       label: "Command Bar",          category: "Navigation" },
    "toggle-sidebar":     { keys: "CmdOrCtrl+B",       label: "Toggle Sidebar",       category: "Navigation" },
    "new-tab":            { keys: "CmdOrCtrl+T",       label: "New Tab",              category: "Tabs" },
    "close-tab":          { keys: "CmdOrCtrl+W",       label: "Close Tab",            category: "Tabs" },
    "restore-tab":        { keys: "CmdOrCtrl+Shift+T", label: "Restore Closed Tab",   category: "Tabs" },
    "next-tab":           { keys: "CmdOrCtrl+Tab",     label: "Next Tab",             category: "Tabs" },
    "prev-tab":           { keys: "CmdOrCtrl+Shift+Tab", label: "Previous Tab",       category: "Tabs" },
    "pin-tab":            { keys: "CmdOrCtrl+Shift+P", label: "Pin/Unpin Tab",        category: "Tabs" },
    "split-view":         { keys: "CmdOrCtrl+Shift+S", label: "Split View",           category: "View" },
    "focus-mode":         { keys: "F11",               label: "Focus Mode",           category: "View" },
    "focus-mode-alt":     { keys: "CmdOrCtrl+Shift+F", label: "Focus Mode (Alt)",     category: "View" },
    "ghost-mode":         { keys: "CmdOrCtrl+Shift+G", label: "Ghost Mode",           category: "View" },
    "fullscreen":         { keys: "CmdOrCtrl+Ctrl+F",  label: "Fullscreen",           category: "View" },
    "zoom-in":            { keys: "CmdOrCtrl+=",       label: "Zoom In",              category: "View" },
    "zoom-out":           { keys: "CmdOrCtrl+-",       label: "Zoom Out",             category: "View" },
    "zoom-reset":         { keys: "CmdOrCtrl+0",       label: "Reset Zoom",           category: "View" },
    "notes":              { keys: "CmdOrCtrl+Shift+N", label: "Notes Panel",          category: "Tools" },
    "screenshot":         { keys: "CmdOrCtrl+Shift+X", label: "Screenshot",           category: "Tools" },
    "ai-panel":           { keys: "CmdOrCtrl+Shift+A", label: "AI Panel",             category: "Tools" },
    "reading-queue":      { keys: "CmdOrCtrl+Shift+R", label: "Reading Queue",        category: "Tools" },
    "sessions":           { keys: "CmdOrCtrl+Shift+E", label: "Sessions",             category: "Tools" },
    "sound-mixer":        { keys: "CmdOrCtrl+Shift+M", label: "Sound Mixer",          category: "Tools" },
    "css-editor":         { keys: "CmdOrCtrl+Shift+C", label: "CSS Editor",           category: "Tools" },
    "distraction-lock":   { keys: "CmdOrCtrl+Shift+D", label: "Distraction Lock",     category: "Tools" },
    "pipe":               { keys: "CmdOrCtrl+Shift+L", label: "Pipe (Share)",         category: "Tools" },
    "devtools":           { keys: "F12",               label: "Developer Tools",      category: "Tools" },
    "reader-mode":        { keys: "CmdOrCtrl+Alt+R",   label: "Reader Mode",          category: "View" },
    "find":               { keys: "CmdOrCtrl+F",       label: "Find on Page",         category: "Navigation" },
    "settings":           { keys: "CmdOrCtrl+,",       label: "Settings",             category: "Navigation" },
    "privacy-panel":      { keys: "CmdOrCtrl+Shift+I", label: "Privacy Panel",        category: "Privacy" },
    "workspace-1":        { keys: "CmdOrCtrl+Alt+1",   label: "Workspace 1",          category: "Workspaces" },
    "workspace-2":        { keys: "CmdOrCtrl+Alt+2",   label: "Workspace 2",          category: "Workspaces" },
    "workspace-3":        { keys: "CmdOrCtrl+Alt+3",   label: "Workspace 3",          category: "Workspaces" },
    "workspace-4":        { keys: "CmdOrCtrl+Alt+4",   label: "Workspace 4",          category: "Workspaces" },
    "workspace-new":      { keys: "CmdOrCtrl+Alt+N",   label: "New Workspace",        category: "Workspaces" },
  },

  // Action handlers — map action IDs to functions
  ACTIONS: {
    "command-bar":       () => SolaceCommandBar.toggle(),
    "toggle-sidebar":    () => SolaceSidebar._toggleCollapse(),
    "new-tab":           () => gBrowser.addTab("about:solace-newtab", { triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal() }),
    "close-tab":         () => gBrowser.removeCurrentTab(),
    "restore-tab":       () => undoCloseTab(),
    "next-tab":          () => gBrowser.tabContainer.advanceSelectedTab(1, true),
    "prev-tab":          () => gBrowser.tabContainer.advanceSelectedTab(-1, true),
    "pin-tab":           () => { const t = gBrowser.selectedTab; t.pinned ? gBrowser.unpinTab(t) : gBrowser.pinTab(t); },
    "split-view":        () => SolaceSplitView.toggle(),
    "focus-mode":        () => SolaceFocusMode.toggle(),
    "focus-mode-alt":    () => SolaceFocusMode.toggle(),
    "ghost-mode":        () => SolaceGhostMode.toggle(),
    "fullscreen":        () => BrowserFullScreen(),
    "zoom-in":           () => FullZoom.enlarge(),
    "zoom-out":          () => FullZoom.reduce(),
    "zoom-reset":        () => FullZoom.reset(),
    "notes":             () => SolaceNotes.toggle(),
    "screenshot":        () => SolaceScreenshots.capture(),
    "ai-panel":          () => SolaceAIPanel.toggle(),
    "reading-queue":     () => SolaceReadingQueue.toggle(),
    "sessions":          () => SolaceSessions.toggle(),
    "sound-mixer":       () => SolaceSoundMixer.toggle(),
    "css-editor":        () => SolaceCSSEditor.toggle(),
    "distraction-lock":  () => SolaceDistractionLock.toggle(),
    "pipe":              () => SolacePipe.showShareDialog(),
    "devtools":          () => { try { gDevToolsBrowser.toggleToolboxCommand(gBrowser); } catch(e) {} },
    "reader-mode":       () => { try { ReaderParent.toggleReaderMode(); } catch(e) {} },
    "find":              () => gLazyFindCommand("cmd_find"),
    "settings":          () => gBrowser.addTab("about:preferences", { triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal() }),
    "privacy-panel":     () => SolacePrivacy.toggle(),
    "workspace-1":       () => { const ws = SolaceWorkspaces._workspaces[0]; if (ws) SolaceWorkspaces.switchToWorkspace(ws.id); },
    "workspace-2":       () => { const ws = SolaceWorkspaces._workspaces[1]; if (ws) SolaceWorkspaces.switchToWorkspace(ws.id); },
    "workspace-3":       () => { const ws = SolaceWorkspaces._workspaces[2]; if (ws) SolaceWorkspaces.switchToWorkspace(ws.id); },
    "workspace-4":       () => { const ws = SolaceWorkspaces._workspaces[3]; if (ws) SolaceWorkspaces.switchToWorkspace(ws.id); },
    "workspace-new":     () => SolaceWorkspaces.createWorkspace(),
  },

  init() {
    this._loadBindings();
    this._installListener();
  },

  // ── Parse key combo string → structured object ─────────────────────────
  _parseCombo(comboStr) {
    const parts = comboStr.split("+");
    const isMac = Services.appinfo.OS === "Darwin";
    const result = { ctrl: false, meta: false, alt: false, shift: false, key: "" };

    for (const part of parts) {
      const p = part.trim();
      switch (p) {
        case "CmdOrCtrl":
          if (isMac) result.meta = true;
          else result.ctrl = true;
          break;
        case "Ctrl":   result.ctrl = true; break;
        case "Cmd":    result.meta = true; break;
        case "Alt":    result.alt = true; break;
        case "Shift":  result.shift = true; break;
        case "Tab":    result.key = "Tab"; break;
        default:       result.key = p; break;
      }
    }
    return result;
  },

  // ── Check if a keyboard event matches a combo ──────────────────────────
  _matchesCombo(event, combo) {
    if (event.ctrlKey !== combo.ctrl) return false;
    if (event.metaKey !== combo.meta) return false;
    if (event.altKey !== combo.alt) return false;
    if (event.shiftKey !== combo.shift) return false;

    const eventKey = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    const comboKey = combo.key.length === 1 ? combo.key.toLowerCase() : combo.key;
    return eventKey === comboKey;
  },

  // ── Install global keyboard listener ───────────────────────────────────
  _installListener() {
    const listener = (e) => {
      // If we're recording a new binding, capture instead of executing
      if (this._recording) {
        e.preventDefault();
        e.stopPropagation();
        this._finishRecording(e);
        return;
      }

      for (const [actionId, binding] of Object.entries(this._bindings)) {
        const combo = this._parseCombo(binding.keys);
        if (this._matchesCombo(e, combo)) {
          const handler = this.ACTIONS[actionId];
          if (handler) {
            e.preventDefault();
            e.stopPropagation();
            try { handler(); } catch (err) {
              console.error("[Solace Keybindings] Error in action", actionId, err);
            }
            return;
          }
        }
      }
    };

    document.addEventListener("keydown", listener, true);
    this._listeners.push(listener);
  },

  // ── Persistence ────────────────────────────────────────────────────────
  _loadBindings() {
    try {
      const json = Services.prefs.getStringPref("solace.keybindings", "");
      if (json) {
        const saved = JSON.parse(json);
        // Merge saved over defaults
        this._bindings = {};
        for (const [id, def] of Object.entries(this.DEFAULTS)) {
          this._bindings[id] = { ...def, ...(saved[id] || {}) };
        }
      } else {
        this._bindings = JSON.parse(JSON.stringify(this.DEFAULTS));
      }
    } catch (e) {
      this._bindings = JSON.parse(JSON.stringify(this.DEFAULTS));
    }
  },

  _saveBindings() {
    const toSave = {};
    for (const [id, binding] of Object.entries(this._bindings)) {
      toSave[id] = { keys: binding.keys };
    }
    Services.prefs.setStringPref("solace.keybindings", JSON.stringify(toSave));
  },

  resetToDefaults() {
    this._bindings = JSON.parse(JSON.stringify(this.DEFAULTS));
    this._saveBindings();
    if (this._visible) this._renderPanel();
  },

  resetBinding(actionId) {
    if (this.DEFAULTS[actionId]) {
      this._bindings[actionId].keys = this.DEFAULTS[actionId].keys;
      this._saveBindings();
      if (this._visible) this._renderPanel();
    }
  },

  // ── Convert keyboard event to display string ───────────────────────────
  _eventToComboString(e) {
    const parts = [];
    const isMac = Services.appinfo.OS === "Darwin";

    if (e.metaKey && isMac) parts.push("CmdOrCtrl");
    else if (e.ctrlKey) parts.push(isMac ? "Ctrl" : "CmdOrCtrl");
    if (e.altKey) parts.push("Alt");
    if (e.shiftKey) parts.push("Shift");

    // Get the key
    let key = e.key;
    if (key === "Control" || key === "Meta" || key === "Alt" || key === "Shift") return null; // Modifier only
    if (key === " ") key = "Space";
    if (key.length === 1) key = key.toUpperCase();

    parts.push(key);
    return parts.join("+");
  },

  // ── Pretty display of key combo ────────────────────────────────────────
  _formatCombo(comboStr) {
    const isMac = Services.appinfo.OS === "Darwin";
    return comboStr
      .replace(/CmdOrCtrl/g, isMac ? "⌘" : "Ctrl")
      .replace(/Ctrl/g, isMac ? "⌃" : "Ctrl")
      .replace(/Cmd/g, "⌘")
      .replace(/Alt/g, isMac ? "⌥" : "Alt")
      .replace(/Shift/g, isMac ? "⇧" : "Shift")
      .replace(/\+/g, isMac ? "" : " + ");
  },

  // ── Settings Panel UI ─────────────────────────────────────────────────
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
    this._recording = null;
  },

  _buildPanel() {
    const panel = document.createElement("div");
    panel.id = "solace-keybindings-panel";
    panel.style.cssText = `
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.55);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      z-index: var(--solace-z-modal);
      display: none; justify-content: center; align-items: center;
      font-family: var(--solace-font-family);
    `;

    const card = document.createElement("div");
    card.id = "solace-keybindings-card";
    card.style.cssText = `
      width: 640px; max-width: 90vw; max-height: 80vh;
      background: var(--solace-bg-primary);
      border: 1px solid var(--solace-glass-border);
      border-radius: 16px;
      box-shadow: 0 24px 80px rgba(0,0,0,0.5);
      display: flex; flex-direction: column;
      overflow: hidden;
      animation: solace-scale-in 200ms cubic-bezier(0.16, 1, 0.3, 1);
    `;

    // Header
    const header = document.createElement("div");
    header.style.cssText = `
      display:flex; align-items:center; padding:16px 20px;
      border-bottom:1px solid var(--solace-border);
    `;
    const title = document.createElement("span");
    title.textContent = "Keyboard Shortcuts";
    title.style.cssText = "font-size:16px; font-weight:600; color:var(--solace-text-primary); flex:1;";

    const resetBtn = document.createElement("button");
    resetBtn.textContent = "Reset All";
    resetBtn.style.cssText = `
      padding:5px 12px; border:1px solid var(--solace-border); border-radius:6px;
      background:transparent; color:var(--solace-text-secondary); cursor:pointer;
      font-family:var(--solace-font-family); font-size:11px; margin-right:8px;
    `;
    resetBtn.addEventListener("click", () => this.resetToDefaults());

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "\u2715";
    closeBtn.style.cssText = `
      padding:4px 8px; border:none; border-radius:6px;
      background:transparent; color:var(--solace-text-secondary); cursor:pointer;
      font-size:16px;
    `;
    closeBtn.addEventListener("click", () => this.hide());

    header.append(title, resetBtn, closeBtn);

    // Search
    const searchWrap = document.createElement("div");
    searchWrap.style.cssText = "padding:8px 20px;";
    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.placeholder = "Filter shortcuts...";
    searchInput.style.cssText = `
      width:100%; padding:8px 12px; background:var(--solace-bg-secondary);
      border:1px solid var(--solace-border); border-radius:8px;
      color:var(--solace-text-primary); font-family:var(--solace-font-family);
      font-size:13px; outline:none;
    `;
    searchInput.addEventListener("input", () => this._renderPanel(searchInput.value));
    searchWrap.appendChild(searchInput);

    // Body (scrollable)
    const body = document.createElement("div");
    body.id = "solace-keybindings-body";
    body.style.cssText = "flex:1; overflow-y:auto; padding:8px 20px 20px;";

    card.append(header, searchWrap, body);
    panel.appendChild(card);

    panel.addEventListener("click", (e) => {
      if (e.target === panel) this.hide();
    });

    document.documentElement.appendChild(panel);
    this._panel = panel;
  },

  _renderPanel(filter) {
    const body = this._panel.querySelector("#solace-keybindings-body");
    while (body.firstChild) body.firstChild.remove();

    const filterLower = (filter || "").toLowerCase();

    // Group by category
    const categories = {};
    for (const [id, binding] of Object.entries(this._bindings)) {
      const cat = binding.category || "Other";
      if (filterLower && !binding.label.toLowerCase().includes(filterLower) && !id.includes(filterLower)) continue;
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push({ id, ...binding });
    }

    for (const [category, bindings] of Object.entries(categories)) {
      const catHeader = document.createElement("div");
      catHeader.textContent = category;
      catHeader.style.cssText = `
        font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:1px;
        color:var(--solace-text-tertiary); padding:12px 0 6px; margin-top:4px;
      `;
      body.appendChild(catHeader);

      for (const binding of bindings) {
        const row = document.createElement("div");
        row.style.cssText = `
          display:flex; align-items:center; padding:8px 12px; border-radius:8px;
          transition: background 120ms;
        `;
        row.addEventListener("mouseenter", () => { row.style.background = "var(--solace-bg-hover)"; });
        row.addEventListener("mouseleave", () => { row.style.background = ""; });

        const label = document.createElement("span");
        label.textContent = binding.label;
        label.style.cssText = "flex:1; font-size:13px; color:var(--solace-text-primary);";

        const keyBadge = document.createElement("div");
        keyBadge.style.cssText = `
          display:flex; align-items:center; gap:4px; padding:4px 10px;
          background: var(--solace-bg-secondary); border:1px solid var(--solace-border);
          border-radius:6px; font-size:12px; color:var(--solace-text-secondary);
          font-family: var(--solace-font-mono); cursor:pointer; min-width:80px;
          justify-content:center; transition: all 120ms;
          ${this._recording === binding.id ? "border-color:var(--solace-purple); background:rgba(108,92,231,0.1); color:var(--solace-purple-light);" : ""}
        `;
        keyBadge.textContent = this._recording === binding.id
          ? "Press keys..."
          : this._formatCombo(binding.keys);

        keyBadge.addEventListener("click", (e) => {
          e.stopPropagation();
          if (this._recording === binding.id) {
            this._recording = null;
            this._renderPanel(filter);
          } else {
            this._recording = binding.id;
            this._renderPanel(filter);
          }
        });

        // Reset single binding button
        const resetSingle = document.createElement("button");
        resetSingle.textContent = "\u21BA";
        resetSingle.title = "Reset to default";
        resetSingle.style.cssText = `
          margin-left:6px; padding:2px 6px; border:none; border-radius:4px;
          background:transparent; color:var(--solace-text-tertiary); cursor:pointer;
          font-size:14px; opacity:0; transition:opacity 120ms;
        `;
        row.addEventListener("mouseenter", () => { resetSingle.style.opacity = "1"; });
        row.addEventListener("mouseleave", () => { resetSingle.style.opacity = "0"; });
        resetSingle.addEventListener("click", (e) => {
          e.stopPropagation();
          this.resetBinding(binding.id);
        });

        row.append(label, keyBadge, resetSingle);
        body.appendChild(row);
      }
    }

    if (body.children.length === 0) {
      const empty = document.createElement("div");
      empty.textContent = "No shortcuts match your search.";
      empty.style.cssText = "text-align:center; padding:24px; color:var(--solace-text-tertiary); font-size:13px;";
      body.appendChild(empty);
    }
  },

  _finishRecording(event) {
    const comboStr = this._eventToComboString(event);
    if (!comboStr) return; // Modifier-only press

    const actionId = this._recording;
    this._recording = null;

    // Check for conflicts
    for (const [id, binding] of Object.entries(this._bindings)) {
      if (id !== actionId && binding.keys === comboStr) {
        // Conflict — clear the other binding
        binding.keys = "";
      }
    }

    this._bindings[actionId].keys = comboStr;
    this._saveBindings();
    this._renderPanel();
  },

  uninit() {
    for (const listener of this._listeners) {
      document.removeEventListener("keydown", listener, true);
    }
    this._listeners = [];
  },
};
