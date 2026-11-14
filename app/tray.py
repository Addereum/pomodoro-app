#!/usr/bin/env python3
"""
Standalone System Tray / AppIndicator for Addereums Pomodoro.
Runs isolated in Gtk 3.0 to provide full compatibility with AyatanaAppIndicator
without conflicting with the main application's GTK 4 / Libadwaita environment.
"""

import sys
import os
import json
import signal
from pathlib import Path

# Paths
APP_DIR = Path(__file__).resolve().parent

try:
    import gi
    gi.require_version("Gtk", "3.0")
    from gi.repository import Gtk, GLib

    # Initialize GTK display connection
    init_res = Gtk.init_check(None)
    init_ok = init_res[0] if isinstance(init_res, tuple) else bool(init_res)
    if not init_ok:
        sys.exit(0)

    try:
        gi.require_version("AyatanaAppIndicator3", "0.1")
        from gi.repository import AyatanaAppIndicator3 as appindicator
    except (ValueError, ImportError):
        try:
            gi.require_version("AppIndicator3", "0.1")
            from gi.repository import AppIndicator3 as appindicator
        except (ValueError, ImportError):
            sys.exit(0)

except Exception:
    # If environment does not support Gtk3 or AppIndicator, exit silently
    sys.exit(0)


class PomodoroTray:
    def __init__(self):
        # Initialize Indicator with local icon theme path
        self.indicator = appindicator.Indicator.new_with_path(
            "addereums-pomodoro",
            "icon",
            appindicator.IndicatorCategory.APPLICATION_STATUS,
            str(APP_DIR)
        )
        self.indicator.set_icon_theme_path(str(APP_DIR))
        self.indicator.set_title("Addereums Pomodoro")

        self.phase_names = {
            "focus": "Fokus",
            "shortBreak": "Kurze Pause",
            "longBreak": "Lange Pause"
        }

        self.current_phase = "focus"
        self.is_running = False
        self.formatted_time = "25:00"

        # Build and attach menu BEFORE setting status to ACTIVE
        self.build_menu()
        self.indicator.set_menu(self.menu)
        self.indicator.set_status(appindicator.IndicatorStatus.ACTIVE)

        # Watch stdin for updates from main.py
        GLib.io_add_watch(sys.stdin.fileno(), GLib.IO_IN | GLib.IO_HUP, self.on_stdin_event)

        # Handle SIGTERM / SIGINT
        signal.signal(signal.SIGINT, lambda s, f: Gtk.main_quit())
        signal.signal(signal.SIGTERM, lambda s, f: Gtk.main_quit())

    def build_menu(self):
        self.menu = Gtk.Menu()

        # Status / Header item (non-clickable)
        self.item_status = Gtk.MenuItem(label="Addereums Pomodoro - Fokus 25:00")
        self.item_status.set_sensitive(False)
        self.menu.append(self.item_status)

        # Separator
        self.menu.append(Gtk.SeparatorMenuItem())

        # Toggle Window (Show / Hide)
        self.item_toggle_window = Gtk.MenuItem(label="Fenster anzeigen / ausblenden")
        self.item_toggle_window.connect("activate", lambda w: self.send_action("toggle_window"))
        self.menu.append(self.item_toggle_window)

        # Timer Start / Pause
        self.item_toggle_timer = Gtk.MenuItem(label="Timer starten")
        self.item_toggle_timer.connect("activate", lambda w: self.send_action("toggle_timer"))
        self.menu.append(self.item_toggle_timer)

        # Skip Phase
        self.item_skip = Gtk.MenuItem(label="Phase überspringen")
        self.item_skip.connect("activate", lambda w: self.send_action("skip_phase"))
        self.menu.append(self.item_skip)

        # Separator
        self.menu.append(Gtk.SeparatorMenuItem())

        # Quit App
        self.item_quit = Gtk.MenuItem(label="Beenden")
        self.item_quit.connect("activate", lambda w: self.send_action("quit"))
        self.menu.append(self.item_quit)

        self.menu.show_all()

    def send_action(self, action: str):
        msg = json.dumps({"action": action})
        try:
            sys.stdout.write(msg + "\n")
            sys.stdout.flush()
        except (BrokenPipeError, IOError):
            Gtk.main_quit()

    def on_stdin_event(self, source, condition):
        if condition & GLib.IO_HUP:
            Gtk.main_quit()
            return False

        line = sys.stdin.readline()
        if not line:
            Gtk.main_quit()
            return False

        try:
            data = json.loads(line.strip())
            self.handle_message(data)
        except Exception:
            pass
        return True

    def handle_message(self, data: dict):
        msg_type = data.get("type")
        if msg_type == "timer_status":
            self.current_phase = data.get("phase", "focus")
            self.formatted_time = data.get("formattedTime", "25:00")
            self.is_running = bool(data.get("isRunning", False))

            phase_label = self.phase_names.get(self.current_phase, "Fokus")
            status_text = f"{phase_label}: {self.formatted_time}"
            self.item_status.set_label(f"Addereums Pomodoro ({status_text})")

            # Update Indicator tray text
            self.indicator.set_label(self.formatted_time, "00:00")

            # Update Play/Pause menu item
            if self.is_running:
                self.item_toggle_timer.set_label("Timer anhalten (Pause)")
            else:
                self.item_toggle_timer.set_label("Timer fortsetzen (Start)")

        elif msg_type == "quit":
            Gtk.main_quit()


def main():
    try:
        tray = PomodoroTray()
        Gtk.main()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
