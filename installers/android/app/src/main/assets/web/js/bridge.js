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
    // 1. Android Notification Bar Bridge
    if (window.AndroidBridge && typeof window.AndroidBridge.updateTimerStatus === 'function') {
      try {
        window.AndroidBridge.updateTimerStatus(data.phase, data.formattedTime, !!data.isRunning);
      } catch (e) {
        console.warn('AndroidBridge error:', e);
      }
    }

    // 2. Desktop Native Host
    if (this.isNativeHost) {
      this.postMessage({
        type: 'timer_status',
        phase: data.phase,
        formattedTime: data.formattedTime,
        isRunning: !!data.isRunning
      });
    }
  }

  requestBatteryOptimization() {
    if (window.AndroidBridge && typeof window.AndroidBridge.requestBatteryOptimization === 'function') {
      try {
        window.AndroidBridge.requestBatteryOptimization();
      } catch (e) {
        console.warn('AndroidBridge battery error:', e);
      }
    }
  }

  setKeepScreenOn(enabled) {
    // 1. Native Android Bridge
    if (window.AndroidBridge && typeof window.AndroidBridge.setKeepScreenOn === 'function') {
      try {
        window.AndroidBridge.setKeepScreenOn(!!enabled);
      } catch (e) {
        console.warn('AndroidBridge keepScreenOn error:', e);
      }
    }

    // 2. Web Screen Wake Lock API (Desktop & Mobile Browser)
    if ('wakeLock' in navigator) {
      if (enabled) {
        if (!this.wakeLockSentinel) {
          navigator.wakeLock.request('screen').then(sentinel => {
            this.wakeLockSentinel = sentinel;
          }).catch(err => {
            console.warn('WakeLock request error:', err);
          });
        }
      } else {
        if (this.wakeLockSentinel) {
          this.wakeLockSentinel.release().catch(() => {});
          this.wakeLockSentinel = null;
        }
      }
    }
  }

  pickCustomAudioFile() {
    if (window.AndroidBridge && typeof window.AndroidBridge.pickCustomAudioFile === 'function') {
      try {
        window.AndroidBridge.pickCustomAudioFile();
        return true;
      } catch (e) {
        console.warn('AndroidBridge pickCustomAudioFile error:', e);
      }
    }
    return false;
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
