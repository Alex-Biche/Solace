/* ═══════════════════════════════════════════════════════════════════════════════
   Solace Browser — Vertical Tabs Sidebar
   Core sidebar component managing vertical tabs, tab groups,
   pinned tabs, multi-select, drag-and-drop, and tab sleep.
   ═══════════════════════════════════════════════════════════════════════════════ */

"use strict";

var SolaceSidebar = {
  _sidebar: null,
  _tabList: null,
  _pinnedContainer: null,
  _searchInput: null,
  _collapsed: false,
  _resizing: false,
  _multiSelected: new Set(),
  _tabSleepTimers: new Map(),
  _tabHeatmap: new Map(),
  _tabIdCounter: 0,

  get TAB_SLEEP_TIMEOUT() {
    return Services.prefs.getIntPref("solace.tab-sleep.timeout-minutes", 5) * 60 * 1000;
  },

  init() {
    this._buildSidebar();
    this._bindEvents();
    this._syncTabsFromBrowser();
    this._initTabSleep();
    this._initTabHeatmap();

    // Load collapsed state
    this._collapsed = Services.prefs.getBoolPref("solace.sidebar.collapsed", false);
    if (this._collapsed) {
      this._sidebar.setAttribute("collapsed", "");
      this._updateCollapseIcon();
    }
  },

  // ── Build the sidebar DOM ────────────────────────────────────────────────
  // Uses proper DOM APIs instead of innerHTML, which does not work reliably
  // on XUL elements in Firefox chrome.
  _buildSidebar() {
    const sidebar = document.createXULElement("vbox");
    sidebar.id = "solace-sidebar";

    // -- Profile bar --
    const profileBar = this._createElement("div", { id: "solace-profile-bar" });
    const profileAvatar = this._createElement("div", {
      className: "solace-profile-avatar",
      textContent: "S",
      style: "background: var(--solace-accent-user, var(--solace-purple));",
    });
    const profileName = this._createElement("span", {
      className: "solace-profile-name",
      textContent: "Default Profile",
    });
    const profileArrow = this._createElement("span", {
      className: "solace-profile-switcher-arrow",
      textContent: "\u25BE", // ▾
    });
    profileBar.append(profileAvatar, profileName, profileArrow);

    // -- Workspace bar --
    const workspaceBar = this._createElement("div", { id: "solace-workspace-bar" });
    const workspacePill = this._createElement("div", { className: "solace-workspace-pill" });
    workspacePill.setAttribute("active", "");
    workspacePill.dataset.workspace = "default";
    workspacePill.append(
      this._createElement("span", { className: "workspace-icon", textContent: "\uD83C\uDFE0" }),
      this._createElement("span", { className: "solace-workspace-label", textContent: "Home" }),
      this._createElement("span", { className: "workspace-count", textContent: "0" })
    );
    const workspaceAdd = this._createElement("div", {
      className: "solace-workspace-add",
      textContent: "+",
    });
    workspaceAdd.title = "New Workspace";
    workspaceBar.append(workspacePill, workspaceAdd);

    // -- Tab search --
    const tabSearch = this._createElement("div", { id: "solace-tab-search" });
    const searchInput = this._createElement("input", { type: "text" });
    searchInput.placeholder = "Search tabs\u2026";
    tabSearch.appendChild(searchInput);

    // -- Pinned tabs container --
    const pinnedTabs = this._createElement("div", { id: "solace-pinned-tabs" });

    // -- Tab list --
    const tabList = this._createElement("div", { id: "solace-tab-list" });
    tabList.setAttribute("role", "listbox");
    tabList.tabIndex = 0;

    // -- New tab button --
    const newTabBtn = this._createElement("div", { id: "solace-new-tab-btn" });
    newTabBtn.append(
      this._createElement("span", { className: "plus-icon", textContent: "+" }),
      this._createElement("span", { className: "solace-sidebar-label", textContent: "New Tab" })
    );

    // -- Footer --
    const footer = this._createElement("div", { id: "solace-sidebar-footer" });
    const footerButtons = [
      { id: "solace-btn-notes", title: "Notes", text: "\uD83D\uDCDD" },
      { id: "solace-btn-reading", title: "Reading Queue", text: "\uD83D\uDCD6" },
      { id: "solace-btn-sessions", title: "Sessions", text: "\uD83D\uDCBE" },
      { id: "solace-btn-settings", title: "Settings", text: "\u2699" },
      { id: "solace-sidebar-collapse", title: "Collapse", text: "\u25C0" },
    ];
    for (const btn of footerButtons) {
      const el = this._createElement("div", {
        id: btn.id,
        className: "solace-sidebar-action",
        textContent: btn.text,
      });
      el.title = btn.title;
      footer.appendChild(el);
    }

    // -- Resize handle --
    const resizeHandle = this._createElement("div", { id: "solace-sidebar-resize" });

    // Assemble sidebar
    sidebar.append(
      profileBar,
      workspaceBar,
      tabSearch,
      pinnedTabs,
      tabList,
      newTabBtn,
      footer,
      resizeHandle
    );

    // Insert before the browser content
    const browser = document.getElementById("browser");
    browser.parentNode.insertBefore(sidebar, browser);
    browser.style.marginLeft = "var(--solace-sidebar-width)";

    this._sidebar = sidebar;
    this._tabList = tabList;
    this._pinnedContainer = pinnedTabs;
    this._searchInput = searchInput;
  },

  // ── Utility: create an HTML element with properties ─────────────────────
  _createElement(tag, props = {}) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (key === "className") {
        el.className = value;
      } else if (key === "textContent") {
        el.textContent = value;
      } else if (key === "style" && typeof value === "string") {
        el.setAttribute("style", value);
      } else {
        el[key] = value;
      }
    }
    return el;
  },

  // ── Generate a stable tab identifier ────────────────────────────────────
  // tab.linkedPanel can be undefined for lazy/discarded tabs, so we fall
  // back to a monotonically increasing counter stored on the tab itself.
  _getTabId(tab) {
    if (tab.linkedPanel) {
      return tab.linkedPanel;
    }
    if (!tab.__solaceId) {
      tab.__solaceId = "solace-tab-" + (++this._tabIdCounter);
    }
    return tab.__solaceId;
  },

  // ── Event binding ────────────────────────────────────────────────────────
  _bindEvents() {
    // New tab button
    this._sidebar.querySelector("#solace-new-tab-btn").addEventListener("click", () => {
      this._openNewTab();
    });

    // Collapse toggle
    this._sidebar.querySelector("#solace-sidebar-collapse").addEventListener("click", () => {
      this._toggleCollapse();
    });

    // Tab search
    this._searchInput.addEventListener("input", (e) => {
      this._filterTabs(e.target.value);
    });

    // Profile bar: click to switch profile, scroll to top of tab list
    this._sidebar.querySelector("#solace-profile-bar").addEventListener("click", () => {
      this._tabList.scrollTo({ top: 0, behavior: "smooth" });
      SolaceProfiles.showProfileSwitcher();
    });

    // Workspace add
    this._sidebar.querySelector(".solace-workspace-add").addEventListener("click", () => {
      SolaceWorkspaces.createWorkspace();
    });

    // Double-click on empty space in tab list to create a new tab
    this._tabList.addEventListener("dblclick", (e) => {
      if (e.target === this._tabList) {
        this._openNewTab();
      }
    });

    // Keyboard navigation within the sidebar tab list
    this._tabList.addEventListener("keydown", (e) => this._onTabListKeydown(e));

    // Sidebar resize
    this._initResize();

    // Listen for Firefox tab events
    const events = [
      "TabOpen", "TabClose", "TabSelect", "TabAttrModified",
      "TabMove", "TabPinned", "TabUnpinned",
    ];
    for (const evt of events) {
      gBrowser.tabContainer.addEventListener(evt, (e) => this["_on" + evt](e));
    }

    // Keyboard shortcut for sidebar toggle
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        this._toggleCollapse();
      }
    });

    // Footer action buttons
    this._sidebar.querySelector("#solace-btn-notes").addEventListener("click", () => {
      SolaceNotes.toggle();
    });
    this._sidebar.querySelector("#solace-btn-reading").addEventListener("click", () => {
      SolaceReadingQueue.toggle();
    });
    this._sidebar.querySelector("#solace-btn-sessions").addEventListener("click", () => {
      SolaceSessions.toggle();
    });
    this._sidebar.querySelector("#solace-btn-settings").addEventListener("click", () => {
      gBrowser.addTab("about:preferences", {
        triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
      });
    });
  },

  // ── Open a new tab (shared helper) ──────────────────────────────────────
  _openNewTab() {
    gBrowser.addTab("about:solace-newtab", {
      triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
    });
  },

  // ── Sync tabs from Firefox's internal tab list ──────────────────────────
  _syncTabsFromBrowser() {
    // Clear containers using DOM API (not innerHTML)
    while (this._tabList.firstChild) {
      this._tabList.firstChild.remove();
    }
    while (this._pinnedContainer.firstChild) {
      this._pinnedContainer.firstChild.remove();
    }

    for (const tab of gBrowser.tabs) {
      this._createTabElement(tab);
    }

    this._updateWorkspaceCount();
  },

  // ── Create a sidebar tab element for a Firefox tab ──────────────────────
  _createTabElement(tab) {
    const tabId = this._getTabId(tab);
    const el = this._createElement("div", { className: "solace-tab" });
    el.dataset.tabId = tabId;
    el.setAttribute("role", "option");
    el._tab = tab;

    // Favicon
    const favicon = this._createElement("img", { className: "solace-tab-favicon" });
    favicon.src = tab.image || "chrome://branding/content/icon32.png";
    favicon.addEventListener("error", () => {
      favicon.src = "chrome://branding/content/icon32.png";
    });

    // Title with tooltip for truncated text
    const title = this._createElement("span", {
      className: "solace-tab-title",
      textContent: tab.label || "New Tab",
    });
    title.title = tab.label || "New Tab";

    // Sleep indicator
    const sleepIndicator = this._createElement("div", { className: "solace-tab-sleep-indicator" });
    sleepIndicator.title = "Tab is sleeping";

    // Sound icon
    const soundIcon = this._createElement("div", {
      className: "solace-tab-sound",
      textContent: "\uD83D\uDD0A", // speaker emoji
    });
    soundIcon.addEventListener("click", (e) => {
      e.stopPropagation();
      tab.toggleMuteAudio();
    });

    // Close button
    const closeBtn = this._createElement("div", {
      className: "solace-tab-close",
      textContent: "\u00D7", // multiplication sign
    });
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      gBrowser.removeTab(tab);
    });

    // Heatmap overlay
    const heatmap = this._createElement("div", { className: "solace-tab-heatmap" });

    el.append(favicon, title, sleepIndicator, soundIcon, closeBtn, heatmap);

    // Left click to select, with modifier support
    el.addEventListener("click", (e) => {
      if (e.ctrlKey || e.metaKey) {
        this._toggleMultiSelect(tab, el);
      } else if (e.shiftKey) {
        this._rangeSelect(tab);
      } else {
        this._clearMultiSelect();
        gBrowser.selectedTab = tab;
      }
    });

    // Middle-click to close
    el.addEventListener("auxclick", (e) => {
      if (e.button === 1) {
        e.preventDefault();
        gBrowser.removeTab(tab);
      }
    });

    // Context menu
    el.addEventListener("contextmenu", (e) => {
      this._showTabContextMenu(e, tab);
    });

    // Drag and drop
    el.draggable = true;
    el.addEventListener("dragstart", (e) => this._onDragStart(e, tab));
    el.addEventListener("dragover", (e) => this._onDragOver(e));
    el.addEventListener("drop", (e) => this._onDrop(e, tab));
    el.addEventListener("dragend", (e) => this._onDragEnd(e));

    // Update state attributes
    if (tab.selected) el.setAttribute("selected", "");
    if (tab.pinned) el.setAttribute("pinned", "");
    if (tab.soundPlaying) el.setAttribute("audible", "");
    if (tab.hasAttribute && tab.hasAttribute("pending")) el.setAttribute("sleeping", "");

    // Add to correct container
    if (tab.pinned) {
      this._pinnedContainer.appendChild(el);
    } else {
      this._tabList.appendChild(el);
    }

    return el;
  },

  // ── Tab event handlers ─────────────────────────────────────────────────────
  _onTabOpen(e) {
    const el = this._createTabElement(e.target);
    // Subtle entrance animation
    el.animate(
      [
        { opacity: 0, transform: "translateX(-12px)" },
        { opacity: 1, transform: "translateX(0)" },
      ],
      { duration: 200, easing: "ease-out", fill: "forwards" }
    );
    this._updateWorkspaceCount();
    this._resetTabSleepTimer(e.target);
    // Scroll the new tab into view
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  },

  _onTabClose(e) {
    const el = this._findTabElement(e.target);
    if (el) {
      const anim = el.animate(
        [
          { opacity: 1, transform: "translateX(0)" },
          { opacity: 0, transform: "translateX(-12px)" },
        ],
        { duration: 150, easing: "ease-in", fill: "forwards" }
      );
      anim.onfinish = () => el.remove();
    }
    this._tabSleepTimers.delete(e.target);
    this._tabHeatmap.delete(e.target);
    this._multiSelected.delete(e.target);
    this._updateWorkspaceCount();
  },

  _onTabSelect(e) {
    // Deselect all
    for (const el of this._sidebar.querySelectorAll(".solace-tab[selected]")) {
      el.removeAttribute("selected");
    }

    const el = this._findTabElement(e.target);
    if (el) {
      el.setAttribute("selected", "");
      // Scroll selected tab into view
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }

    // Wake up sleeping tab
    this._wakeTab(e.target);
    this._resetTabSleepTimer(e.target);
    this._incrementHeatmap(e.target);
  },

  _onTabAttrModified(e) {
    const el = this._findTabElement(e.target);
    if (!el) return;

    const tab = e.target;
    const title = el.querySelector(".solace-tab-title");
    const favicon = el.querySelector(".solace-tab-favicon");

    if (title) {
      const label = tab.label || "New Tab";
      title.textContent = label;
      title.title = label;
    }
    if (favicon) {
      favicon.src = tab.image || "chrome://branding/content/icon32.png";
    }

    if (tab.soundPlaying) {
      el.setAttribute("audible", "");
    } else {
      el.removeAttribute("audible");
    }
  },

  _onTabMove(e) {
    this._syncTabsFromBrowser();
  },

  _onTabPinned(e) {
    const el = this._findTabElement(e.target);
    if (el) {
      el.setAttribute("pinned", "");
      this._pinnedContainer.appendChild(el);
    }
  },

  _onTabUnpinned(e) {
    const el = this._findTabElement(e.target);
    if (el) {
      el.removeAttribute("pinned");
      this._tabList.appendChild(el);
    }
  },

  // ── Tab sleep system ───────────────────────────────────────────────────────
  _initTabSleep() {
    setInterval(() => this._checkSleepingTabs(), 60000);
  },

  _resetTabSleepTimer(tab) {
    if (this._tabSleepTimers.has(tab)) {
      clearTimeout(this._tabSleepTimers.get(tab));
    }

    const timer = setTimeout(() => {
      this._sleepTab(tab);
    }, this.TAB_SLEEP_TIMEOUT);

    this._tabSleepTimers.set(tab, timer);
  },

  _sleepTab(tab) {
    if (tab.selected || tab.pinned) return;
    // Respect user prefs for sleep exclusions
    if (Services.prefs.getBoolPref("solace.tab-sleep.exclude-pinned", true) && tab.pinned) return;
    if (Services.prefs.getBoolPref("solace.tab-sleep.exclude-playing-audio", true) && tab.soundPlaying) return;
    if (!Services.prefs.getBoolPref("solace.tab-sleep.enabled", true)) return;

    if (!tab.hasAttribute("pending")) {
      try {
        gBrowser.discardBrowser(tab);
      } catch (e) {
        console.debug("[Solace Sidebar] Could not discard tab:", e.message);
        return;
      }

      tab.setAttribute("solace-sleeping", "true");
      const el = this._findTabElement(tab);
      if (el) el.setAttribute("sleeping", "");
    }
  },

  _wakeTab(tab) {
    const el = this._findTabElement(tab);
    if (el) el.removeAttribute("sleeping");
  },

  _checkSleepingTabs() {
    for (const tab of gBrowser.tabs) {
      if (!tab.selected && !tab.pinned && !this._tabSleepTimers.has(tab)) {
        this._resetTabSleepTimer(tab);
      }
    }
  },

  // ── Tab heatmap ────────────────────────────────────────────────────────────
  _initTabHeatmap() {
    if (!Services.prefs.getBoolPref("solace.tab-heatmap.enabled", true)) return;
  },

  _incrementHeatmap(tab) {
    const count = (this._tabHeatmap.get(tab) || 0) + 1;
    this._tabHeatmap.set(tab, count);
    this._updateHeatmapVisual(tab, count);
  },

  _updateHeatmapVisual(tab, count) {
    const el = this._findTabElement(tab);
    if (!el) return;

    const heatmap = el.querySelector(".solace-tab-heatmap");
    if (!heatmap) return;

    const values = this._tabHeatmap.values();
    let maxCount = 1;
    for (const v of values) {
      if (v > maxCount) maxCount = v;
    }
    const intensity = count / maxCount;

    const r = Math.round(108 + (255 - 108) * intensity);
    const g = Math.round(92 * (1 - intensity));
    const b = Math.round(231 * (1 - intensity * 0.5));

    heatmap.style.background = `rgba(${r}, ${g}, ${b}, ${0.3 + intensity * 0.5})`;
  },

  // ── Multi-select ───────────────────────────────────────────────────────────
  _toggleMultiSelect(tab, el) {
    if (this._multiSelected.has(tab)) {
      this._multiSelected.delete(tab);
      el.removeAttribute("multiselected");
    } else {
      this._multiSelected.add(tab);
      el.setAttribute("multiselected", "");
    }
  },

  _rangeSelect(targetTab) {
    const tabs = Array.from(gBrowser.tabs);
    const currentIndex = tabs.indexOf(gBrowser.selectedTab);
    const targetIndex = tabs.indexOf(targetTab);

    const start = Math.min(currentIndex, targetIndex);
    const end = Math.max(currentIndex, targetIndex);

    this._clearMultiSelect();
    for (let i = start; i <= end; i++) {
      const el = this._findTabElement(tabs[i]);
      if (el) {
        this._multiSelected.add(tabs[i]);
        el.setAttribute("multiselected", "");
      }
    }
  },

  _clearMultiSelect() {
    this._multiSelected.clear();
    for (const el of this._sidebar.querySelectorAll(".solace-tab[multiselected]")) {
      el.removeAttribute("multiselected");
    }
  },

  // ── Drag and drop ──────────────────────────────────────────────────────────
  _onDragStart(e, tab) {
    const tabId = this._getTabId(tab);
    e.dataTransfer.setData("text/plain", tabId);
    e.target.setAttribute("dragging", "");
  },

  _onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  },

  _onDrop(e, targetTab) {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData("text/plain");

    // gBrowser.tabs is an HTMLCollection, not an Array -- convert first
    const sourceTab = Array.from(gBrowser.tabs).find(
      (t) => this._getTabId(t) === sourceId
    );

    if (sourceTab && sourceTab !== targetTab) {
      const targetIndex = Array.from(gBrowser.tabs).indexOf(targetTab);
      if (targetIndex !== -1) {
        gBrowser.moveTabTo(sourceTab, targetIndex);
      }
    }
  },

  _onDragEnd(e) {
    e.target.removeAttribute("dragging");
    for (const el of this._sidebar.querySelectorAll(".solace-tab-drop-indicator")) {
      el.remove();
    }
  },

  // ── Tab search / filter (fuzzy) ────────────────────────────────────────────
  _filterTabs(query) {
    const lower = query.toLowerCase();

    for (const el of this._tabList.querySelectorAll(".solace-tab")) {
      if (!query) {
        el.style.display = "";
        continue;
      }
      const title = (el.querySelector(".solace-tab-title").textContent || "").toLowerCase();
      const match = this._fuzzyMatch(lower, title);
      el.style.display = match ? "" : "none";
    }
  },

  /**
   * Simple fuzzy match: every character in the pattern must appear in order
   * within the target string, but not necessarily contiguously.
   */
  _fuzzyMatch(pattern, text) {
    let pi = 0;
    for (let ti = 0; ti < text.length && pi < pattern.length; ti++) {
      if (text[ti] === pattern[pi]) {
        pi++;
      }
    }
    return pi === pattern.length;
  },

  // ── Tab context menu ───────────────────────────────────────────────────────
  _showTabContextMenu(e, tab) {
    e.preventDefault();

    // Remove any existing context menu
    const existing = document.getElementById("solace-tab-context-menu");
    if (existing) existing.remove();

    const menu = document.createXULElement("menupopup");
    menu.id = "solace-tab-context-menu";

    const items = [
      { label: "Reload", action: () => gBrowser.reloadTab(tab) },
      {
        label: tab.pinned ? "Unpin Tab" : "Pin Tab",
        action: () => {
          if (tab.pinned) gBrowser.unpinTab(tab);
          else gBrowser.pinTab(tab);
        },
      },
      { type: "separator" },
      { label: "Split Left", action: () => SolaceSplitView.splitLeft(tab) },
      { label: "Split Right", action: () => SolaceSplitView.splitRight(tab) },
      { type: "separator" },
      { label: "Move to Workspace\u2026", action: () => SolaceWorkspaces.showMoveDialog(tab) },
      { label: "Add to Group\u2026", action: () => this._showGroupDialog(tab) },
      { label: "Set Site Color\u2026", action: () => this._showColorPicker(tab) },
      { type: "separator" },
      { label: "Duplicate Tab", action: () => gBrowser.duplicateTab(tab) },
      { label: "Sleep Tab", action: () => this._sleepTab(tab) },
      { label: "Save to Reading Queue", action: () => SolaceReadingQueue.addFromTab(tab) },
      { type: "separator" },
      {
        label: this._multiSelected.size > 1
          ? `Close ${this._multiSelected.size} Tabs`
          : "Close Tab",
        action: () => {
          if (this._multiSelected.size > 1) {
            for (const t of this._multiSelected) {
              gBrowser.removeTab(t);
            }
            this._clearMultiSelect();
          } else {
            gBrowser.removeTab(tab);
          }
        },
      },
      {
        label: "Close Other Tabs",
        action: () => gBrowser.removeAllTabsBut(tab),
      },
    ];

    for (const item of items) {
      if (item.type === "separator") {
        menu.appendChild(document.createXULElement("menuseparator"));
      } else {
        const mi = document.createXULElement("menuitem");
        mi.setAttribute("label", item.label);
        mi.addEventListener("command", item.action);
        menu.appendChild(mi);
      }
    }

    const popupSet = document.getElementById("mainPopupSet");
    popupSet.appendChild(menu);

    // Use proper XUL popup positioning: anchor at screen coordinates
    menu.openPopup(null, "after_pointer", 0, 0, true, false, e);
  },

  _showGroupDialog(tab) {
    SolaceTabGroups.showAssignDialog(tab);
  },

  _showColorPicker(tab) {
    const colors = [
      "#d63031", "#e17055", "#ffeaa7", "#00cec9",
      "#74b9ff", "#6C5CE7", "#fd79a8", "#636e72",
    ];
    // Placeholder: pick a random color. A real implementation would show a popup picker.
    const color = colors[Math.floor(Math.random() * colors.length)];
    const el = this._findTabElement(tab);
    if (el) {
      el.setAttribute("data-site-color", "");
      el.style.setProperty("--tab-site-color", color);
    }
  },

  // ── Keyboard navigation within the sidebar ─────────────────────────────────
  _onTabListKeydown(e) {
    const tabEls = Array.from(this._tabList.querySelectorAll(".solace-tab:not([style*='display: none'])"));
    if (!tabEls.length) return;

    const currentEl = this._tabList.querySelector(".solace-tab[selected]");
    const currentIndex = currentEl ? tabEls.indexOf(currentEl) : -1;
    let nextIndex = -1;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        nextIndex = currentIndex < tabEls.length - 1 ? currentIndex + 1 : 0;
        break;
      case "ArrowUp":
        e.preventDefault();
        nextIndex = currentIndex > 0 ? currentIndex - 1 : tabEls.length - 1;
        break;
      case "Home":
        e.preventDefault();
        nextIndex = 0;
        break;
      case "End":
        e.preventDefault();
        nextIndex = tabEls.length - 1;
        break;
      case "Delete":
        if (currentEl && currentEl._tab) {
          e.preventDefault();
          gBrowser.removeTab(currentEl._tab);
        }
        return;
      default:
        return;
    }

    if (nextIndex >= 0 && nextIndex < tabEls.length) {
      const nextTab = tabEls[nextIndex]._tab;
      if (nextTab) {
        gBrowser.selectedTab = nextTab;
      }
    }
  },

  // ── Sidebar collapse ──────────────────────────────────────────────────────
  _toggleCollapse() {
    this._collapsed = !this._collapsed;

    if (this._collapsed) {
      this._sidebar.setAttribute("collapsed", "");
      document.getElementById("browser").style.marginLeft = "var(--solace-sidebar-collapsed-width)";
    } else {
      this._sidebar.removeAttribute("collapsed");
      document.getElementById("browser").style.marginLeft = "var(--solace-sidebar-width)";
    }

    this._updateCollapseIcon();
    Services.prefs.setBoolPref("solace.sidebar.collapsed", this._collapsed);
  },

  // Flip the collapse icon direction based on state
  _updateCollapseIcon() {
    const btn = this._sidebar.querySelector("#solace-sidebar-collapse");
    if (btn) {
      btn.textContent = this._collapsed ? "\u25B6" : "\u25C0"; // ▶ when collapsed, ◀ when expanded
    }
  },

  // ── Sidebar resize ────────────────────────────────────────────────────────
  _initResize() {
    const handle = this._sidebar.querySelector("#solace-sidebar-resize");
    let startX, startWidth;

    handle.addEventListener("mousedown", (e) => {
      startX = e.clientX;
      startWidth = this._sidebar.offsetWidth;
      this._resizing = true;
      handle.setAttribute("dragging", "");

      const onMove = (moveEvt) => {
        if (!this._resizing) return;
        const newWidth = Math.max(180, Math.min(500, startWidth + moveEvt.clientX - startX));
        document.documentElement.style.setProperty("--solace-sidebar-width", newWidth + "px");
        Services.prefs.setIntPref("solace.sidebar.width", newWidth);
      };

      const onUp = () => {
        this._resizing = false;
        handle.removeAttribute("dragging");
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  },

  // ── Helpers ────────────────────────────────────────────────────────────────
  _findTabElement(tab) {
    const tabId = this._getTabId(tab);
    if (!tabId) return null;
    return this._sidebar.querySelector(`.solace-tab[data-tab-id="${CSS.escape(tabId)}"]`);
  },

  _updateWorkspaceCount() {
    // Count only non-pinned tabs for the active workspace pill
    let count = 0;
    for (const tab of gBrowser.tabs) {
      if (!tab.pinned) count++;
    }
    const pill = this._sidebar.querySelector(".solace-workspace-pill[active] .workspace-count");
    if (pill) {
      pill.textContent = String(count);
    }
  },

  uninit() {
    for (const timer of this._tabSleepTimers.values()) {
      clearTimeout(timer);
    }
    this._tabSleepTimers.clear();
    this._tabHeatmap.clear();
    this._multiSelected.clear();
  },
};
