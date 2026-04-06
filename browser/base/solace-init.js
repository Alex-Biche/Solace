/* ═══════════════════════════════════════════════════════════════════════════════
   Solace Browser — Main Initialization
   This script bootstraps all Solace components when the browser window opens.
   It is loaded via an overlay on browser.xhtml.
   ═══════════════════════════════════════════════════════════════════════════════ */

"use strict";

var Solace = {
  _initialized: false,

  /**
   * Called when the main browser window loads.
   * Initializes all Solace components in the correct order.
   */
  init() {
    if (this._initialized) return;
    this._initialized = true;

    console.log("[Solace] Initializing Solace Browser...");

    // ── Phase 1: Core services ─────────────────────────────────────
    try {
      this._applyTheme();
      this._registerAboutPages();
    } catch (e) {
      console.error("[Solace] Phase 1 error:", e);
    }

    // ── Phase 2: UI components ─────────────────────────────────────
    try {
      SolaceProfiles.init();
      SolaceWorkspaces.init();
      SolaceTabGroups.init();
      SolaceSidebar.init();
      SolaceCommandBar.init();
      SolaceSplitView.init();
      SolaceFocusMode.init();
      SolaceGhostMode.init();
    } catch (e) {
      console.error("[Solace] Phase 2 error:", e);
    }

    // ── Phase 3: Feature panels ────────────────────────────────────
    try {
      SolaceNotes.init();
      SolaceScreenshots.init();
      SolaceSessions.init();
      SolaceReadingQueue.init();
      SolaceSoundMixer.init();
      SolaceCSSEditor.init();
    } catch (e) {
      console.error("[Solace] Phase 3 error:", e);
    }

    // ── Phase 4: Advanced features ─────────────────────────────────
    try {
      SolacePeek.init();
      SolaceDistractionLock.init();
      SolacePipe.init();
      SolaceAdaptiveColor.init();
    } catch (e) {
      console.error("[Solace] Phase 4 error:", e);
    }

    // ── Phase 5: AI (only if enabled) ──────────────────────────────
    try {
      SolaceAIPanel.init();
    } catch (e) {
      console.error("[Solace] AI Panel error:", e);
    }

    // ── Phase 6: Settings, Privacy & Keybindings ──────────────────
    try {
      SolaceKeybindings.init();
      SolacePrivacy.init();
      SolaceStatusBar.init();
    } catch (e) {
      console.error("[Solace] Phase 6 error:", e);
    }

    // ── Phase 7: First-run check ──────────────────────────────────
    this._checkFirstRun();

    console.log("[Solace] Initialization complete.");
  },

  /**
   * Called when the browser window is closing.
   * Cleans up all Solace components.
   */
  uninit() {
    console.log("[Solace] Shutting down...");

    const components = [
      SolaceKeybindings, SolaceStatusBar, SolacePrivacy,
      SolaceSidebar, SolaceWorkspaces, SolaceProfiles, SolaceTabGroups,
      SolaceCommandBar, SolaceSplitView, SolaceFocusMode, SolaceGhostMode,
      SolaceNotes, SolaceScreenshots, SolaceSessions, SolaceReadingQueue,
      SolaceSoundMixer, SolaceCSSEditor, SolacePeek, SolaceDistractionLock,
      SolacePipe, SolaceAIPanel, SolaceAdaptiveColor,
    ];

    for (const component of components) {
      try {
        if (component && typeof component.uninit === "function") {
          component.uninit();
        }
      } catch (e) {
        console.error("[Solace] Cleanup error:", e);
      }
    }
  },

  // ── Theme application ──────────────────────────────────────────
  _applyTheme() {
    const root = document.documentElement;
    const mode = Services.prefs.getStringPref("solace.theme.mode", "system");
    const density = Services.prefs.getStringPref("solace.theme.density", "normal");
    const translucent = Services.prefs.getBoolPref("solace.theme.translucent", true);
    const blurIntensity = Services.prefs.getIntPref("solace.theme.blur-intensity", 20);

    root.setAttribute("solace-theme", mode);
    root.setAttribute("solace-density", density);

    if (translucent) {
      root.style.setProperty("--solace-glass-blur", blurIntensity + "px");
    } else {
      root.style.setProperty("--solace-glass-blur", "0px");
      root.style.setProperty("--solace-glass-bg", "var(--solace-bg-primary)");
    }

    // Apply user accent color
    this._applyAccentColor();

    // Load the Solace theme CSS
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "chrome://solace/content/themes/solace-theme.css";
    document.head.appendChild(link);

    // Load sidebar CSS
    const sidebarCSS = document.createElement("link");
    sidebarCSS.rel = "stylesheet";
    sidebarCSS.href = "chrome://solace/content/components/sidebar/solace-sidebar.css";
    document.head.appendChild(sidebarCSS);

    // Watch for theme preference changes
    Services.prefs.addObserver("solace.theme.", {
      observe(subject, topic, data) {
        if (data === "solace.theme.mode") {
          root.setAttribute("solace-theme", Services.prefs.getStringPref("solace.theme.mode", "system"));
        } else if (data === "solace.theme.density") {
          root.setAttribute("solace-density", Services.prefs.getStringPref("solace.theme.density", "normal"));
        }
      },
    });
  },

  // ── Register about: pages ──────────────────────────────────────
  _registerAboutPages() {
    // Register about:solace-newtab
    const { ComponentUtils } = ChromeUtils.importESModule(
      "resource://gre/modules/ComponentUtils.sys.mjs"
    );

    class SolaceNewTabPage {
      get URI() { return Services.io.newURI("chrome://solace/content/components/newtab/solace-newtab.html"); }
      get flags() { return Ci.nsIAboutModule.ALLOW_SCRIPT | Ci.nsIAboutModule.URI_SAFE_FOR_UNTRUSTED_CONTENT; }
      getURIFlags() { return this.flags; }
      newChannel(uri, loadInfo) {
        const channel = Services.io.newChannelFromURIWithLoadInfo(this.URI, loadInfo);
        channel.originalURI = uri;
        return channel;
      }
    }

    class SolaceOnboardingPage {
      get URI() { return Services.io.newURI("chrome://solace/content/components/onboarding/solace-onboarding.html"); }
      get flags() { return Ci.nsIAboutModule.ALLOW_SCRIPT; }
      getURIFlags() { return this.flags; }
      newChannel(uri, loadInfo) {
        const channel = Services.io.newChannelFromURIWithLoadInfo(this.URI, loadInfo);
        channel.originalURI = uri;
        return channel;
      }
    }

    class SolaceAboutPage {
      get URI() { return Services.io.newURI("chrome://branding/content/about.xhtml"); }
      get flags() { return Ci.nsIAboutModule.ALLOW_SCRIPT; }
      getURIFlags() { return this.flags; }
      newChannel(uri, loadInfo) {
        const channel = Services.io.newChannelFromURIWithLoadInfo(this.URI, loadInfo);
        channel.originalURI = uri;
        return channel;
      }
    }

    // Registration would happen via components in a real build
    // For now, we override the new tab behavior
    try {
      const newTabURL = "chrome://solace/content/components/newtab/solace-newtab.html";
      Services.prefs.setStringPref("browser.newtab.url", newTabURL);

      // Override AboutNewTab
      const { AboutNewTab } = ChromeUtils.importESModule(
        "resource:///modules/AboutNewTab.sys.mjs"
      );
      AboutNewTab.newTabURL = newTabURL;
    } catch (e) {
      console.debug("[Solace] Could not override new tab URL:", e.message);
    }
  },

  // ── First run detection ────────────────────────────────────────
  _checkFirstRun() {
    const hasRun = Services.prefs.getBoolPref("solace.firstrun.completed", false);

    if (!hasRun) {
      // Open onboarding page
      gBrowser.addTab("chrome://solace/content/components/onboarding/solace-onboarding.html", {
        triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
      });

      // Listen for onboarding completion
      window.addEventListener("solace-onboarding-complete", (e) => {
        this._applyOnboardingSettings(e.detail);
        Services.prefs.setBoolPref("solace.firstrun.completed", true);
      });
    }
  },

  _applyOnboardingSettings(settings) {
    if (!settings) return;

    try {
      if (settings.theme) {
        Services.prefs.setStringPref("solace.theme.mode", settings.theme);
      }
      if (settings.density) {
        Services.prefs.setStringPref("solace.theme.density", settings.density);
      }
      if (settings.accentColor) {
        Services.prefs.setStringPref("solace.theme.accent-color", settings.accentColor);
      }
      if (settings.privacy) {
        this._applyPrivacyLevel(settings.privacy);
      }
      if (settings.features) {
        for (const [feature, enabled] of Object.entries(settings.features)) {
          const prefMap = {
            "workspaces": "solace.workspaces.enabled",
            "tab-sleep": "solace.sidebar.vertical-tabs",
            "peek": "solace.peek-links.enabled",
            "sound-mixer": "solace.sound-mixer.enabled",
            "ai": "solace.ai.enabled",
            "pipe": "solace.pipe.enabled",
          };
          const pref = prefMap[feature];
          if (pref) Services.prefs.setBoolPref(pref, enabled);
        }
      }
      if (settings.routing && settings.routing !== "direct") {
        Services.prefs.setStringPref("solace.privacy.routing", settings.routing);
        try { SolacePrivacy._setRouting(settings.routing); } catch (e) {}
      }
      if (settings.import && settings.import !== "none") {
        // Trigger Firefox's built-in import wizard
        try {
          MigrationUtils.showMigrationWizard(window, {
            entrypoint: MigrationUtils.MIGRATION_ENTRYPOINTS.FIRSTRUN,
          });
        } catch (e) {
          console.debug("[Solace] Import wizard:", e.message);
        }
      }
    } catch (e) {
      console.error("[Solace] Failed to apply onboarding settings:", e);
    }
  },

  _applyPrivacyLevel(level) {
    switch (level) {
      case "relaxed":
        Services.prefs.setBoolPref("privacy.resistFingerprinting", false);
        Services.prefs.setBoolPref("privacy.firstparty.isolate", false);
        Services.prefs.setStringPref("browser.contentblocking.category", "standard");
        break;

      case "standard":
        Services.prefs.setBoolPref("privacy.resistFingerprinting", false);
        Services.prefs.setBoolPref("privacy.firstparty.isolate", true);
        Services.prefs.setStringPref("browser.contentblocking.category", "strict");
        break;

      case "strict":
        Services.prefs.setBoolPref("privacy.resistFingerprinting", true);
        Services.prefs.setBoolPref("privacy.firstparty.isolate", true);
        Services.prefs.setStringPref("browser.contentblocking.category", "strict");
        break;

      case "paranoid":
        Services.prefs.setBoolPref("privacy.resistFingerprinting", true);
        Services.prefs.setBoolPref("privacy.firstparty.isolate", true);
        Services.prefs.setBoolPref("javascript.enabled", false);
        Services.prefs.setIntPref("network.cookie.cookieBehavior", 2); // block all
        Services.prefs.setStringPref("browser.contentblocking.category", "strict");
        break;
    }
  },

  // ── Accent color application ───────────────────────────────────
  _applyAccentColor() {
    try {
      const color = Services.prefs.getStringPref("solace.theme.accent-color", "#6C5CE7");
      const root = document.documentElement;
      root.style.setProperty("--solace-accent-user", color);

      // Derive lighter/darker variants
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      root.style.setProperty("--solace-accent-rgb", `${r}, ${g}, ${b}`);
      root.style.setProperty("--solace-accent-light", `rgba(${r}, ${g}, ${b}, 0.15)`);
      root.style.setProperty("--solace-accent-glow", `0 0 20px rgba(${r}, ${g}, ${b}, 0.15)`);
    } catch (e) {}
  },
};

// ── Bootstrap ────────────────────────────────────────────────────
// Firefox calls these when the window loads/unloads
window.addEventListener("load", () => Solace.init());
window.addEventListener("unload", () => Solace.uninit());
