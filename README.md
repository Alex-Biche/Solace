# Solace Browser

A Gecko-based web browser built for focus, privacy, and flow. Zero telemetry. Translucent UI. Vertical tabs. Workspaces. Full Firefox extension support.

Built as a Firefox fork — same approach as Zen Browser, LibreWolf, and Waterfox.

---

## Architecture

Solace is structured as an **overlay project** that applies customizations on top of the Firefox (mozilla-unified) source tree:

```
Solace/
├── scripts/              # Build and bootstrap scripts
│   ├── bootstrap.sh      # Downloads Firefox source + sets up build env
│   ├── apply-overlay.sh  # Applies Solace customizations to Firefox tree
│   └── build.sh          # Build, run, package commands
├── config/
│   ├── mozconfig          # Firefox build configuration
│   ├── solace.js          # Default browser preferences (~200 prefs)
│   └── policies.json      # Enterprise policies (telemetry, tracking)
├── branding/              # App name, icons, about pages, localization
├── browser/
│   ├── base/              # Main init script, XUL overlay, moz.build
│   ├── themes/            # Translucent frosted-glass CSS, adaptive color
│   └── components/        # All Solace features
│       ├── sidebar/       # Vertical tabs sidebar
│       ├── workspaces/    # Workspace engine
│       ├── commandbar/    # ⌘K quick launcher
│       ├── profiles/      # Isolated profile management
│       ├── ai-panel/      # Opt-in AI integration
│       ├── tabs/          # Tab groups
│       ├── split-view/    # Side-by-side browsing
│       ├── notes/         # Built-in scratch pad
│       ├── screenshots/   # Capture + annotate
│       ├── sessions/      # Save/restore tab sessions
│       ├── reading-queue/ # Read-later list
│       ├── peek/          # Link preview on hover
│       ├── sound-mixer/   # Per-tab volume control
│       ├── css-editor/    # Live CSS injection per site
│       ├── pipe/          # LAN device sharing
│       ├── distraction-lock/ # Domain blocker with no override
│       ├── focus-mode/    # Hide all chrome
│       ├── ghost-mode/    # Ultra-lightweight browsing
│       ├── newtab/        # Custom new tab page
│       └── onboarding/    # First-run setup wizard
├── extensions/
│   └── solace-blocker/    # Built-in ad/tracker blocker
└── patches/               # Source-level patches to Firefox
```

---

## Prerequisites

### macOS
```bash
xcode-select --install
brew install mercurial python3 rust
```

### Linux (Debian/Ubuntu)
```bash
sudo apt install mercurial python3 python3-pip build-essential \
  libgtk-3-dev libdbus-glib-1-dev libpulse-dev libasound2-dev \
  nasm yasm rustc cargo clang llvm
```

