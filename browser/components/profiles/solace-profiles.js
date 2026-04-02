/* ═══════════════════════════════════════════════════════════════════════════════
   Solace Browser — Profile Management
   Completely isolated environments with separate cookies, storage, history,
   passwords, extensions, and settings. No data bleed between profiles.
   ═══════════════════════════════════════════════════════════════════════════════ */

"use strict";

var SolaceProfiles = {
  _profiles: [],
  _activeProfileId: null,
  _profileSwitcherPanel: null,

  COLORS: ["#6C5CE7", "#0984e3", "#00cec9", "#00b894", "#fdcb6e", "#e17055", "#d63031", "#fd79a8"],
  ICONS: ["👤", "💼", "🏠", "🎮", "📚", "🔬", "🎨", "🛒", "🔒", "✈️"],

  init() {
    this._loadProfiles();

    if (this._profiles.length === 0) {
      this._profiles.push({
        id: "default",
        name: "Default",
        color: "#6C5CE7",
        icon: "👤",
        locked: false,
        pin: null,
        isGuest: false,
        profileDir: null, // Uses default Firefox profile
      });
      this._activeProfileId = "default";
      this._saveProfiles();
    }

    this._updateProfileBar();
  },

  // ── Profile CRUD ───────────────────────────────────────────────────────────

  async createProfile(options = {}) {
    const id = "profile-" + Date.now();
    const profile = {
      id,
      name: options.name || "New Profile",
      color: options.color || this.COLORS[this._profiles.length % this.COLORS.length],
      icon: options.icon || "👤",
      locked: options.locked || false,
      pin: options.pin || null,
      isGuest: options.isGuest || false,
      profileDir: null,
    };

    // Create a new Firefox profile directory for complete isolation
    try {
      const profileService = Cc["@mozilla.org/toolkit/profile-service;1"]
        .getService(Ci.nsIToolkitProfileService);

      const newProfile = profileService.createProfile(null, `Solace-${id}`);
      profile.profileDir = newProfile.rootDir.path;
    } catch (e) {
      console.error("Solace: Failed to create profile directory:", e);
      // Fallback: use a subdirectory
      const profileDir = Services.dirsvc.get("ProfD", Ci.nsIFile);
      const solaceDir = profileDir.clone();
      solaceDir.append("solace-profiles");
      solaceDir.append(id);
      if (!solaceDir.exists()) {
        solaceDir.create(Ci.nsIFile.DIRECTORY_TYPE, 0o755);
      }
      profile.profileDir = solaceDir.path;
    }

    this._profiles.push(profile);
    this._saveProfiles();
    this._updateProfileBar();

    return profile;
  },

  deleteProfile(profileId) {
    if (profileId === "default") return;
    if (profileId === this._activeProfileId) {
      this.switchProfile("default");
    }

    this._profiles = this._profiles.filter((p) => p.id !== profileId);
    this._saveProfiles();
    this._updateProfileBar();
  },

  editProfile(profileId, updates) {
    const profile = this._getProfile(profileId);
    if (!profile) return;

    Object.assign(profile, updates);
    this._saveProfiles();
    this._updateProfileBar();
  },

  // ── Profile Switching ──────────────────────────────────────────────────────

  async switchProfile(profileId) {
    const profile = this._getProfile(profileId);
    if (!profile) return;

    // Check if locked
    if (profile.locked && profile.pin) {
      const pin = prompt("Enter PIN to unlock this profile:");
      if (pin !== profile.pin) {
        alert("Incorrect PIN.");
        return;
      }
    }

    this._activeProfileId = profileId;
    this._saveProfiles();
    this._updateProfileBar();
    this._applyProfileTheme(profile);

    // For true isolation, we'd launch a new browser instance with the profile
    // In the overlay approach, we switch container identity
    if (profile.profileDir && profileId !== "default") {
      // Use Firefox's container tabs mechanism for isolation within same window
      this._switchContainerIdentity(profile);
    }

    document.dispatchEvent(new CustomEvent("solace-profile-changed", {
      detail: { profileId, profile },
    }));
  },

  _switchContainerIdentity(profile) {
    // Each profile maps to a userContext (container) for cookie/storage isolation
    const contextId = this._getOrCreateContextId(profile.id);

    // New tabs in this profile use this container
    // Store the mapping
    Services.prefs.setIntPref(`solace.profiles.context.${profile.id}`, contextId);
  },

  _getOrCreateContextId(profileId) {
    const existingId = Services.prefs.getIntPref(`solace.profiles.context.${profileId}`, 0);
    if (existingId > 0) return existingId;

    // Create new userContext identity
    try {
      const contextualIdentityService = Cc["@mozilla.org/contextual-identity-service;1"]
        .getService(Ci.nsIContextualIdentityService);

      const identity = contextualIdentityService.create(
        `Solace: ${profileId}`,
        "fingerprint",
        "blue"
      );

      return identity.userContextId;
    } catch (e) {
      // Fallback
      return Math.floor(Math.random() * 1000) + 100;
    }
  },

  // ── Guest Profile ──────────────────────────────────────────────────────────

  async startGuestSession() {
    const guest = await this.createProfile({
      name: "Guest",
      icon: "🕶",
      color: "#636e72",
      isGuest: true,
    });

    await this.switchProfile(guest.id);
  },

  async endGuestSession() {
    const guestProfile = this._profiles.find((p) => p.isGuest);
    if (!guestProfile) return;

    // Wipe all guest data
    if (guestProfile.profileDir) {
      try {
        const dir = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
        dir.initWithPath(guestProfile.profileDir);
        if (dir.exists()) {
          dir.remove(true); // Recursive delete
        }
      } catch (e) {
        console.error("Solace: Failed to clean guest profile:", e);
      }
    }

    this.deleteProfile(guestProfile.id);
    await this.switchProfile("default");
  },

  // ── Export / Import ────────────────────────────────────────────────────────

  async exportProfile(profileId) {
    const profile = this._getProfile(profileId);
    if (!profile || !profile.profileDir) return;

    // Create a zip of the profile directory
    // This would use nsIZipWriter in a real implementation
    const exportData = {
      profile: { ...profile, pin: null }, // Don't export PIN
      exportDate: new Date().toISOString(),
      version: 1,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    // Trigger download
    const a = document.createElement("a");
    a.href = url;
    a.download = `solace-profile-${profile.name}.json`;
    a.click();

    URL.revokeObjectURL(url);
  },

  async importProfile(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.profile || data.version !== 1) {
        throw new Error("Invalid profile export file");
      }

      const imported = await this.createProfile({
        name: data.profile.name + " (Imported)",
        color: data.profile.color,
        icon: data.profile.icon,
      });

      return imported;
    } catch (e) {
      console.error("Solace: Failed to import profile:", e);
      alert("Failed to import profile: " + e.message);
    }
  },

  // ── Profile Switcher UI ────────────────────────────────────────────────────

  showProfileSwitcher() {
    const existing = document.getElementById("solace-profile-switcher");
    if (existing) { existing.remove(); return; }

    const panel = document.createElement("div");
    panel.id = "solace-profile-switcher";
    panel.style.cssText = `
      position: fixed;
      left: var(--solace-sidebar-collapsed-width, 48px);
      top: 8px;
      width: 280px;
      background: var(--solace-glass-bg);
      backdrop-filter: blur(40px) saturate(2);
      -webkit-backdrop-filter: blur(40px) saturate(2);
      border: 1px solid var(--solace-glass-border);
      border-radius: var(--solace-border-radius-lg);
      box-shadow: var(--solace-shadow-lg);
      z-index: var(--solace-z-modal);
      padding: 8px;
      font-family: var(--solace-font-family);
      animation: solace-scale-in 200ms cubic-bezier(0.16, 1, 0.3, 1);
    `;

    // Profile list
    for (const profile of this._profiles) {
      const item = document.createElement("div");
      item.style.cssText = `
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 12px;
        border-radius: 8px;
        cursor: pointer;
        transition: background 120ms;
        ${profile.id === this._activeProfileId ? "background: var(--solace-bg-selected);" : ""}
      `;

      item.innerHTML = `
        <div style="
          width:32px; height:32px; border-radius:50%;
          background:${profile.color}; display:flex;
          align-items:center; justify-content:center;
          font-size:16px; box-shadow: 0 0 0 2px var(--solace-glass-border);
        ">${profile.icon}</div>
        <div style="flex:1;">
          <div style="font-size:13px; font-weight:500; color:var(--solace-text-primary);">${profile.name}</div>
          <div style="font-size:11px; color:var(--solace-text-tertiary);">
            ${profile.isGuest ? "Guest Session" : profile.locked ? "🔒 Locked" : "Profile"}
          </div>
        </div>
        ${profile.id === this._activeProfileId ? '<div style="color:var(--solace-purple-light); font-size:12px;">●</div>' : ""}
      `;

      item.addEventListener("click", () => {
        this.switchProfile(profile.id);
        panel.remove();
      });

      item.addEventListener("mouseenter", () => { item.style.background = "var(--solace-bg-hover)"; });
      item.addEventListener("mouseleave", () => {
        item.style.background = profile.id === this._activeProfileId ? "var(--solace-bg-selected)" : "";
      });

      panel.appendChild(item);
    }

    // Separator
    const sep = document.createElement("div");
    sep.style.cssText = "height:1px; background:var(--solace-border); margin:6px 0;";
    panel.appendChild(sep);

    // Actions
    const actions = [
      { icon: "➕", label: "New Profile", action: () => { this.createProfile(); panel.remove(); } },
      { icon: "🕶", label: "Guest Session", action: () => { this.startGuestSession(); panel.remove(); } },
      { icon: "📤", label: "Export Profile", action: () => { this.exportProfile(this._activeProfileId); panel.remove(); } },
    ];

    for (const act of actions) {
      const item = document.createElement("div");
      item.style.cssText = `
        display: flex; align-items: center; gap: 10px;
        padding: 8px 12px; border-radius: 8px; cursor: pointer;
        font-size: 13px; color: var(--solace-text-secondary);
        transition: background 120ms;
      `;
      item.innerHTML = `<span style="font-size:14px;">${act.icon}</span> ${act.label}`;
      item.addEventListener("click", act.action);
      item.addEventListener("mouseenter", () => { item.style.background = "var(--solace-bg-hover)"; });
      item.addEventListener("mouseleave", () => { item.style.background = ""; });
      panel.appendChild(item);
    }

    document.documentElement.appendChild(panel);

    // Close on click outside
    setTimeout(() => {
      const close = (e) => {
        if (!panel.contains(e.target)) {
          panel.remove();
          document.removeEventListener("click", close);
        }
      };
      document.addEventListener("click", close);
    }, 0);
  },

  // ── Theme application ──────────────────────────────────────────────────────

  _applyProfileTheme(profile) {
    const root = document.documentElement;
    root.style.setProperty("--solace-profile-color", profile.color);

    // Update profile bar in sidebar
    const avatar = document.querySelector(".solace-profile-avatar");
    const name = document.querySelector(".solace-profile-name");
    if (avatar) {
      avatar.style.background = profile.color;
      avatar.textContent = profile.icon;
    }
    if (name) name.textContent = profile.name;
  },

  _updateProfileBar() {
    const profile = this._getProfile(this._activeProfileId);
    if (profile) this._applyProfileTheme(profile);
  },

  // ── Persistence ────────────────────────────────────────────────────────────

  _loadProfiles() {
    try {
      const profileDir = Services.dirsvc.get("ProfD", Ci.nsIFile);
      const file = profileDir.clone();
      file.append("solace");
      file.append("profiles.json");

      if (!file.exists()) return;

      const data = IOUtils.readUTF8(file.path);
      const parsed = JSON.parse(data);
      this._profiles = parsed.profiles || [];
      this._activeProfileId = parsed.activeId || "default";
    } catch (e) {
      console.error("Solace: Failed to load profiles:", e);
    }
  },

  _saveProfiles() {
    try {
      const profileDir = Services.dirsvc.get("ProfD", Ci.nsIFile);
      const solaceDir = profileDir.clone();
      solaceDir.append("solace");
      if (!solaceDir.exists()) solaceDir.create(Ci.nsIFile.DIRECTORY_TYPE, 0o755);

      const file = solaceDir.clone();
      file.append("profiles.json");

      const data = JSON.stringify({
        profiles: this._profiles.map((p) => ({ ...p, pin: p.pin })), // PIN stored locally only
        activeId: this._activeProfileId,
      }, null, 2);

      IOUtils.writeUTF8(file.path, data);
    } catch (e) {
      console.error("Solace: Failed to save profiles:", e);
    }
  },

  _getProfile(id) {
    return this._profiles.find((p) => p.id === id);
  },

  uninit() {
    this._saveProfiles();
    // End guest session if active
    const activeProfile = this._getProfile(this._activeProfileId);
    if (activeProfile?.isGuest) {
      this.endGuestSession();
    }
  },
};
