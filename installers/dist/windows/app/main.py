#!/usr/bin/env python3
"""
Pomodoro Native Desktop Host for Fedora / GNOME
Frameless window with custom integrated Titlebar & native Wayland drag support.
"""

import sys
import os
import json
import subprocess
from pathlib import Path

# Ensure paths
APP_DIR = Path(__file__).resolve().parent
WEB_INDEX = APP_DIR / "web" / "index.html"
ICON_PATH = APP_DIR / "icon.svg"

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

.titlebar-btn.close:hover {
    background-color: #e03131 !important;
    color: #ffffff !important;
}
"""


class PomodoroWindow(Adw.ApplicationWindow):
    def __init__(self, app):
        super().__init__(application=app, title="Addereums Pomodoro")

        # Frameless window - completely replaces bulky GNOME titlebar
        self.set_decorated(False)
        self.set_default_size(680, 820)
        self.set_size_request(480, 600)
        self.add_css_class("pomodoro-window")

        self.is_compact = False

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
        self.btn_close.set_tooltip_text("Schließen")
        self.btn_close.add_css_class("titlebar-btn")
        self.btn_close.add_css_class("close")
        self.btn_close.connect("clicked", lambda b: self.close())
        right_box.append(self.btn_close)

        self.titlebar_box.append(right_box)

        # Right-click gesture on custom titlebar triggers GNOME window menu ("Immer im Vordergrund")
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

    def on_theme_changed(self, style_manager, param):
        is_dark = style_manager.get_dark()
        if is_dark:
            self.titlebar_box.remove_css_class("light")
        else:
            self.titlebar_box.add_css_class("light")

        theme_str = "dark" if is_dark else "light"
        js_code = f"if (window.pomodoroApp) window.pomodoroApp.settings.applyTheme('{theme_str}');"
        try:
            self.web_view.evaluate_javascript(js_code, -1, None, None, None, None, None)
        except Exception:
            pass

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

        try:
            self.web_view.evaluate_javascript(js_code, -1, None, None, None, None, None)
        except Exception:
            pass

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
        win.present()


def main():
    app = PomodoroApp()
    return app.run(sys.argv)


if __name__ == "__main__":
    sys.exit(main())
