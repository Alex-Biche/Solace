/* ═══════════════════════════════════════════════════════════════════════════════
   Solace Browser — Pipe
   Share a tab or clipboard to another device on the same local network
   No account needed — uses mDNS/Bonjour for discovery
   ═══════════════════════════════════════════════════════════════════════════════ */

"use strict";

var SolacePipe = {
  _server: null,
  _port: 9876,
  _devices: [],
  _panel: null,

  init() {
    if (!Services.prefs.getBoolPref("solace.pipe.enabled", true)) return;
    this._startServer();
    this._startDiscovery();
  },

  _startServer() {
    try {
      // Create a simple HTTP server on a local port for receiving
      const serverSocket = Cc["@mozilla.org/network/server-socket;1"]
        .createInstance(Ci.nsIServerSocket);
      serverSocket.init(this._port, true, -1); // loopback only for security

      serverSocket.asyncListen({
        onSocketAccepted: (socket, transport) => {
          this._handleIncoming(transport);
        },
        onStopListening: () => {},
      });

      this._server = serverSocket;
    } catch (e) {
      console.debug("Solace Pipe: Could not start server:", e.message);
    }
  },

  _startDiscovery() {
    // Discover other Solace browsers on the network
    // In a real implementation, this would use mDNS/Bonjour
    // For now, we use a simple UDP broadcast approach
    try {
      // Broadcast presence every 30 seconds
      setInterval(() => this._broadcastPresence(), 30000);
      this._broadcastPresence();
    } catch (e) {
      console.debug("Solace Pipe: Discovery error:", e.message);
    }
  },

  _broadcastPresence() {
    // Placeholder — in a real build, this sends UDP multicast
    // announcing this Solace instance
  },

  _handleIncoming(transport) {
    // Read incoming pipe data
    try {
      const inputStream = transport.openInputStream(0, 0, 0);
      const scriptableStream = Cc["@mozilla.org/scriptableinputstream;1"]
        .createInstance(Ci.nsIScriptableInputStream);
      scriptableStream.init(inputStream);

      const data = scriptableStream.read(scriptableStream.available());
      const parsed = JSON.parse(data);

      if (parsed.type === "url") {
        this._showNotification(`Received link from ${parsed.sender}`, () => {
          gBrowser.addTab(parsed.url, {
            triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
          });
        });
      } else if (parsed.type === "clipboard") {
        this._showNotification(`Received clipboard from ${parsed.sender}`, () => {
          const clipboard = Cc["@mozilla.org/widget/clipboard;1"]
            .getService(Ci.nsIClipboard);
          // Set clipboard content
        });
      }

      scriptableStream.close();
      inputStream.close();
    } catch (e) {
      console.debug("Solace Pipe: Incoming error:", e.message);
    }
  },

  showShareDialog() {
    const existing = document.getElementById("solace-pipe-dialog");
    if (existing) { existing.remove(); return; }

    const dialog = document.createElement("div");
    dialog.id = "solace-pipe-dialog";
    dialog.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      width: 360px; background: var(--solace-glass-bg);
      backdrop-filter: blur(40px) saturate(2);
      border: 1px solid var(--solace-glass-border);
      border-radius: var(--solace-border-radius-lg);
      box-shadow: var(--solace-shadow-lg);
      z-index: var(--solace-z-modal); padding: 20px;
      font-family: var(--solace-font-family);
      animation: solace-scale-in 200ms cubic-bezier(0.16, 1, 0.3, 1);
    `;

    const currentUrl = gBrowser.selectedBrowser?.currentURI?.spec || "";

    dialog.innerHTML = `
      <div style="font-size:16px; font-weight:600; color:var(--solace-text-primary); margin-bottom:4px;">📡 Pipe</div>
      <div style="font-size:12px; color:var(--solace-text-tertiary); margin-bottom:16px;">Share to a device on your network</div>

      <div style="padding:10px; background:var(--solace-bg-secondary); border-radius:8px; margin-bottom:16px;">
        <div style="font-size:11px; color:var(--solace-text-tertiary); margin-bottom:4px;">Sharing</div>
        <div style="font-size:13px; color:var(--solace-text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${currentUrl}</div>
      </div>

      <div id="solace-pipe-devices" style="margin-bottom:16px;">
        <div style="text-align:center; padding:20px; color:var(--solace-text-tertiary); font-size:12px;">
          Scanning for devices...
        </div>
      </div>

      <div style="display:flex; gap:8px;">
        <button id="solace-pipe-manual" style="flex:1; padding:8px; border:1px solid var(--solace-border); border-radius:8px; background:transparent; color:var(--solace-text-secondary); cursor:pointer; font-family:var(--solace-font-family); font-size:12px;">Enter IP Manually</button>
        <button id="solace-pipe-close" style="padding:8px 16px; border:none; border-radius:8px; background:var(--solace-bg-secondary); color:var(--solace-text-secondary); cursor:pointer; font-family:var(--solace-font-family); font-size:12px;">Close</button>
      </div>
    `;

    document.documentElement.appendChild(dialog);

    dialog.querySelector("#solace-pipe-close").addEventListener("click", () => dialog.remove());
    dialog.querySelector("#solace-pipe-manual").addEventListener("click", () => {
      const ip = prompt("Enter device IP address:");
      if (ip) this._sendToDevice(ip, currentUrl);
      dialog.remove();
    });

    // Render discovered devices
    this._renderDevices(dialog.querySelector("#solace-pipe-devices"), currentUrl, dialog);
  },

  _renderDevices(container, url, dialog) {
    if (this._devices.length === 0) return;

    container.innerHTML = "";
    for (const device of this._devices) {
      const btn = document.createElement("div");
      btn.style.cssText = `
        display:flex; align-items:center; gap:10px; padding:10px;
        border-radius:8px; cursor:pointer; transition:background 120ms;
      `;
      btn.innerHTML = `
        <span style="font-size:20px;">💻</span>
        <div>
          <div style="font-size:13px; color:var(--solace-text-primary);">${device.name}</div>
          <div style="font-size:11px; color:var(--solace-text-tertiary);">${device.ip}</div>
        </div>
      `;
      btn.addEventListener("click", () => {
        this._sendToDevice(device.ip, url);
        dialog.remove();
      });
      btn.addEventListener("mouseenter", () => { btn.style.background = "var(--solace-bg-hover)"; });
      btn.addEventListener("mouseleave", () => { btn.style.background = ""; });
      container.appendChild(btn);
    }
  },

  async _sendToDevice(ip, url) {
    try {
      const data = JSON.stringify({
        type: "url",
        url,
        sender: Services.appinfo.name,
        timestamp: Date.now(),
      });

      // Simple HTTP POST
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `http://${ip}:${this._port}/pipe`, true);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.send(data);
    } catch (e) {
      console.error("Solace Pipe: Send failed:", e);
    }
  },

  _showNotification(message, action) {
    // Use Firefox's notification system
    const nb = gBrowser.getNotificationBox();
    nb.appendNotification("solace-pipe", {
      label: message,
      priority: nb.PRIORITY_INFO_HIGH,
    }, [{
      label: "Open",
      callback: action,
    }]);
  },

  uninit() {
    if (this._server) {
      this._server.close();
    }
  },
};
