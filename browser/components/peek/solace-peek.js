/* ═══════════════════════════════════════════════════════════════════════════════
   Solace Browser — Peek Links
   Hover a link + tap a key for a floating preview without leaving your tab
   ═══════════════════════════════════════════════════════════════════════════════ */

"use strict";

var SolacePeek = {
  _preview: null,
  _visible: false,
  _currentUrl: null,
  _triggerKey: "Alt",

  init() {
    this._triggerKey = Services.prefs.getStringPref("solace.peek-links.trigger-key", "Alt");

    // Listen for hover + key in content
    document.addEventListener("keydown", (e) => {
      if (e.key === this._triggerKey && this._hoveredLink) {
        e.preventDefault();
        this._showPreview(this._hoveredLink);
      }
    });

    document.addEventListener("keyup", (e) => {
      if (e.key === this._triggerKey && this._visible) {
        this._hidePreview();
      }
    });

    // Track hovered links via message from content script
    window.messageManager.addMessageListener("SolacePeek:LinkHover", (msg) => {
      this._hoveredLink = msg.data.url;
    });

    window.messageManager.addMessageListener("SolacePeek:LinkLeave", () => {
      this._hoveredLink = null;
    });
  },

  _showPreview(url) {
    if (this._visible && this._currentUrl === url) return;

    this._hidePreview();

    const preview = document.createElement("div");
    preview.id = "solace-peek-preview";
    preview.style.cssText = `
      position: fixed;
      right: 24px;
      top: 50%;
      transform: translateY(-50%);
      width: 500px;
      height: 400px;
      background: var(--solace-bg-primary);
      border: 1px solid var(--solace-glass-border);
      border-radius: var(--solace-border-radius-lg);
      box-shadow: var(--solace-shadow-lg);
      z-index: var(--solace-z-peek);
      overflow: hidden;
      animation: solace-scale-in 200ms cubic-bezier(0.16, 1, 0.3, 1);
    `;

    // URL bar
    const urlBar = document.createElement("div");
    urlBar.style.cssText = `
      padding:8px 12px; background:var(--solace-bg-secondary);
      border-bottom:1px solid var(--solace-border);
      font-size:11px; color:var(--solace-text-tertiary);
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      font-family:var(--solace-font-family);
    `;
    urlBar.textContent = url;

    // Iframe for preview
    const iframe = document.createElement("browser");
    iframe.setAttribute("type", "content");
    iframe.setAttribute("remote", "true");
    iframe.setAttribute("src", url);
    iframe.style.cssText = "width:100%; height:calc(100% - 32px); border:none;";

    preview.appendChild(urlBar);
    preview.appendChild(iframe);

    document.documentElement.appendChild(preview);

    this._preview = preview;
    this._visible = true;
    this._currentUrl = url;
  },

  _hidePreview() {
    if (this._preview) {
      this._preview.style.animation = "solace-scale-in 150ms ease-out reverse";
      this._preview.addEventListener("animationend", () => {
        this._preview?.remove();
        this._preview = null;
      });
    }
    this._visible = false;
    this._currentUrl = null;
  },

  uninit() {
    this._hidePreview();
  },
};
