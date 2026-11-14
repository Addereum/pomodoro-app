#!/usr/bin/env python3
"""
Pomodoro Native Desktop Host for Fedora / GNOME
Frameless window with custom integrated Titlebar & native Wayland drag support.
Supports GNOME Do-Not-Disturb (DND) mode and System Tray / AppIndicator companion.
"""

import sys
import os
import json
import subprocess
import atexit
from pathlib import Path

# Ensure paths
APP_DIR = Path(__file__).resolve().parent
WEB_INDEX = APP_DIR / "web" / "index.html"
ICON_PATH = APP_DIR / "icon.svg"
ICON_PNG = APP_DIR / "icon.png"

try:
    import gi
    gi.require_version("Gtk", "4.0")
    gi.require_version("Adw", "1")
    gi.require_version("WebKit", "6.0")
    from gi.repository import Gtk, Adw, WebKit, Gdk, GLib, Gio
except ImportError as e:
    print(f"Error loading GTK/WebKit libraries: {e}", file=sys.stderr)
    print("Please ensure python3-gobject, gtk4, libadwaita, and webkitgtk6.0 are installed on Fedora.", file=sys.stderr)
    sys.exit(1)


CUSTOM_TITLEBAR_CSS = """
window.pomodoro-window {
    background-color: #1e1e1e;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
}

.custom-titlebar {
    background-color: #242424;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    padding: 6px 14px;
    min-height: 38px;
}

.custom-titlebar.light {
    background-color: #f0f0f3;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.titlebar-brand-label {
    font-weight: 700;
    font-size: 13px;
    color: #f5f5f7;
}

.custom-titlebar.light .titlebar-brand-label {
    color: #1d1d1f;
}

.titlebar-center-label {
    font-weight: 600;
    font-size: 13px;
    color: #e03131;
}

.titlebar-btn {
    background: transparent;
    border: none;
    border-radius: 6px;
    color: #a0a0a5;
    padding: 3px 8px;
    font-size: 14px;
    font-weight: 700;
    min-width: 30px;
    min-height: 28px;
}

.titlebar-btn:hover {
    background-color: #383838;
    color: #ffffff;
}

.custom-titlebar.light .titlebar-btn:hover {
    background-color: #e2e2e7;
    color: #1d1d1f;
}

window.pomodoro-window .custom-titlebar .titlebar-btn.close:hover {
    background-color: #e03131;
    color: #ffffff;
}
"""


class DndManager:
    """Manages GNOME desktop notification banners (Do Not Disturb) during focus phases."""
    def __init__(self):
        self.settings = None
        self.original_show_banners = None
        self.is_dnd_active = False
        try:
            source = Gio.SettingsSchemaSource.get_default()
            if source and source.lookup("org.gnome.desktop.notifications", True):
                self.settings = Gio.Settings.new("org.gnome.desktop.notifications")
                self.original_show_banners = self.settings.get_boolean("show-banners")
        except Exception as e:
            print(f"[DND] GNOME notifications schema not accessible: {e}", file=sys.stderr)

    def set_dnd(self, enable: bool):
        if not self.settings:
            return
        try:
            if enable and not self.is_dnd_active:
                self.original_show_banners = self.settings.get_boolean("show-banners")
                self.settings.set_boolean("show-banners", False)
                self.is_dnd_active = True
            elif not enable and self.is_dnd_active:
                restore_val = True if self.original_show_banners is None else self.original_show_banners
                self.settings.set_boolean("show-banners", restore_val)
                self.is_dnd_active = False
        except Exception as e:
            print(f"[DND Error] Could not update show-banners: {e}", file=sys.stderr)

    def cleanup(self):
        if self.is_dnd_active and self.settings:
            try:
                restore_val = True if self.original_show_banners is None else self.original_show_banners
                self.settings.set_boolean("show-banners", restore_val)
                self.is_dnd_active = False
            except Exception:
                pass


def check_tray_host_available() -> bool:
    """Checks if a StatusNotifierWatcher or System Tray host is active on DBus."""
    try:
        bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)
        proxy = Gio.DBusProxy.new_sync(
            bus,
            Gio.DBusProxyFlags.DO_NOT_LOAD_PROPERTIES,
            None,
            "org.freedesktop.DBus",
            "/org/freedesktop/DBus",
            "org.freedesktop.DBus",
            None
        )
        for watcher in [
            "org.kde.StatusNotifierWatcher",
            "org.ayatana.StatusNotifierWatcher",
            "org.freedesktop.StatusNotifierWatcher"
        ]:
            res = proxy.call_sync(
                "NameHasOwner",
                GLib.Variant("(s)", (watcher,)),
                Gio.DBusCallFlags.NONE,
                -1,
                None
            )
            if res and res.unpack()[0]:
                return True
        return False
    except Exception:
        return False


