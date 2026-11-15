#!/usr/bin/env bash
set -euo pipefail

# Build macOS .app Bundle and DMG / ZIP
VERSION="${APP_VERSION:-$(git describe --tags --always 2>/dev/null | sed 's/^v//' || echo "1.3.6")}"
APP_NAME="Addereums Pomodoro"
BUNDLE_NAME="${APP_NAME}.app"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DIST_DIR="${ROOT_DIR}/installers/dist"
BUILD_DIR="$(mktemp -d -t pomodoro-macos-build-XXXXXX)"

mkdir -p "${DIST_DIR}"
trap 'rm -rf "${BUILD_DIR}"' EXIT

echo "==> Erstelle macOS App-Bundle für ${APP_NAME} v${VERSION}..."

APP_BUNDLE="${BUILD_DIR}/${BUNDLE_NAME}"
CONTENTS_DIR="${APP_BUNDLE}/Contents"
MACOS_DIR="${CONTENTS_DIR}/MacOS"
RESOURCES_DIR="${CONTENTS_DIR}/Resources"

mkdir -p "${MACOS_DIR}"
mkdir -p "${RESOURCES_DIR}/app"

# 1. Info.plist kopieren & Version aktualisieren
cp "${SCRIPT_DIR}/Info.plist" "${CONTENTS_DIR}/Info.plist"
sed -i "s/1.1.1/${VERSION}/g" "${CONTENTS_DIR}/Info.plist" 2>/dev/null || sed -i '' "s/1.1.1/${VERSION}/g" "${CONTENTS_DIR}/Info.plist" 2>/dev/null || true

# 2. Launcher-Skript erstellen
cat << 'EOF' > "${MACOS_DIR}/${APP_NAME}"
#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
exec /usr/bin/python3 "${DIR}/macos_launcher.py" "$@"
EOF
chmod +x "${MACOS_DIR}/${APP_NAME}"

# 3. Python Launcher kopieren
cp "${SCRIPT_DIR}/macos_launcher.py" "${MACOS_DIR}/macos_launcher.py"
chmod +x "${MACOS_DIR}/macos_launcher.py"

# 4. Icon & App-Ressourcen kopieren
if [ -f "${ROOT_DIR}/app/AppIcon.icns" ]; then
    cp "${ROOT_DIR}/app/AppIcon.icns" "${RESOURCES_DIR}/AppIcon.icns"
fi
cp -a "${ROOT_DIR}/app/." "${RESOURCES_DIR}/app/"

# 5. Packe ZIP für macOS
echo "==> Erstelle macOS ZIP..."
(
    cd "${BUILD_DIR}"
    zip -r -q "${DIST_DIR}/Addereums-Pomodoro-${VERSION}-macOS.zip" "${BUNDLE_NAME}"
)

# 6. Erstelle DMG (nur auf macOS, wenn hdiutil verfügbar)
if command -v hdiutil >/dev/null 2>&1; then
    echo "==> Erstelle macOS DMG..."
    hdiutil create -volname "${APP_NAME}" -srcfolder "${APP_BUNDLE}" -ov -format UDZO "${DIST_DIR}/Addereums-Pomodoro-${VERSION}-macOS.dmg"
fi

echo "==> Fertig! macOS Bundle erstellt in ${DIST_DIR}"
