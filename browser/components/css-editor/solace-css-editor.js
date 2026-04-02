/* ═══════════════════════════════════════════════════════════════════════════════
   Solace Browser — Live CSS Editor
   Edit any page's styles in real time from the sidebar
   ═══════════════════════════════════════════════════════════════════════════════ */

"use strict";

var SolaceCSSEditor = {
  _panel: null,
  _visible: false,
  _siteStyles: {}, // Stored per-host

  init() {
    this._loadStyles();

    // Apply saved styles when pages load
    gBrowser.addEventListener("pageshow", (e) => this._applyStylesForCurrentTab());
    gBrowser.tabContainer.addEventListener("TabSelect", () => this._applyStylesForCurrentTab());
  },

  toggle() {
    if (this._visible) this.hide();
    else this.show();
  },

  show() {
    if (!this._panel) this._buildUI();
    this._visible = true;
    this._panel.style.display = "flex";
    this._loadCurrentSiteCSS();
  },

  hide() {
    if (!this._panel) return;
    this._visible = false;
    this._panel.style.display = "none";
  },

  _buildUI() {
    const panel = document.createElement("div");
    panel.id = "solace-css-editor";
    panel.style.cssText = `
      position: fixed; right: 0; top: 0; bottom: 0; width: 380px;
      background: var(--solace-glass-bg);
      backdrop-filter: blur(var(--solace-glass-blur)) saturate(var(--solace-glass-saturate));
      border-left: 1px solid var(--solace-glass-border);
      z-index: var(--solace-z-panel); display: none; flex-direction: column;
      font-family: var(--solace-font-family); box-shadow: var(--solace-shadow-lg);
    `;

    panel.innerHTML = `
      <div style="display:flex; align-items:center; padding:12px 16px; border-bottom:1px solid var(--solace-border);">
        <span style="font-size:14px; font-weight:600; color:var(--solace-text-primary); flex:1;">🎨 Live CSS Editor</span>
        <div id="solace-css-host" style="font-size:11px; color:var(--solace-text-tertiary); padding:3px 8px; background:var(--solace-bg-hover); border-radius:100px;"></div>
        <div id="solace-css-close" style="cursor:pointer; padding:4px 8px; color:var(--solace-text-secondary); margin-left:8px;">✕</div>
      </div>
      <textarea id="solace-css-textarea" spellcheck="false" style="
        flex:1; background:var(--solace-bg-secondary); border:none; outline:none; resize:none;
        padding:16px; color:var(--solace-text-primary);
        font-family: var(--solace-font-mono); font-size:12px; line-height:1.6;
        tab-size:2;
      " placeholder="/* Type CSS here — changes apply live */"></textarea>
      <div style="display:flex; gap:8px; padding:8px 16px; border-top:1px solid var(--solace-border);">
        <button id="solace-css-save" style="flex:1; padding:8px; border:none; border-radius:6px; background:var(--solace-purple); color:white; cursor:pointer; font-family:var(--solace-font-family); font-size:12px;">Save for this site</button>
        <button id="solace-css-clear" style="padding:8px 16px; border:1px solid var(--solace-border); border-radius:6px; background:transparent; color:var(--solace-text-secondary); cursor:pointer; font-family:var(--solace-font-family); font-size:12px;">Clear</button>
      </div>
    `;

    document.documentElement.appendChild(panel);
    this._panel = panel;

    panel.querySelector("#solace-css-close").addEventListener("click", () => this.hide());

    const textarea = panel.querySelector("#solace-css-textarea");
    textarea.addEventListener("input", () => this._applyLiveCSS(textarea.value));

    // Tab key inserts spaces
    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const start = textarea.selectionStart;
        textarea.value = textarea.value.slice(0, start) + "  " + textarea.value.slice(textarea.selectionEnd);
        textarea.selectionStart = textarea.selectionEnd = start + 2;
        this._applyLiveCSS(textarea.value);
      }
    });

    panel.querySelector("#solace-css-save").addEventListener("click", () => {
      const host = this._getCurrentHost();
      if (host) {
        this._siteStyles[host] = textarea.value;
        this._saveStyles();
      }
    });

    panel.querySelector("#solace-css-clear").addEventListener("click", () => {
      textarea.value = "";
      this._applyLiveCSS("");
      const host = this._getCurrentHost();
      if (host) {
        delete this._siteStyles[host];
        this._saveStyles();
      }
    });
  },

  _getCurrentHost() {
    try {
      return gBrowser.selectedBrowser.currentURI.host;
    } catch (e) {
      return null;
    }
  },

  _loadCurrentSiteCSS() {
    const host = this._getCurrentHost();
    this._panel.querySelector("#solace-css-host").textContent = host || "No site";

    const css = host ? (this._siteStyles[host] || "") : "";
    this._panel.querySelector("#solace-css-textarea").value = css;
  },

  _applyLiveCSS(css) {
    try {
      const browser = gBrowser.selectedBrowser;
      browser.messageManager.sendAsyncMessage("SolaceCSS:Apply", { css });
    } catch (e) { /* ignore */ }
  },

  _applyStylesForCurrentTab() {
    const host = this._getCurrentHost();
    if (host && this._siteStyles[host]) {
      this._applyLiveCSS(this._siteStyles[host]);
    }
  },

  _loadStyles() {
    try {
      const dir = Services.dirsvc.get("ProfD", Ci.nsIFile);
      const file = dir.clone(); file.append("solace"); file.append("site-css.json");
      if (!file.exists()) return;
      this._siteStyles = JSON.parse(IOUtils.readUTF8(file.path)) || {};
    } catch (e) { /* ignore */ }
  },

  _saveStyles() {
    try {
      const dir = Services.dirsvc.get("ProfD", Ci.nsIFile);
      const solace = dir.clone(); solace.append("solace");
      if (!solace.exists()) solace.create(Ci.nsIFile.DIRECTORY_TYPE, 0o755);
      const file = solace.clone(); file.append("site-css.json");
      IOUtils.writeUTF8(file.path, JSON.stringify(this._siteStyles));
    } catch (e) { /* ignore */ }
  },

  uninit() {},
};
