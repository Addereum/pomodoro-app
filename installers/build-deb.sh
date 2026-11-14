#!/usr/bin/env bash
set -euo pipefail

# Build Debian / Ubuntu (.deb) package
VERSION="1.0.0"
PKG_NAME="pomodoro-app"
ARCH="all"
DEB_NAME="${PKG_NAME}_${VERSION}_${ARCH}.deb"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BUILD_DIR="$(mktemp -d -t pomodoro-deb-build-XXXXXX)"
DIST_DIR="${SCRIPT_DIR}/dist"

mkdir -p "${DIST_DIR}"

trap 'rm -rf "${BUILD_DIR}"' EXIT

echo "==> Erstelle Debian/Ubuntu Paket für ${PKG_NAME} v${VERSION}..."

# Erstelle Verzeichnisstruktur
mkdir -p "${BUILD_DIR}/DEBIAN"
chmod 755 "${BUILD_DIR}/DEBIAN"
mkdir -p "${BUILD_DIR}/usr/bin"
mkdir -p "${BUILD_DIR}/usr/share/${PKG_NAME}/app"
mkdir -p "${BUILD_DIR}/usr/share/applications"
mkdir -p "${BUILD_DIR}/usr/share/icons/hicolor/scalable/apps"

# 1. DEBIAN/control
cat << 'EOF' > "${BUILD_DIR}/DEBIAN/control"
Package: pomodoro-app
Version: 1.0.0
Section: utils
Priority: optional
Architecture: all
Maintainer: addereum <https://github.com/addereum>
Homepage: https://github.com/addereum/pomodoro-app
Depends: python3, python3-gi, gir1.2-gtk-4.0, gir1.2-adw-1, gir1.2-webkit-6.0, libnotify-bin
Recommends: sound-theme-freedesktop
Description: Addereums Pomodoro – Moderner Fokus- & Produktivitaets-Timer
 Schlanker, nativer Pomodoro-Timer mit GTK4, Libadwaita und WebKitGTK.
 Bietet randloses Design, Soundeffekte, prozedurales Umgebungsrauschen,
 Aufgabenverwaltung, 7-Tage-Statistik und PiP-Kompaktmodus.
EOF

# 2. DEBIAN/postinst & postrm
cat << 'EOF' > "${BUILD_DIR}/DEBIAN/postinst"
#!/bin/sh
set -e
if [ "$1" = "configure" ]; then
    if command -v update-desktop-database >/dev/null 2>&1; then
        update-desktop-database -q /usr/share/applications || true
    fi
    if command -v gtk-update-icon-cache >/dev/null 2>&1; then
        gtk-update-icon-cache -q -t -f /usr/share/icons/hicolor || true
    fi
fi
exit 0
EOF
chmod 755 "${BUILD_DIR}/DEBIAN/postinst"

cat << 'EOF' > "${BUILD_DIR}/DEBIAN/postrm"
#!/bin/sh
set -e
if [ "$1" = "remove" ] || [ "$1" = "purge" ]; then
    if command -v update-desktop-database >/dev/null 2>&1; then
        update-desktop-database -q /usr/share/applications || true
    fi
    if command -v gtk-update-icon-cache >/dev/null 2>&1; then
        gtk-update-icon-cache -q -t -f /usr/share/icons/hicolor || true
    fi
fi
exit 0
EOF
chmod 755 "${BUILD_DIR}/DEBIAN/postrm"

# 3. App Dateien kopieren
cp -a "${ROOT_DIR}/app/." "${BUILD_DIR}/usr/share/${PKG_NAME}/app/"

# 4. Icon installieren
cp -a "${ROOT_DIR}/app/icon.svg" "${BUILD_DIR}/usr/share/icons/hicolor/scalable/apps/pomodoro-app.svg"

# 5. Desktop-Datei
cat << 'EOF' > "${BUILD_DIR}/usr/share/applications/pomodoro.desktop"
[Desktop Entry]
Version=1.0
Type=Application
Name=Addereums Pomodoro
GenericName=Fokus & Produktivitäts-Timer
Comment=Addereums Pomodoro – Fokus- & Produktivitäts-Timer
Exec=/usr/bin/pomodoro %U
Icon=pomodoro-app
Terminal=false
Categories=Utility;Clock;Office;
StartupNotify=true
StartupWMClass=io.github.addereum.pomodoro-app
Keywords=Pomodoro;Timer;Focus;Produktivität;Clock;Zeit;Addereum;
EOF
chmod 644 "${BUILD_DIR}/usr/share/applications/pomodoro.desktop"

# 6. /usr/bin/pomodoro Wrapper-Script
cat << 'EOF' > "${BUILD_DIR}/usr/bin/pomodoro"
#!/usr/bin/env bash
set -e
APP_DIR="/usr/share/pomodoro-app/app"

if [ "${1:-}" = "--web" ] || [ "${1:-}" = "-w" ]; then
    PORT=8765
    echo "Starte Web-Server auf http://127.0.0.1:${PORT}..."
    if command -v xdg-open >/dev/null 2>&1; then
        (sleep 1 && xdg-open "http://127.0.0.1:${PORT}") &
    fi
    exec python3 -m http.server "${PORT}" --directory "${APP_DIR}/web"
fi

exec python3 "${APP_DIR}/main.py" "$@"
EOF
chmod 755 "${BUILD_DIR}/usr/bin/pomodoro"

# 7. Paket mit dpkg-deb bauen
dpkg-deb --build --root-owner-group "${BUILD_DIR}" "${DIST_DIR}/${DEB_NAME}"

echo "==> Fertig! Debian/Ubuntu Paket erstellt:"
echo "    ${DIST_DIR}/${DEB_NAME}"
