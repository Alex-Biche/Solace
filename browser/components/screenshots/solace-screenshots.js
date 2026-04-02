/* ═══════════════════════════════════════════════════════════════════════════════
   Solace Browser — Screenshot Tool with Annotation
   Capture full page, visible area, or selection
   ═══════════════════════════════════════════════════════════════════════════════ */

"use strict";

var SolaceScreenshots = {
  _overlay: null,
  _canvas: null,
  _ctx: null,
  _mode: null, // "fullpage", "visible", "selection"
  _selecting: false,
  _selection: { x: 0, y: 0, w: 0, h: 0 },

  init() {
    // Keyboard shortcut: Ctrl/Cmd + Shift + X
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "X") {
        e.preventDefault();
        this.capture();
      }
    });
  },

  capture(mode) {
    if (!mode) {
      this._showModeSelector();
      return;
    }
    this._mode = mode;

    switch (mode) {
      case "visible": this._captureVisible(); break;
      case "fullpage": this._captureFullPage(); break;
      case "selection": this._startSelection(); break;
    }
  },

  _showModeSelector() {
    const existing = document.getElementById("solace-screenshot-mode");
    if (existing) { existing.remove(); return; }

    const menu = document.createXULElement("menupopup");
    menu.id = "solace-screenshot-mode";

    const modes = [
      { label: "Capture Visible Area", mode: "visible" },
      { label: "Capture Full Page", mode: "fullpage" },
      { label: "Select Area", mode: "selection" },
    ];

    for (const m of modes) {
      const mi = document.createXULElement("menuitem");
      mi.setAttribute("label", m.label);
      mi.addEventListener("command", () => this.capture(m.mode));
      menu.appendChild(mi);
    }

    document.getElementById("mainPopupSet").appendChild(menu);
    menu.openPopup(null, "after_pointer", 0, 0, true);
  },

  async _captureVisible() {
    try {
      const browser = gBrowser.selectedBrowser;
      const canvas = await browser.browsingContext.currentWindowGlobal.drawSnapshot(
        null, 1.0, "rgb(255,255,255)"
      );
      this._showAnnotationEditor(canvas);
    } catch (e) {
      console.error("Solace screenshot:", e);
    }
  },

  async _captureFullPage() {
    try {
      const browser = gBrowser.selectedBrowser;
      const browsingContext = browser.browsingContext;

      // Get full page dimensions
      const scrollWidth = await browsingContext.currentWindowGlobal
        .sendQuery("SolaceScreenshot:GetScrollDimensions");

      const canvas = await browsingContext.currentWindowGlobal.drawSnapshot(
        new DOMRect(0, 0, scrollWidth.width, scrollWidth.height),
        0.5, // Scale down for large pages
        "rgb(255,255,255)"
      );
      this._showAnnotationEditor(canvas);
    } catch (e) {
      console.error("Solace screenshot:", e);
      // Fallback to visible
      this._captureVisible();
    }
  },

  _startSelection() {
    const overlay = document.createElement("div");
    overlay.id = "solace-screenshot-selection-overlay";
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 999999;
      cursor: crosshair; background: rgba(0,0,0,0.3);
    `;

    const selBox = document.createElement("div");
    selBox.style.cssText = `
      position: absolute; border: 2px solid var(--solace-purple);
      background: rgba(108,92,231,0.1); display: none;
    `;
    overlay.appendChild(selBox);

    let startX, startY;

    overlay.addEventListener("mousedown", (e) => {
      startX = e.clientX;
      startY = e.clientY;
      this._selecting = true;
      selBox.style.display = "block";
    });

    overlay.addEventListener("mousemove", (e) => {
      if (!this._selecting) return;
      const x = Math.min(startX, e.clientX);
      const y = Math.min(startY, e.clientY);
      const w = Math.abs(e.clientX - startX);
      const h = Math.abs(e.clientY - startY);
      selBox.style.left = x + "px";
      selBox.style.top = y + "px";
      selBox.style.width = w + "px";
      selBox.style.height = h + "px";
      this._selection = { x, y, w, h };
    });

    overlay.addEventListener("mouseup", async () => {
      this._selecting = false;
      overlay.remove();
      if (this._selection.w > 10 && this._selection.h > 10) {
        await this._captureSelection();
      }
    });

    overlay.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { overlay.remove(); }
    });

    document.documentElement.appendChild(overlay);
    overlay.focus();
  },

  async _captureSelection() {
    try {
      const browser = gBrowser.selectedBrowser;
      const { x, y, w, h } = this._selection;
      const canvas = await browser.browsingContext.currentWindowGlobal.drawSnapshot(
        new DOMRect(x, y, w, h), 1.0, "rgb(255,255,255)"
      );
      this._showAnnotationEditor(canvas);
    } catch (e) {
      console.error("Solace screenshot selection:", e);
    }
  },

  _showAnnotationEditor(imageSource) {
    const existing = document.getElementById("solace-screenshot-editor");
    if (existing) existing.remove();

    const editor = document.createElement("div");
    editor.id = "solace-screenshot-editor";
    editor.style.cssText = `
      position: fixed; inset: 0; z-index: var(--solace-z-modal);
      background: rgba(0,0,0,0.8); backdrop-filter: blur(8px);
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; font-family: var(--solace-font-family);
    `;

    // Toolbar
    const toolbar = document.createElement("div");
    toolbar.style.cssText = `
      display:flex; gap:8px; margin-bottom:16px; padding:8px 16px;
      background:var(--solace-glass-bg); border-radius:var(--solace-border-radius-pill);
      border:1px solid var(--solace-glass-border);
    `;

    const tools = [
      { icon: "✏️", label: "Draw", tool: "draw" },
      { icon: "⬜", label: "Rectangle", tool: "rect" },
      { icon: "⭕", label: "Circle", tool: "circle" },
      { icon: "T", label: "Text", tool: "text" },
      { icon: "↩", label: "Undo", tool: "undo" },
    ];

    for (const t of tools) {
      const btn = document.createElement("button");
      btn.textContent = t.icon;
      btn.title = t.label;
      btn.style.cssText = `
        padding:6px 12px; border:none; border-radius:6px; cursor:pointer;
        background:transparent; color:var(--solace-text-primary); font-size:16px;
        transition: background 120ms;
      `;
      btn.addEventListener("click", () => {
        if (t.tool === "undo") { /* undo logic */ }
      });
      toolbar.appendChild(btn);
    }

    // Canvas
    const canvas = document.createElement("canvas");
    canvas.width = imageSource.width || 800;
    canvas.height = imageSource.height || 600;
    canvas.style.cssText = `
      max-width: 90vw; max-height: 70vh; border-radius: 8px;
      box-shadow: var(--solace-shadow-lg); cursor: crosshair;
    `;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(imageSource, 0, 0);

    // Action buttons
    const actions = document.createElement("div");
    actions.style.cssText = "display:flex; gap:12px; margin-top:16px;";

    const copyBtn = document.createElement("button");
    copyBtn.textContent = "Copy to Clipboard";
    copyBtn.style.cssText = `
      padding:10px 20px; border:none; border-radius:8px; cursor:pointer;
      background:var(--solace-purple); color:white; font-weight:500;
      font-family:var(--solace-font-family);
    `;
    copyBtn.addEventListener("click", () => {
      canvas.toBlob((blob) => {
        navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        editor.remove();
      });
    });

    const saveBtn = document.createElement("button");
    saveBtn.textContent = "Save as PNG";
    saveBtn.style.cssText = copyBtn.style.cssText.replace("var(--solace-purple)", "var(--solace-bg-secondary)");
    saveBtn.addEventListener("click", () => {
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `solace-screenshot-${Date.now()}.png`;
      a.click();
      editor.remove();
    });

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "Cancel";
    closeBtn.style.cssText = saveBtn.style.cssText;
    closeBtn.addEventListener("click", () => editor.remove());

    actions.appendChild(copyBtn);
    actions.appendChild(saveBtn);
    actions.appendChild(closeBtn);

    editor.appendChild(toolbar);
    editor.appendChild(canvas);
    editor.appendChild(actions);

    // Close on Escape
    editor.addEventListener("keydown", (e) => {
      if (e.key === "Escape") editor.remove();
    });

    document.documentElement.appendChild(editor);
    editor.setAttribute("tabindex", "-1");
    editor.focus();

    if (imageSource.close) imageSource.close();
  },

  uninit() {},
};
