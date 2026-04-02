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

  TAB_SLEEP_TIMEOUT: 5 * 60 * 1000, // 5 minutes of inactivity

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
    }
  },

  // ── Build the sidebar DOM ────────────────────────────────────────────────
  _buildSidebar() {
    const sidebar = document.createXULElement("vbox");
    sidebar.id = "solace-sidebar";

    sidebar.innerHTML = `
      <div id="solace-profile-bar">
        <div class="solace-profile-avatar" style="background: var(--solace-purple);">S</div>
        <span class="solace-profile-name">Default Profile</span>
        <span class="solace-profile-switcher-arrow">▾</span>
      </div>

      <div id="solace-workspace-bar">
        <div class="solace-workspace-pill" active data-workspace="default">
          <span class="workspace-icon">🏠</span>
          <span class="solace-workspace-label">Home</span>
          <span class="workspace-count">0</span>
        </div>
        <div class="solace-workspace-add" title="New Workspace">+</div>
      </div>

      <div id="solace-tab-search">
        <input type="text" placeholder="Search tabs..." />
      </div>

      <div id="solace-pinned-tabs"></div>

      <div id="solace-tab-list"></div>

      <div id="solace-new-tab-btn">
        <span class="plus-icon">+</span>
        <span class="solace-sidebar-label">New Tab</span>
      </div>

      <div id="solace-sidebar-footer">
        <div class="solace-sidebar-action" id="solace-btn-notes" title="Notes">📝</div>
        <div class="solace-sidebar-action" id="solace-btn-reading" title="Reading Queue">📖</div>
        <div class="solace-sidebar-action" id="solace-btn-sessions" title="Sessions">💾</div>
        <div class="solace-sidebar-action" id="solace-btn-settings" title="Settings">⚙</div>
        <div class="solace-sidebar-action" id="solace-sidebar-collapse" title="Collapse">◀</div>
      </div>

      <div id="solace-sidebar-resize"></div>
    `;

    // Insert before the browser content
    const browser = document.getElementById("browser");
    browser.parentNode.insertBefore(sidebar, browser);

    // Shift content to make room for sidebar
    browser.style.marginLeft = "var(--solace-sidebar-width)";

    this._sidebar = sidebar;
    this._tabList = sidebar.querySelector("#solace-tab-list");
    this._pinnedContainer = sidebar.querySelector("#solace-pinned-tabs");
    this._searchInput = sidebar.querySelector("#solace-tab-search input");
  },

  // ── Event binding ────────────────────────────────────────────────────────
  _bindEvents() {
    // New tab button
    this._sidebar.querySelector("#solace-new-tab-btn").addEventListener("click", () => {
      gBrowser.addTab("about:solace-newtab", {
        triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
      });
    });

    // Collapse toggle
    this._sidebar.querySelector("#solace-sidebar-collapse").addEventListener("click", () => {
      this._toggleCollapse();
    });

    // Tab search
    this._searchInput.addEventListener("input", (e) => {
      this._filterTabs(e.target.value);
    });

    // Profile bar click
    this._sidebar.querySelector("#solace-profile-bar").addEventListener("click", () => {
      SolaceProfiles.showProfileSwitcher();
    });

    // Workspace add
    this._sidebar.querySelector(".solace-workspace-add").addEventListener("click", () => {
      SolaceWorkspaces.createWorkspace();
    });

    // Sidebar resize
    this._initResize();

    // Listen for Firefox tab events
    gBrowser.tabContainer.addEventListener("TabOpen", (e) => this._onTabOpen(e));
    gBrowser.tabContainer.addEventListener("TabClose", (e) => this._onTabClose(e));
    gBrowser.tabContainer.addEventListener("TabSelect", (e) => this._onTabSelect(e));
    gBrowser.tabContainer.addEventListener("TabAttrModified", (e) => this._onTabAttrModified(e));
    gBrowser.tabContainer.addEventListener("TabMove", (e) => this._onTabMove(e));
    gBrowser.tabContainer.addEventListener("TabPinned", (e) => this._onTabPinned(e));
    gBrowser.tabContainer.addEventListener("TabUnpinned", (e) => this._onTabUnpinned(e));

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

  // ── Sync tabs from Firefox's internal tab list ────────────────────────────
  _syncTabsFromBrowser() {
    this._tabList.innerHTML = "";
    this._pinnedContainer.innerHTML = "";

    for (const tab of gBrowser.tabs) {
      this._createTabElement(tab);
    }

    this._updateWorkspaceCount();
  },

  // ── Create a sidebar tab element for a Firefox tab ────────────────────────
  _createTabElement(tab) {
    const el = document.createElement("div");
    el.className = "solace-tab";
    el.dataset.tabId = tab.linkedPanel;
    el._tab = tab;

    const favicon = document.createElement("img");
    favicon.className = "solace-tab-favicon";
    favicon.src = tab.image || "chrome://branding/content/icon32.png";
    favicon.onerror = () => { favicon.src = "chrome://branding/content/icon32.png"; };

    const title = document.createElement("span");
    title.className = "solace-tab-title";
    title.textContent = tab.label || "New Tab";

    const sleepIndicator = document.createElement("div");
    sleepIndicator.className = "solace-tab-sleep-indicator";
    sleepIndicator.title = "Tab is sleeping";

    const soundIcon = document.createElement("div");
    soundIcon.className = "solace-tab-sound";
    soundIcon.textContent = "🔊";
    soundIcon.addEventListener("click", (e) => {
      e.stopPropagation();
      tab.toggleMuteAudio();
    });

    const closeBtn = document.createElement("div");
    closeBtn.className = "solace-tab-close";
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      gBrowser.removeTab(tab);
    });

    const heatmap = document.createElement("div");
    heatmap.className = "solace-tab-heatmap";

    el.appendChild(favicon);
    el.appendChild(title);
    el.appendChild(sleepIndicator);
    el.appendChild(soundIcon);
    el.appendChild(closeBtn);
    el.appendChild(heatmap);

    // Click to select
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

    // Update state
    if (tab.selected) el.setAttribute("selected", "");
    if (tab.pinned) el.setAttribute("pinned", "");
    if (tab.soundPlaying) el.setAttribute("audible", "");
    if (tab.hasAttribute("pending")) el.setAttribute("sleeping", "");

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
    el.style.animation = "solace-slide-in-left 200ms ease-out";
    this._updateWorkspaceCount();
    this._resetTabSleepTimer(e.target);
  },

  _onTabClose(e) {
    const el = this._findTabElement(e.target);
    if (el) {
      el.style.animation = "solace-fade-in 150ms ease-out reverse";
      el.addEventListener("animationend", () => el.remove());
    }
    this._tabSleepTimers.delete(e.target);
    this._updateWorkspaceCount();
  },

  _onTabSelect(e) {
    // Deselect all
    this._sidebar.querySelectorAll(".solace-tab[selected]").forEach((el) => {
      el.removeAttribute("selected");
    });

    const el = this._findTabElement(e.target);
    if (el) {
      el.setAttribute("selected", "");
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

    if (title) title.textContent = tab.label || "New Tab";
    if (favicon) favicon.src = tab.image || "chrome://branding/content/icon32.png";

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
    // Periodically check for inactive tabs
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

    // Discard the tab (Firefox's built-in mechanism)
    if (!tab.hasAttribute("pending")) {
      gBrowser.discardBrowser(tab);

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

    const maxCount = Math.max(...this._tabHeatmap.values(), 1);
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
    const tabs = [...gBrowser.tabs];
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
    this._sidebar.querySelectorAll(".solace-tab[multiselected]").forEach((el) => {
      el.removeAttribute("multiselected");
    });
  },

  // ── Drag and drop ──────────────────────────────────────────────────────────
  _onDragStart(e, tab) {
    e.dataTransfer.setData("text/plain", tab.linkedPanel);
    e.target.setAttribute("dragging", "");
  },

  _onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  },

  _onDrop(e, targetTab) {
    e.preventDefault();
    const sourcePanel = e.dataTransfer.getData("text/plain");
    const sourceTab = gBrowser.tabs.find((t) => t.linkedPanel === sourcePanel);
    if (sourceTab && sourceTab !== targetTab) {
      const targetIndex = Array.from(gBrowser.tabs).indexOf(targetTab);
      gBrowser.moveTabTo(sourceTab, targetIndex);
    }
  },

  _onDragEnd(e) {
    e.target.removeAttribute("dragging");
    this._sidebar.querySelectorAll(".solace-tab-drop-indicator").forEach((el) => el.remove());
  },

  // ── Tab search / filter ────────────────────────────────────────────────────
  _filterTabs(query) {
    const lower = query.toLowerCase();
    this._tabList.querySelectorAll(".solace-tab").forEach((el) => {
      const title = el.querySelector(".solace-tab-title").textContent.toLowerCase();
      const match = !query || title.includes(lower);
      el.style.display = match ? "" : "none";
    });
  },

  // ── Tab context menu ───────────────────────────────────────────────────────
  _showTabContextMenu(e, tab) {
    e.preventDefault();

    // Remove existing context menu if any
    const existing = document.getElementById("solace-tab-context-menu");
    if (existing) existing.remove();

    const menu = document.createXULElement("menupopup");
    menu.id = "solace-tab-context-menu";

    const items = [
      { label: "Reload", action: () => gBrowser.reloadTab(tab) },
      { label: tab.pinned ? "Unpin Tab" : "Pin Tab", action: () => {
        if (tab.pinned) gBrowser.unpinTab(tab);
        else gBrowser.pinTab(tab);
      }},
      { type: "separator" },
      { label: "Split Left", action: () => SolaceSplitView.splitLeft(tab) },
      { label: "Split Right", action: () => SolaceSplitView.splitRight(tab) },
      { type: "separator" },
      { label: "Move to Workspace...", action: () => SolaceWorkspaces.showMoveDialog(tab) },
      { label: "Add to Group...", action: () => this._showGroupDialog(tab) },
      { label: "Set Site Color...", action: () => this._showColorPicker(tab) },
      { type: "separator" },
      { label: "Duplicate Tab", action: () => gBrowser.duplicateTab(tab) },
      { label: "Sleep Tab", action: () => this._sleepTab(tab) },
      { label: "Save to Reading Queue", action: () => SolaceReadingQueue.addFromTab(tab) },
      { type: "separator" },
      { label: this._multiSelected.size > 1 ? `Close ${this._multiSelected.size} Tabs` : "Close Tab",
        action: () => {
          if (this._multiSelected.size > 1) {
            this._multiSelected.forEach((t) => gBrowser.removeTab(t));
            this._clearMultiSelect();
          } else {
            gBrowser.removeTab(tab);
          }
        }
      },
      { label: "Close Other Tabs", action: () => {
        gBrowser.removeAllTabsBut(tab);
      }},
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

    document.getElementById("mainPopupSet").appendChild(menu);
    menu.openPopupAtScreen(e.screenX, e.screenY, true);
  },

  _showGroupDialog(tab) {
    // Dispatch to tab groups component
    SolaceTabGroups.showAssignDialog(tab);
  },

  _showColorPicker(tab) {
    // Simple per-site color tagging
    const colors = ["#d63031", "#e17055", "#ffeaa7", "#00cec9", "#74b9ff", "#6C5CE7", "#fd79a8", "#636e72"];
    // Would show a popup color picker
    const color = colors[Math.floor(Math.random() * colors.length)]; // placeholder
    const el = this._findTabElement(tab);
    if (el) {
      el.setAttribute("data-site-color", "");
      el.style.setProperty("--tab-site-color", color);
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

    Services.prefs.setBoolPref("solace.sidebar.collapsed", this._collapsed);
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

      const onMove = (e) => {
        if (!this._resizing) return;
        const newWidth = Math.max(180, Math.min(500, startWidth + e.clientX - startX));
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
    return this._sidebar.querySelector(`.solace-tab[data-tab-id="${tab.linkedPanel}"]`);
  },

  _updateWorkspaceCount() {
    const count = gBrowser.tabs.length;
    const activeWorkspacePill = this._sidebar.querySelector(".solace-workspace-pill[active] .workspace-count");
    if (activeWorkspacePill) {
      activeWorkspacePill.textContent = count;
    }
  },

  uninit() {
    this._tabSleepTimers.forEach((timer) => clearTimeout(timer));
    this._tabSleepTimers.clear();
  },
};
