/* ═══════════════════════════════════════════════════════════════════════════════
   Solace Browser — Sound Mixer
   Per-tab volume control from one panel
   ═══════════════════════════════════════════════════════════════════════════════ */

"use strict";

var SolaceSoundMixer = {
  _panel: null,
  _visible: false,

  init() {},

  toggle() {
    if (this._visible) this.hide();
    else this.show();
  },

  show() {
    if (!this._panel) this._buildUI();
    this._visible = true;
    this._panel.style.display = "flex";
    this._renderMixer();
  },

  hide() {
    if (!this._panel) return;
    this._visible = false;
    this._panel.style.display = "none";
  },

  _buildUI() {
    const panel = document.createElement("div");
    panel.id = "solace-sound-mixer";
    panel.style.cssText = `
      position: fixed; right: 16px; bottom: 16px; width: 320px;
      background: var(--solace-glass-bg);
      backdrop-filter: blur(var(--solace-glass-blur)) saturate(var(--solace-glass-saturate));
      border: 1px solid var(--solace-glass-border);
      border-radius: var(--solace-border-radius-lg);
      box-shadow: var(--solace-shadow-lg);
      z-index: var(--solace-z-panel); display: none; flex-direction: column;
      font-family: var(--solace-font-family);
      animation: solace-scale-in 200ms cubic-bezier(0.16, 1, 0.3, 1);
    `;

    panel.innerHTML = `
      <div style="display:flex; align-items:center; padding:12px 16px; border-bottom:1px solid var(--solace-border);">
        <span style="font-size:14px; font-weight:600; color:var(--solace-text-primary); flex:1;">🔊 Sound Mixer</span>
        <div id="solace-mixer-close" style="cursor:pointer; color:var(--solace-text-secondary);">✕</div>
      </div>
      <div id="solace-mixer-list" style="padding:12px; max-height:300px; overflow-y:auto;"></div>
    `;

    document.documentElement.appendChild(panel);
    this._panel = panel;

    panel.querySelector("#solace-mixer-close").addEventListener("click", () => this.hide());
  },

  _renderMixer() {
    const list = this._panel.querySelector("#solace-mixer-list");
    list.innerHTML = "";

    let hasAudio = false;

    for (const tab of gBrowser.tabs) {
      if (tab.soundPlaying || tab.hasAttribute("soundplaying") || tab.linkedBrowser?.audioMuted) {
        hasAudio = true;
        const item = document.createElement("div");
        item.style.cssText = `
          display:flex; align-items:center; gap:10px; padding:8px 0;
        `;

        const favicon = document.createElement("img");
        favicon.src = tab.image || "chrome://branding/content/icon32.png";
        favicon.style.cssText = "width:16px; height:16px; border-radius:3px;";

        const title = document.createElement("span");
        title.textContent = tab.label;
        title.style.cssText = "flex:1; font-size:12px; color:var(--solace-text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;";

        const slider = document.createElement("input");
        slider.type = "range";
        slider.min = "0";
        slider.max = "100";
        slider.value = tab.linkedBrowser?.audioMuted ? "0" : "100";
        slider.style.cssText = "width:80px; accent-color:var(--solace-purple);";
        slider.addEventListener("input", () => {
          if (parseInt(slider.value) === 0) {
            tab.linkedBrowser.audioMuted = true;
          } else {
            tab.linkedBrowser.audioMuted = false;
          }
        });

        const muteBtn = document.createElement("div");
        muteBtn.textContent = tab.linkedBrowser?.audioMuted ? "🔇" : "🔊";
        muteBtn.style.cssText = "cursor:pointer; font-size:14px;";
        muteBtn.addEventListener("click", () => {
          tab.toggleMuteAudio();
          muteBtn.textContent = tab.linkedBrowser?.audioMuted ? "🔇" : "🔊";
          slider.value = tab.linkedBrowser?.audioMuted ? "0" : "100";
        });

        item.appendChild(favicon);
        item.appendChild(title);
        item.appendChild(slider);
        item.appendChild(muteBtn);
        list.appendChild(item);
      }
    }

    if (!hasAudio) {
      list.innerHTML = `<div style="text-align:center; padding:16px; color:var(--solace-text-tertiary); font-size:12px;">No tabs playing audio</div>`;
    }
  },

  uninit() {},
};