class TrayProcessManager:
    """Spawns and communicates with the isolated Gtk 3.0 AppIndicator tray companion."""
    def __init__(self, window):
        self.window = window
        self.proc = None
        self.start()

    def start(self):
        tray_script = APP_DIR / "tray.py"
        if not tray_script.exists():
            return
        try:
            self.proc = subprocess.Popen(
                [sys.executable, str(tray_script)],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=None,
                text=True,
                bufsize=1
            )
            GLib.io_add_watch(
                self.proc.stdout.fileno(),
                GLib.IO_IN | GLib.IO_HUP,
                self.on_stdout
            )
        except Exception as e:
            print(f"[Tray Error] Failed to start tray process: {e}", file=sys.stderr)
            self.proc = None

    def on_stdout(self, source, condition):
        if condition & GLib.IO_HUP:
            return False
        if not self.proc or not self.proc.stdout:
            return False
        try:
            line = self.proc.stdout.readline()
            if not line:
                return False
            data = json.loads(line.strip())
            action = data.get("action")
            self.handle_tray_action(action)
        except Exception:
            pass
        return True

    def handle_tray_action(self, action: str):
        if action == "toggle_window":
            if self.window.is_visible():
                self.window.set_visible(False)
            else:
                self.window.set_visible(True)
                self.window.present()
        elif action == "toggle_timer":
            self.window.eval_js("if (window.pomodoroApp) window.pomodoroApp.timer.toggle();")
        elif action == "skip_phase":
            self.window.eval_js("if (window.pomodoroApp) window.pomodoroApp.timer.skip();")
        elif action == "quit":
            self.window.quit_app()

    def send_update(self, data: dict):
        if self.proc and self.proc.stdin:
            try:
                line = json.dumps(data) + "\n"
                self.proc.stdin.write(line)
                self.proc.stdin.flush()
            except (BrokenPipeError, IOError):
                self.proc = None

    def stop(self):
        if self.proc:
            try:
                self.send_update({"type": "quit"})
                self.proc.terminate()
            except Exception:
                pass
            self.proc = None


