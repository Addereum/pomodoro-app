#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Build Script: Windows App & Modern Graphical Installer (.exe & .zip)
# ==============================================================================

VERSION="${APP_VERSION:-$(git describe --tags --always 2>/dev/null | sed 's/^v//' || echo "1.3.6")}"
PKG_NAME="pomodoro-app"
ARCH="windows-x64"
ZIP_NAME="${PKG_NAME}-${VERSION}-${ARCH}.zip"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DIST_DIR="${SCRIPT_DIR}/dist"
WIN_BUILD_DIR="${SCRIPT_DIR}/.build-win-tmp"
PACKAGE_DIR="${WIN_BUILD_DIR}/PomodoroApp"

rm -rf "${WIN_BUILD_DIR}"
mkdir -p "${PACKAGE_DIR}"
mkdir -p "${DIST_DIR}"

trap 'rm -rf "${WIN_BUILD_DIR}"' EXIT

echo "=========================================================="
echo "==> Erstelle Windows Executables (.exe) & Installer..."
echo "=========================================================="

# 1. Stelle sicher, dass icon.ico vorhanden ist
if [ ! -f "${ROOT_DIR}/app/icon.ico" ]; then
    echo "==> Generiere Windows icon.ico..."
    magick "${ROOT_DIR}/app/icon.svg" -define icon:auto-resize=256,128,64,48,32,16 "${ROOT_DIR}/app/icon.ico"
fi

# 2. Verzeichnisse im Bundle anlegen
mkdir -p "${PACKAGE_DIR}/app"
mkdir -p "${PACKAGE_DIR}/bin"

# 3. Web-App-Dateien kopieren
cp -a "${ROOT_DIR}/app/." "${PACKAGE_DIR}/app/"
find "${PACKAGE_DIR}/app" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find "${PACKAGE_DIR}/app" -type f -name "*.pyc" -delete 2>/dev/null || true

# 4. Windows PowerShell Helper kopieren
cp -a "${SCRIPT_DIR}/windows/launcher.ps1" "${PACKAGE_DIR}/bin/launcher.ps1"
cp -a "${SCRIPT_DIR}/windows/setup.ps1" "${PACKAGE_DIR}/bin/setup.ps1"
cp -a "${SCRIPT_DIR}/windows/uninstall.ps1" "${PACKAGE_DIR}/bin/uninstall.ps1"

# 5. Generiere native 64-Bit Windows GUI Executables (.exe)
PE_BUILDER="${SCRIPT_DIR}/windows/pomodoro-pe-builder.py"
chmod +x "${PE_BUILDER}"

echo "==> Baue Pomodoro.exe (App Launcher)..."
python3 "${PE_BUILDER}" "${PACKAGE_DIR}/Pomodoro.exe" \
    'powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "bin\launcher.ps1"'

echo "==> Baue Setup.exe (Grafischer Installer)..."
python3 "${PE_BUILDER}" "${PACKAGE_DIR}/Setup.exe" \
    'powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "bin\setup.ps1"'

echo "==> Baue Uninstall.exe (Uninstaller)..."
python3 "${PE_BUILDER}" "${PACKAGE_DIR}/Uninstall.exe" \
    'powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "bin\uninstall.ps1"'

# 6. Windows Quickstart README
cat << 'README' > "${PACKAGE_DIR}/README-Windows.txt"
==========================================================
    🍅 Pomodoro App - Fokus- & Produktivitäts-Timer
==========================================================

SCHNELLSTART:
-------------
Option A: Schnelle Installation (Empfohlen)
  1. Doppelklicke auf "Setup.exe".
  2. Wähle deine Optionen (Desktop-Icon, Startmenü).
  3. Klicke auf "Jetzt Installieren".
  -> Die App wird sauber installiert und kann danach direkt
     über das Startmenü oder den Desktop gestartet werden!

Option B: Portabel (ohne Installation)
  - Doppelklicke einfach direkt auf "Pomodoro.exe".
  - Die App startet sofort im eigenständigen, randlosen Fenster.

VORAUSSETZUNGEN:
----------------
- Windows 10 oder Windows 11 (64-Bit)
- Keine zusätzlichen Downloads oder Runtimes nötig!
README

# 7. Kopiere entpacktes Windows-Verzeichnis nach dist/windows
mkdir -p "${DIST_DIR}/windows"
cp -a "${PACKAGE_DIR}/." "${DIST_DIR}/windows/"

# 8. Erstelle distribution ZIP
cd "${WIN_BUILD_DIR}"
zip -q -r "${DIST_DIR}/${ZIP_NAME}" "PomodoroApp"

echo ""
echo "=========================================================="
echo "✅ Fertig! Windows Executables & Installer erstellt:"
echo "   - Installer:       ${DIST_DIR}/windows/Setup.exe"
echo "   - App Launcher:    ${DIST_DIR}/windows/Pomodoro.exe"
echo "   - Uninstaller:     ${DIST_DIR}/windows/Uninstall.exe"
echo "   - Download Paket:  ${DIST_DIR}/${ZIP_NAME}"
echo "=========================================================="
