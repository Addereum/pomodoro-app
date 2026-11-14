#!/usr/bin/env bash
set -euo pipefail

# Build standalone Linux AppImage
VERSION="1.1.1"
PKG_NAME="Addereums-Pomodoro"
APPIMAGE_NAME="${PKG_NAME}-${VERSION}-x86_64.AppImage"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DIST_DIR="${SCRIPT_DIR}/dist"
BUILD_DIR="$(mktemp -d -t pomodoro-appimage-build-XXXXXX)"

mkdir -p "${DIST_DIR}"
trap 'rm -rf "${BUILD_DIR}"' EXIT

echo "==> Erstelle Linux AppImage für ${PKG_NAME} v${VERSION}..."

APP_DIR="${BUILD_DIR}/AppDir"
mkdir -p "${APP_DIR}/usr/bin"
mkdir -p "${APP_DIR}/usr/share/pomodoro-app/app"
mkdir -p "${APP_DIR}/usr/share/applications"
mkdir -p "${APP_DIR}/usr/share/icons/hicolor/scalable/apps"
mkdir -p "${APP_DIR}/usr/share/icons/hicolor/128x128/apps"

# 1. App-Dateien kopieren
cp -a "${ROOT_DIR}/app/." "${APP_DIR}/usr/share/pomodoro-app/app/"
find "${APP_DIR}/usr/share/pomodoro-app/app" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find "${APP_DIR}/usr/share/pomodoro-app/app" -type f -name "*.pyc" -delete 2>/dev/null || true

# 2. Icons
cp "${ROOT_DIR}/app/icon.svg" "${APP_DIR}/usr/share/icons/hicolor/scalable/apps/pomodoro-app.svg"
cp "${ROOT_DIR}/app/icon.svg" "${APP_DIR}/pomodoro-app.svg"
if [ -f "${ROOT_DIR}/app/icon.png" ]; then
    cp "${ROOT_DIR}/app/icon.png" "${APP_DIR}/usr/share/icons/hicolor/128x128/apps/pomodoro-app.png"
    cp "${ROOT_DIR}/app/icon.png" "${APP_DIR}/pomodoro-app.png"
    cp "${ROOT_DIR}/app/icon.png" "${APP_DIR}/.DirIcon"
fi

# 3. Desktop Entry
cat << 'EOF' > "${APP_DIR}/pomodoro.desktop"
[Desktop Entry]
Version=1.0
Type=Application
Name=Addereums Pomodoro
GenericName=Fokus & Produktivitäts-Timer
Comment=Addereums Pomodoro – Fokus- & Produktivitäts-Timer
Exec=pomodoro %U
Icon=pomodoro-app
Terminal=false
Categories=Utility;Clock;Office;
StartupNotify=true
StartupWMClass=io.github.addereum.pomodoro-app
Keywords=Pomodoro;Timer;Focus;Produktivität;Clock;Zeit;Addereum;
EOF
cp "${APP_DIR}/pomodoro.desktop" "${APP_DIR}/usr/share/applications/pomodoro.desktop"

# 4. Launcher Skript in usr/bin
cat << 'EOF' > "${APP_DIR}/usr/bin/pomodoro"
#!/bin/sh
APPDIR="$(dirname "$(dirname "$(readlink -f "$0")")")"
export PYTHONPATH="${APPDIR}/usr/share/pomodoro-app:${PYTHONPATH:-}"
exec python3 "${APPDIR}/usr/share/pomodoro-app/app/main.py" "$@"
EOF
chmod +x "${APP_DIR}/usr/bin/pomodoro"

# 5. AppRun Skript im Wurzelverzeichnis des AppDir
cat << 'EOF' > "${APP_DIR}/AppRun"
#!/bin/sh
SELF="$(readlink -f "$0")"
HERE="${SELF%/*}"
export PATH="${HERE}/usr/bin:${PATH}"
exec "${HERE}/usr/bin/pomodoro" "$@"
EOF
chmod +x "${APP_DIR}/AppRun"

# 6. Kompiliere AppImage mit appimagetool falls verfügbar
if command -v appimagetool >/dev/null 2>&1; then
    echo "==> Baue AppImage mit appimagetool..."
    ARCH=x86_64 appimagetool "${APP_DIR}" "${DIST_DIR}/${APPIMAGE_NAME}"
else
    echo "ℹ️  appimagetool nicht lokal installiert. Erstelle AppDir-Tarball als portable AppImage-Struktur..."
    (
        cd "${BUILD_DIR}"
        tar -czf "${DIST_DIR}/${PKG_NAME}-${VERSION}-AppDir.tar.gz" AppDir
    )
fi

echo "==> Fertig! AppImage / AppDir erstellt in ${DIST_DIR}"
