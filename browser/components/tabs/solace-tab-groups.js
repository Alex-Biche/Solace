/* ═══════════════════════════════════════════════════════════════════════════════
   Solace Browser — Tab Groups
   Color-labeled, named groups within workspaces
   ═══════════════════════════════════════════════════════════════════════════════ */

"use strict";

var SolaceTabGroups = {
  _groups: [],

  COLORS: [
    { name: "Red", value: "#d63031" },
    { name: "Orange", value: "#e17055" },
    { name: "Yellow", value: "#ffeaa7" },
    { name: "Green", value: "#00b894" },
    { name: "Teal", value: "#00cec9" },
    { name: "Blue", value: "#74b9ff" },
    { name: "Purple", value: "#6C5CE7" },
    { name: "Pink", value: "#fd79a8" },
  ],

  init() {
    this._loadGroups();
  },

  createGroup(name, color) {
    const group = {
      id: "grp-" + Date.now(),
      name: name || "New Group",
      color: color || this.COLORS[this._groups.length % this.COLORS.length].value,
      collapsed: false,
      tabIds: [],
    };
    this._groups.push(group);
    this._saveGroups();
    this._renderInSidebar();
    return group;
  },

  deleteGroup(groupId) {
    this._groups = this._groups.filter((g) => g.id !== groupId);
    this._saveGroups();
    this._renderInSidebar();
  },

  addTabToGroup(tab, groupId) {
    const group = this._groups.find((g) => g.id === groupId);
    if (!group) return;

    // Remove from any existing group
    this._groups.forEach((g) => {
      g.tabIds = g.tabIds.filter((id) => id !== tab.linkedPanel);
    });

    group.tabIds.push(tab.linkedPanel);
    tab._solaceGroup = groupId;
    this._saveGroups();
    this._renderInSidebar();
  },

  removeTabFromGroup(tab) {
    this._groups.forEach((g) => {
      g.tabIds = g.tabIds.filter((id) => id !== tab.linkedPanel);
    });
    delete tab._solaceGroup;
    this._saveGroups();
    this._renderInSidebar();
  },

  showAssignDialog(tab) {
    const existing = document.getElementById("solace-group-assign");
    if (existing) existing.remove();

    const menu = document.createXULElement("menupopup");
    menu.id = "solace-group-assign";

    for (const group of this._groups) {
      const mi = document.createXULElement("menuitem");
      mi.setAttribute("label", `● ${group.name}`);
      mi.style.color = group.color;
      mi.addEventListener("command", () => this.addTabToGroup(tab, group.id));
      menu.appendChild(mi);
    }

    menu.appendChild(document.createXULElement("menuseparator"));

    const newGrp = document.createXULElement("menuitem");
    newGrp.setAttribute("label", "+ New Group");
    newGrp.addEventListener("command", () => {
      const name = prompt("Group name:");
      if (name) {
        const group = this.createGroup(name);
        this.addTabToGroup(tab, group.id);
      }
    });
    menu.appendChild(newGrp);

    if (tab._solaceGroup) {
      const removeGrp = document.createXULElement("menuitem");
      removeGrp.setAttribute("label", "Remove from Group");
      removeGrp.addEventListener("command", () => this.removeTabFromGroup(tab));
      menu.appendChild(removeGrp);
    }

    document.getElementById("mainPopupSet").appendChild(menu);
    menu.openPopup(null, "after_pointer", 0, 0, true);
  },

  _renderInSidebar() {
    // Re-render the tab list organized by groups
    const tabList = document.getElementById("solace-tab-list");
    if (!tabList) return;

    tabList.innerHTML = "";

    // Grouped tabs
    for (const group of this._groups) {
      if (group.tabIds.length === 0) continue;

      const groupEl = document.createElement("div");
      groupEl.className = "solace-tab-group";

      const header = document.createElement("div");
      header.className = "solace-group-header";
      if (group.collapsed) header.setAttribute("collapsed", "");

      header.innerHTML = `
        <div class="solace-group-color" style="background:${group.color}"></div>
        <span class="solace-group-label">${group.name}</span>
        <span class="solace-group-chevron">▾</span>
      `;

      header.addEventListener("click", () => {
        group.collapsed = !group.collapsed;
        if (group.collapsed) header.setAttribute("collapsed", "");
        else header.removeAttribute("collapsed");
        this._saveGroups();
      });

      const tabsContainer = document.createElement("div");
      tabsContainer.className = "solace-group-tabs";
      if (!group.collapsed) {
        tabsContainer.style.maxHeight = (group.tabIds.length * 40) + "px";
      }

      for (const tabId of group.tabIds) {
        const tab = gBrowser.tabs.find((t) => t.linkedPanel === tabId);
        if (tab && !tab.pinned) {
          SolaceSidebar._createTabElement(tab);
          const tabEl = SolaceSidebar._findTabElement(tab);
          if (tabEl) tabsContainer.appendChild(tabEl);
        }
      }

      groupEl.appendChild(header);
      groupEl.appendChild(tabsContainer);
      tabList.appendChild(groupEl);
    }

    // Ungrouped tabs
    const groupedIds = new Set(this._groups.flatMap((g) => g.tabIds));
    for (const tab of gBrowser.tabs) {
      if (!tab.pinned && !groupedIds.has(tab.linkedPanel)) {
        SolaceSidebar._createTabElement(tab);
      }
    }
  },

  _loadGroups() {
    try {
      const dir = Services.dirsvc.get("ProfD", Ci.nsIFile);
      const file = dir.clone(); file.append("solace"); file.append("tab-groups.json");
      if (!file.exists()) return;
      this._groups = JSON.parse(IOUtils.readUTF8(file.path)) || [];
    } catch (e) { /* ignore */ }
  },

  _saveGroups() {
    try {
      const dir = Services.dirsvc.get("ProfD", Ci.nsIFile);
      const solace = dir.clone(); solace.append("solace");
      if (!solace.exists()) solace.create(Ci.nsIFile.DIRECTORY_TYPE, 0o755);
      const file = solace.clone(); file.append("tab-groups.json");
      IOUtils.writeUTF8(file.path, JSON.stringify(this._groups));
    } catch (e) { /* ignore */ }
  },

  uninit() {
    this._saveGroups();
  },
};
