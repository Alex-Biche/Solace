#!/usr/bin/env bash
# Solace Browser — Overlay Application Script
# Copies Solace customizations into the Firefox source tree

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
FIREFOX_DIR="$PROJECT_ROOT/mozilla-unified"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${CYAN}[solace]${NC} $1"; }
ok()  { echo -e "${GREEN}[solace]${NC} $1"; }

if [[ ! -d "$FIREFOX_DIR" ]]; then
    echo -e "${RED}[solace]${NC} Firefox source not found at $FIREFOX_DIR"
    echo "Run bootstrap.sh first."
    exit 1
fi

# ── Branding ──────────────────────────────────────────────────────────────────
log "Applying branding..."
BRAND_DIR="$FIREFOX_DIR/browser/branding/solace"
mkdir -p "$BRAND_DIR"
cp -r "$PROJECT_ROOT/branding/"* "$BRAND_DIR/"

# ── mozconfig ─────────────────────────────────────────────────────────────────
log "Applying mozconfig..."
cp "$PROJECT_ROOT/config/mozconfig" "$FIREFOX_DIR/.mozconfig"

# ── User preferences ─────────────────────────────────────────────────────────
log "Applying default preferences..."
mkdir -p "$FIREFOX_DIR/browser/app/profile"
cp "$PROJECT_ROOT/config/solace.js" "$FIREFOX_DIR/browser/app/profile/solace.js"

# Append include to existing prefs if not already there
PREFS_FILE="$FIREFOX_DIR/browser/app/profile/firefox.js"
if [[ -f "$PREFS_FILE" ]] && ! grep -q "solace.js" "$PREFS_FILE"; then
    echo '// Solace Browser custom preferences' >> "$PREFS_FILE"
    echo '#include solace.js' >> "$PREFS_FILE"
fi

# ── Policies ──────────────────────────────────────────────────────────────────
log "Applying enterprise policies..."
DIST_DIR="$FIREFOX_DIR/distribution"
mkdir -p "$DIST_DIR"
cp "$PROJECT_ROOT/config/policies.json" "$DIST_DIR/policies.json"

# ── Browser chrome (UI) ──────────────────────────────────────────────────────
log "Applying Solace browser chrome..."
SOLACE_CHROME="$FIREFOX_DIR/browser/components/solace"
mkdir -p "$SOLACE_CHROME"
cp -r "$PROJECT_ROOT/browser/"* "$SOLACE_CHROME/"

# ── Theme CSS ─────────────────────────────────────────────────────────────────
log "Injecting Solace theme into browser CSS..."
THEME_DIR="$FIREFOX_DIR/browser/themes/shared/solace"
mkdir -p "$THEME_DIR"
cp -r "$PROJECT_ROOT/browser/themes/"* "$THEME_DIR/"

# ── Custom new tab ────────────────────────────────────────────────────────────
log "Applying custom new tab page..."
NEWTAB_DIR="$FIREFOX_DIR/browser/components/solace/newtab"
mkdir -p "$NEWTAB_DIR"
cp -r "$PROJECT_ROOT/browser/components/newtab/"* "$NEWTAB_DIR/"

# ── Extensions ────────────────────────────────────────────────────────────────
log "Copying built-in extensions..."
EXT_DIR="$FIREFOX_DIR/browser/extensions"
mkdir -p "$EXT_DIR"
for ext in "$PROJECT_ROOT/extensions/"*/; do
    if [[ -d "$ext" ]]; then
        ext_name=$(basename "$ext")
        cp -r "$ext" "$EXT_DIR/$ext_name"
        log "  → $ext_name"
    fi
done

# ── Apply source patches ─────────────────────────────────────────────────────
log "Applying source patches..."
cd "$FIREFOX_DIR"
for patch in "$PROJECT_ROOT/patches/"*.patch; do
    if [[ -f "$patch" ]]; then
        patch_name=$(basename "$patch")
        log "  → $patch_name"
        patch -p1 < "$patch" || {
            echo -e "${RED}[solace]${NC} Failed to apply $patch_name"
            echo "You may need to resolve conflicts manually."
        }
    fi
done

# ── Register Solace components in Firefox build system ────────────────────────
log "Registering Solace components in build system..."
BROWSER_MOZ_BUILD="$FIREFOX_DIR/browser/components/moz.build"
if [[ -f "$BROWSER_MOZ_BUILD" ]] && ! grep -q "solace" "$BROWSER_MOZ_BUILD"; then
    echo "" >> "$BROWSER_MOZ_BUILD"
    echo "# Solace Browser components" >> "$BROWSER_MOZ_BUILD"
    echo "DIRS += ['solace']" >> "$BROWSER_MOZ_BUILD"
fi

ok "Overlay applied successfully!"
echo ""
echo "Next steps:"
echo "  cd $FIREFOX_DIR"
echo "  ./mach build"
echo "  ./mach run"
