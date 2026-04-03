#!/usr/bin/env bash
# Solace Browser — Build Script
# Applies overlay and builds Firefox with Solace customizations

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
FIREFOX_DIR="$PROJECT_ROOT/mozilla-unified"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${CYAN}[solace]${NC} $1"; }
ok()  { echo -e "${GREEN}[solace]${NC} $1"; }
warn() { echo -e "${YELLOW}[solace]${NC} $1"; }
err() { echo -e "${RED}[solace]${NC} $1" >&2; }

usage() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  build       Full build (apply overlay + compile)"
    echo "  rebuild     Incremental rebuild"
    echo "  overlay     Apply overlay only (no compile)"
    echo "  run         Run the built browser"
    echo "  package     Create distributable package"
    echo "  clean       Clean build artifacts"
    echo "  pgo         Full PGO+LTO optimized build"
    echo ""
}

check_firefox() {
    if [[ ! -d "$FIREFOX_DIR" ]]; then
        err "Firefox source not found at $FIREFOX_DIR"
        err "Run: ./scripts/bootstrap.sh"
        exit 1
    fi
}

cmd_overlay() {
    log "Applying Solace overlay..."
    "$SCRIPT_DIR/apply-overlay.sh"
    ok "Overlay applied."
}

cmd_build() {
    check_firefox
    cmd_overlay

    log "Building Solace Browser..."
    cd "$FIREFOX_DIR"
    ./mach build

    ok "Build complete!"
    echo ""
    ok "Run with: ./scripts/build.sh run"
}

cmd_rebuild() {
    check_firefox
    cmd_overlay

    log "Incremental rebuild..."
    cd "$FIREFOX_DIR"
    ./mach build faster

    ok "Rebuild complete!"
}

cmd_run() {
    check_firefox

    log "Launching Solace Browser..."
    cd "$FIREFOX_DIR"
    ./mach run -- --no-remote -P solace
}

cmd_package() {
    check_firefox

    log "Packaging Solace Browser..."
    cd "$FIREFOX_DIR"
    ./mach package

    ok "Package created!"

    # Find the output
    local obj_dir
    obj_dir=$(cat "$FIREFOX_DIR/.mozconfig" 2>/dev/null | grep "mk_add_options MOZ_OBJDIR" | cut -d= -f2 || echo "")
    if [[ -z "$obj_dir" ]]; then
        obj_dir="$FIREFOX_DIR/obj-*"
    fi

    echo ""
    log "Look for the package in:"
    ls -la $obj_dir/dist/*.dmg $obj_dir/dist/*.tar.* $obj_dir/dist/*.zip 2>/dev/null || echo "  (check obj-*/dist/)"
}

cmd_clean() {
    check_firefox

    log "Cleaning build artifacts..."
    cd "$FIREFOX_DIR"
    ./mach clobber

    ok "Clean complete."
}

cmd_pgo() {
    check_firefox
    cmd_overlay

    log "Starting PGO+LTO optimized build (this will take a long time)..."

    # Phase 1: Instrumented build
    log "Phase 1: Building instrumented binary..."
    cd "$FIREFOX_DIR"
    cp "$PROJECT_ROOT/config/mozconfig" .mozconfig

    # Ensure PGO generate is enabled
    if ! grep -q "enable-profile-generate" .mozconfig; then
        echo 'ac_add_options --enable-profile-generate' >> .mozconfig
    fi
    # Remove profile-use if present
    sed -i '' '/enable-profile-use/d' .mozconfig 2>/dev/null || true

    ./mach build
    ./mach package

    # Phase 2: Profile generation
    log "Phase 2: Generating profile data..."
    ./mach python build/pgo/profileserver.py

    # Phase 3: Optimized build using profile
    log "Phase 3: Building optimized binary with PGO..."
    sed -i '' '/enable-profile-generate/d' .mozconfig 2>/dev/null || true
    echo 'ac_add_options --enable-profile-use' >> .mozconfig

    ./mach clobber
    ./mach build
    ./mach package

    ok "PGO+LTO build complete!"
}

# ── Main ──────────────────────────────────────────────────────────
case "${1:-build}" in
    build)   cmd_build ;;
    rebuild) cmd_rebuild ;;
    overlay) cmd_overlay ;;
    run)     cmd_run ;;
    package) cmd_package ;;
    clean)   cmd_clean ;;
    pgo)     cmd_pgo ;;
    help|-h|--help) usage ;;
    *)
        err "Unknown command: $1"
        usage
        exit 1
        ;;
esac
