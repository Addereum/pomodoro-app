#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ASSETS_DIR="${SCRIPT_DIR}/app/src/main/assets/web"

mkdir -p "${ASSETS_DIR}"
rm -rf "${ASSETS_DIR:?}"/*

echo "==> Kopiere Web-Assets in das Android Projekt..."
cp -r "${ROOT_DIR}/app/web/." "${ASSETS_DIR}/"
cp "${ROOT_DIR}/app/icon.svg" "${ASSETS_DIR}/icon.svg"
cp "${ROOT_DIR}/app/icon.png" "${ASSETS_DIR}/icon.png"

# Kopiere Icons auch eine Ebene höher für relative Pfade (../icon.svg)
cp "${ROOT_DIR}/app/icon.svg" "${SCRIPT_DIR}/app/src/main/assets/icon.svg"
cp "${ROOT_DIR}/app/icon.png" "${SCRIPT_DIR}/app/src/main/assets/icon.png"

echo "✅ Assets erfolgreich vorbereitet in ${ASSETS_DIR}"
