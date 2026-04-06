/* ═══════════════════════════════════════════════════════════════════════════════
   Solace Browser — Command Bar / Spotlight-Style Launcher
   Floating search with bang support, calculator, recent searches, and more
   ═══════════════════════════════════════════════════════════════════════════════ */

"use strict";

var SolaceCommandBar = {
  _overlay: null,
  _container: null,
  _inputRow: null,
  _input: null,
  _bangChip: null,
  _resultsCard: null,
  _resultList: null,
  _footerEl: null,
  _visible: false,
  _selectedIndex: 0,
  _results: [],
  _activeBang: null,
  _mode: "all",
  _recentSearches: [],
  _categoryOrder: ["Navigate", "Calculator", "Bangs", "Tabs", "Commands", "Bookmarks", "History", "Recent"],
  _currentCategoryIndex: -1,

  MAX_RECENT: 20,
  RECENT_STORAGE_KEY: "solace.commandbar.recentSearches",

  // ── Default bangs ───────────────────────────────────────────────────────────

  DEFAULT_BANGS: {
    "!g":   { label: "Google",        url: "https://www.google.com/search?q=%s" },
    "!ddg": { label: "DuckDuckGo",    url: "https://duckduckgo.com/?q=%s" },
    "!yt":  { label: "YouTube",       url: "https://www.youtube.com/results?search_query=%s" },
    "!gh":  { label: "GitHub",        url: "https://github.com/search?q=%s" },
    "!w":   { label: "Wikipedia",     url: "https://en.wikipedia.org/wiki/Special:Search?search=%s" },
    "!r":   { label: "Reddit",        url: "https://www.reddit.com/search/?q=%s" },
    "!so":  { label: "StackOverflow", url: "https://stackoverflow.com/search?q=%s" },
    "!npm": { label: "npm",           url: "https://www.npmjs.com/search?q=%s" },
    "!mdn": { label: "MDN",           url: "https://developer.mozilla.org/en-US/search?q=%s" },
  },

  COMMANDS: [
    { id: "new-tab",         label: "New Tab",             icon: "+",  action() { gBrowser.addTab("about:solace-newtab", { triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal() }); } },
    { id: "new-window",      label: "New Window",          icon: "W",  action() { OpenBrowserWindow(); } },
    { id: "new-private",     label: "New Private Window",  icon: "P",  action() { OpenBrowserWindow({ private: true }); } },
    { id: "close-tab",       label: "Close Current Tab",   icon: "X",  action() { gBrowser.removeCurrentTab(); } },
    { id: "toggle-sidebar",  label: "Toggle Sidebar",      icon: "S",  action() { SolaceSidebar._toggleCollapse(); } },
    { id: "focus-mode",      label: "Toggle Focus Mode",   icon: "F",  action() { SolaceFocusMode.toggle(); } },
    { id: "ghost-mode",      label: "Toggle Ghost Mode",   icon: "G",  action() { SolaceGhostMode.toggle(); } },
    { id: "split-view",      label: "Toggle Split View",   icon: "V",  action() { SolaceSplitView.toggle(); } },
    { id: "screenshot",      label: "Take Screenshot",     icon: "C",  action() { SolaceScreenshots.capture(); } },
    { id: "notes",           label: "Open Notes",          icon: "N",  action() { SolaceNotes.toggle(); } },
    { id: "reading-queue",   label: "Reading Queue",       icon: "R",  action() { SolaceReadingQueue.toggle(); } },
    { id: "sessions",        label: "Save Session",        icon: "D",  action() { SolaceSessions.saveCurrentSession(); } },
    { id: "sound-mixer",     label: "Sound Mixer",         icon: "M",  action() { SolaceSoundMixer.toggle(); } },
    { id: "css-editor",      label: "Live CSS Editor",     icon: "E",  action() { SolaceCSSEditor.toggle(); } },
    { id: "distraction-lock",label: "Distraction Lock",    icon: "L",  action() { SolaceDistractionLock.toggle(); } },
    { id: "keyboard-mode",   label: "Keyboard Mode",       icon: "K",  action() { SolaceKeyboardMode.toggle(); } },
    { id: "reader-mode",     label: "Reader Mode",         icon: "B",  action() { ReaderParent.toggleReaderMode(); } },
    { id: "pip",             label: "Picture in Picture",  icon: "I",  action() { PictureInPicture.onCommand(); } },
    { id: "settings",        label: "Open Settings",       icon: "O",  action() { gBrowser.addTab("about:preferences", { triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal() }); } },
    { id: "clear-data",      label: "Clear Browsing Data", icon: "T",  action() { Sanitizer.showUI(window); } },
    { id: "zoom-in",         label: "Zoom In",             icon: "+",  action() { FullZoom.enlarge(); } },
    { id: "zoom-out",        label: "Zoom Out",            icon: "-",  action() { FullZoom.reduce(); } },
    { id: "zoom-reset",      label: "Reset Zoom",          icon: "0",  action() { FullZoom.reset(); } },
    { id: "fullscreen",      label: "Toggle Fullscreen",   icon: "U",  action() { BrowserFullScreen(); } },
    { id: "devtools",        label: "Developer Tools",     icon: "D",  action() { gDevToolsBrowser.toggleToolboxCommand(gBrowser); } },
    { id: "workspace-new",   label: "New Workspace",       icon: "W",  action() { SolaceWorkspaces.createWorkspace(); } },
    { id: "ai-panel",        label: "AI Panel",            icon: "A",  action() { SolaceAIPanel.toggle(); } },
    { id: "pipe",            label: "Pipe - Share to Device", icon: "Q", action() { SolacePipe.showShareDialog(); } },
  ],

  // ── Initialization ──────────────────────────────────────────────────────────

  init() {
    this._loadRecentSearches();
    this._buildUI();
    this._bindGlobalShortcut();
  },

  // ── Bang helpers ────────────────────────────────────────────────────────────

  _getBangs() {
    let custom = {};
    try {
      const pref = Services.prefs.getStringPref("solace.commandbar.bangs", "");
      if (pref) {
        custom = JSON.parse(pref);
      }
    } catch (_) {
      // Pref doesn't exist or is invalid JSON — use defaults only
    }
    return Object.assign({}, this.DEFAULT_BANGS, custom);
  },

  // ── Recent searches ─────────────────────────────────────────────────────────

  _loadRecentSearches() {
    try {
      const stored = Services.prefs.getStringPref(this.RECENT_STORAGE_KEY, "[]");
      this._recentSearches = JSON.parse(stored);
      if (!Array.isArray(this._recentSearches)) {
        this._recentSearches = [];
      }
    } catch (_) {
      this._recentSearches = [];
    }
  },

  _saveRecentSearches() {
    try {
      Services.prefs.setStringPref(
        this.RECENT_STORAGE_KEY,
        JSON.stringify(this._recentSearches)
      );
    } catch (_) {
      // Silently fail if prefs unavailable
    }
  },

  _addRecentSearch(query) {
    if (!query || query.length < 2) return;
    // Remove duplicates
    this._recentSearches = this._recentSearches.filter(s => s !== query);
    // Add to front
    this._recentSearches.unshift(query);
    // Trim
    if (this._recentSearches.length > this.MAX_RECENT) {
      this._recentSearches.length = this.MAX_RECENT;
    }
    this._saveRecentSearches();
  },

  // ── URL detection ───────────────────────────────────────────────────────────

  _looksLikeURL(text) {
    if (!text) return false;
    const trimmed = text.trim();
    if (/^https?:\/\//i.test(trimmed)) return true;
    if (/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z]{2,})+/i.test(trimmed) && !trimmed.includes(" ")) return true;
    return false;
  },

  _normalizeURL(text) {
    const trimmed = text.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return "https://" + trimmed;
  },

  // ── Calculator ──────────────────────────────────────────────────────────────

  _tryCalculate(input) {
    if (!input || input.length < 2) return null;
    // Only attempt if input contains math-like characters
    if (!/^[\d\s+\-*/().,%^]+$/.test(input)) return null;
    try {
      // Replace ^ with ** for exponentiation
      const expr = input.replace(/\^/g, "**").replace(/%/g, "/100");
      // Strict sandbox: only allow safe math tokens
      if (/[a-zA-Z_$]/.test(expr)) return null;
      const result = Function('"use strict"; return (' + expr + ")")();
      if (typeof result !== "number" || !isFinite(result)) return null;
      // Format nicely
      const formatted = Number.isInteger(result)
        ? result.toLocaleString()
        : parseFloat(result.toPrecision(12)).toLocaleString(undefined, { maximumFractionDigits: 10 });
      return formatted;
    } catch (_) {
      return null;
    }
  },

  // ── Build UI ────────────────────────────────────────────────────────────────

  _buildUI() {
    // Overlay backdrop
    const overlay = document.createElement("div");
    overlay.id = "solace-commandbar-overlay";
    const overlayS = overlay.style;
    overlayS.position = "fixed";
    overlayS.inset = "0";
    overlayS.background = "rgba(0, 0, 0, 0.35)";
    overlayS.backdropFilter = "blur(12px)";
    overlayS.webkitBackdropFilter = "blur(12px)";
    overlayS.zIndex = "var(--solace-z-commandbar)";
    overlayS.display = "none";
    overlayS.justifyContent = "center";
    overlayS.alignItems = "flex-start";
    overlayS.paddingTop = "18vh";
    overlayS.opacity = "0";
    overlayS.transition = "opacity 180ms ease-out";

    // Floating container (holds the search pill + results card)
    const container = document.createElement("div");
    container.id = "solace-commandbar";
    const containerS = container.style;
    containerS.width = "620px";
    containerS.maxWidth = "90vw";
    containerS.display = "flex";
    containerS.flexDirection = "column";
    containerS.gap = "8px";
    containerS.transform = "scale(0.95)";
    containerS.opacity = "0";
    containerS.transition = "transform 250ms cubic-bezier(0.16, 1, 0.3, 1), opacity 180ms ease-out";

    // ─── Search pill ────────────────────────────────────────────────────
    const pill = document.createElement("div");
    pill.id = "solace-commandbar-pill";
    const pillS = pill.style;
    pillS.background = "var(--solace-glass-bg)";
    pillS.backdropFilter = "blur(60px) saturate(2)";
    pillS.webkitBackdropFilter = "blur(60px) saturate(2)";
    pillS.border = "1px solid var(--solace-glass-border)";
    pillS.borderRadius = "var(--solace-border-radius-pill)";
    pillS.boxShadow = "var(--solace-shadow-lg), 0 0 80px rgba(108, 92, 231, 0.08)";
    pillS.display = "flex";
    pillS.alignItems = "center";
    pillS.padding = "12px 24px";
    pillS.gap = "12px";
    pillS.overflow = "hidden";

    // Search icon
    const searchIcon = document.createElement("span");
    searchIcon.textContent = "\u{1F50D}"; // magnifying glass
    const searchIconS = searchIcon.style;
    searchIconS.fontSize = "18px";
    searchIconS.flexShrink = "0";
    searchIconS.opacity = "0.5";

    // Bang chip (hidden by default)
    const bangChip = document.createElement("span");
    bangChip.id = "solace-commandbar-bang-chip";
    const bangChipS = bangChip.style;
    bangChipS.display = "none";
    bangChipS.padding = "3px 10px";
    bangChipS.borderRadius = "var(--solace-border-radius-pill)";
    bangChipS.background = "var(--solace-bg-selected)";
    bangChipS.color = "var(--solace-text-accent)";
    bangChipS.fontSize = "12px";
    bangChipS.fontWeight = "600";
    bangChipS.fontFamily = "var(--solace-font-family)";
    bangChipS.flexShrink = "0";
    bangChipS.whiteSpace = "nowrap";

    // Input
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Search tabs, history, bookmarks, commands, or type ! for bangs...";
    const inputS = input.style;
    inputS.flex = "1";
    inputS.minWidth = "0";
    inputS.background = "transparent";
    inputS.border = "none";
    inputS.outline = "none";
    inputS.fontSize = "20px";
    inputS.fontFamily = "var(--solace-font-family)";
    inputS.fontWeight = "400";
    inputS.color = "var(--solace-text-primary)";
    inputS.caretColor = "var(--solace-purple-light)";

    pill.appendChild(searchIcon);
    pill.appendChild(bangChip);
    pill.appendChild(input);

    // ─── Results card ───────────────────────────────────────────────────
    const resultsCard = document.createElement("div");
    resultsCard.id = "solace-commandbar-results-card";
    const resultsCardS = resultsCard.style;
    resultsCardS.background = "var(--solace-glass-bg)";
    resultsCardS.backdropFilter = "blur(60px) saturate(2)";
    resultsCardS.webkitBackdropFilter = "blur(60px) saturate(2)";
    resultsCardS.border = "1px solid var(--solace-glass-border)";
    resultsCardS.borderRadius = "var(--solace-border-radius-lg)";
    resultsCardS.boxShadow = "var(--solace-shadow-lg)";
    resultsCardS.overflow = "hidden";
    resultsCardS.display = "none";

    // Result list
    const resultList = document.createElement("div");
    resultList.id = "solace-commandbar-results";
    const resultListS = resultList.style;
    resultListS.maxHeight = "420px";
    resultListS.overflowY = "auto";
    resultListS.padding = "6px 8px";

    // Footer
    const footer = document.createElement("div");
    const footerS = footer.style;
    footerS.display = "flex";
    footerS.gap = "16px";
    footerS.padding = "8px 16px";
    footerS.borderTop = "1px solid var(--solace-border)";
    footerS.fontSize = "11px";
    footerS.color = "var(--solace-text-tertiary)";
    footerS.fontFamily = "var(--solace-font-family)";

    const footerItems = [
      { text: "\u2191\u2193 Navigate" },
      { text: "\u21B5 Open" },
      { text: "Tab Cycle" },
      { text: "\u238B Close" },
      { text: "! Bangs", marginLeft: "auto" },
    ];
    for (const item of footerItems) {
      const span = document.createElement("span");
      span.textContent = item.text;
      if (item.marginLeft) span.style.marginLeft = item.marginLeft;
      footer.appendChild(span);
    }

    resultsCard.appendChild(resultList);
    resultsCard.appendChild(footer);

    container.appendChild(pill);
    container.appendChild(resultsCard);
    overlay.appendChild(container);

    document.documentElement.appendChild(overlay);

    // Store references
    this._overlay = overlay;
    this._container = container;
    this._input = input;
    this._bangChip = bangChip;
    this._resultsCard = resultsCard;
    this._resultList = resultList;
    this._footerEl = footer;

    // Events
    input.addEventListener("input", () => this._onInput());
    input.addEventListener("keydown", (e) => this._onKeyDown(e));
    input.addEventListener("paste", (e) => {
      // Defer so the input value is updated
      setTimeout(() => this._onPaste(), 0);
    });
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) this.hide();
    });
  },

  _bindGlobalShortcut() {
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        this.toggle();
      }
      if (e.key === "Escape" && this._visible) {
        e.preventDefault();
        this.hide();
      }
    });
  },

  // ── Show / Hide with animation ──────────────────────────────────────────────

  toggle() {
    if (this._visible) this.hide();
    else this.show();
  },

  show() {
    this._visible = true;
    this._activeBang = null;
    this._bangChip.style.display = "none";
    this._overlay.style.display = "flex";

    // Force reflow then animate in
    void this._overlay.offsetHeight;
    this._overlay.style.opacity = "1";
    this._container.style.transform = "scale(1)";
    this._container.style.opacity = "1";

    this._input.value = "";
    this._input.focus();
    this._selectedIndex = 0;
    this._currentCategoryIndex = -1;
    this._search("");
  },

  hide() {
    this._visible = false;
    this._overlay.style.opacity = "0";
    this._container.style.transform = "scale(0.95)";
    this._container.style.opacity = "0";

    setTimeout(() => {
      if (!this._visible) {
        this._overlay.style.display = "none";
        this._clearResults();
        this._input.value = "";
        this._activeBang = null;
        this._bangChip.style.display = "none";
      }
    }, 200);
  },

  _clearResults() {
    while (this._resultList.firstChild) {
      this._resultList.removeChild(this._resultList.firstChild);
    }
    this._resultsCard.style.display = "none";
    this._results = [];
  },

  // ── Mode switching ──────────────────────────────────────────────────────────

  _setMode(mode) {
    this._mode = mode;
  },

  // ── Input handlers ──────────────────────────────────────────────────────────

  _onInput() {
    const value = this._input.value;
    this._parseBangFromInput(value);
    this._search(value);
  },

  _onPaste() {
    const value = this._input.value.trim();
    if (this._looksLikeURL(value)) {
      // Will be picked up by _search which checks for URLs
      this._search(this._input.value);
    }
  },

  _parseBangFromInput(value) {
    const bangs = this._getBangs();
    const trimmed = value.trim();

    // Check if input starts with a bang that has a space after it
    const spaceIdx = trimmed.indexOf(" ");
    if (spaceIdx > 0) {
      const possibleBang = trimmed.substring(0, spaceIdx).toLowerCase();
      if (bangs[possibleBang]) {
        this._activeBang = possibleBang;
        this._bangChip.textContent = bangs[possibleBang].label;
        this._bangChip.style.display = "inline-block";
        return;
      }
    }

    // No active bang
    if (this._activeBang) {
      // Check if the bang prefix was removed
      if (spaceIdx < 0 || !bangs[trimmed.substring(0, spaceIdx).toLowerCase()]) {
        this._activeBang = null;
        this._bangChip.style.display = "none";
      }
    }
  },

  // ── Main search dispatcher ──────────────────────────────────────────────────

  async _search(query) {
    let results = [];
    const raw = query.trim();
    const q = raw.toLowerCase();

    // ── Bang suggestions when user types "!" ────────────────────────────
    if (q === "!" || (q.startsWith("!") && !q.includes(" "))) {
      const bangPrefix = q;
      const bangs = this._getBangs();
      for (const [trigger, info] of Object.entries(bangs)) {
        if (trigger.startsWith(bangPrefix) || bangPrefix === "!") {
          results.push({
            type: "bang-suggestion",
            icon: "!",
            title: trigger + " " + info.label,
            subtitle: info.url.replace("%s", "..."),
            category: "Bangs",
            action: () => {
              this._input.value = trigger + " ";
              this._activeBang = trigger;
              this._bangChip.textContent = info.label;
              this._bangChip.style.display = "inline-block";
              this._input.focus();
              this._search(this._input.value);
            },
          });
        }
      }
      this._results = results;
      this._selectedIndex = 0;
      this._renderResults();
      return;
    }

    // ── Active bang — show "Search X for ..." ───────────────────────────
    if (this._activeBang) {
      const bangs = this._getBangs();
      const bangInfo = bangs[this._activeBang];
      const bangQuery = raw.substring(raw.indexOf(" ") + 1).trim();
      if (bangInfo && bangQuery) {
        results.push({
          type: "bang-action",
          icon: "!",
          title: "Search " + bangInfo.label + " for \"" + bangQuery + "\"",
          subtitle: bangInfo.url.replace("%s", encodeURIComponent(bangQuery)),
          category: "Navigate",
          action: () => {
            this._addRecentSearch(raw);
            const url = bangInfo.url.replace("%s", encodeURIComponent(bangQuery));
            gBrowser.addTab(url, {
              triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
            });
            this.hide();
          },
        });
      }
      this._results = results;
      this._selectedIndex = 0;
      this._renderResults();
      return;
    }

    // ── URL detection ───────────────────────────────────────────────────
    if (this._looksLikeURL(raw)) {
      const url = this._normalizeURL(raw);
      results.push({
        type: "navigate",
        icon: "\u2192",
        title: "Navigate to " + raw,
        subtitle: url,
        category: "Navigate",
        action: () => {
          this._addRecentSearch(raw);
          gBrowser.addTab(url, {
            triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
          });
          this.hide();
        },
      });
    }

    // ── Calculator ──────────────────────────────────────────────────────
    const calcResult = this._tryCalculate(raw);
    if (calcResult !== null) {
      results.push({
        type: "calculator",
        icon: "=",
        title: raw + " = " + calcResult,
        subtitle: "Calculator — press Enter to copy",
        category: "Calculator",
        action: () => {
          try {
            const clipboard = Cc["@mozilla.org/widget/clipboardhelper;1"]
              .getService(Ci.nsIClipboardHelper);
            clipboard.copyString(calcResult);
          } catch (_) {
            // Clipboard not available
          }
          this.hide();
        },
      });
    }

    // ── Mode prefix detection ───────────────────────────────────────────
    if (q.startsWith(">")) {
      this._setMode("commands");
      const commandResults = this._searchCommands(q.slice(1).trim());
      results = results.concat(commandResults);
    } else if (q.startsWith("%")) {
      this._setMode("tabs");
      const tabResults = this._searchTabs(q.slice(1).trim());
      results = results.concat(tabResults);
    } else if (q.startsWith("@")) {
      this._setMode("history");
      const historyResults = await this._searchHistory(q.slice(1).trim());
      results = results.concat(historyResults);
    } else if (q.startsWith("*")) {
      this._setMode("bookmarks");
      const bookmarkResults = await this._searchBookmarks(q.slice(1).trim());
      results = results.concat(bookmarkResults);
    } else {
      this._setMode("all");

      if (q) {
        // Search everything
        const tabs = this._searchTabs(q);
        const commands = this._searchCommands(q);

        let history = [];
        let bookmarks = [];
        try {
          [history, bookmarks] = await Promise.all([
            this._searchHistory(q),
            this._searchBookmarks(q),
          ]);
        } catch (_) {
          // Services unavailable
        }

        results = results.concat(
          tabs.map(r => Object.assign(r, { category: "Tabs" })),
          commands.map(r => Object.assign(r, { category: "Commands" })),
          bookmarks.slice(0, 5).map(r => Object.assign(r, { category: "Bookmarks" })),
          history.slice(0, 5).map(r => Object.assign(r, { category: "History" }))
        );
      } else {
        // Empty query — show recent searches
        for (const recent of this._recentSearches.slice(0, 8)) {
          results.push({
            type: "recent",
            icon: "\u{1F552}",
            title: recent,
            subtitle: "Recent search",
            category: "Recent",
            action: () => {
              this._input.value = recent;
              this._input.focus();
              this._search(recent);
            },
          });
        }
      }
    }

    this._results = results;
    this._selectedIndex = results.length > 0 ? 0 : -1;
    this._renderResults();
  },

  // ── Search providers ────────────────────────────────────────────────────────

  _searchTabs(query) {
    const results = [];
    try {
      if (!gBrowser || !gBrowser.tabs) return results;
      for (const tab of gBrowser.tabs) {
        const title = (tab.label || "").toLowerCase();
        let url = "";
        try {
          url = (tab.linkedBrowser && tab.linkedBrowser.currentURI)
            ? tab.linkedBrowser.currentURI.spec.toLowerCase()
            : "";
        } catch (_) {
          // currentURI can throw
        }

        if (!query || this._fuzzyMatch(query, title) || this._fuzzyMatch(query, url)) {
          let urlDisplay = "";
          try {
            urlDisplay = tab.linkedBrowser && tab.linkedBrowser.currentURI
              ? tab.linkedBrowser.currentURI.spec
              : "";
          } catch (_) {
            urlDisplay = "";
          }

          results.push({
            type: "tab",
            icon: tab.image || null,
            title: tab.label || "New Tab",
            subtitle: urlDisplay,
            action: () => {
              gBrowser.selectedTab = tab;
              this.hide();
            },
            score: this._fuzzyScore(query, title),
          });
        }
      }
    } catch (_) {
      // gBrowser not available
    }
    return results.sort((a, b) => b.score - a.score);
  },

  _searchCommands(query) {
    return this.COMMANDS
      .filter(cmd => !query || this._fuzzyMatch(query, cmd.label.toLowerCase()))
      .map(cmd => ({
        type: "command",
        icon: cmd.icon,
        title: cmd.label,
        subtitle: "Command",
        action: () => {
          try { cmd.action(); } catch (_) { /* Command may reference unavailable module */ }
          this.hide();
        },
        score: this._fuzzyScore(query, cmd.label.toLowerCase()),
      }))
      .sort((a, b) => b.score - a.score);
  },

  async _searchHistory(query) {
    if (!query || query.length < 2) return [];
    try {
      if (typeof Cc === "undefined" || typeof Ci === "undefined") return [];
      const historyService = Cc["@mozilla.org/browser/nav-history-service;1"];
      if (!historyService) return [];
      const svc = historyService.getService(Ci.nsINavHistoryService);
      if (!svc) return [];

      const options = svc.getNewQueryOptions();
      options.maxResults = 10;
      options.sortingMode = options.SORT_BY_VISITCOUNT_DESCENDING;

      const histQuery = svc.getNewQuery();
      histQuery.searchTerms = query;

      const result = svc.executeQuery(histQuery, options);
      const root = result.root;
      root.containerOpen = true;

      const results = [];
      for (let i = 0; i < root.childCount; i++) {
        const node = root.getChild(i);
        const uri = node.uri;
        const nodeTitle = node.title || uri;
        results.push({
          type: "history",
          icon: "\u{1F552}",
          title: nodeTitle,
          subtitle: uri,
          action: () => {
            this._addRecentSearch(query);
            gBrowser.addTab(uri, {
              triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
            });
            this.hide();
          },
        });
      }

      root.containerOpen = false;
      return results;
    } catch (_) {
      return [];
    }
  },

  async _searchBookmarks(query) {
    if (!query || query.length < 2) return [];
    try {
      if (typeof Cc === "undefined" || typeof Ci === "undefined") return [];
      const histComponent = Cc["@mozilla.org/browser/nav-history-service;1"];
      if (!histComponent) return [];
      const svc = histComponent.getService(Ci.nsINavHistoryService);
      if (!svc) return [];

      const options = svc.getNewQueryOptions();
      options.maxResults = 10;
      options.queryType = options.QUERY_TYPE_BOOKMARKS;

      const histQuery = svc.getNewQuery();
      histQuery.searchTerms = query;

      const result = svc.executeQuery(histQuery, options);
      const root = result.root;
      root.containerOpen = true;

      const results = [];
      for (let i = 0; i < root.childCount; i++) {
        const node = root.getChild(i);
        const uri = node.uri;
        const nodeTitle = node.title || uri;
        results.push({
          type: "bookmark",
          icon: "\u2605",
          title: nodeTitle,
          subtitle: uri,
          action: () => {
            this._addRecentSearch(query);
            gBrowser.addTab(uri, {
              triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
            });
            this.hide();
          },
        });
      }

      root.containerOpen = false;
      return results;
    } catch (_) {
      return [];
    }
  },

  // ── Fuzzy matching ──────────────────────────────────────────────────────────

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
        if (ti === qi) score += 3;
        consecutive++;
        qi++;
      } else {
        consecutive = 0;
      }
    }

    if (text.startsWith(query)) score += 10;
    return qi === query.length ? score : -1;
  },

  // ── Render results ──────────────────────────────────────────────────────────

  _renderResults() {
    // Clear existing children without innerHTML
    while (this._resultList.firstChild) {
      this._resultList.removeChild(this._resultList.firstChild);
    }

    if (this._results.length === 0) {
      if (this._input.value.trim()) {
        const empty = document.createElement("div");
        empty.textContent = "No results found";
        const emptyS = empty.style;
        emptyS.textAlign = "center";
        emptyS.padding = "24px";
        emptyS.color = "var(--solace-text-tertiary)";
        emptyS.fontSize = "13px";
        emptyS.fontFamily = "var(--solace-font-family)";
        this._resultList.appendChild(empty);
        this._resultsCard.style.display = "block";
      } else if (this._recentSearches.length === 0) {
        this._resultsCard.style.display = "none";
      }
      return;
    }

    this._resultsCard.style.display = "block";
    let currentCategory = "";

    for (let i = 0; i < this._results.length; i++) {
      const r = this._results[i];

      // Category header
      if (r.category && r.category !== currentCategory) {
        currentCategory = r.category;
        const header = document.createElement("div");
        header.textContent = currentCategory;
        const headerS = header.style;
        headerS.fontSize = "10px";
        headerS.fontWeight = "600";
        headerS.textTransform = "uppercase";
        headerS.letterSpacing = "1px";
        headerS.color = "var(--solace-text-tertiary)";
        headerS.padding = "10px 12px 4px";
        headerS.fontFamily = "var(--solace-font-family)";
        this._resultList.appendChild(header);
      }

      const item = document.createElement("div");
      const itemS = item.style;
      itemS.display = "flex";
      itemS.alignItems = "center";
      itemS.gap = "12px";
      itemS.padding = "8px 12px";
      itemS.borderRadius = "10px";
      itemS.cursor = "pointer";
      itemS.transition = "background 100ms ease-out";
      itemS.fontFamily = "var(--solace-font-family)";

      if (i === this._selectedIndex) {
        itemS.background = "var(--solace-bg-selected)";
      }

      // Use closure for index capture
      ((idx) => {
        item.addEventListener("mouseenter", () => {
          this._selectedIndex = idx;
          this._highlightSelected();
        });
        item.addEventListener("click", () => {
          if (this._results[idx]) this._results[idx].action();
        });
      })(i);

      // Icon
      const iconEl = document.createElement("span");
      const iconElS = iconEl.style;
      iconElS.width = "24px";
      iconElS.height = "24px";
      iconElS.display = "flex";
      iconElS.alignItems = "center";
      iconElS.justifyContent = "center";
      iconElS.flexShrink = "0";
      iconElS.fontSize = "14px";
      iconElS.borderRadius = "6px";
      iconElS.background = "var(--solace-bg-hover)";
      iconElS.color = "var(--solace-text-secondary)";

      if (r.type === "tab" && r.icon && r.icon.indexOf("chrome://") !== 0) {
        const img = document.createElement("img");
        img.src = r.icon;
        img.style.width = "16px";
        img.style.height = "16px";
        img.style.borderRadius = "3px";
        img.onerror = function() { this.style.display = "none"; };
        iconEl.appendChild(img);
      } else if (r.type === "bang-suggestion" || r.type === "bang-action") {
        iconEl.textContent = "!";
        iconElS.fontWeight = "700";
        iconElS.color = "var(--solace-purple-light)";
        iconElS.background = "var(--solace-bg-selected)";
      } else if (r.type === "calculator") {
        iconEl.textContent = "=";
        iconElS.fontWeight = "700";
        iconElS.color = "var(--solace-green)";
      } else if (r.type === "navigate") {
        iconEl.textContent = "\u2192";
        iconElS.color = "var(--solace-blue)";
      } else {
        iconEl.textContent = (typeof r.icon === "string" && r.icon) ? r.icon : "\u{1F4C4}";
      }

      // Text container
      const textEl = document.createElement("div");
      textEl.style.flex = "1";
      textEl.style.minWidth = "0";

      const titleEl = document.createElement("div");
      titleEl.textContent = r.title;
      const titleElS = titleEl.style;
      titleElS.fontSize = "13px";
      titleElS.color = "var(--solace-text-primary)";
      titleElS.whiteSpace = "nowrap";
      titleElS.overflow = "hidden";
      titleElS.textOverflow = "ellipsis";

      textEl.appendChild(titleEl);

      if (r.subtitle) {
        const subtitleEl = document.createElement("div");
        subtitleEl.textContent = r.subtitle;
        const subtitleElS = subtitleEl.style;
        subtitleElS.fontSize = "11px";
        subtitleElS.color = "var(--solace-text-tertiary)";
        subtitleElS.whiteSpace = "nowrap";
        subtitleElS.overflow = "hidden";
        subtitleElS.textOverflow = "ellipsis";
        textEl.appendChild(subtitleEl);
      }

      // Keyboard hint for selected item
      if (i === this._selectedIndex) {
        const hint = document.createElement("span");
        hint.textContent = "\u21B5";
        const hintS = hint.style;
        hintS.fontSize = "12px";
        hintS.color = "var(--solace-text-tertiary)";
        hintS.flexShrink = "0";
        hintS.marginLeft = "8px";
        item.appendChild(iconEl);
        item.appendChild(textEl);
        item.appendChild(hint);
      } else {
        item.appendChild(iconEl);
        item.appendChild(textEl);
      }

      this._resultList.appendChild(item);
    }

    // Scroll selected into view
    this._scrollSelectedIntoView();
  },

  _highlightSelected() {
    const items = this._resultList.querySelectorAll("div[style*='cursor: pointer']");
    // Re-render is simpler and avoids stale state
    this._renderResults();
  },

  _scrollSelectedIntoView() {
    // Find the selected item among the result items
    let itemIndex = 0;
    for (let child = this._resultList.firstChild; child; child = child.nextSibling) {
      // Skip category headers (they don't have cursor: pointer)
      if (child.style && child.style.cursor === "pointer") {
        if (itemIndex === this._selectedIndex) {
          child.scrollIntoView({ block: "nearest" });
          break;
        }
        itemIndex++;
      }
    }
  },

  // ── Keyboard navigation ─────────────────────────────────────────────────────

  _onKeyDown(e) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (this._results.length > 0) {
          this._selectedIndex = Math.min(this._selectedIndex + 1, this._results.length - 1);
          this._renderResults();
        }
        break;

      case "ArrowUp":
        e.preventDefault();
        if (this._results.length > 0) {
          this._selectedIndex = Math.max(this._selectedIndex - 1, 0);
          this._renderResults();
        }
        break;

      case "Enter":
        e.preventDefault();
        if (this._selectedIndex >= 0 && this._results[this._selectedIndex]) {
          const query = this._input.value.trim();
          if (query && this._results[this._selectedIndex].type !== "recent") {
            this._addRecentSearch(query);
          }
          this._results[this._selectedIndex].action();
        }
        break;

      case "Escape":
        e.preventDefault();
        this.hide();
        break;

      case "Tab":
        e.preventDefault();
        if (e.shiftKey) {
          this._cycleCategoryBackward();
        } else {
          this._cycleCategoryForward();
        }
        break;

      case "Backspace":
        // If bang is active and input only has the bang prefix left, clear the bang
        if (this._activeBang) {
          const val = this._input.value.trim();
          if (val === this._activeBang || val.length <= this._activeBang.length) {
            this._activeBang = null;
            this._bangChip.style.display = "none";
          }
        }
        break;
    }
  },

  _cycleCategoryForward() {
    const categories = this._getVisibleCategories();
    if (categories.length === 0) return;
    this._currentCategoryIndex = (this._currentCategoryIndex + 1) % categories.length;
    this._selectFirstInCategory(categories[this._currentCategoryIndex]);
  },

  _cycleCategoryBackward() {
    const categories = this._getVisibleCategories();
    if (categories.length === 0) return;
    this._currentCategoryIndex =
      (this._currentCategoryIndex - 1 + categories.length) % categories.length;
    this._selectFirstInCategory(categories[this._currentCategoryIndex]);
  },

  _getVisibleCategories() {
    const seen = [];
    for (const r of this._results) {
      if (r.category && seen.indexOf(r.category) === -1) {
        seen.push(r.category);
      }
    }
    return seen;
  },

  _selectFirstInCategory(category) {
    for (let i = 0; i < this._results.length; i++) {
      if (this._results[i].category === category) {
        this._selectedIndex = i;
        this._renderResults();
        return;
      }
    }
  },

  // ── Cleanup ─────────────────────────────────────────────────────────────────

  uninit() {
    if (this._overlay) {
      this._overlay.remove();
    }
  },
};
