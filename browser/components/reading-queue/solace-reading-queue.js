/* ═══════════════════════════════════════════════════════════════════════════════
   Solace Browser — Reading Queue
   Built-in read-later list that strips pages to clean readable text
   ═══════════════════════════════════════════════════════════════════════════════ */

"use strict";

var SolaceReadingQueue = {
  _panel: null,
  _visible: false,
  _items: [],

  init() {
    this._loadItems();
  },

  toggle() {
    if (this._visible) this.hide();
    else this.show();
  },

  show() {
    if (!this._panel) this._buildUI();
    this._visible = true;
    this._panel.style.display = "flex";
    this._renderList();
  },

  hide() {
    if (!this._panel) return;
    this._visible = false;
    this._panel.style.display = "none";
  },

  addFromTab(tab) {
    const url = tab.linkedBrowser?.currentURI?.spec;
    if (!url || url.startsWith("about:")) return;

    // Check for duplicates
    if (this._items.some((i) => i.url === url)) return;

    this._items.unshift({
      id: "read-" + Date.now(),
      url,
      title: tab.label || url,
      favicon: tab.image,
      added: Date.now(),
      read: false,
    });

    this._saveItems();
    if (this._visible) this._renderList();
  },

  addCurrentPage() {
    this.addFromTab(gBrowser.selectedTab);
  },

  removeItem(itemId) {
    this._items = this._items.filter((i) => i.id !== itemId);
    this._saveItems();
    if (this._visible) this._renderList();
  },

  openInReaderMode(item) {
    const readerUrl = `about:reader?url=${encodeURIComponent(item.url)}`;
    gBrowser.addTab(readerUrl, {
      triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
    });
    item.read = true;
    this._saveItems();
    if (this._visible) this._renderList();
  },

  _buildUI() {
    const panel = document.createElement("div");
    panel.id = "solace-reading-queue-panel";
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
        <span style="font-size:14px; font-weight:600; color:var(--solace-text-primary); flex:1;">Reading Queue</span>
        <div id="solace-rq-add" style="cursor:pointer; padding:4px 12px; border-radius:100px; font-size:12px; background:var(--solace-purple); color:white;">+ Add Page</div>
        <div id="solace-rq-close" style="cursor:pointer; padding:4px 8px; border-radius:6px; color:var(--solace-text-secondary); font-size:14px; margin-left:8px;">✕</div>
      </div>
      <div id="solace-rq-list" style="flex:1; overflow-y:auto; padding:8px;"></div>
    `;

    document.documentElement.appendChild(panel);
    this._panel = panel;

    panel.querySelector("#solace-rq-close").addEventListener("click", () => this.hide());
    panel.querySelector("#solace-rq-add").addEventListener("click", () => this.addCurrentPage());
  },

  _renderList() {
    const list = this._panel.querySelector("#solace-rq-list");
    list.innerHTML = "";

    if (this._items.length === 0) {
      list.innerHTML = `<div style="text-align:center; padding:24px; color:var(--solace-text-tertiary); font-size:13px;">
        <p style="font-size:20px; margin-bottom:8px;">📖</p>
        <p>No items in your reading queue.</p>
        <p style="margin-top:4px; font-size:11px;">Click "+ Add Page" to save the current page.</p>
      </div>`;
      return;
    }

    const unread = this._items.filter((i) => !i.read);
    const read = this._items.filter((i) => i.read);

    if (unread.length > 0) {
      this._renderSection(list, "Unread", unread);
    }
    if (read.length > 0) {
      this._renderSection(list, "Read", read);
    }
  },

  _renderSection(container, title, items) {
    const header = document.createElement("div");
    header.style.cssText = `font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; color:var(--solace-text-tertiary); padding:8px 8px 4px;`;
    header.textContent = `${title} (${items.length})`;
    container.appendChild(header);

    for (const item of items) {
      const el = document.createElement("div");
      el.style.cssText = `
        display:flex; align-items:center; gap:10px; padding:10px;
        border-radius:8px; cursor:pointer; transition:background 120ms;
        ${item.read ? "opacity:0.6;" : ""}
      `;

      el.innerHTML = `
        <img src="${item.favicon || 'chrome://branding/content/icon32.png'}" style="width:16px; height:16px; border-radius:3px;" onerror="this.style.display='none'" />
        <div style="flex:1; min-width:0;">
          <div style="font-size:13px; color:var(--solace-text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.title}</div>
          <div style="font-size:11px; color:var(--solace-text-tertiary);">${new Date(item.added).toLocaleDateString()}</div>
        </div>
        <div class="rq-reader" style="cursor:pointer; font-size:12px; color:var(--solace-text-secondary); padding:2px 6px; border-radius:4px;" title="Open in Reader Mode">📄</div>
        <div class="rq-remove" style="cursor:pointer; font-size:12px; color:var(--solace-text-tertiary); padding:2px 6px; border-radius:4px;" title="Remove">✕</div>
      `;

      el.addEventListener("click", () => {
        gBrowser.addTab(item.url, { triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal() });
        item.read = true;
        this._saveItems();
        this._renderList();
      });

      el.querySelector(".rq-reader").addEventListener("click", (e) => {
        e.stopPropagation();
        this.openInReaderMode(item);
      });

      el.querySelector(".rq-remove").addEventListener("click", (e) => {
        e.stopPropagation();
        this.removeItem(item.id);
      });

      el.addEventListener("mouseenter", () => { el.style.background = "var(--solace-bg-hover)"; });
      el.addEventListener("mouseleave", () => { el.style.background = ""; });

      container.appendChild(el);
    }
  },

  _loadItems() {
    try {
      const dir = Services.dirsvc.get("ProfD", Ci.nsIFile);
      const file = dir.clone(); file.append("solace"); file.append("reading-queue.json");
      if (!file.exists()) return;
      this._items = JSON.parse(IOUtils.readUTF8(file.path)) || [];
    } catch (e) { /* ignore */ }
  },

  _saveItems() {
    try {
      const dir = Services.dirsvc.get("ProfD", Ci.nsIFile);
      const solace = dir.clone(); solace.append("solace");
      if (!solace.exists()) solace.create(Ci.nsIFile.DIRECTORY_TYPE, 0o755);
      const file = solace.clone(); file.append("reading-queue.json");
      IOUtils.writeUTF8(file.path, JSON.stringify(this._items));
    } catch (e) { /* ignore */ }
  },

  uninit() {},
};
