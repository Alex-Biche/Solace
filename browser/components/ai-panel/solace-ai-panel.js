/* ═══════════════════════════════════════════════════════════════════════════════
   Solace Browser — AI Integration Panel (Opt-in Only)
   Connects to any OpenAI-compatible API endpoint.
   Completely disabled by default — no UI, no network, nothing.
   ═══════════════════════════════════════════════════════════════════════════════ */

"use strict";

var SolaceAIPanel = {
  _panel: null,
  _visible: false,
  _enabled: false,
  _messages: [],
  _abortController: null,

  init() {
    this._enabled = Services.prefs.getBoolPref("solace.ai.enabled", false);

    // Only build UI if enabled
    if (this._enabled) {
      this._buildUI();
    }

    Services.prefs.addObserver("solace.ai.enabled", this);
  },

  observe(subject, topic, data) {
    if (data === "solace.ai.enabled") {
      this._enabled = Services.prefs.getBoolPref("solace.ai.enabled", false);
      if (this._enabled && !this._panel) {
        this._buildUI();
      } else if (!this._enabled && this._panel) {
        this._destroyUI();
      }
    }
  },

  _getConfig() {
    return {
      endpoint: Services.prefs.getStringPref("solace.ai.endpoint", ""),
      apiKey: Services.prefs.getStringPref("solace.ai.api-key", ""),
      model: Services.prefs.getStringPref("solace.ai.model", ""),
      provider: Services.prefs.getStringPref("solace.ai.provider", ""),
    };
  },

  _buildUI() {
    const panel = document.createElement("div");
    panel.id = "solace-ai-panel";
    panel.style.cssText = `
      position: fixed;
      right: 0;
      top: 0;
      bottom: 0;
      width: 380px;
      background: var(--solace-glass-bg);
      backdrop-filter: blur(var(--solace-glass-blur)) saturate(var(--solace-glass-saturate));
      -webkit-backdrop-filter: blur(var(--solace-glass-blur)) saturate(var(--solace-glass-saturate));
      border-left: 1px solid var(--solace-glass-border);
      z-index: var(--solace-z-panel);
      display: none;
      flex-direction: column;
      font-family: var(--solace-font-family);
      box-shadow: var(--solace-shadow-lg);
      transition: transform var(--solace-transition-slow);
    `;

    panel.innerHTML = `
      <div style="display:flex; align-items:center; padding:12px 16px; border-bottom:1px solid var(--solace-border);">
        <span style="font-size:14px; font-weight:600; color:var(--solace-text-primary); flex:1;">AI Assistant</span>
        <div id="solace-ai-model-badge" style="
          font-size:10px; padding:3px 8px; border-radius:100px;
          background:var(--solace-bg-hover); color:var(--solace-text-tertiary);
          margin-right:8px;
        ">No model</div>
        <div id="solace-ai-settings-btn" style="
          cursor:pointer; padding:4px 8px; border-radius:6px;
          color:var(--solace-text-secondary); font-size:12px;
          transition: background 120ms;
        ">⚙</div>
        <div id="solace-ai-close-btn" style="
          cursor:pointer; padding:4px 8px; border-radius:6px;
          color:var(--solace-text-secondary); font-size:14px;
          transition: background 120ms;
        ">✕</div>
      </div>

      <div id="solace-ai-messages" style="
        flex:1; overflow-y:auto; padding:12px 16px;
        display:flex; flex-direction:column; gap:12px;
      ">
        <div style="text-align:center; padding:24px; color:var(--solace-text-tertiary); font-size:13px;">
          <p style="font-size:20px; margin-bottom:8px;">🤖</p>
          <p>AI is connected directly to your chosen provider.</p>
          <p style="margin-top:4px; font-size:11px;">Nothing is routed through Solace servers.</p>
        </div>
      </div>

      <div id="solace-ai-actions" style="
        display:flex; gap:6px; padding:8px 16px;
        border-top:1px solid var(--solace-border);
      ">
        <button class="solace-ai-action-btn" data-action="summarize">Summarize Page</button>
        <button class="solace-ai-action-btn" data-action="explain">Explain Selection</button>
        <button class="solace-ai-action-btn" data-action="qa">Q&A</button>
      </div>

      <div id="solace-ai-input-area" style="
        display:flex; gap:8px; padding:12px 16px;
        border-top:1px solid var(--solace-border);
      ">
        <textarea id="solace-ai-input" placeholder="Ask about this page..." style="
          flex:1; background:var(--solace-bg-secondary); border:1px solid var(--solace-border);
          border-radius:8px; padding:8px 12px; color:var(--solace-text-primary);
          font-family:var(--solace-font-family); font-size:13px; resize:none;
          outline:none; min-height:36px; max-height:120px;
          transition: border-color 120ms;
        "></textarea>
        <button id="solace-ai-send" style="
          background:var(--solace-purple); color:white; border:none;
          border-radius:8px; padding:8px 14px; cursor:pointer;
          font-family:var(--solace-font-family); font-size:13px; font-weight:500;
          transition: opacity 120ms; align-self:flex-end;
        ">Send</button>
      </div>

      <div id="solace-ai-settings-panel" style="
        display:none; position:absolute; inset:0;
        background:var(--solace-bg-primary); z-index:10;
        flex-direction:column; overflow-y:auto;
      ">
        <div style="padding:16px; border-bottom:1px solid var(--solace-border); display:flex; align-items:center;">
          <span style="font-size:14px; font-weight:600; color:var(--solace-text-primary); flex:1;">AI Settings</span>
          <div id="solace-ai-settings-close" style="cursor:pointer; color:var(--solace-text-secondary);">✕</div>
        </div>
        <div style="padding:16px; display:flex; flex-direction:column; gap:16px;">
          <div>
            <label style="font-size:12px; color:var(--solace-text-secondary); display:block; margin-bottom:4px;">Provider</label>
            <select id="solace-ai-provider" style="
              width:100%; padding:8px; background:var(--solace-bg-secondary);
              border:1px solid var(--solace-border); border-radius:6px;
              color:var(--solace-text-primary); font-family:var(--solace-font-family);
            ">
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="mistral">Mistral</option>
              <option value="ollama">Ollama (Local)</option>
              <option value="custom">Custom Endpoint</option>
            </select>
          </div>
          <div>
            <label style="font-size:12px; color:var(--solace-text-secondary); display:block; margin-bottom:4px;">API Endpoint</label>
            <input id="solace-ai-endpoint-input" type="text" placeholder="https://api.openai.com/v1" style="
              width:100%; padding:8px; background:var(--solace-bg-secondary);
              border:1px solid var(--solace-border); border-radius:6px;
              color:var(--solace-text-primary); font-family:var(--solace-font-family);
            " />
          </div>
          <div>
            <label style="font-size:12px; color:var(--solace-text-secondary); display:block; margin-bottom:4px;">API Key</label>
            <input id="solace-ai-key-input" type="password" placeholder="sk-..." style="
              width:100%; padding:8px; background:var(--solace-bg-secondary);
              border:1px solid var(--solace-border); border-radius:6px;
              color:var(--solace-text-primary); font-family:var(--solace-font-family);
            " />
          </div>
          <div>
            <label style="font-size:12px; color:var(--solace-text-secondary); display:block; margin-bottom:4px;">Model</label>
            <input id="solace-ai-model-input" type="text" placeholder="gpt-4o, claude-sonnet-4-6, etc." style="
              width:100%; padding:8px; background:var(--solace-bg-secondary);
              border:1px solid var(--solace-border); border-radius:6px;
              color:var(--solace-text-primary); font-family:var(--solace-font-family);
            " />
          </div>
          <button id="solace-ai-save-settings" style="
            background:var(--solace-purple); color:white; border:none;
            border-radius:8px; padding:10px; cursor:pointer;
            font-family:var(--solace-font-family); font-weight:500;
          ">Save Settings</button>
        </div>
      </div>
    `;

    document.documentElement.appendChild(panel);
    this._panel = panel;
    this._bindPanelEvents();
    this._loadSettings();
  },

  _bindPanelEvents() {
    // Close
    this._panel.querySelector("#solace-ai-close-btn").addEventListener("click", () => this.hide());

    // Settings toggle
    this._panel.querySelector("#solace-ai-settings-btn").addEventListener("click", () => {
      const settingsPanel = this._panel.querySelector("#solace-ai-settings-panel");
      settingsPanel.style.display = settingsPanel.style.display === "flex" ? "none" : "flex";
    });

    this._panel.querySelector("#solace-ai-settings-close").addEventListener("click", () => {
      this._panel.querySelector("#solace-ai-settings-panel").style.display = "none";
    });

    // Save settings
    this._panel.querySelector("#solace-ai-save-settings").addEventListener("click", () => {
      this._saveSettings();
    });

    // Send message
    this._panel.querySelector("#solace-ai-send").addEventListener("click", () => {
      this._sendMessage();
    });

    // Enter to send
    this._panel.querySelector("#solace-ai-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this._sendMessage();
      }
    });

    // Quick action buttons
    this._panel.querySelectorAll(".solace-ai-action-btn").forEach((btn) => {
      btn.style.cssText = `
        padding:5px 10px; border-radius:100px; border:1px solid var(--solace-border);
        background:transparent; color:var(--solace-text-secondary);
        font-size:11px; cursor:pointer; font-family:var(--solace-font-family);
        transition: all 120ms;
      `;
      btn.addEventListener("click", () => {
        this._quickAction(btn.dataset.action);
      });
    });

    // Provider change updates endpoint
    this._panel.querySelector("#solace-ai-provider").addEventListener("change", (e) => {
      const endpointInput = this._panel.querySelector("#solace-ai-endpoint-input");
      const endpoints = {
        openai: "https://api.openai.com/v1",
        anthropic: "https://api.anthropic.com/v1",
        mistral: "https://api.mistral.ai/v1",
        ollama: "http://localhost:11434/v1",
        custom: "",
      };
      endpointInput.value = endpoints[e.target.value] || "";
    });
  },

  _loadSettings() {
    const config = this._getConfig();
    if (this._panel) {
      this._panel.querySelector("#solace-ai-endpoint-input").value = config.endpoint;
      this._panel.querySelector("#solace-ai-key-input").value = config.apiKey;
      this._panel.querySelector("#solace-ai-model-input").value = config.model;
      this._panel.querySelector("#solace-ai-provider").value = config.provider || "custom";

      const badge = this._panel.querySelector("#solace-ai-model-badge");
      badge.textContent = config.model || "No model";
    }
  },

  _saveSettings() {
    const endpoint = this._panel.querySelector("#solace-ai-endpoint-input").value.trim();
    const apiKey = this._panel.querySelector("#solace-ai-key-input").value.trim();
    const model = this._panel.querySelector("#solace-ai-model-input").value.trim();
    const provider = this._panel.querySelector("#solace-ai-provider").value;

    Services.prefs.setStringPref("solace.ai.endpoint", endpoint);
    Services.prefs.setStringPref("solace.ai.api-key", apiKey);
    Services.prefs.setStringPref("solace.ai.model", model);
    Services.prefs.setStringPref("solace.ai.provider", provider);

    const badge = this._panel.querySelector("#solace-ai-model-badge");
    badge.textContent = model || "No model";

    this._panel.querySelector("#solace-ai-settings-panel").style.display = "none";
  },

  // ── Chat ───────────────────────────────────────────────────────────────────

  async _sendMessage(content) {
    const input = this._panel.querySelector("#solace-ai-input");
    const text = content || input.value.trim();
    if (!text) return;

    input.value = "";
    this._addMessage("user", text);

    const config = this._getConfig();
    if (!config.endpoint || !config.model) {
      this._addMessage("system", "Please configure your AI provider in settings (⚙).");
      return;
    }

    // Build messages array
    const messages = this._messages.map((m) => ({
      role: m.role === "system" ? "assistant" : m.role,
      content: m.content,
    }));

    try {
      this._addMessage("assistant", "...");
      const loadingEl = this._panel.querySelector("#solace-ai-messages").lastElementChild;

      this._abortController = new AbortController();

      const headers = {
        "Content-Type": "application/json",
      };

      // Handle different auth styles
      if (config.provider === "anthropic") {
        headers["x-api-key"] = config.apiKey;
        headers["anthropic-version"] = "2023-06-01";
      } else {
        headers["Authorization"] = `Bearer ${config.apiKey}`;
      }

      let body, url;

      if (config.provider === "anthropic") {
        url = config.endpoint + "/messages";
        body = JSON.stringify({
          model: config.model,
          max_tokens: 4096,
          messages: messages.filter((m) => m.role !== "system"),
        });
      } else {
        url = config.endpoint + "/chat/completions";
        body = JSON.stringify({
          model: config.model,
          messages,
          max_tokens: 4096,
        });
      }

      const response = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: this._abortController.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API error ${response.status}: ${errText}`);
      }

      const data = await response.json();

      let reply;
      if (config.provider === "anthropic") {
        reply = data.content?.[0]?.text || "No response";
      } else {
        reply = data.choices?.[0]?.message?.content || "No response";
      }

      // Replace loading message
      if (loadingEl) loadingEl.remove();
      this._messages.pop(); // Remove placeholder
      this._addMessage("assistant", reply);

    } catch (e) {
      if (e.name === "AbortError") return;
      const messagesContainer = this._panel.querySelector("#solace-ai-messages");
      if (messagesContainer.lastElementChild) {
        messagesContainer.lastElementChild.remove();
      }
      this._messages.pop();
      this._addMessage("system", `Error: ${e.message}`);
    }
  },

  _addMessage(role, content) {
    this._messages.push({ role, content });

    const container = this._panel.querySelector("#solace-ai-messages");
    const msg = document.createElement("div");

    const isUser = role === "user";
    const isSystem = role === "system";

    msg.style.cssText = `
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 13px;
      line-height: 1.5;
      max-width: 90%;
      word-wrap: break-word;
      white-space: pre-wrap;
      animation: solace-fade-in 200ms ease-out;
      ${isUser
        ? "align-self:flex-end; background:var(--solace-purple); color:white;"
        : isSystem
          ? "align-self:center; background:rgba(255,60,60,0.1); color:var(--solace-red); font-size:12px; text-align:center;"
          : "align-self:flex-start; background:var(--solace-bg-secondary); color:var(--solace-text-primary);"}
    `;
    msg.textContent = content;

    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
  },

  // ── Quick actions ──────────────────────────────────────────────────────────

  async _quickAction(action) {
    let text;

    switch (action) {
      case "summarize":
        const pageText = await this._getPageText();
        text = `Please summarize the following web page content concisely:\n\n${pageText.slice(0, 8000)}`;
        break;

      case "explain":
        const selection = await this._getSelection();
        if (!selection) {
          this._addMessage("system", "Select some text on the page first.");
          return;
        }
        text = `Please explain the following text:\n\n"${selection}"`;
        break;

      case "qa":
        const pageContent = await this._getPageText();
        this._addMessage("system", "Ask any question about this page. Context has been loaded.");
        this._messages.push({
          role: "system",
          content: `The user is viewing a web page. Here is the page content for context:\n\n${pageContent.slice(0, 8000)}`,
        });
        return;
    }

    if (text) {
      await this._sendMessage(text);
    }
  },

  async _getPageText() {
    try {
      const browser = gBrowser.selectedBrowser;
      const actor = browser.browsingContext.currentWindowGlobal.getActor("SolaceAI");
      return await actor.sendQuery("GetPageText");
    } catch (e) {
      // Fallback: try to get text via content script
      return "Unable to extract page content.";
    }
  },

  async _getSelection() {
    try {
      const browser = gBrowser.selectedBrowser;
      const actor = browser.browsingContext.currentWindowGlobal.getActor("SolaceAI");
      return await actor.sendQuery("GetSelection");
    } catch (e) {
      return "";
    }
  },

  // ── Toggle ─────────────────────────────────────────────────────────────────

  toggle() {
    if (!this._enabled) {
      // Show a prompt to enable AI
      const enable = confirm(
        "AI features are currently disabled.\n\n" +
        "Enabling will add an AI panel that connects directly to your chosen AI provider. " +
        "No data is routed through Solace servers.\n\n" +
        "Enable AI features?"
      );
      if (enable) {
        Services.prefs.setBoolPref("solace.ai.enabled", true);
      }
      return;
    }

    if (this._visible) this.hide();
    else this.show();
  },

  show() {
    if (!this._panel) return;
    this._visible = true;
    this._panel.style.display = "flex";
    this._panel.querySelector("#solace-ai-input").focus();
  },

  hide() {
    if (!this._panel) return;
    this._visible = false;
    this._panel.style.display = "none";
    if (this._abortController) this._abortController.abort();
  },

  _destroyUI() {
    if (this._panel) {
      this._panel.remove();
      this._panel = null;
    }
    this._visible = false;
    this._messages = [];
  },

  uninit() {
    Services.prefs.removeObserver("solace.ai.enabled", this);
    if (this._abortController) this._abortController.abort();
    this._destroyUI();
  },
};
