/**
 * System and Native Desktop Bridge
 * Communicates with Python WebKitGTK shell or standard Browser Notification API.
 */

export class DesktopBridge {
  constructor() {
    this.isNativeHost = !!(
      window.webkit &&
      window.webkit.messageHandlers &&
      window.webkit.messageHandlers.bridge
    );

    this.hasBrowserNotification = 'Notification' in window;
    this.setupPermissions();
  }

  async setupPermissions() {
    if (!this.isNativeHost && this.hasBrowserNotification) {
      if (Notification.permission === 'default') {
        try {
          await Notification.requestPermission();
        } catch (e) {
          // Ignore
        }
      }
    }
  }

  postMessage(data) {
    if (this.isNativeHost) {
      try {
        window.webkit.messageHandlers.bridge.postMessage(data);
      } catch (e) {
        try {
          window.webkit.messageHandlers.bridge.postMessage(JSON.stringify(data));
        } catch (err) {
          console.warn('Native message posting failed:', err);
        }
      }
    }
  }

  sendNotification(title, body, urgency = 'normal') {
    // 1. Native Python GTK Host
    if (this.isNativeHost) {
      this.postMessage({
        type: 'notify',
        title,
        body,
        urgency
      });
      return;
    }

    // 2. Standard Web Browser
    if (this.hasBrowserNotification && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '../icon.svg',
          badge: '../icon.svg',
          tag: 'pomodoro-phase'
        });
      } catch (e) {
        console.warn('Web notification failed:', e);
      }
    }
  }

  updateTitle(title) {
    document.title = title;
    if (this.isNativeHost) {
      this.postMessage({
        type: 'set_title',
        title
      });
    }
  }

  toggleCompact(isCompact) {
    if (this.isNativeHost) {
      this.postMessage({
        type: 'toggle_compact',
        compact: isCompact
      });
    }
  }

  minimizeWindow() {
    if (this.isNativeHost) {
      this.postMessage({
        type: 'minimize'
      });
    }
  }

  closeWindow() {
    if (this.isNativeHost) {
      this.postMessage({
        type: 'close'
      });
    } else {
      window.close();
    }
  }

  triggerSystemSound() {
    if (this.isNativeHost) {
      this.postMessage({
        type: 'play_sound'
      });
    }
  }

  setDnd(enabled) {
    if (this.isNativeHost) {
      this.postMessage({
        type: 'set_dnd',
        enabled: !!enabled
      });
    }
  }

  updateTimerStatus(data) {
    if (this.isNativeHost) {
      this.postMessage({
        type: 'timer_status',
        phase: data.phase,
        formattedTime: data.formattedTime,
        isRunning: !!data.isRunning
      });
    }
  }

  updateCloseToTray(closeToTray) {
    if (this.isNativeHost) {
      this.postMessage({
        type: 'set_close_to_tray',
        closeToTray: !!closeToTray
      });
    }
  }
}
