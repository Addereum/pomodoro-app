#!/usr/bin/env bash
set -euo pipefail

# Build Portable Linux Tarball (.tar.gz)
VERSION="${APP_VERSION:-$(git describe --tags --always 2>/dev/null | sed 's/^v//' || echo "1.3.6")}"
PKG_NAME="pomodoro-app"
ARCH="linux-x86_64"
TAR_NAME="${PKG_NAME}-${VERSION}-${ARCH}-portable.tar.gz"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BUILD_DIR="${SCRIPT_DIR}/.build-tarball-tmp"
DIST_DIR="${SCRIPT_DIR}/dist"

rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}/${PKG_NAME}-${VERSION}"
mkdir -p "${DIST_DIR}"

trap 'rm -rf "${BUILD_DIR}"' EXIT

echo "==> Erstelle portables Linux Tarball-Paket (${TAR_NAME})..."

TARGET_DIR="${BUILD_DIR}/${PKG_NAME}-${VERSION}"

# App-Dateien kopieren
cp -a "${ROOT_DIR}/app" "${TARGET_DIR}/"
find "${TARGET_DIR}" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find "${TARGET_DIR}" -type f -name "*.pyc" -delete 2>/dev/null || true

# Launcher Script
cp -a "${ROOT_DIR}/run.sh" "${TARGET_DIR}/pomodoro"
chmod +x "${TARGET_DIR}/pomodoro"

# Desktop & README
cp -a "${ROOT_DIR}/pomodoro.desktop" "${TARGET_DIR}/"
cp -a "${ROOT_DIR}/README.md" "${TARGET_DIR}/"

# Universal Installer
cp -a "${SCRIPT_DIR}/install-linux.sh" "${TARGET_DIR}/install.sh"
cp -a "${SCRIPT_DIR}/uninstall-linux.sh" "${TARGET_DIR}/uninstall.sh"
chmod +x "${TARGET_DIR}/install.sh" "${TARGET_DIR}/uninstall.sh"

# Tarball packen
tar -czf "${DIST_DIR}/${TAR_NAME}" -C "${BUILD_DIR}" "${PKG_NAME}-${VERSION}"

echo "==> Fertig! Portables Tarball erstellt:"
echo "    ${DIST_DIR}/${TAR_NAME}"
