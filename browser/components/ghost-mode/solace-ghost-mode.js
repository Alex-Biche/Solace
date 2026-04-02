/* ═══════════════════════════════════════════════════════════════════════════════
   Solace Browser — Ghost Mode
   One toggle that disables all scripts, images, and trackers
   for ultra-lightweight browsing
   ═══════════════════════════════════════════════════════════════════════════════ */

"use strict";

var SolaceGhostMode = {
  _active: false,
  _savedPrefs: {},

  PREFS_TO_CHANGE: {
    "javascript.enabled": false,
    "permissions.default.image": 2, // Block images
    "media.autoplay.default": 5,   // Block autoplay
    "dom.disable_beforeunload": true,
    "network.prefetch-next": false,
    "network.http.speculative-parallel-limit": 0,
    "browser.cache.memory.enable": false,
    "media.hardware-video-decoding.enabled": false,
  },

  init() {
    this._active = Services.prefs.getBoolPref("solace.ghost-mode.enabled", false);
    if (this._active) this._enable();
  },

  toggle() {
    if (this._active) this.disable();
    else this.enable();
  },

  enable() {
    this._active = true;
    this._enable();
    Services.prefs.setBoolPref("solace.ghost-mode.enabled", true);
    document.documentElement.setAttribute("solace-ghost-mode", "true");
  },

  disable() {
    this._active = false;
    this._disable();
    Services.prefs.setBoolPref("solace.ghost-mode.enabled", false);
    document.documentElement.removeAttribute("solace-ghost-mode");
  },

  _enable() {
    // Save current values
    for (const [pref, newVal] of Object.entries(this.PREFS_TO_CHANGE)) {
      try {
        const type = Services.prefs.getPrefType(pref);
        if (type === Services.prefs.PREF_BOOL) {
          this._savedPrefs[pref] = Services.prefs.getBoolPref(pref);
          Services.prefs.setBoolPref(pref, newVal);
        } else if (type === Services.prefs.PREF_INT) {
          this._savedPrefs[pref] = Services.prefs.getIntPref(pref);
          Services.prefs.setIntPref(pref, newVal);
        }
      } catch (e) { /* pref might not exist */ }
    }

    document.documentElement.setAttribute("solace-ghost-mode", "true");
  },

  _disable() {
    // Restore saved values
    for (const [pref, oldVal] of Object.entries(this._savedPrefs)) {
      try {
        const type = Services.prefs.getPrefType(pref);
        if (type === Services.prefs.PREF_BOOL) {
          Services.prefs.setBoolPref(pref, oldVal);
        } else if (type === Services.prefs.PREF_INT) {
          Services.prefs.setIntPref(pref, oldVal);
        }
      } catch (e) { /* ignore */ }
    }
    this._savedPrefs = {};

    document.documentElement.removeAttribute("solace-ghost-mode");
  },

  uninit() {
    if (this._active) this._disable();
  },
};
