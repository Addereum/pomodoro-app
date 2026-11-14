#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ICON_PATH="$SCRIPT_DIR/app/icon.svg"
DESKTOP_ENTRY="$SCRIPT_DIR/pomodoro.desktop"

show_help() {
  echo "Addereums Pomodoro - Fokus & Produktivitäts-Timer"
  echo "Repository: https://github.com/addereum/pomodoro-app"
  echo ""
  echo "Verwendung: ./run.sh [OPTION]"
  echo ""
  echo "Optionen:"
  echo "  (keine)        Startet die native Desktop-App (GTK4 + Libadwaita + WebKitGTK)"
  echo "  --web, -w      Startet den Web-Modus via lokalem Webserver und öffnet den Browser"
  echo "  --install, -i  Installiert das .desktop Icon in ~/.local/share/applications/ (GNOME Menü)"
  echo "  --uninstall    Entfernt die .desktop Verknüpfung aus dem Anwendungsmenü"
  echo "  --help, -h     Zeigt diese Hilfe an"
  echo ""
}

install_desktop_entry() {
  echo "📦 Installiere Pomodoro in ~/.local/share/applications/..."
  mkdir -p "$HOME/.local/share/applications"
  
  # Ensure exact path in desktop file
  sed -e "s|Exec=.*|Exec=$SCRIPT_DIR/run.sh|g" \
      -e "s|Icon=.*|Icon=$ICON_PATH|g" \
      "$DESKTOP_ENTRY" > "$HOME/.local/share/applications/pomodoro.desktop"
  
  chmod +x "$HOME/.local/share/applications/pomodoro.desktop"
  
  if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "$HOME/.local/share/applications" || true
  fi
  
  echo "✅ Erfolgreich installiert! Du findest 'Pomodoro' jetzt in deinen Fedora/GNOME Anwendungen."
}

uninstall_desktop_entry() {
  echo "🗑️ Entferne Pomodoro aus ~/.local/share/applications/..."
  rm -f "$HOME/.local/share/applications/pomodoro.desktop"
  if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "$HOME/.local/share/applications" || true
  fi
  echo "✅ Verknüpfung entfernt."
}

start_web_server() {
  PORT=8090
  echo "🌐 Starte Pomodoro im Web-Modus auf Port $PORT..."
  cd "$SCRIPT_DIR/app/web"
  
  # Open browser in background after short delay
  (sleep 0.8 && (xdg-open "http://localhost:$PORT" || sensible-browser "http://localhost:$PORT" || true)) &
  
  python3 -m http.server "$PORT"
}

case "$1" in
  --help|-h)
    show_help
    exit 0
    ;;
  --install|-i)
    install_desktop_entry
    exit 0
    ;;
  --uninstall)
    uninstall_desktop_entry
    exit 0
    ;;
  --web|-w)
    start_web_server
    exit 0
    ;;
  *)
    # Default: launch native desktop app
    if [ -n "$WAYLAND_DISPLAY" ] || [ -n "$DISPLAY" ]; then
      exec python3 "$SCRIPT_DIR/app/main.py" "$@"
    else
      echo "⚠️ Kein Grafikdisplay (Wayland/X11) gefunden. Wechsle automatisch in den Web-Modus..."
      start_web_server
    fi
    ;;
esac
