#!/usr/bin/env bash
# Tulip Track · local cross-platform build
#
#   ./scripts/build-all.sh
#
# Builds, from this machine:
#   - frontend (npm run build)
#   - Linux bundles (deb + AppImage) via `tauri build`
#   - Android aarch64 APK via `tauri android build` (signed if a keystore exists)
#
# Outputs land in ./dist/. Windows is NOT built here — use the GitHub Actions
# workflow (.github/workflows/build.yml) for that.
#
# Prereqs:
#   - Android SDK/NDK + JDK 17 (see env.sh; sourced automatically if present)
#   - A keystore at src-tauri/gen/android/keystore/ (generated once via:
#     keytool -genkeypair -v -keystore .../tulip-track-release.jks -alias tulip-track \
#       -keyalg RSA -keysize 2048 -validity 10000)
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"

# --- environment -------------------------------------------------------------
[ -f env.sh ] && source env.sh
[ -f .env ] && set -a && source .env && set +a
export PATH="${HOME}/.cargo/bin:${PATH}"

if [ -z "${VITE_SUPABASE_URL:-}" ] || [ -z "${VITE_SUPABASE_ANON_KEY:-}" ]; then
  echo "!! VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set in .env — binaries will run in DEMO mode." >&2
fi

# --- release signing (Android) -----------------------------------------------
KS_DIR="$ROOT/src-tauri/gen/android/keystore"
KS_FILE="$KS_DIR/tulip-track-release.jks"
if [ -f "$KS_FILE" ] && [ -f "$KS_DIR/passwords.env" ]; then
  # shellcheck disable=SC1091
  source "$KS_DIR/passwords.env"
  export TULIP_KEYSTORE_BASE64="$(base64 -w0 "$KS_FILE")"
  export TULIP_KEYSTORE_PASSWORD="$STORE_PASS"
  export TULIP_KEY_ALIAS="$KEY_ALIAS"
  export TULIP_KEY_PASSWORD="$KEY_PASS"
  echo "Android release signing: ENABLED (keystore found)"
else
  echo "!! No keystore found at $KS_FILE — Android APK will be UNSIGNED." >&2
fi

STAMP="$(date +%Y%m%d-%H%M)"
mkdir -p "$ROOT/dist"

# --- frontend ----------------------------------------------------------------
echo "==> npm install + check + build"
npm ci
npm run check
npm run build

# --- Linux -------------------------------------------------------------------
echo "==> tauri build (Linux: deb + AppImage)"
npm run tauri build -- --bundles deb,appimage

LINUX_DIR="$ROOT/src-tauri/target/release/bundle"
cp "$LINUX_DIR"/deb/*.deb        "$ROOT/dist/" 2>/dev/null || true
cp "$LINUX_DIR"/appimage/*.AppImage "$ROOT/dist/" 2>/dev/null || true

# --- Android -----------------------------------------------------------------
echo "==> tauri android build (aarch64 APK)"
npm run tauri android build -- --apk --target aarch64

APK_DIR="$ROOT/src-tauri/gen/android/app/build/outputs/apk/universal/release"
find "$APK_DIR" -name '*.apk' -exec cp {} "$ROOT/dist/" \;

echo
echo "==> done. Artifacts in $ROOT/dist:"
ls -la "$ROOT/dist"