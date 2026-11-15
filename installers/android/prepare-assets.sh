#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ASSETS_DIR="${SCRIPT_DIR}/app/src/main/assets/web"

# Echte Build-Metadaten aus Git ermitteln
BUILD_COUNT=$(git -C "${ROOT_DIR}" rev-list --count HEAD 2>/dev/null || echo "18")
COMMIT_HASH=$(git -C "${ROOT_DIR}" rev-parse --short HEAD 2>/dev/null || echo "dev")
APP_VER="${APP_VERSION:-$(git -C "${ROOT_DIR}" describe --tags --always 2>/dev/null | sed 's/^v//' || echo "1.3.6")}"

# version.js generieren
cat << EOF > "${ROOT_DIR}/app/web/js/version.js"
export const APP_VERSION = '${APP_VER}';
export const APP_BUILD = '${BUILD_COUNT}';
export const APP_COMMIT = '${COMMIT_HASH}';
EOF

mkdir -p "${ASSETS_DIR}"
rm -rf "${ASSETS_DIR:?}"/*

echo "==> Kopiere Web-Assets in das Android Projekt..."
cp -r "${ROOT_DIR}/app/web/." "${ASSETS_DIR}/"
cp "${ROOT_DIR}/app/icon.svg" "${ASSETS_DIR}/icon.svg"
cp "${ROOT_DIR}/app/icon.png" "${ASSETS_DIR}/icon.png"

# Kopiere Icons auch eine Ebene höher für relative Pfade (../icon.svg)
cp "${ROOT_DIR}/app/icon.svg" "${SCRIPT_DIR}/app/src/main/assets/icon.svg"
cp "${ROOT_DIR}/app/icon.png" "${SCRIPT_DIR}/app/src/main/assets/icon.png"

echo "✅ Assets (v${APP_VER} Build #${BUILD_COUNT} • ${COMMIT_HASH}) erfolgreich vorbereitet in ${ASSETS_DIR}"
