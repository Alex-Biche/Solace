/* ═══════════════════════════════════════════════════════════════════════════════
   Solace Browser — Notes Panel
   Built-in scratch pad, always one click away
   ═══════════════════════════════════════════════════════════════════════════════ */

"use strict";

var SolaceNotes = {
  _panel: null,
  _visible: false,
  _notes: [],
  _activeNoteId: null,
  _saveTimer: null,

  init() {
    this._loadNotes();
    if (this._notes.length === 0) {
      this._notes.push({
        id: "note-" + Date.now(),
        title: "Scratch Pad",
        content: "",
        created: Date.now(),
        modified: Date.now(),
      });
      this._activeNoteId = this._notes[0].id;
    }
  },

  toggle() {
    if (this._visible) this.hide();
    else this.show();
  },

  show() {
    if (!this._panel) this._buildUI();
    this._visible = true;
    this._panel.style.display = "flex";
    this._renderNotesList();
    this._loadActiveNote();
  },

  hide() {
    if (!this._panel) return;
    this._visible = false;
    this._panel.style.display = "none";
    this._saveCurrentNote();
  },

  _buildUI() {
    const panel = document.createElement("div");
    panel.id = "solace-notes-panel";
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
        <span style="font-size:14px; font-weight:600; color:var(--solace-text-primary); flex:1;">Notes</span>
        <div id="solace-notes-new" style="cursor:pointer; padding:4px 8px; border-radius:6px; color:var(--solace-text-secondary); font-size:14px;">+</div>
        <div id="solace-notes-close" style="cursor:pointer; padding:4px 8px; border-radius:6px; color:var(--solace-text-secondary); font-size:14px;">✕</div>
      </div>
      <div id="solace-notes-list" style="
        max-height:150px; overflow-y:auto; border-bottom:1px solid var(--solace-border);
        padding:4px;
      "></div>
      <textarea id="solace-notes-editor" style="
        flex:1; background:transparent; border:none; outline:none; resize:none;
        padding:16px; color:var(--solace-text-primary);
        font-family: var(--solace-font-mono); font-size:13px; line-height:1.6;
      " placeholder="Start typing..."></textarea>
    `;

    document.documentElement.appendChild(panel);
    this._panel = panel;

    panel.querySelector("#solace-notes-close").addEventListener("click", () => this.hide());
    panel.querySelector("#solace-notes-new").addEventListener("click", () => this._createNote());

    const editor = panel.querySelector("#solace-notes-editor");
    editor.addEventListener("input", () => {
      if (this._saveTimer) clearTimeout(this._saveTimer);
      this._saveTimer = setTimeout(() => this._saveCurrentNote(), 1000);
    });
  },

  _createNote() {
    const note = {
      id: "note-" + Date.now(),
      title: "New Note",
      content: "",
      created: Date.now(),
      modified: Date.now(),
    };
    this._notes.unshift(note);
    this._activeNoteId = note.id;
    this._renderNotesList();
    this._loadActiveNote();
    this._saveNotes();
  },

  _renderNotesList() {
    const list = this._panel.querySelector("#solace-notes-list");
    list.innerHTML = "";

    for (const note of this._notes) {
      const item = document.createElement("div");
      item.style.cssText = `
        padding:8px 12px; border-radius:6px; cursor:pointer;
        transition: background 120ms; font-size:12px;
        ${note.id === this._activeNoteId ? "background:var(--solace-bg-selected);" : ""}
      `;
      item.innerHTML = `
        <div style="font-weight:500; color:var(--solace-text-primary); margin-bottom:2px;">${note.title}</div>
        <div style="color:var(--solace-text-tertiary); font-size:11px;">${new Date(note.modified).toLocaleDateString()}</div>
      `;
      item.addEventListener("click", () => {
        this._saveCurrentNote();
        this._activeNoteId = note.id;
        this._renderNotesList();
        this._loadActiveNote();
      });
      list.appendChild(item);
    }
  },

  _loadActiveNote() {
    const note = this._notes.find((n) => n.id === this._activeNoteId);
    if (note && this._panel) {
      this._panel.querySelector("#solace-notes-editor").value = note.content;
    }
  },

  _saveCurrentNote() {
    const note = this._notes.find((n) => n.id === this._activeNoteId);
    if (note && this._panel) {
      note.content = this._panel.querySelector("#solace-notes-editor").value;
      note.modified = Date.now();
      // Auto-title from first line
      const firstLine = note.content.split("\n")[0].trim();
      if (firstLine) note.title = firstLine.slice(0, 50);
    }
    this._saveNotes();
  },

  _loadNotes() {
    try {
      const dir = Services.dirsvc.get("ProfD", Ci.nsIFile);
      const file = dir.clone(); file.append("solace"); file.append("notes.json");
      if (!file.exists()) return;
      const data = JSON.parse(IOUtils.readUTF8(file.path));
      this._notes = data.notes || [];
      this._activeNoteId = data.activeId || this._notes[0]?.id;
    } catch (e) { /* ignore */ }
  },

  _saveNotes() {
    try {
      const dir = Services.dirsvc.get("ProfD", Ci.nsIFile);
      const solace = dir.clone(); solace.append("solace");
      if (!solace.exists()) solace.create(Ci.nsIFile.DIRECTORY_TYPE, 0o755);
      const file = solace.clone(); file.append("notes.json");
      IOUtils.writeUTF8(file.path, JSON.stringify({ notes: this._notes, activeId: this._activeNoteId }));
    } catch (e) { /* ignore */ }
  },

  uninit() {
    this._saveCurrentNote();
  },
};