class PomodoroWindow(Adw.ApplicationWindow):
    def __init__(self, app):
        super().__init__(application=app, title="Addereums Pomodoro")

        # Frameless window - completely replaces bulky GNOME titlebar
        self.set_decorated(False)
        self.set_default_size(680, 820)
        self.set_size_request(480, 600)
        self.add_css_class("pomodoro-window")

        self.is_compact = False
        self.close_to_tray = True
        self.tray_available = check_tray_host_available()

        if not self.tray_available:
            print("[Tray Info] Kein aktiver StatusNotifierWatcher / Tray-Host auf DBus gefunden.")
            print("            (Hinweis: Standard-GNOME auf Fedora unterstützt Tray-Icons über das Paket 'gnome-shell-extension-appindicator').")

        # Managers
        self.dnd_manager = DndManager()
        self.tray_manager = TrayProcessManager(self)
        atexit.register(self.cleanup)

        # Intercept window close to support "Close to Tray"
        self.connect("close-request", self.on_close_request)

        # Apply Custom Styles
        self.css_provider = Gtk.CssProvider()
        self.css_provider.load_from_string(CUSTOM_TITLEBAR_CSS)
        Gtk.StyleContext.add_provider_for_display(
            Gdk.Display.get_default(),
            self.css_provider,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
        )

        # Main vertical box
        main_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        self.set_content(main_box)

        # Window Handle wrapping Custom Titlebar (Native Wayland/X11 moving & dragging!)
        self.window_handle = Gtk.WindowHandle()
        main_box.append(self.window_handle)

        # Custom Titlebar Box
        self.titlebar_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        self.titlebar_box.add_css_class("custom-titlebar")
        self.window_handle.set_child(self.titlebar_box)

        # Left Section: Icon + Brand Name
        left_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)
        self.icon_img = Gtk.Image.new_from_file(str(ICON_PATH))
        self.icon_img.set_pixel_size(18)
        left_box.append(self.icon_img)

        self.brand_label = Gtk.Label(label="Addereums Pomodoro")
        self.brand_label.add_css_class("titlebar-brand-label")
        left_box.append(self.brand_label)
        self.titlebar_box.append(left_box)

        # Center Section: Active Countdown / Title
        self.title_label = Gtk.Label(label="Fokus")
        self.title_label.add_css_class("titlebar-center-label")
        self.title_label.set_hexpand(True)
        self.title_label.set_halign(Gtk.Align.CENTER)
        self.titlebar_box.append(self.title_label)

        # Right Section: Window Controls (Compact, Minimize, Close)
        right_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=4)

        self.btn_compact = Gtk.Button(label="⤢")
        self.btn_compact.set_tooltip_text("Kompaktmodus / Mini-Player")
        self.btn_compact.add_css_class("titlebar-btn")
        self.btn_compact.connect("clicked", lambda b: self.toggle_compact_mode())
        right_box.append(self.btn_compact)

        self.btn_minimize = Gtk.Button(label="−")
        self.btn_minimize.set_tooltip_text("Minimieren")
        self.btn_minimize.add_css_class("titlebar-btn")
        self.btn_minimize.connect("clicked", lambda b: self.minimize())
        right_box.append(self.btn_minimize)

        self.btn_close = Gtk.Button(label="✕")
        self.btn_close.set_tooltip_text("Schließen (In den System-Tray)")
        self.btn_close.add_css_class("titlebar-btn")
        self.btn_close.add_css_class("close")
        self.btn_close.connect("clicked", lambda b: self.close())
        right_box.append(self.btn_close)

        self.titlebar_box.append(right_box)

        # Right-click gesture on custom titlebar triggers GNOME window menu
        right_click_gesture = Gtk.GestureClick.new()
        right_click_gesture.set_button(3)
        right_click_gesture.connect("pressed", self.on_titlebar_right_click)
        self.titlebar_box.add_controller(right_click_gesture)

        # Web View
        self.web_view = WebKit.WebView()
        self.web_view.set_vexpand(True)
        self.web_view.set_hexpand(True)
        main_box.append(self.web_view)

        # WebKit Settings
        settings = self.web_view.get_settings()
        settings.set_allow_file_access_from_file_urls(True)
        settings.set_allow_universal_access_from_file_urls(True)
        settings.set_enable_developer_extras(True)
        settings.set_enable_webaudio(True)
        settings.set_media_playback_allows_inline(True)

        # WebKit User Content Manager & Bridge Handler
        self.content_manager = self.web_view.get_user_content_manager()
        self.content_manager.register_script_message_handler("bridge")
        self.content_manager.connect("script-message-received::bridge", self.on_script_message)

        # Load Web App
        file_uri = WEB_INDEX.as_uri()
        self.web_view.load_uri(file_uri)

        # Sync Adwaita StyleManager (Dark / Light Theme changes)
        self.style_manager = Adw.StyleManager.get_default()
        self.style_manager.connect("notify::dark", self.on_theme_changed)

    def on_close_request(self, window):
        """Intercept window close to minimize to tray if enabled and tray host exists"""
        if self.close_to_tray and self.tray_available:
            self.set_visible(False)
            return True  # Stop default close, window stays alive in tray
        self.cleanup()
        return False

    def eval_js(self, js_code: str):
        """Execute JavaScript inside the WebKit WebView safely"""
        try:
            self.web_view.evaluate_javascript(js_code, -1, None, None, None, None, None)
        except Exception:
            pass

    def quit_app(self):
        """Perform full application exit, stopping tray and restoring system state"""
        self.close_to_tray = False
        self.cleanup()
        app = self.get_application()
        if app:
            app.quit()
        else:
            self.close()

    def cleanup(self):
        """Restore GNOME banners and stop tray process"""
        if hasattr(self, "dnd_manager") and self.dnd_manager:
            self.dnd_manager.cleanup()
        if hasattr(self, "tray_manager") and self.tray_manager:
            self.tray_manager.stop()

    def on_theme_changed(self, style_manager, param):
        is_dark = style_manager.get_dark()
        if is_dark:
            self.titlebar_box.remove_css_class("light")
        else:
            self.titlebar_box.add_css_class("light")

        theme_str = "dark" if is_dark else "light"
        self.eval_js(f"if (window.pomodoroApp) window.pomodoroApp.settings.applyTheme('{theme_str}');")

    def on_script_message(self, content_manager, js_result):
        try:
            msg_str = ""
            if hasattr(js_result, "is_string") and js_result.is_string():
                msg_str = js_result.to_string()
            elif hasattr(js_result, "to_json"):
                msg_str = js_result.to_json(0)
            elif hasattr(js_result, "to_string"):
                msg_str = js_result.to_string()

            if not msg_str:
                return

            data = json.loads(msg_str)
            if isinstance(data, str):
                data = json.loads(data)

            if not isinstance(data, dict):
                return

            action = data.get("type")

            if action == "notify":
                title = data.get("title", "Addereums Pomodoro")
                body = data.get("body", "")
                urgency = data.get("urgency", "normal")
                self.send_system_notification(title, body, urgency)

            elif action == "set_title":
                title = data.get("title", "Addereums Pomodoro")
                self.set_title(title)
                if hasattr(self, "title_label"):
                    self.title_label.set_text(title)

            elif action == "play_sound":
                self.play_system_sound()

            elif action == "toggle_compact":
                is_compact = bool(data.get("compact", False))
                self.toggle_compact_mode(is_compact)

            elif action == "minimize":
                self.minimize()

            elif action == "close":
                self.close()

            elif action == "set_dnd":
                enabled = bool(data.get("enabled", False))
                self.dnd_manager.set_dnd(enabled)

            elif action == "set_close_to_tray":
                self.close_to_tray = bool(data.get("closeToTray", True))

            elif action == "timer_status":
                self.tray_manager.send_update(data)

        except Exception as e:
            print(f"[Bridge Error] Failed to process message: {e}", file=sys.stderr)

    def on_titlebar_right_click(self, gesture, n_press, x, y):
        """Open native GNOME window menu (Immer im Vordergrund, Minimieren, etc.)"""
        surface = self.get_surface()
        if surface and isinstance(surface, Gdk.Toplevel):
            surface.titlebar_gesture(Gdk.TitlebarGesture.RIGHT_CLICK)

    def toggle_compact_mode(self, forced_state=None):
        """Toggle minimalist compact overlay mode without ping-pong looping"""
        target_state = forced_state if forced_state is not None else not self.is_compact
        if target_state == self.is_compact:
            return  # Prevent recursive feedback loop

        self.is_compact = target_state

        if self.is_compact:
            self.set_size_request(380, 115)
            self.set_default_size(380, 115)
            self.btn_compact.set_label("🗖")
            self.btn_compact.set_tooltip_text("Vollansicht wiederherstellen")
            js_code = "if (window.pomodoroApp) window.pomodoroApp.toggleCompactMode(true, false);"
        else:
            self.set_size_request(480, 600)
            self.set_default_size(680, 820)
            self.btn_compact.set_label("⤢")
            self.btn_compact.set_tooltip_text("Kompaktmodus / Mini-Player")
            js_code = "if (window.pomodoroApp) window.pomodoroApp.toggleCompactMode(false, false);"

        self.queue_resize()
        self.eval_js(js_code)

    def send_system_notification(self, title, body, urgency="normal"):
        """Show native desktop notification on Fedora / GNOME"""
        try:
            cmd = [
                "notify-send",
                "-a", "Addereums Pomodoro",
                "-u", urgency,
                "-i", str(ICON_PATH),
                title,
                body
            ]
            subprocess.Popen(cmd)
        except Exception as e:
            print(f"[Notify Error] notify-send failed: {e}", file=sys.stderr)

    def play_system_sound(self):
        """Play native freedesktop bell sound if available"""
        sound_file = "/usr/share/sounds/freedesktop/stereo/alarm-clock-elapsed.oga"
        if os.path.exists(sound_file):
            try:
                subprocess.Popen(["paplay", sound_file])
            except Exception:
                pass


class PomodoroApp(Adw.Application):
    def __init__(self):
        super().__init__(
            application_id="io.github.pomodoro.app",
            flags=Gio.ApplicationFlags.DEFAULT_FLAGS
        )

    def do_activate(self):
        win = self.props.active_window
        if not win:
            win = PomodoroWindow(self)
        win.set_visible(True)
        win.present()


def main():
    app = PomodoroApp()
    return app.run(sys.argv)


if __name__ == "__main__":
    sys.exit(main())
