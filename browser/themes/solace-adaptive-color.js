/* ═══════════════════════════════════════════════════════════════════════════════
   Solace Browser — Adaptive Color System
   Extracts dominant color from active page and tints the chrome
   ═══════════════════════════════════════════════════════════════════════════════ */

"use strict";

var SolaceAdaptiveColor = {
  _canvas: null,
  _ctx: null,
  _enabled: true,
  _currentHue: 260,
  _targetHue: 260,
  _animationFrame: null,
  _debounceTimer: null,

  init() {
    this._canvas = document.createElement("canvas");
    this._canvas.width = 64;
    this._canvas.height = 64;
    this._ctx = this._canvas.getContext("2d", { willReadFrequently: true });

    this._enabled = Services.prefs.getBoolPref("solace.theme.adaptive-color", true);

    Services.prefs.addObserver("solace.theme.adaptive-color", this);

    // Listen for tab switches and page loads
    gBrowser.tabContainer.addEventListener("TabSelect", () => this._onTabChange());
    gBrowser.addEventListener("pageshow", () => this._onTabChange());

    this._onTabChange();
  },

  observe(subject, topic, data) {
    if (data === "solace.theme.adaptive-color") {
      this._enabled = Services.prefs.getBoolPref("solace.theme.adaptive-color", true);
      if (!this._enabled) {
        this._resetColor();
      } else {
        this._onTabChange();
      }
    }
  },

  _onTabChange() {
    if (!this._enabled) return;

    // Debounce rapid tab switches
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => this._extractColor(), 300);
  },

  async _extractColor() {
    try {
      const browser = gBrowser.selectedBrowser;
      if (!browser) return;

      // Capture a small thumbnail of the page
      const uri = browser.currentURI;
      if (!uri || uri.scheme === "about" || uri.scheme === "chrome") {
        this._animateToHue(260); // Default purple for internal pages
        return;
      }

      // Use PageThumbs or canvas capture
      const browsingContext = browser.browsingContext;
      if (!browsingContext) return;

      const snapshot = await browsingContext.currentWindowGlobal
        .drawSnapshot(
          new DOMRect(0, 0, 64, 64),
          1.0,
          "rgb(255,255,255)"
        );

      this._ctx.drawImage(snapshot, 0, 0, 64, 64);
      snapshot.close();

      const imageData = this._ctx.getImageData(0, 0, 64, 64);
      const dominantColor = this._getDominantColor(imageData.data);
      const hsl = this._rgbToHsl(dominantColor[0], dominantColor[1], dominantColor[2]);

      this._animateToHue(hsl[0]);
    } catch (e) {
      // Silently fail — just keep current color
      console.debug("Solace adaptive color: ", e.message);
    }
  },

  _getDominantColor(pixels) {
    // Simple color quantization — find most common color bucket
    const buckets = {};
    const step = 4 * 4; // Sample every 4th pixel for speed

    for (let i = 0; i < pixels.length; i += step) {
      const r = Math.round(pixels[i] / 32) * 32;
      const g = Math.round(pixels[i + 1] / 32) * 32;
      const b = Math.round(pixels[i + 2] / 32) * 32;

      // Skip near-white and near-black
      const brightness = (r + g + b) / 3;
      if (brightness > 240 || brightness < 15) continue;

      // Skip very desaturated colors
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max - min < 20) continue;

      const key = `${r},${g},${b}`;
      buckets[key] = (buckets[key] || 0) + 1;
    }

    let maxCount = 0;
    let dominantKey = "108,92,231"; // fallback purple

    for (const [key, count] of Object.entries(buckets)) {
      if (count > maxCount) {
        maxCount = count;
        dominantKey = key;
      }
    }

    return dominantKey.split(",").map(Number);
  },

  _rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }

    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
  },

  _animateToHue(targetHue) {
    this._targetHue = targetHue;
    if (this._animationFrame) cancelAnimationFrame(this._animationFrame);
    this._animate();
  },

  _animate() {
    const diff = this._targetHue - this._currentHue;
    if (Math.abs(diff) < 1) {
      this._currentHue = this._targetHue;
      this._applyHue();
      return;
    }

    this._currentHue += diff * 0.08; // Smooth lerp
    this._applyHue();
    this._animationFrame = requestAnimationFrame(() => this._animate());
  },

  _applyHue() {
    const root = document.documentElement;
    root.style.setProperty("--solace-adaptive-hue", Math.round(this._currentHue));
    root.style.setProperty("--solace-adaptive-sat", "60%");
    root.style.setProperty("--solace-adaptive-light", "50%");

    // Tint glass surfaces with a subtle hue shift
    const tintColor = `hsla(${Math.round(this._currentHue)}, 30%, 50%, 0.05)`;
    root.style.setProperty("--solace-adaptive-tint", tintColor);
  },

  _resetColor() {
    this._animateToHue(260);
  },

  uninit() {
    Services.prefs.removeObserver("solace.theme.adaptive-color", this);
    if (this._animationFrame) cancelAnimationFrame(this._animationFrame);
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
  },
};
