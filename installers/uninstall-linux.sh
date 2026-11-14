#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Uninstaller für Pomodoro App
# ==============================================================================

echo "=========================================================="
echo "      🗑️  Pomodoro App - Deinstallation"
echo "=========================================================="
echo ""

if [ "$(id -u)" -eq 0 ]; then
    TARGET_BASE="/usr/local/share/pomodoro-app"
    BIN_FILE="/usr/local/bin/pomodoro"
    DESKTOP_FILE="/usr/share/applications/pomodoro.desktop"
    ICON_FILE="/usr/share/icons/hicolor/scalable/apps/pomodoro-app.svg"
else
    TARGET_BASE="${HOME}/.local/share/pomodoro-app"
    BIN_FILE="${HOME}/.local/bin/pomodoro"
    DESKTOP_FILE="${HOME}/.local/share/applications/pomodoro.desktop"
    ICON_FILE="${HOME}/.local/share/icons/hicolor/scalable/apps/pomodoro-app.svg"
fi

echo "Entferne installierte Dateien..."

rm -rf "${TARGET_BASE}"
rm -f "${BIN_FILE}"
rm -f "${DESKTOP_FILE}"
rm -f "${ICON_FILE}"

if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database -q "$(dirname "${DESKTOP_FILE}")" 2>/dev/null || true
fi
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    gtk-update-icon-cache -q -t -f "$(dirname "$(dirname "$(dirname "${ICON_FILE}")")")" 2>/dev/null || true
fi

echo "✅ Pomodoro App wurde erfolgreich vom System entfernt."
