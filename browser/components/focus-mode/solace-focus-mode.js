/* ═══════════════════════════════════════════════════════════════════════════════
   Solace Browser — Focus Mode
   Hides all chrome and UI leaving only the page
   ═══════════════════════════════════════════════════════════════════════════════ */

"use strict";

var SolaceFocusMode = {
  _active: false,

  init() {
    // Keyboard shortcut: F11 or Ctrl+Shift+F
    document.addEventListener("keydown", (e) => {
      if (e.key === "F11" || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "F")) {
        e.preventDefault();
        this.toggle();
      }
    });
  },

  toggle() {
    if (this._active) this.disable();
    else this.enable();
  },

  enable() {
    this._active = true;
    document.documentElement.setAttribute("solace-focus-mode", "true");
    Services.prefs.setBoolPref("solace.focus-mode.enabled", true);
  },

  disable() {
    this._active = false;
    document.documentElement.removeAttribute("solace-focus-mode");
    Services.prefs.setBoolPref("solace.focus-mode.enabled", false);
  },

  uninit() {},
};
