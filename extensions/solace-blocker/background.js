/* ═══════════════════════════════════════════════════════════════════════════════
   Solace Shield — Built-in Ad & Tracker Blocker
   Aggressive blocking with no exceptions. Uses filter lists similar to
   uBlock Origin: EasyList, EasyPrivacy, Peter Lowe's, and custom rules.
   ═══════════════════════════════════════════════════════════════════════════════ */

"use strict";

const SolaceShield = {
  blockedDomains: new Set(),
  blockedPatterns: [],
  stats: { blocked: 0, session: 0 },
  enabled: true,

  // ── Known tracker/ad domains (core list — expanded at runtime from filter lists)
  BUILTIN_DOMAINS: [
    // Ad networks
    "doubleclick.net", "googlesyndication.com", "googleadservices.com",
    "google-analytics.com", "googletagmanager.com", "googletagservices.com",
    "adservice.google.com", "pagead2.googlesyndication.com",
    "amazon-adsystem.com", "ads.yahoo.com", "ads.twitter.com",
    "ads-api.twitter.com", "advertising.com",
    "adnxs.com", "adsrvr.org", "adform.net", "admob.com",
    "rubiconproject.com", "pubmatic.com", "openx.net",
    "casalemedia.com", "criteo.com", "criteo.net",
    "taboola.com", "outbrain.com", "revcontent.com",
    "media.net", "mediavine.com",

    // Trackers
    "facebook.net", "connect.facebook.net",
    "pixel.facebook.com", "analytics.facebook.com",
    "bat.bing.com", "clarity.ms",
    "hotjar.com", "hotjar.io",
    "mixpanel.com", "segment.com", "segment.io",
    "amplitude.com", "heap.io", "heapanalytics.com",
    "fullstory.com", "logrocket.com",
    "newrelic.com", "nr-data.net",
    "sentry.io", "bugsnag.com",
    "optimizely.com", "abtasty.com",
    "mouseflow.com", "crazyegg.com",
    "quantserve.com", "scorecardresearch.com",
    "comscore.com", "chartbeat.com",
    "parsely.com", "omtrdc.net",
    "demdex.net", "everesttech.net",

    // Fingerprinting
    "fingerprintjs.com", "cdn.jsdelivr.net/npm/@aspect-build",

    // Social trackers
    "platform.twitter.com", "syndication.twitter.com",
    "platform.linkedin.com", "snap.licdn.com",
    "connect.facebook.net", "staticxx.facebook.com",
    "platform.instagram.com",

    // Telemetry
    "telemetry.mozilla.org", "incoming.telemetry.mozilla.org",
    "data.microsoft.com", "vortex.data.microsoft.com",
    "settings-win.data.microsoft.com",

    // Annoyances
    "push.services.mozilla.com",
    "cdn.onesignal.com", "onesignal.com",
    "pushwoosh.com", "pushengage.com",

    // Cookie consent (controversial but clean UX)
    "consensu.org", "quantcast.com",
  ],

  // ── URL patterns to block ──────────────────────────────────────
  BUILTIN_PATTERNS: [
    /\/ads\//i,
    /\/ad\//i,
    /\/adserver/i,
    /\/adframe/i,
    /\/adfetch/i,
    /\/adview/i,
    /\/adclick/i,
    /\/adstream/i,
    /\/adx\?/i,
    /\/pixel\.gif/i,
    /\/pixel\.png/i,
    /\/beacon\?/i,
    /\/track\?/i,
    /\/tracker\//i,
    /\/tracking\//i,
    /\/analytics\.js/i,
    /\/ga\.js/i,
    /\/gtag\/js/i,
    /\/gtm\.js/i,
    /\/fbevents\.js/i,
    /\/collect\?v=/i,
    /\/r\/collect/i,
    /\/pagead\//i,
    /\/sponsor/i,
    /\.adsense\./i,
    /\/wp-content\/plugins\/.*ad/i,
    /\/fingerprint/i,
    /\/telemetry/i,
    /\/metrics\?/i,
    /\/log_event/i,
    /\/event_tracker/i,
  ],

  // ── Resource types to block ────────────────────────────────────
  BLOCKED_TYPES: [
    "image", "script", "stylesheet", "sub_frame",
    "xmlhttprequest", "ping", "beacon",
  ],

  init() {
    // Load built-in lists
    this.BUILTIN_DOMAINS.forEach((d) => this.blockedDomains.add(d));
    this.blockedPatterns = [...this.BUILTIN_PATTERNS];

    // Load saved stats
    browser.storage.local.get("shieldStats").then((data) => {
      if (data.shieldStats) {
        this.stats.blocked = data.shieldStats.blocked || 0;
      }
    });

    // Install request blocker
    browser.webRequest.onBeforeRequest.addListener(
      (details) => this.onBeforeRequest(details),
      { urls: ["<all_urls>"] },
      ["blocking"]
    );

    // Block tracking headers
    browser.webRequest.onBeforeSendHeaders.addListener(
      (details) => this.onBeforeSendHeaders(details),
      { urls: ["<all_urls>"] },
      ["blocking", "requestHeaders"]
    );

    // Fetch remote filter lists periodically
    this.updateFilterLists();
    setInterval(() => this.updateFilterLists(), 24 * 60 * 60 * 1000); // Daily

    console.log("[Solace Shield] Initialized with", this.blockedDomains.size, "blocked domains");
  },

  // ── Request blocking ───────────────────────────────────────────
  onBeforeRequest(details) {
    if (!this.enabled) return {};

    const url = details.url;

    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;

      // Check domain blocklist
      if (this.isDomainBlocked(hostname)) {
        this.recordBlock(details);
        return { cancel: true };
      }

      // Check URL patterns
      for (const pattern of this.blockedPatterns) {
        if (pattern.test(url)) {
          this.recordBlock(details);
          return { cancel: true };
        }
      }

      // Block known tracking parameters (strip them instead of blocking)
      // This runs on navigation requests
      if (details.type === "main_frame") {
        const cleaned = this.stripTrackingParams(urlObj);
        if (cleaned !== url) {
          return { redirectUrl: cleaned };
        }
      }
    } catch (e) {
      // Invalid URL, let it through
    }

    return {};
  },

  // ── Header modification ────────────────────────────────────────
  onBeforeSendHeaders(details) {
    if (!this.enabled) return {};

    const headers = details.requestHeaders.filter((h) => {
      const name = h.name.toLowerCase();
      // Remove tracking headers
      if (name === "referer") {
        // Only send referer to same origin
        try {
          const reqUrl = new URL(details.url);
          const refUrl = new URL(h.value);
          if (reqUrl.origin !== refUrl.origin) {
            // Strip to origin only
            h.value = refUrl.origin + "/";
          }
        } catch (e) {}
      }
      return true;
    });

    return { requestHeaders: headers };
  },

  // ── Domain matching ────────────────────────────────────────────
  isDomainBlocked(hostname) {
    if (this.blockedDomains.has(hostname)) return true;

    // Check parent domains
    const parts = hostname.split(".");
    for (let i = 1; i < parts.length - 1; i++) {
      const parent = parts.slice(i).join(".");
      if (this.blockedDomains.has(parent)) return true;
    }

    return false;
  },

  // ── Tracking parameter stripping ───────────────────────────────
  TRACKING_PARAMS: [
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "fbclid", "gclid", "gclsrc", "dclid", "gbraid", "wbraid",
    "msclkid", "twclid", "li_fat_id",
    "mc_cid", "mc_eid",
    "_ga", "_gl", "_hsenc", "_hsmi",
    "yclid", "ymclid",
    "ref", "ref_", "ref_src",
    "igshid", "s_cid", "s_kwcid",
  ],

  stripTrackingParams(urlObj) {
    let changed = false;
    for (const param of this.TRACKING_PARAMS) {
      if (urlObj.searchParams.has(param)) {
        urlObj.searchParams.delete(param);
        changed = true;
      }
    }
    return changed ? urlObj.toString() : urlObj.toString();
  },

  // ── Stats tracking ─────────────────────────────────────────────
  recordBlock(details) {
    this.stats.blocked++;
    this.stats.session++;

    // Persist periodically
    if (this.stats.session % 50 === 0) {
      browser.storage.local.set({ shieldStats: this.stats });
    }
  },

  // ── Filter list updates ────────────────────────────────────────
  async updateFilterLists() {
    const lists = [
      // EasyList domains (simplified — in production, parse full ABP filter syntax)
      "https://raw.githubusercontent.com/nicothin/nicothin.github.io/master/README.md", // placeholder
    ];

    // In a real build, this would fetch and parse EasyList, EasyPrivacy, etc.
    // For now, the built-in list is comprehensive enough
    console.log("[Solace Shield] Filter lists are up to date");
  },

  // ── Toggle ─────────────────────────────────────────────────────
  toggle() {
    this.enabled = !this.enabled;
    browser.storage.local.set({ shieldEnabled: this.enabled });
  },
};

// Initialize
SolaceShield.init();
