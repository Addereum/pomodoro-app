#!/usr/bin/env bash
set -euo pipefail

# Build Fedora / RHEL / openSUSE (.rpm) package
VERSION="1.1.1"
PKG_NAME="pomodoro-app"
RELEASE="1"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BUILD_DIR="${SCRIPT_DIR}/.build-rpm-tmp"
DIST_DIR="${SCRIPT_DIR}/dist"

rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}"
mkdir -p "${DIST_DIR}"

trap 'rm -rf "${BUILD_DIR}"' EXIT

echo "==> Erstelle Fedora/RHEL/openSUSE RPM Paket für ${PKG_NAME} v${VERSION}..."

RPM_TOPDIR="${BUILD_DIR}/rpmbuild"
RPM_TMPDIR="${BUILD_DIR}/tmppath"
mkdir -p "${RPM_TOPDIR}"/{BUILD,RPMS,SOURCES,SPECS,SRPMS,BUILDROOT}
mkdir -p "${RPM_TMPDIR}"

SPEC_FILE="${RPM_TOPDIR}/SPECS/${PKG_NAME}.spec"

cat << EOF > "${SPEC_FILE}"
Name:           ${PKG_NAME}
Version:        ${VERSION}
Release:        ${RELEASE}%{?dist}
Summary:        Addereums Pomodoro – Fokus- & Produktivitaets-Timer
License:        MIT
URL:            https://github.com/addereum/pomodoro-app
BuildArch:      noarch
Requires:       python3, python3-gobject, gtk4, libadwaita, webkitgtk6.0, libnotify
Recommends:     gnome-shell-extension-appindicator, libayatana-appindicator-gtk3, gtk3

%description
Addereums Pomodoro: Schlanker, nativer Pomodoro-Timer mit GTK4, Libadwaita und WebKitGTK.
Bietet randloses Design, Soundeffekte, prozedurales Umgebungsrauschen,
Aufgabenverwaltung, 7-Tage-Statistik und PiP-Kompaktmodus.

%prep

%build

%install
rm -rf %{buildroot}
mkdir -p %{buildroot}/usr/bin
mkdir -p %{buildroot}/usr/share/${PKG_NAME}/app
mkdir -p %{buildroot}/usr/share/applications
mkdir -p %{buildroot}/usr/share/icons/hicolor/scalable/apps

# App-Dateien kopieren
cp -a "${ROOT_DIR}/app/." %{buildroot}/usr/share/${PKG_NAME}/app/
find %{buildroot} -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find %{buildroot} -type f -name "*.pyc" -delete 2>/dev/null || true

# Icon
cp -a "${ROOT_DIR}/app/icon.svg" %{buildroot}/usr/share/icons/hicolor/scalable/apps/pomodoro-app.svg

# Desktop Shortcut
cat << 'DESK' > %{buildroot}/usr/share/applications/pomodoro.desktop
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
Icon=pomodoro-app
Terminal=false
Categories=Utility;Clock;Office;
StartupNotify=true
StartupWMClass=io.github.pomodoro.app
Keywords=Pomodoro;Timer;Focus;Produktivität;Clock;Zeit;
DESK
chmod 644 %{buildroot}/usr/share/applications/pomodoro.desktop

# CLI Wrapper
cat << 'WRAPPER' > %{buildroot}/usr/bin/pomodoro
#!/usr/bin/env bash
set -e
APP_DIR="/usr/share/pomodoro-app/app"

if [ "\${1:-}" = "--web" ] || [ "\${1:-}" = "-w" ]; then
    PORT=8765
    echo "Starte Web-Server auf http://127.0.0.1:\${PORT}..."
    if command -v xdg-open >/dev/null 2>&1; then
        (sleep 1 && xdg-open "http://127.0.0.1:\${PORT}") &
    fi
    exec python3 -m http.server "\${PORT}" --directory "\${APP_DIR}/web"
fi

exec python3 "\${APP_DIR}/main.py" "\$@"
WRAPPER
chmod 755 %{buildroot}/usr/bin/pomodoro

%post
if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database -q /usr/share/applications || true
fi
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    gtk-update-icon-cache -q -t -f /usr/share/icons/hicolor || true
fi

%postun
if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database -q /usr/share/applications || true
fi
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    gtk-update-icon-cache -q -t -f /usr/share/icons/hicolor || true
fi

%files
/usr/bin/pomodoro
/usr/share/${PKG_NAME}
/usr/share/applications/pomodoro.desktop
/usr/share/icons/hicolor/scalable/apps/pomodoro-app.svg

%changelog
* Sat Nov 14 2026 Lukas <support@pomodoro.local> - 1.0.0-1
- Initiale Version fuer Linux
EOF

rpmbuild -bb "${SPEC_FILE}" \
    --define "_topdir ${RPM_TOPDIR}" \
    --define "_tmppath ${RPM_TMPDIR}"

# Kopiere gebautes RPM nach dist
find "${RPM_TOPDIR}/RPMS" -type f -name "*.rpm" -exec cp {} "${DIST_DIR}/" \;

RPM_FILE="$(find "${DIST_DIR}" -type f -name "${PKG_NAME}-${VERSION}*.rpm" -printf "%f\n" | head -n 1)"
echo "==> Fertig! Fedora/RPM Paket erstellt:"
echo "    ${DIST_DIR}/${RPM_FILE}"
