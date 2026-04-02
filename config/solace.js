// Solace Browser — Default Preferences
// These override Firefox defaults for privacy, performance, and UX

// ═══════════════════════════════════════════════════════════════════════════════
// PRIVACY & SECURITY
// ═══════════════════════════════════════════════════════════════════════════════

// Zero telemetry
pref("toolkit.telemetry.enabled", false);
pref("toolkit.telemetry.unified", false);
pref("toolkit.telemetry.archive.enabled", false);
pref("toolkit.telemetry.newProfilePing.enabled", false);
pref("toolkit.telemetry.shutdownPingSender.enabled", false);
pref("toolkit.telemetry.updatePing.enabled", false);
pref("toolkit.telemetry.bhrPing.enabled", false);
pref("toolkit.telemetry.firstShutdownPing.enabled", false);
pref("toolkit.telemetry.server", "");
pref("toolkit.telemetry.coverage.opt-out", true);
pref("datareporting.healthreport.uploadEnabled", false);
pref("datareporting.policy.dataSubmissionEnabled", false);
pref("app.shield.optoutstudies.enabled", false);
pref("browser.ping-centre.telemetry", false);
pref("browser.newtabpage.activity-stream.feeds.telemetry", false);
pref("browser.newtabpage.activity-stream.telemetry", false);

// Disable experiments and Normandy
pref("app.normandy.enabled", false);
pref("app.normandy.api_url", "");
pref("messaging-system.rsexperimentloader.enabled", false);

// Disable sponsored content
pref("browser.newtabpage.activity-stream.showSponsored", false);
pref("browser.newtabpage.activity-stream.showSponsoredTopSites", false);
pref("browser.newtabpage.activity-stream.default.sites", "");

// Disable Pocket
pref("extensions.pocket.enabled", false);
pref("extensions.pocket.api", "");
pref("extensions.pocket.site", "");

// HTTPS-only mode by default
pref("dom.security.https_only_mode", true);
pref("dom.security.https_only_mode_ever_enabled", true);
pref("dom.security.https_only_mode_send_http_background_request", false);

// First-party isolation
pref("privacy.firstparty.isolate", true);

// Enhanced tracking protection — strict
pref("privacy.trackingprotection.enabled", true);
pref("privacy.trackingprotection.socialtracking.enabled", true);
pref("privacy.trackingprotection.cryptomining.enabled", true);
pref("privacy.trackingprotection.fingerprinting.enabled", true);
pref("browser.contentblocking.category", "strict");

// Fingerprint resistance
pref("privacy.resistFingerprinting", true);
pref("privacy.resistFingerprinting.randomization", true);
pref("privacy.resistFingerprinting.letterboxing", false);

// Cookie behavior — reject third-party
pref("network.cookie.cookieBehavior", 5);
pref("network.cookie.lifetimePolicy", 0);

// DNS over HTTPS
pref("network.trr.mode", 3);
pref("network.trr.uri", "https://mozilla.cloudflare-dns.com/dns-query");
pref("network.trr.custom_uri", "");

// DNS leak protection
pref("network.proxy.socks_remote_dns", true);
pref("network.dns.disablePrefetch", true);

// Disable prefetch (privacy)
pref("network.prefetch-next", false);
pref("network.dns.disablePrefetch", true);
pref("network.predictor.enabled", false);
pref("network.http.speculative-parallel-limit", 0);

// WebRTC leak prevention
pref("media.peerconnection.ice.default_address_only", true);
pref("media.peerconnection.ice.no_host", true);

// Disable safe browsing phoning home (local lists still work)
pref("browser.safebrowsing.downloads.remote.enabled", false);

// Container tabs enabled
pref("privacy.userContext.enabled", true);
pref("privacy.userContext.ui.enabled", true);

// ═══════════════════════════════════════════════════════════════════════════════
// PERFORMANCE
// ═══════════════════════════════════════════════════════════════════════════════

// Hardware acceleration
pref("layers.acceleration.force-enabled", true);
pref("gfx.webrender.all", true);
pref("gfx.canvas.accelerated", true);
pref("media.hardware-video-decoding.force-enabled", true);

// Lazy tab loading on restore
pref("browser.sessionstore.restore_on_demand", true);
pref("browser.sessionstore.restore_pinned_tabs_on_demand", false);

// Process isolation
pref("dom.ipc.processCount", 8);
pref("fission.autostart", true);

