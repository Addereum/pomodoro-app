#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Universal Linux Installer für Pomodoro App
# Unterstützt Fedora, Ubuntu, Debian, Arch Linux, Manjaro, openSUSE etc.
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_SOURCE_DIR="${SCRIPT_DIR}/../app"

if [ ! -d "${APP_SOURCE_DIR}" ] && [ -d "${SCRIPT_DIR}/app" ]; then
    APP_SOURCE_DIR="${SCRIPT_DIR}/app"
fi

if [ ! -f "${APP_SOURCE_DIR}/main.py" ]; then
    echo "❌ Fehler: App-Verzeichnis nicht gefunden!" >&2
    exit 1
fi

echo "=========================================================="
echo "      🍅 Addereums Pomodoro - Linux Installation"
echo "      https://github.com/addereum/pomodoro-app"
echo "=========================================================="
echo ""

# 1. Distro & Abhängigkeiten prüfen
check_dependencies() {
    echo "==> Prüfe Abhängigkeiten..."
    local missing=0

    if ! command -v python3 >/dev/null 2>&1; then
        echo "❌ python3 fehlt!"
        missing=1
    fi

    # Prüfe Python GTK4 / Libadwaita / WebKit Bindings
    if ! python3 -c "import gi; gi.require_version('Gtk', '4.0'); gi.require_version('Adw', '1'); gi.require_version('WebKit', '6.0')" 2>/dev/null; then
        echo "⚠️  GTK4 / Libadwaita / WebKitGTK-6.0 Python-Bibliotheken fehlen noch."
        echo ""
        echo "Installationsbefehle für deine Distribution:"
        
        if command -v dnf >/dev/null 2>&1; then
            echo "👉 Fedora / RHEL:"
            echo "   sudo dnf install -y python3-gobject gtk4 libadwaita webkitgtk6.0 libnotify gnome-shell-extension-appindicator libayatana-appindicator-gtk3 gtk3"
        elif command -v apt-get >/dev/null 2>&1; then
            echo "👉 Ubuntu / Debian / Pop!_OS / Mint:"
            echo "   sudo apt update && sudo apt install -y python3-gi gir1.2-gtk-4.0 gir1.2-adw-1 gir1.2-webkit-6.0 libnotify-bin gnome-shell-extension-appindicator gir1.2-ayatanaappindicator3-0.1 gir1.2-gtk-3.0"
        elif command -v pacman >/dev/null 2>&1; then
            echo "👉 Arch Linux / Manjaro:"
            echo "   sudo pacman -S --needed python-gobject gtk4 libadwaita webkitgtk-6.0 libnotify libayatana-appindicator gtk3"
        elif command -v zypper >/dev/null 2>&1; then
            echo "👉 openSUSE:"
            echo "   sudo zypper in python3-gobject typelib-Gtk-4_0 typelib-Adw-1 typelib-WebKit-6_0 libnotify-tools typelib-AyatanaAppIndicator3-0_1"
        fi
        echo ""
        echo "(Tipp: Du kannst die App trotzdem installieren oder jederzeit mit '--web' im Browser nutzen.)"
        echo ""
    else
        echo "✅ Alle System-Abhängigkeiten (GTK4, Libadwaita, WebKitGTK 6.0) sind vorhanden!"
    fi
}

check_dependencies

# 2. Installationsziel bestimmen
if [ "$(id -u)" -eq 0 ]; then
    TARGET_BASE="/usr/local/share/pomodoro-app"
    BIN_DIR="/usr/local/bin"
    DESKTOP_DIR="/usr/share/applications"
    ICON_DIR="/usr/share/icons/hicolor/scalable/apps"
    INSTALL_TYPE="Systemweit (Root / Multi-User)"
else
    TARGET_BASE="${HOME}/.local/share/pomodoro-app"
    BIN_DIR="${HOME}/.local/bin"
    DESKTOP_DIR="${HOME}/.local/share/applications"
    ICON_DIR="${HOME}/.local/share/icons/hicolor/scalable/apps"
    INSTALL_TYPE="Benutzer-Installation (~/.local/)"
fi

echo "==> Installationsmodus: ${INSTALL_TYPE}"
echo "    Zielverzeichnis:    ${TARGET_BASE}"
echo "    Befehl (CLI):       ${BIN_DIR}/pomodoro"
echo ""

# 3. Verzeichnisse anlegen
mkdir -p "${TARGET_BASE}/app"
mkdir -p "${BIN_DIR}"
mkdir -p "${DESKTOP_DIR}"
mkdir -p "${ICON_DIR}"

# 4. Dateien kopieren
echo "==> Kopiere Anwendungsdateien..."
cp -r "${APP_SOURCE_DIR}/." "${TARGET_BASE}/app/"
find "${TARGET_BASE}/app" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find "${TARGET_BASE}/app" -type f -name "*.pyc" -delete 2>/dev/null || true

# 5. Icon installieren
cp "${APP_SOURCE_DIR}/icon.svg" "${ICON_DIR}/pomodoro-app.svg"

# 6. Wrapper-Skript anlegen
cat << WRAPPER > "${BIN_DIR}/pomodoro"
#!/usr/bin/env bash
set -e
APP_DIR="${TARGET_BASE}/app"

if [ "\${1:-}" = "--web" ] || [ "\${1:-}" = "-w" ]; then
    PORT=8765
    echo "Starte Pomodoro Web-Modus auf http://127.0.0.1:\${PORT}..."
    if command -v xdg-open >/dev/null 2>&1; then
        (sleep 1 && xdg-open "http://127.0.0.1:\${PORT}") &
    fi
    exec python3 -m http.server "\${PORT}" --directory "\${APP_DIR}/web"
fi

exec python3 "\${APP_DIR}/main.py" "\$@"
WRAPPER
chmod +x "${BIN_DIR}/pomodoro"

# 7. Desktop-Eintrag anlegen
cat << DESKTOP > "${DESKTOP_DIR}/pomodoro.desktop"
[Desktop Entry]
Version=1.0
Type=Application
Name=Addereums Pomodoro
GenericName=Fokus & Produktivitäts-Timer
Comment=Addereums Pomodoro – Fokus- & Produktivitäts-Timer
Exec=${BIN_DIR}/pomodoro %U
Icon=pomodoro-app
Terminal=false
Categories=Utility;Clock;Office;
StartupNotify=true
StartupWMClass=io.github.addereum.pomodoro-app
Keywords=Pomodoro;Timer;Focus;Produktivität;Clock;Zeit;Addereum;
DESKTOP
chmod 644 "${DESKTOP_DIR}/pomodoro.desktop"

# 8. Caches aktualisieren
if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database -q "${DESKTOP_DIR}" 2>/dev/null || true
fi
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    gtk-update-icon-cache -q -t -f "$(dirname "$(dirname "${ICON_DIR}")")" 2>/dev/null || true
fi

echo ""
echo "=========================================================="
echo "🎉 Installation erfolgreich abgeschlossen!"
echo "=========================================================="
echo ""
echo "Startmöglichkeiten:"
echo "  1. Im App-Menü nach 'Pomodoro' suchen und starten"
echo "  2. Im Terminal: pomodoro"
echo "  3. Im Browser-Modus: pomodoro --web"
echo ""

if [[ ":$PATH:" != *":${BIN_DIR}:"* ]]; then
    echo "ℹ️  Hinweis: '${BIN_DIR}' ist noch nicht in deiner \$PATH-Variable."
    echo "    Füge folgende Zeile zu deiner ~/.bashrc oder ~/.zshrc hinzu:"
    echo "    export PATH=\"${BIN_DIR}:\$PATH\""
    echo ""
fi
