/* ═══════════════════════════════════════════════════════════════════════════════
   Solace Browser — Command Bar / Quick Launcher
   Fuzzy search across tabs, history, bookmarks, settings, and commands
   ═══════════════════════════════════════════════════════════════════════════════ */

"use strict";

var SolaceCommandBar = {
  _overlay: null,
  _input: null,
  _resultList: null,
  _visible: false,
  _selectedIndex: 0,
  _results: [],
  _mode: "all", // "all", "tabs", "history", "bookmarks", "commands"

  COMMANDS: [
    { id: "new-tab", label: "New Tab", icon: "➕", action: () => gBrowser.addTab("about:solace-newtab", { triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal() }) },
    { id: "new-window", label: "New Window", icon: "🪟", action: () => OpenBrowserWindow() },
    { id: "new-private", label: "New Private Window", icon: "🔒", action: () => OpenBrowserWindow({ private: true }) },
    { id: "close-tab", label: "Close Current Tab", icon: "✕", action: () => gBrowser.removeCurrentTab() },
    { id: "toggle-sidebar", label: "Toggle Sidebar", icon: "◧", action: () => SolaceSidebar._toggleCollapse() },
    { id: "focus-mode", label: "Toggle Focus Mode", icon: "🎯", action: () => SolaceFocusMode.toggle() },
    { id: "ghost-mode", label: "Toggle Ghost Mode", icon: "👻", action: () => SolaceGhostMode.toggle() },
    { id: "split-view", label: "Toggle Split View", icon: "⬚", action: () => SolaceSplitView.toggle() },
    { id: "screenshot", label: "Take Screenshot", icon: "📷", action: () => SolaceScreenshots.capture() },
    { id: "notes", label: "Open Notes", icon: "📝", action: () => SolaceNotes.toggle() },
    { id: "reading-queue", label: "Reading Queue", icon: "📖", action: () => SolaceReadingQueue.toggle() },
    { id: "sessions", label: "Save Session", icon: "💾", action: () => SolaceSessions.saveCurrentSession() },
    { id: "sound-mixer", label: "Sound Mixer", icon: "🔊", action: () => SolaceSoundMixer.toggle() },
    { id: "css-editor", label: "Live CSS Editor", icon: "🎨", action: () => SolaceCSSEditor.toggle() },
    { id: "distraction-lock", label: "Distraction Lock", icon: "🔐", action: () => SolaceDistractionLock.toggle() },
    { id: "keyboard-mode", label: "Keyboard Mode", icon: "⌨️", action: () => SolaceKeyboardMode.toggle() },
    { id: "reader-mode", label: "Reader Mode", icon: "📄", action: () => ReaderParent.toggleReaderMode() },
    { id: "pip", label: "Picture in Picture", icon: "📺", action: () => PictureInPicture.onCommand() },
    { id: "settings", label: "Open Settings", icon: "⚙", action: () => gBrowser.addTab("about:preferences", { triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal() }) },
    { id: "clear-data", label: "Clear Browsing Data", icon: "🗑", action: () => Sanitizer.showUI(window) },
    { id: "zoom-in", label: "Zoom In", icon: "🔍", action: () => FullZoom.enlarge() },
    { id: "zoom-out", label: "Zoom Out", icon: "🔍", action: () => FullZoom.reduce() },
    { id: "zoom-reset", label: "Reset Zoom", icon: "🔍", action: () => FullZoom.reset() },
    { id: "fullscreen", label: "Toggle Fullscreen", icon: "⛶", action: () => BrowserFullScreen() },
    { id: "devtools", label: "Open Developer Tools", icon: "🛠", action: () => gDevToolsBrowser.toggleToolboxCommand(gBrowser) },
    { id: "workspace-new", label: "New Workspace", icon: "📂", action: () => SolaceWorkspaces.createWorkspace() },
    { id: "ai-panel", label: "AI Panel", icon: "🤖", action: () => SolaceAIPanel.toggle() },
    { id: "pipe", label: "Pipe — Share to Device", icon: "📡", action: () => SolacePipe.showShareDialog() },
  ],

  init() {
    this._buildUI();
    this._bindGlobalShortcut();
  },

  _buildUI() {
    // Create overlay
    const overlay = document.createElement("div");
    overlay.id = "solace-commandbar-overlay";
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: var(--solace-z-commandbar);
      display: none;
      justify-content: center;
      align-items: flex-start;
      padding-top: 15vh;
    `;

    const container = document.createElement("div");
    container.id = "solace-commandbar";
    container.style.cssText = `
      width: 600px;
      max-width: 90vw;
      background: var(--solace-glass-bg);
      backdrop-filter: blur(40px) saturate(2);
      -webkit-backdrop-filter: blur(40px) saturate(2);
      border: 1px solid var(--solace-glass-border);
      border-radius: var(--solace-border-radius-lg);
      box-shadow: var(--solace-shadow-lg), 0 0 60px rgba(108, 92, 231, 0.1);
      overflow: hidden;
      animation: solace-scale-in 200ms cubic-bezier(0.16, 1, 0.3, 1);
    `;

    // Mode tabs
    const modeBar = document.createElement("div");
    modeBar.style.cssText = `
      display: flex;
      gap: 2px;
      padding: 8px 12px 0;
      border-bottom: 1px solid var(--solace-border);
    `;

    const modes = [
      { id: "all", label: "All", key: "" },
      { id: "tabs", label: "Tabs", key: "%" },
      { id: "history", label: "History", key: "@" },
      { id: "bookmarks", label: "Bookmarks", key: "*" },
      { id: "commands", label: "Commands", key: ">" },
    ];

    for (const mode of modes) {
      const btn = document.createElement("div");
      btn.dataset.mode = mode.id;
      btn.textContent = mode.label;
      btn.style.cssText = `
        padding: 6px 12px;
        font-size: 11px;
        font-weight: 500;
        color: var(--solace-text-secondary);
        cursor: pointer;
        border-bottom: 2px solid transparent;
        transition: all 120ms ease-out;
        font-family: var(--solace-font-family);
      `;
      if (mode.id === "all") {
        btn.style.color = "var(--solace-text-accent)";
        btn.style.borderBottomColor = "var(--solace-purple)";
      }
      btn.addEventListener("click", () => {
        this._setMode(mode.id);
        this._input.value = mode.key;
        this._input.focus();
        this._search(mode.key);
      });
      modeBar.appendChild(btn);
    }

    // Search input
    const inputWrapper = document.createElement("div");
    inputWrapper.style.cssText = `padding: 12px 16px;`;

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Search tabs, history, bookmarks, or type > for commands...";
    input.style.cssText = `
      width: 100%;
      background: transparent;
      border: none;
      outline: none;
      font-size: 16px;
      font-family: var(--solace-font-family);
      color: var(--solace-text-primary);
      caret-color: var(--solace-purple-light);
    `;

    inputWrapper.appendChild(input);

    // Results list
    const resultList = document.createElement("div");
    resultList.id = "solace-commandbar-results";
    resultList.style.cssText = `
      max-height: 400px;
      overflow-y: auto;
      padding: 4px 8px 8px;
    `;

    // Footer
    const footer = document.createElement("div");
    footer.style.cssText = `
      display: flex;
      gap: 16px;
      padding: 8px 16px;
      border-top: 1px solid var(--solace-border);
      font-size: 11px;
      color: var(--solace-text-tertiary);
      font-family: var(--solace-font-family);
    `;
    footer.innerHTML = `
      <span>↑↓ Navigate</span>
      <span>↵ Open</span>
      <span>⎋ Close</span>
      <span style="margin-left:auto">% Tabs · @ History · * Bookmarks · > Commands</span>
    `;

    container.appendChild(modeBar);
    container.appendChild(inputWrapper);
    container.appendChild(resultList);
    container.appendChild(footer);
    overlay.appendChild(container);

    // Insert into browser chrome
    document.documentElement.appendChild(overlay);

    this._overlay = overlay;
    this._input = input;
    this._resultList = resultList;

    // Events
    input.addEventListener("input", () => this._search(input.value));
    input.addEventListener("keydown", (e) => this._onKeyDown(e));
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) this.hide();
    });
  },

  _bindGlobalShortcut() {
    document.addEventListener("keydown", (e) => {
      // Cmd/Ctrl + K to open
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        this.toggle();
      }
      // Escape to close
      if (e.key === "Escape" && this._visible) {
        this.hide();
      }
    });
  },

  // ── Show / Hide ────────────────────────────────────────────────────────────

  toggle() {
    if (this._visible) this.hide();
    else this.show();
  },

  show() {
    this._visible = true;
    this._overlay.style.display = "flex";
    this._input.value = "";
    this._input.focus();
    this._selectedIndex = 0;
    this._search("");
  },

  hide() {
    this._visible = false;
    this._overlay.style.display = "none";
    this._input.value = "";
    this._resultList.innerHTML = "";
  },

  // ── Mode switching ─────────────────────────────────────────────────────────

  _setMode(mode) {
    this._mode = mode;
    const tabs = this._overlay.querySelectorAll("[data-mode]");
    tabs.forEach((el) => {
      if (el.dataset.mode === mode) {
        el.style.color = "var(--solace-text-accent)";
        el.style.borderBottomColor = "var(--solace-purple)";
      } else {
        el.style.color = "var(--solace-text-secondary)";
        el.style.borderBottomColor = "transparent";
      }
    });
  },

  // ── Search ─────────────────────────────────────────────────────────────────

  async _search(query) {
    let results = [];
    const q = query.trim().toLowerCase();

    // Detect mode from prefix
    if (q.startsWith(">")) {
      this._setMode("commands");
      results = this._searchCommands(q.slice(1).trim());
    } else if (q.startsWith("%")) {
      this._setMode("tabs");
      results = this._searchTabs(q.slice(1).trim());
    } else if (q.startsWith("@")) {
      this._setMode("history");
      results = await this._searchHistory(q.slice(1).trim());
    } else if (q.startsWith("*")) {
      this._setMode("bookmarks");
      results = await this._searchBookmarks(q.slice(1).trim());
    } else {
      this._setMode("all");
      // Search everything
      const tabs = this._searchTabs(q);
      const commands = this._searchCommands(q);
      const history = await this._searchHistory(q);
      const bookmarks = await this._searchBookmarks(q);

      results = [
        ...tabs.map((r) => ({ ...r, category: "Tabs" })),
        ...commands.map((r) => ({ ...r, category: "Commands" })),
        ...bookmarks.slice(0, 5).map((r) => ({ ...r, category: "Bookmarks" })),
        ...history.slice(0, 5).map((r) => ({ ...r, category: "History" })),
      ];
    }

    this._results = results;
    this._selectedIndex = 0;
    this._renderResults();
  },

  _searchTabs(query) {
    const results = [];
    for (const tab of gBrowser.tabs) {
      const title = (tab.label || "").toLowerCase();
      const url = (tab.linkedBrowser?.currentURI?.spec || "").toLowerCase();

      if (!query || this._fuzzyMatch(query, title) || this._fuzzyMatch(query, url)) {
        results.push({
          type: "tab",
          icon: tab.image || "chrome://branding/content/icon32.png",
          title: tab.label || "New Tab",
          subtitle: tab.linkedBrowser?.currentURI?.spec || "",
          action: () => { gBrowser.selectedTab = tab; this.hide(); },
          score: this._fuzzyScore(query, title),
        });
      }
    }
    return results.sort((a, b) => b.score - a.score);
  },

  _searchCommands(query) {
    return this.COMMANDS
      .filter((cmd) => !query || this._fuzzyMatch(query, cmd.label.toLowerCase()))
      .map((cmd) => ({
        type: "command",
        icon: cmd.icon,
        title: cmd.label,
        subtitle: "Command",
        action: () => { cmd.action(); this.hide(); },
        score: this._fuzzyScore(query, cmd.label.toLowerCase()),
      }))
      .sort((a, b) => b.score - a.score);
  },

  async _searchHistory(query) {
    if (!query || query.length < 2) return [];

    try {
      const results = [];
      const historyService = Cc["@mozilla.org/browser/nav-history-service;1"]
        .getService(Ci.nsINavHistoryService);

      const options = historyService.getNewQueryOptions();
      options.maxResults = 10;
      options.sortingMode = options.SORT_BY_VISITCOUNT_DESCENDING;

      const histQuery = historyService.getNewQuery();
      histQuery.searchTerms = query;

      const result = historyService.executeQuery(histQuery, options);
      const container = result.root;
      container.containerOpen = true;

      for (let i = 0; i < container.childCount; i++) {
        const node = container.getChild(i);
        results.push({
          type: "history",
          icon: node.icon || "🕐",
          title: node.title || node.uri,
          subtitle: node.uri,
          action: () => {
            gBrowser.addTab(node.uri, {
              triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
            });
            this.hide();
          },
        });
      }

      container.containerOpen = false;
      return results;
    } catch (e) {
      return [];
    }
  },

  async _searchBookmarks(query) {
    if (!query || query.length < 2) return [];

    try {
      const results = [];
      const bookmarkService = Cc["@mozilla.org/browser/nav-bookmarks-service;1"]
        .getService(Ci.nsINavBookmarksService);
      const historyService = Cc["@mozilla.org/browser/nav-history-service;1"]
        .getService(Ci.nsINavHistoryService);

      const options = historyService.getNewQueryOptions();
      options.maxResults = 10;
      options.queryType = options.QUERY_TYPE_BOOKMARKS;

      const histQuery = historyService.getNewQuery();
      histQuery.searchTerms = query;

      const result = historyService.executeQuery(histQuery, options);
      const container = result.root;
      container.containerOpen = true;

      for (let i = 0; i < container.childCount; i++) {
        const node = container.getChild(i);
        results.push({
          type: "bookmark",
          icon: "⭐",
          title: node.title || node.uri,
          subtitle: node.uri,
          action: () => {
            gBrowser.addTab(node.uri, {
              triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
            });
            this.hide();
          },
        });
      }

      container.containerOpen = false;
      return results;
    } catch (e) {
      return [];
    }
  },

  // ── Fuzzy matching ─────────────────────────────────────────────────────────

  _fuzzyMatch(query, text) {
    if (!query) return true;
    let qi = 0;
    for (let ti = 0; ti < text.length && qi < query.length; ti++) {
      if (text[ti] === query[qi]) qi++;
    }
    return qi === query.length;
  },

  _fuzzyScore(query, text) {
    if (!query) return 0;
    let score = 0;
    let qi = 0;
    let consecutive = 0;

    for (let ti = 0; ti < text.length && qi < query.length; ti++) {
      if (text[ti] === query[qi]) {
        score += 1 + consecutive * 2;
        if (ti === qi) score += 3; // Bonus for matching at same position
        consecutive++;
        qi++;
      } else {
        consecutive = 0;
      }
    }

    if (text.startsWith(query)) score += 10;
    return qi === query.length ? score : -1;
  },

  // ── Render results ─────────────────────────────────────────────────────────

  _renderResults() {
    this._resultList.innerHTML = "";

    let currentCategory = "";

    for (let i = 0; i < this._results.length; i++) {
      const r = this._results[i];

      // Category header
      if (r.category && r.category !== currentCategory) {
        currentCategory = r.category;
        const header = document.createElement("div");
        header.style.cssText = `
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: var(--solace-text-tertiary);
          padding: 8px 12px 4px;
          font-family: var(--solace-font-family);
        `;
        header.textContent = currentCategory;
        this._resultList.appendChild(header);
      }

      const item = document.createElement("div");
      item.style.cssText = `
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 12px;
        border-radius: 8px;
        cursor: pointer;
        transition: background 120ms ease-out;
        font-family: var(--solace-font-family);
      `;

      if (i === this._selectedIndex) {
        item.style.background = "var(--solace-bg-selected)";
      }

      item.addEventListener("mouseenter", () => {
        this._selectedIndex = i;
        this._renderResults();
      });

      item.addEventListener("click", () => r.action());

      // Icon
      const icon = document.createElement("span");
      if (r.type === "tab" && r.icon && !r.icon.startsWith("chrome://")) {
        const img = document.createElement("img");
        img.src = r.icon;
        img.style.cssText = "width: 16px; height: 16px; border-radius: 3px;";
        img.onerror = () => { img.style.display = "none"; };
        icon.appendChild(img);
      } else {
        icon.textContent = typeof r.icon === "string" ? r.icon : "📄";
        icon.style.fontSize = "16px";
      }
      icon.style.cssText += "width: 20px; text-align: center; flex-shrink: 0;";

      // Text
      const text = document.createElement("div");
      text.style.cssText = "flex: 1; min-width: 0;";

      const title = document.createElement("div");
      title.textContent = r.title;
      title.style.cssText = `
        font-size: 13px;
        color: var(--solace-text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      `;

      const subtitle = document.createElement("div");
      subtitle.textContent = r.subtitle;
      subtitle.style.cssText = `
        font-size: 11px;
        color: var(--solace-text-tertiary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      `;

      text.appendChild(title);
      if (r.subtitle) text.appendChild(subtitle);

      item.appendChild(icon);
      item.appendChild(text);
      this._resultList.appendChild(item);
    }

    if (this._results.length === 0 && this._input.value.trim()) {
      const empty = document.createElement("div");
      empty.textContent = "No results found";
      empty.style.cssText = `
        text-align: center;
        padding: 24px;
        color: var(--solace-text-tertiary);
        font-size: 13px;
        font-family: var(--solace-font-family);
      `;
      this._resultList.appendChild(empty);
    }
  },

  // ── Keyboard navigation ────────────────────────────────────────────────────

  _onKeyDown(e) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        this._selectedIndex = Math.min(this._selectedIndex + 1, this._results.length - 1);
        this._renderResults();
        break;

      case "ArrowUp":
        e.preventDefault();
        this._selectedIndex = Math.max(this._selectedIndex - 1, 0);
        this._renderResults();
        break;

      case "Enter":
        e.preventDefault();
        if (this._results[this._selectedIndex]) {
          this._results[this._selectedIndex].action();
        }
        break;

      case "Escape":
        this.hide();
        break;

      case "Tab":
        e.preventDefault();
        // Cycle through modes
        const modeOrder = ["all", "tabs", "history", "bookmarks", "commands"];
        const currentIdx = modeOrder.indexOf(this._mode);
        const nextMode = modeOrder[(currentIdx + 1) % modeOrder.length];
        this._setMode(nextMode);
        this._search(this._input.value);
        break;
    }
  },

  uninit() {
    if (this._overlay) this._overlay.remove();
  },
};