// Smooth scrolling
pref("general.smoothScroll", true);
pref("general.smoothScroll.msdPhysics.enabled", true);
pref("general.smoothScroll.msdPhysics.continuousMotionMaxDeltaMS", 250);
pref("general.smoothScroll.msdPhysics.motionBeginSpringConstant", 400);
pref("general.smoothScroll.msdPhysics.regularSpringConstant", 200);
pref("general.smoothScroll.msdPhysics.slowdownMinDeltaMS", 50);
pref("general.smoothScroll.msdPhysics.slowdownSpringConstant", 100);
pref("general.smoothScroll.currentVelocityWeighting", "0.15");
pref("general.smoothScroll.stopDecelerationWeighting", "0.6");
pref("mousewheel.min_line_scroll_amount", 25);

// ═══════════════════════════════════════════════════════════════════════════════
// UI & UX
// ═══════════════════════════════════════════════════════════════════════════════

// Vertical tabs by default
pref("solace.sidebar.vertical-tabs", true);
pref("solace.sidebar.collapsed", false);
pref("solace.sidebar.width", 250);

// Tab behavior
pref("browser.tabs.loadInBackground", true);
pref("browser.tabs.closeWindowWithLastTab", false);
pref("browser.tabs.warnOnClose", true);

// Paste-and-go
pref("browser.urlbar.decodeURLsOnCopy", true);
pref("browser.urlbar.trimURLs", true);

// Per-site zoom memory
pref("browser.zoom.siteSpecific", true);

// PiP
pref("media.videocontrols.picture-in-picture.enabled", true);
pref("media.videocontrols.picture-in-picture.video-toggle.enabled", true);

// Reader mode
pref("reader.parse-on-load.enabled", true);

// Custom new tab
pref("browser.newtabpage.enabled", true);
pref("browser.startup.homepage", "about:solace-newtab");
pref("browser.newtab.url", "about:solace-newtab");

// Theme
pref("solace.theme.mode", "system");  // "dark", "light", "system"
pref("solace.theme.translucent", true);
pref("solace.theme.blur-intensity", 20);
pref("solace.theme.density", "normal");  // "compact", "normal", "spacious"
pref("solace.theme.adaptive-color", true);

// Workspaces
pref("solace.workspaces.enabled", true);
pref("solace.workspaces.suspend-inactive", true);
pref("solace.workspaces.scheduled", false);

// Profiles
pref("solace.profiles.enabled", true);
pref("solace.profiles.guest-mode", false);

// Command bar
pref("solace.commandbar.enabled", true);
pref("solace.commandbar.shortcut", "CmdOrCtrl+K");

// AI Panel (disabled by default)
pref("solace.ai.enabled", false);
pref("solace.ai.provider", "");
pref("solace.ai.endpoint", "");
pref("solace.ai.api-key", "");
pref("solace.ai.model", "");

// Ghost mode
pref("solace.ghost-mode.enabled", false);

// Focus mode
pref("solace.focus-mode.enabled", false);

// Productivity
pref("solace.notes.enabled", true);
pref("solace.screenshots.enabled", true);
pref("solace.reading-queue.enabled", true);
pref("solace.sessions.enabled", true);
pref("solace.password-manager.enabled", true);
pref("solace.offline-cache.enabled", true);

// Unique features
pref("solace.peek-links.enabled", true);
pref("solace.peek-links.trigger-key", "Alt");
pref("solace.tab-heatmap.enabled", true);
pref("solace.sound-mixer.enabled", true);
pref("solace.css-editor.enabled", true);
pref("solace.pipe.enabled", true);
pref("solace.history-heatmap.enabled", true);
pref("solace.keyboard-mode.enabled", false);
pref("solace.distraction-lock.enabled", false);
pref("solace.per-site-color.enabled", true);
pref("solace.split-view.enabled", true);

// Preloading (privacy-respecting — only on hover, not speculative)
pref("solace.preload-on-hover", true);

// ═══════════════════════════════════════════════════════════════════════════════
// DISABLED FIREFOX FEATURES
// ═══════════════════════════════════════════════════════════════════════════════

// Disable default Firefox UI elements we replace
pref("browser.tabs.tabmanager.enabled", false);
pref("browser.toolbars.bookmarks.visibility", "newtab");

// Disable Firefox accounts / sync (we have our own)
pref("identity.fxaccounts.enabled", false);

// Disable Firefox suggestions
pref("browser.urlbar.suggest.quicksuggest.nonsponsored", false);
pref("browser.urlbar.suggest.quicksuggest.sponsored", false);

// Disable what's new
pref("browser.messaging-system.whatsNewPanel.enabled", false);

// Disable default browser prompt
pref("browser.shell.checkDefaultBrowser", false);