### Windows
Install [MozillaBuild](https://ftp.mozilla.org/pub/mozilla/libraries/win32/MozillaBuildSetup-Latest.exe) and use the Mozilla Build shell.

---

## How to Build

### Step 1: Bootstrap (first time only)

This downloads the Firefox source tree (~4GB) and installs build dependencies:

```bash
cd Solace
./scripts/bootstrap.sh
```

The bootstrap script will:
1. Check prerequisites (python3, git, rust, cargo)
2. Clone `mozilla-unified` via Mercurial
3. Run Mozilla's `./mach bootstrap` to install build dependencies
4. Apply the Solace overlay
5. Copy the mozconfig

### Step 2: Build

```bash
# Standard build
./scripts/build.sh build

# Or step by step:
./scripts/build.sh overlay   # Apply Solace files to Firefox tree
cd mozilla-unified
./mach build                  # Compile (~30-60 min first time)
```

### Step 3: Run

```bash
./scripts/build.sh run

# Or directly:
cd mozilla-unified
./mach run
```

---

## Build Commands

| Command | Description |
|---------|-------------|
| `./scripts/build.sh build` | Full build (overlay + compile) |
| `./scripts/build.sh rebuild` | Incremental rebuild (fast) |
| `./scripts/build.sh overlay` | Apply overlay only, no compile |
| `./scripts/build.sh run` | Launch the built browser |
| `./scripts/build.sh package` | Create distributable .dmg / .tar / .zip |
| `./scripts/build.sh pgo` | Full PGO+LTO optimized release build |
| `./scripts/build.sh clean` | Clean build artifacts |

---

## Optimized Release Build

For maximum performance (PGO + LTO):

```bash
./scripts/build.sh pgo
```

This runs three passes:
1. **Instrumented build** — compiles with profiling hooks
2. **Profile generation** — runs the browser through benchmarks
3. **Optimized build** — recompiles using profile data for optimal code layout

This takes significantly longer but produces a measurably faster binary.

---

## Feature Overview

### Core Browsing
- **Vertical tabs** with collapsible sidebar (⌘B to toggle)
- **Tab groups** with color labels and custom names
- **Pinned tabs** that persist across sessions
- **Tab sleep** — inactive tabs are suspended to save RAM
- **Split-screen** — two tabs side by side (⌘⇧S)
- **Picture-in-picture** video (detachable, resizable)
- **Command bar** — ⌘K to search tabs, history, bookmarks, commands
- **Smooth scrolling** with physics-based animation
- **Per-site zoom** levels remembered automatically
- **Reader mode** with custom fonts and spacing
- Full Firefox extension support

### Profiles
- Completely isolated (cookies, storage, history, passwords, extensions)
- Per-profile color and icon
- PIN/password lock for sensitive profiles
- Guest mode — wiped on close
- Export/import profiles between devices

### Workspaces
- Named groups of tabs inside each profile
- Instant switching — inactive workspaces are suspended (near-zero CPU/RAM)
- Save as templates, re-open later
- Scheduled workspaces (auto-switch at set times)
- Workspace focus mode — hide all other workspaces

### Privacy & Security
- **Zero telemetry** — nothing sent anywhere, ever
- **Built-in ad/tracker blocker** (Solace Shield)
- **Fingerprint randomization**
- **First-party isolation** by default
- **HTTPS-only mode** on by default
- **Container tabs** for per-site identity isolation
- **DNS-over-HTTPS** with configurable provider
- **DNS leak protection**
- No Pocket, no sponsored content, no experiments

### AI (Opt-in Only)
- **Completely disabled by default** — no UI, no code, nothing
- Enable in settings → connects to your own provider
- Supports OpenAI, Anthropic, Mistral, Ollama, or any OpenAI-compatible endpoint
- Your API key, direct connection — browser is just a client
- Page summarization, selection explanation, Q&A
- One toggle to disable and remove all AI UI

### Productivity
- **Notes panel** — always one click away (⌘⇧N)
- **Screenshot tool** with annotation (⌘⇧X)
- **Session save/restore** — name and recall any tab set
- **Reading queue** — read-later with clean text view
- **Sound mixer** — per-tab volume control
- **Live CSS editor** — modify any site's styles in real time
- **Distraction lock** — block domains with no override

### Unique Features
- **Peek links** — hover + Alt for floating preview
- **Tab heatmap** — visual indicator of most visited tabs
- **Per-site color tagging** — color-coded tab indicators
- **Pipe** — share tabs/clipboard across LAN devices instantly
- **Ghost mode** — disable JS, images, trackers for ultra-light browsing
- **Focus mode** — hide all chrome, just the page (F11)

### Design
- **Translucent frosted glass UI** with blur and vibrancy
- **Adaptive color** — chrome tints based on page content
- **Compact, normal, and spacious** density modes
- **Dark, light, and system-auto** themes
- Full theme engine — override any color token
- Custom CSS injection per site

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| ⌘K | Command bar (search everything) |
| ⌘B | Toggle sidebar |
| ⌘⇧S | Split view |
| ⌘⇧X | Screenshot |
| ⌘⇧N | Notes panel |
| ⌘⇧F | Focus mode |
| ⌘⇧A | AI panel |
| F11 | Focus mode |
| ⌥+hover | Peek link preview |
| ⌘⌥1-9 | Switch workspace |

---

## Development

### Iterating on UI changes

Most Solace changes are in JavaScript and CSS, which means you can iterate quickly:

```bash
# Apply overlay changes
./scripts/build.sh overlay

# Incremental rebuild (much faster than full build)
./scripts/build.sh rebuild

# Or for CSS/JS only changes, just restart the browser
./scripts/build.sh run
```

### Project structure for contributors

- **Config changes** → `config/solace.js` (preferences) or `config/policies.json`
- **Theme/CSS** → `browser/themes/`
- **New features** → `browser/components/<feature-name>/`
- **Built-in extensions** → `extensions/<extension-name>/`
- **Build system** → `browser/base/moz.build`, `browser/base/jar.mn`

---

## How It Works

Solace uses the same architecture as other Firefox forks:

1. **Firefox source** (mozilla-unified) provides the Gecko engine, networking, security, and extension system
2. **Solace overlay** replaces/extends the browser chrome (UI), which in Firefox is built with HTML, CSS, and JavaScript
3. **mozconfig** configures the build — disables telemetry at compile time, enables optimizations, sets branding
4. **solace.js** sets ~200 default preferences for privacy, performance, and UX
5. **XUL overlay** injects Solace scripts and styles into `browser.xhtml`
6. **JAR manifest** maps `chrome://solace/` URLs to our component files
7. **Built-in extensions** ship pre-installed (ad blocker)

This means Solace is a **real Gecko browser** — not Electron, not a skin, not a wrapper. It compiles the full Firefox source with our modifications baked in.

---

## License

Mozilla Public License 2.0 — same as Firefox.
