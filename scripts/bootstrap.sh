#!/usr/bin/env bash
# Solace Browser — Bootstrap Script
# Downloads Firefox source and prepares the build environment

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
FIREFOX_DIR="$PROJECT_ROOT/mozilla-unified"
FIREFOX_VERSION="128.0"  # ESR base — stable Gecko

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${CYAN}[solace]${NC} $1"; }
ok()  { echo -e "${GREEN}[solace]${NC} $1"; }
err() { echo -e "${RED}[solace]${NC} $1" >&2; }

# ── Step 1: Check prerequisites ──────────────────────────────────────────────
check_prereqs() {
    log "Checking prerequisites..."
    local missing=()

    command -v python3 >/dev/null 2>&1 || missing+=("python3")
    command -v git     >/dev/null 2>&1 || missing+=("git")
    command -v rustc   >/dev/null 2>&1 || missing+=("rust (install via rustup)")
    command -v cargo   >/dev/null 2>&1 || missing+=("cargo")

    if [[ "$(uname)" == "Darwin" ]]; then
        command -v xcrun >/dev/null 2>&1 || missing+=("Xcode Command Line Tools")
    fi

    if [[ ${#missing[@]} -gt 0 ]]; then
        err "Missing prerequisites: ${missing[*]}"
        err "Install them and re-run this script."
        exit 1
    fi
    ok "All prerequisites found."
}

# ── Step 2: Clone Firefox source ─────────────────────────────────────────────
clone_firefox() {
    if [[ -d "$FIREFOX_DIR" ]]; then
        log "Firefox source already exists at $FIREFOX_DIR"
        return 0
    fi

    log "Cloning Mozilla Firefox source (this will take a while)..."
    log "Using mozilla-unified Mercurial → Git mirror..."

    # Try the official Mozilla git mirror first
    if command -v hg >/dev/null 2>&1; then
        log "Using Mercurial (hg) to clone mozilla-unified..."
        hg clone https://hg.mozilla.org/mozilla-unified "$FIREFOX_DIR"
    else
        log "Mercurial not found. Installing via pip..."
        python3 -m pip install --user mercurial
        if command -v hg >/dev/null 2>&1; then
            hg clone https://hg.mozilla.org/mozilla-unified "$FIREFOX_DIR"
        else
            err "Could not install Mercurial. Please install it manually:"
            err "  brew install mercurial   (macOS)"
            err "  apt install mercurial    (Debian/Ubuntu)"
            exit 1
        fi
    fi

    ok "Firefox source cloned successfully."
}

# ── Step 3: Run Mozilla bootstrap ─────────────────────────────────────────────
run_moz_bootstrap() {
    log "Running Mozilla bootstrap to install build dependencies..."
    cd "$FIREFOX_DIR"
    ./mach bootstrap --application-choice=browser --no-interactive
    ok "Mozilla bootstrap complete."
}

# ── Step 4: Apply Solace overlay ──────────────────────────────────────────────
apply_overlay() {
    log "Applying Solace overlay..."
    "$SCRIPT_DIR/apply-overlay.sh"
    ok "Solace overlay applied."
}

# ── Step 5: Configure build ───────────────────────────────────────────────────
configure_build() {
    log "Copying Solace mozconfig..."
    cp "$PROJECT_ROOT/config/mozconfig" "$FIREFOX_DIR/.mozconfig"
    ok "Build configured."
}

# ── Main ──────────────────────────────────────────────────────────────────────
main() {
    echo ""
    echo "  ╔═══════════════════════════════════════╗"
    echo "  ║        Solace Browser Bootstrap        ║"
    echo "  ╚═══════════════════════════════════════╝"
    echo ""

    check_prereqs
    clone_firefox
    run_moz_bootstrap
    apply_overlay
    configure_build

    echo ""
    ok "Bootstrap complete! To build Solace:"
    ok "  cd $FIREFOX_DIR"
    ok "  ./mach build"
    ok "  ./mach run"
    echo ""
}

main "$@"
