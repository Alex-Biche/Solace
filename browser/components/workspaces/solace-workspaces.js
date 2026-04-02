/* ═══════════════════════════════════════════════════════════════════════════════
   Solace Browser — Workspaces Engine
   Named groups of tabs within a profile. Inactive workspaces are suspended.
   ═══════════════════════════════════════════════════════════════════════════════ */

"use strict";

var SolaceWorkspaces = {
  _workspaces: [],
  _activeWorkspaceId: null,
  _scheduledTimers: [],

  DEFAULT_WORKSPACE: {
    id: "default",
    name: "Home",
    icon: "🏠",
    color: "#6C5CE7",
    tabs: [],
    tabGroups: [],
    background: null,
    template: false,
  },

  init() {
    this._loadWorkspaces();
    this._initScheduling();

    // If no workspaces exist, create default
    if (this._workspaces.length === 0) {
      this._workspaces.push({ ...this.DEFAULT_WORKSPACE });
      this._activeWorkspaceId = "default";
    }

    this._renderWorkspaceBar();
  },

  // ── Workspace CRUD ─────────────────────────────────────────────────────────

  createWorkspace(options = {}) {
    const id = "ws-" + Date.now() + "-" + Math.random().toString(36).substr(2, 6);
    const workspace = {
      id,
      name: options.name || "New Workspace",
      icon: options.icon || "📂",
      color: options.color || this._randomColor(),
      tabs: [],
      tabGroups: [],
      background: options.background || null,
      template: false,
    };

    this._workspaces.push(workspace);
    this._saveWorkspaces();
    this._renderWorkspaceBar();

    // Show rename dialog
    this._showRenameDialog(workspace);

    return workspace;
  },

  deleteWorkspace(workspaceId) {
    if (workspaceId === "default") return; // Can't delete default

    const workspace = this._getWorkspace(workspaceId);
    if (!workspace) return;

    // Close all tabs in this workspace
    for (const tabInfo of workspace.tabs) {
      const tab = this._findTabByInfo(tabInfo);
      if (tab) gBrowser.removeTab(tab);
    }

    this._workspaces = this._workspaces.filter((w) => w.id !== workspaceId);

    // Switch to default if active workspace was deleted
    if (this._activeWorkspaceId === workspaceId) {
      this.switchToWorkspace("default");
    }

    this._saveWorkspaces();
    this._renderWorkspaceBar();
  },

  renameWorkspace(workspaceId, newName) {
    const workspace = this._getWorkspace(workspaceId);
    if (workspace) {
      workspace.name = newName;
      this._saveWorkspaces();
      this._renderWorkspaceBar();
    }
  },

  setWorkspaceIcon(workspaceId, icon) {
    const workspace = this._getWorkspace(workspaceId);
    if (workspace) {
      workspace.icon = icon;
      this._saveWorkspaces();
      this._renderWorkspaceBar();
    }
  },

  setWorkspaceColor(workspaceId, color) {
    const workspace = this._getWorkspace(workspaceId);
    if (workspace) {
      workspace.color = color;
      this._saveWorkspaces();
      this._renderWorkspaceBar();
      // Update sidebar tint when active workspace color changes
      if (workspaceId === this._activeWorkspaceId) {
        this._applyWorkspaceTheme(workspace);
      }
    }
  },

  // ── Workspace Switching ────────────────────────────────────────────────────

  switchToWorkspace(workspaceId) {
    const prevWorkspace = this._getWorkspace(this._activeWorkspaceId);
    const nextWorkspace = this._getWorkspace(workspaceId);

    if (!nextWorkspace || workspaceId === this._activeWorkspaceId) return;

    // Save current workspace state
    if (prevWorkspace) {
      this._saveWorkspaceState(prevWorkspace);
      this._suspendWorkspace(prevWorkspace);
    }

    // Activate new workspace
    this._activeWorkspaceId = workspaceId;
    this._restoreWorkspace(nextWorkspace);
    this._applyWorkspaceTheme(nextWorkspace);

    this._saveWorkspaces();
    this._renderWorkspaceBar();

    // Dispatch event for other components
    document.dispatchEvent(new CustomEvent("solace-workspace-changed", {
      detail: { workspaceId, workspace: nextWorkspace },
    }));
  },

  _saveWorkspaceState(workspace) {
    workspace.tabs = [];
    for (const tab of gBrowser.tabs) {
      if (tab._solaceWorkspace === workspace.id) {
        workspace.tabs.push({
          url: tab.linkedBrowser?.currentURI?.spec || "about:blank",
          title: tab.label,
          pinned: tab.pinned,
          favicon: tab.image,
        });
      }
    }
  },

  _suspendWorkspace(workspace) {
    // Hide all tabs belonging to this workspace
    for (const tab of gBrowser.tabs) {
      if (tab._solaceWorkspace === workspace.id) {
        tab.hidden = true;
        // Discard to save memory
        if (!tab.selected && !tab.pinned) {
          gBrowser.discardBrowser(tab);
        }
      }
    }
  },

  _restoreWorkspace(workspace) {
    // Show tabs belonging to this workspace
    let hasVisibleTabs = false;

    for (const tab of gBrowser.tabs) {
      if (tab._solaceWorkspace === workspace.id) {
        tab.hidden = false;
        hasVisibleTabs = true;
      }
    }

    // If workspace has saved tabs but none exist, restore them
    if (!hasVisibleTabs && workspace.tabs.length > 0) {
      for (const tabInfo of workspace.tabs) {
        const newTab = gBrowser.addTab(tabInfo.url, {
          triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
        });
        newTab._solaceWorkspace = workspace.id;
        if (tabInfo.pinned) gBrowser.pinTab(newTab);
      }
    }

    // If workspace is empty, create a new tab
    if (!hasVisibleTabs && workspace.tabs.length === 0) {
      const newTab = gBrowser.addTab("about:solace-newtab", {
        triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
      });
      newTab._solaceWorkspace = workspace.id;
    }

    // Select the first visible tab
    const firstVisible = gBrowser.tabs.find(
      (t) => t._solaceWorkspace === workspace.id && !t.hidden
    );
    if (firstVisible) gBrowser.selectedTab = firstVisible;

    // Update sidebar
    SolaceSidebar._syncTabsFromBrowser();
  },

  _applyWorkspaceTheme(workspace) {
    const root = document.documentElement;
    if (workspace.color) {
      root.style.setProperty("--solace-workspace-accent", workspace.color);
    }
    if (workspace.background) {
      root.style.setProperty("--solace-workspace-bg", `url(${workspace.background})`);
    }
  },

  // ── Move tabs between workspaces ───────────────────────────────────────────

  moveTabToWorkspace(tab, workspaceId) {
    tab._solaceWorkspace = workspaceId;

    if (workspaceId !== this._activeWorkspaceId) {
      tab.hidden = true;
      if (!tab.pinned) gBrowser.discardBrowser(tab);
      SolaceSidebar._syncTabsFromBrowser();
    }

    this._saveWorkspaces();
    this._renderWorkspaceBar();
  },

  showMoveDialog(tab) {
    // Build a popup showing available workspaces
    const existing = document.getElementById("solace-workspace-move-menu");
    if (existing) existing.remove();

    const menu = document.createXULElement("menupopup");
    menu.id = "solace-workspace-move-menu";

    for (const ws of this._workspaces) {
      if (ws.id === this._activeWorkspaceId) continue;

      const mi = document.createXULElement("menuitem");
      mi.setAttribute("label", `${ws.icon} ${ws.name}`);
      mi.addEventListener("command", () => {
        this.moveTabToWorkspace(tab, ws.id);
      });
      menu.appendChild(mi);
    }

    const sep = document.createXULElement("menuseparator");
    menu.appendChild(sep);

    const newWs = document.createXULElement("menuitem");
    newWs.setAttribute("label", "+ New Workspace");
    newWs.addEventListener("command", () => {
      const ws = this.createWorkspace();
      this.moveTabToWorkspace(tab, ws.id);
    });
    menu.appendChild(newWs);

    document.getElementById("mainPopupSet").appendChild(menu);
    menu.openPopup(null, "after_pointer", 0, 0, true);
  },

  // ── Templates ──────────────────────────────────────────────────────────────

  saveAsTemplate(workspaceId) {
    const workspace = this._getWorkspace(workspaceId);
    if (!workspace) return;

    this._saveWorkspaceState(workspace);
    workspace.template = true;

    const template = JSON.parse(JSON.stringify(workspace));
    template.id = "tmpl-" + Date.now();
    template.name += " (Template)";

    this._saveToStorage("solace-workspace-templates", [
      ...this._getTemplates(),
      template,
    ]);
  },

  restoreTemplate(templateId) {
    const templates = this._getTemplates();
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;

    const ws = this.createWorkspace({
      name: template.name.replace(" (Template)", ""),
      icon: template.icon,
      color: template.color,
    });

    ws.tabs = JSON.parse(JSON.stringify(template.tabs));
    this.switchToWorkspace(ws.id);
  },

  _getTemplates() {
    return this._loadFromStorage("solace-workspace-templates") || [];
  },

  // ── Scheduled workspaces ───────────────────────────────────────────────────

  _initScheduling() {
    if (!Services.prefs.getBoolPref("solace.workspaces.scheduled", false)) return;

    const schedules = this._loadFromStorage("solace-workspace-schedules") || [];

    for (const schedule of schedules) {
      this._setupScheduleTimer(schedule);
    }
  },

  addSchedule(workspaceId, time, days = [1, 2, 3, 4, 5]) {
    const schedules = this._loadFromStorage("solace-workspace-schedules") || [];
    schedules.push({ workspaceId, time, days });
    this._saveToStorage("solace-workspace-schedules", schedules);
    this._setupScheduleTimer({ workspaceId, time, days });
  },

  _setupScheduleTimer(schedule) {
    const check = () => {
      const now = new Date();
      const [hours, minutes] = schedule.time.split(":").map(Number);

      if (
        schedule.days.includes(now.getDay()) &&
        now.getHours() === hours &&
        now.getMinutes() === minutes
      ) {
        this.switchToWorkspace(schedule.workspaceId);
      }
    };

    // Check every minute
    const timer = setInterval(check, 60000);
    this._scheduledTimers.push(timer);
  },

  // ── Focus mode (isolate one workspace) ─────────────────────────────────────

  enterFocusMode(workspaceId) {
    const ws = this._getWorkspace(workspaceId || this._activeWorkspaceId);
    if (!ws) return;

    // Hide all other workspace pills
    this._workspaces.forEach((w) => {
      if (w.id !== ws.id) {
        const pill = document.querySelector(`.solace-workspace-pill[data-workspace="${w.id}"]`);
        if (pill) pill.style.display = "none";
      }
    });

    document.documentElement.setAttribute("solace-workspace-focus", "true");
  },

  exitFocusMode() {
    document.querySelectorAll(".solace-workspace-pill").forEach((pill) => {
      pill.style.display = "";
    });
    document.documentElement.removeAttribute("solace-workspace-focus");
  },

  // ── Render workspace bar in sidebar ────────────────────────────────────────

  _renderWorkspaceBar() {
    const bar = document.getElementById("solace-workspace-bar");
    if (!bar) return;

    // Keep the add button
    const addBtn = bar.querySelector(".solace-workspace-add");

    // Clear existing pills
    bar.querySelectorAll(".solace-workspace-pill").forEach((el) => el.remove());

    for (const ws of this._workspaces) {
      const pill = document.createElement("div");
      pill.className = "solace-workspace-pill";
      pill.dataset.workspace = ws.id;
      if (ws.id === this._activeWorkspaceId) pill.setAttribute("active", "");

      pill.innerHTML = `
        <span class="workspace-icon">${ws.icon}</span>
        <span class="solace-workspace-label">${ws.name}</span>
        <span class="workspace-count">${ws.tabs.length}</span>
      `;

      pill.addEventListener("click", () => this.switchToWorkspace(ws.id));
      pill.addEventListener("contextmenu", (e) => this._showWorkspaceContextMenu(e, ws));

      bar.insertBefore(pill, addBtn);
    }
  },

  _showWorkspaceContextMenu(e, workspace) {
    e.preventDefault();

    const existing = document.getElementById("solace-workspace-context-menu");
    if (existing) existing.remove();

    const menu = document.createXULElement("menupopup");
    menu.id = "solace-workspace-context-menu";

    const items = [
      { label: "Rename", action: () => this._showRenameDialog(workspace) },
      { label: "Change Icon", action: () => this._showIconPicker(workspace) },
      { label: "Change Color", action: () => this._showColorDialog(workspace) },
      { type: "separator" },
      { label: "Save as Template", action: () => this.saveAsTemplate(workspace.id) },
      { label: "Enter Focus Mode", action: () => this.enterFocusMode(workspace.id) },
      { label: "Schedule...", action: () => this._showScheduleDialog(workspace) },
      { type: "separator" },
      { label: "Delete Workspace", action: () => {
        if (workspace.id !== "default") this.deleteWorkspace(workspace.id);
      }},
    ];

    for (const item of items) {
      if (item.type === "separator") {
        menu.appendChild(document.createXULElement("menuseparator"));
      } else {
        const mi = document.createXULElement("menuitem");
        mi.setAttribute("label", item.label);
        mi.addEventListener("command", item.action);
        if (item.label === "Delete Workspace" && workspace.id === "default") {
          mi.setAttribute("disabled", "true");
        }
        menu.appendChild(mi);
      }
    }

    document.getElementById("mainPopupSet").appendChild(menu);
    menu.openPopupAtScreen(e.screenX, e.screenY, true);
  },

  _showRenameDialog(workspace) {
    const name = prompt("Workspace name:", workspace.name);
    if (name && name.trim()) {
      this.renameWorkspace(workspace.id, name.trim());
    }
  },

  _showIconPicker(workspace) {
    const icons = ["🏠", "💼", "📚", "🎮", "🎵", "🛒", "✈️", "🔬", "🎨", "💰", "📧", "🔧"];
    const icon = icons[Math.floor(Math.random() * icons.length)]; // placeholder
    this.setWorkspaceIcon(workspace.id, icon);
  },

  _showColorDialog(workspace) {
    const colors = ["#d63031", "#e17055", "#ffeaa7", "#00cec9", "#74b9ff", "#6C5CE7", "#fd79a8", "#00b894"];
    const color = colors[Math.floor(Math.random() * colors.length)]; // placeholder
    this.setWorkspaceColor(workspace.id, color);
  },

  _showScheduleDialog(workspace) {
    const time = prompt("Switch time (HH:MM):", "09:00");
    if (time && /^\d{2}:\d{2}$/.test(time)) {
      this.addSchedule(workspace.id, time);
    }
  },

  // ── Persistence ────────────────────────────────────────────────────────────

  _loadWorkspaces() {
    try {
      const data = this._loadFromStorage("solace-workspaces");
      if (data) {
        this._workspaces = data.workspaces || [];
        this._activeWorkspaceId = data.activeId || "default";
      }
    } catch (e) {
      console.error("Solace: Failed to load workspaces:", e);
    }
  },

  _saveWorkspaces() {
    this._saveToStorage("solace-workspaces", {
      workspaces: this._workspaces,
      activeId: this._activeWorkspaceId,
    });
  },

  _saveToStorage(key, value) {
    try {
      const profileDir = Services.dirsvc.get("ProfD", Ci.nsIFile);
      const file = profileDir.clone();
      file.append("solace");
      if (!file.exists()) file.create(Ci.nsIFile.DIRECTORY_TYPE, 0o755);

      const dataFile = file.clone();
      dataFile.append(key + ".json");

      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify(value, null, 2));

      IOUtils.write(dataFile.path, data);
    } catch (e) {
      console.error("Solace: Failed to save:", key, e);
    }
  },

  _loadFromStorage(key) {
    try {
      const profileDir = Services.dirsvc.get("ProfD", Ci.nsIFile);
      const file = profileDir.clone();
      file.append("solace");
      file.append(key + ".json");

      if (!file.exists()) return null;

      const data = IOUtils.readUTF8(file.path);
      return JSON.parse(data);
    } catch (e) {
      return null;
    }
  },

  // ── Helpers ────────────────────────────────────────────────────────────────

  _getWorkspace(id) {
    return this._workspaces.find((w) => w.id === id);
  },

  _findTabByInfo(tabInfo) {
    return gBrowser.tabs.find(
      (t) => t.linkedBrowser?.currentURI?.spec === tabInfo.url
    );
  },

  _randomColor() {
    const colors = ["#d63031", "#e17055", "#ffeaa7", "#00cec9", "#74b9ff", "#6C5CE7", "#fd79a8", "#00b894"];
    return colors[Math.floor(Math.random() * colors.length)];
  },

  uninit() {
    this._scheduledTimers.forEach((t) => clearInterval(t));
    this._saveWorkspaces();
  },
};
