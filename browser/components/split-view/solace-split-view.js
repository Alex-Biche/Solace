/* ═══════════════════════════════════════════════════════════════════════════════
   Solace Browser — Split View
   Two tabs side by side in one window
   ═══════════════════════════════════════════════════════════════════════════════ */

"use strict";

var SolaceSplitView = {
  _active: false,
  _leftTab: null,
  _rightTab: null,
  _splitter: null,
  _splitRatio: 0.5,

  init() {
    // Keyboard shortcut: Ctrl/Cmd + Shift + S
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "S") {
        e.preventDefault();
        this.toggle();
      }
    });
  },

  toggle() {
    if (this._active) this.close();
    else this.splitCurrent();
  },

  splitCurrent() {
    const currentTab = gBrowser.selectedTab;
    // Open a new tab for the right side
    const newTab = gBrowser.addTab("about:solace-newtab", {
      triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
    });
    this.split(currentTab, newTab);
  },

  splitLeft(tab) {
    if (this._active) {
      this._leftTab = tab;
      this._updateLayout();
    } else {
      this.split(tab, gBrowser.selectedTab);
    }
  },

  splitRight(tab) {
    if (this._active) {
      this._rightTab = tab;
      this._updateLayout();
    } else {
      this.split(gBrowser.selectedTab, tab);
    }
  },

  split(leftTab, rightTab) {
    this._active = true;
    this._leftTab = leftTab;
    this._rightTab = rightTab;

    this._createSplitLayout();

    // Mark tabs in sidebar
    const leftEl = SolaceSidebar._findTabElement(leftTab);
    const rightEl = SolaceSidebar._findTabElement(rightTab);
    if (leftEl) leftEl.setAttribute("split-left", "");
    if (rightEl) rightEl.setAttribute("split-right", "");
  },

  close() {
    if (!this._active) return;

    this._active = false;

    // Remove split layout
    const container = document.getElementById("solace-split-container");
    if (container) container.remove();

    // Restore normal browser layout
    const browser = document.getElementById("browser");
    browser.style.display = "";

    // Remove sidebar markers
    document.querySelectorAll("[split-left], [split-right]").forEach((el) => {
      el.removeAttribute("split-left");
      el.removeAttribute("split-right");
    });

    // Restore normal tab display
    if (this._leftTab) gBrowser.selectedTab = this._leftTab;

    this._leftTab = null;
    this._rightTab = null;
    if (this._splitter) this._splitter = null;
  },

  _createSplitLayout() {
    // Hide normal browser panel
    const browser = document.getElementById("browser");

    // Create split container
    const existing = document.getElementById("solace-split-container");
    if (existing) existing.remove();

    const container = document.createElement("div");
    container.id = "solace-split-container";
    container.style.cssText = `
      display: flex;
      flex: 1;
      height: 100%;
      position: relative;
    `;

    // Left browser
    const leftPanel = document.createElement("div");
    leftPanel.id = "solace-split-left";
    leftPanel.style.cssText = `
      flex: ${this._splitRatio};
      overflow: hidden;
      position: relative;
      border-right: 1px solid var(--solace-border);
    `;

    // Splitter handle
    const splitter = document.createElement("div");
    splitter.id = "solace-split-handle";
    splitter.style.cssText = `
      width: 6px;
      cursor: col-resize;
      background: transparent;
      transition: background 120ms;
      z-index: 10;
      flex-shrink: 0;
    `;
    splitter.addEventListener("mouseenter", () => {
      splitter.style.background = "var(--solace-purple)";
      splitter.style.opacity = "0.3";
    });
    splitter.addEventListener("mouseleave", () => {
      if (!this._resizing) {
        splitter.style.background = "transparent";
        splitter.style.opacity = "1";
      }
    });

    // Right browser
    const rightPanel = document.createElement("div");
    rightPanel.id = "solace-split-right";
    rightPanel.style.cssText = `
      flex: ${1 - this._splitRatio};
      overflow: hidden;
      position: relative;
    `;

    container.appendChild(leftPanel);
    container.appendChild(splitter);
    container.appendChild(rightPanel);

    browser.parentNode.insertBefore(container, browser.nextSibling);

    // Move browser panels into split view
    this._moveBrowserToPanel(this._leftTab, leftPanel);
    this._moveBrowserToPanel(this._rightTab, rightPanel);

    // Splitter drag
    this._initSplitterDrag(splitter, container);

    this._splitter = splitter;
  },

  _moveBrowserToPanel(tab, panel) {
    if (!tab || !tab.linkedBrowser) return;

    const browser = tab.linkedBrowser;
    const wrapper = browser.closest(".browserSidebarContainer") || browser.parentElement;

    if (wrapper) {
      wrapper.style.cssText = "width:100%; height:100%; position:absolute; inset:0;";
      panel.appendChild(wrapper);
    }
  },

  _initSplitterDrag(splitter, container) {
    let startX;
    this._resizing = false;

    splitter.addEventListener("mousedown", (e) => {
      startX = e.clientX;
      this._resizing = true;

      const onMove = (e) => {
        if (!this._resizing) return;
        const containerRect = container.getBoundingClientRect();
        const ratio = (e.clientX - containerRect.left) / containerRect.width;
        this._splitRatio = Math.max(0.2, Math.min(0.8, ratio));
        this._updateLayout();
      };

      const onUp = () => {
        this._resizing = false;
        splitter.style.background = "transparent";
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  },

  _updateLayout() {
    const left = document.getElementById("solace-split-left");
    const right = document.getElementById("solace-split-right");
    if (left) left.style.flex = this._splitRatio;
    if (right) right.style.flex = 1 - this._splitRatio;
  },

  uninit() {
    this.close();
  },
};
