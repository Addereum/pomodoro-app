/**
 * Settings Manager
 * Persists customizable preferences and configurations.
 */

const SETTINGS_STORAGE_KEY = 'pomodoro_user_settings';

export const DEFAULT_SETTINGS = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  cyclesBeforeLongBreak: 4,
  dailyTarget: 6,
  autoStartBreaks: false,
  autoStartFocus: false,
  soundType: 'bell',
  soundVolume: 80,
  ambientSound: 'none',
  ambientVolume: 50,
  desktopNotifications: true,
  autoDnd: true,
  closeToTray: true,
  keepScreenOn: false,
  customSoundName: '',
  theme: 'dark' // 'dark' | 'light' | 'system'
};

export class SettingsManager {
  constructor() {
    this.settings = { ...DEFAULT_SETTINGS };
    this.onUpdate = () => {};
    this.load();
  }

  load() {
    try {
      const data = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (data) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
      }
    } catch (e) {
      console.error('Failed to parse settings, using defaults', e);
      this.settings = { ...DEFAULT_SETTINGS };
    }
    this.applyTheme(this.settings.theme);
  }

  save(newSettings) {
    this.settings = {
      ...this.settings,
      ...newSettings,
      focusMinutes: Math.max(1, Math.min(90, parseInt(newSettings.focusMinutes, 10) || 25)),
      shortBreakMinutes: Math.max(1, Math.min(30, parseInt(newSettings.shortBreakMinutes, 10) || 5)),
      longBreakMinutes: Math.max(1, Math.min(60, parseInt(newSettings.longBreakMinutes, 10) || 15)),
      cyclesBeforeLongBreak: Math.max(1, Math.min(10, parseInt(newSettings.cyclesBeforeLongBreak, 10) || 4)),
      dailyTarget: Math.max(1, Math.min(30, parseInt(newSettings.dailyTarget, 10) || 6)),
      ambientSound: newSettings.ambientSound || 'none',
      ambientVolume: Math.max(0, Math.min(100, parseInt(newSettings.ambientVolume, 10) || 50)),
      soundVolume: Math.max(0, Math.min(100, parseInt(newSettings.soundVolume, 10) || 80))
    };

    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.settings));
    } catch (e) {
      console.error('Failed to save settings', e);
    }

    this.applyTheme(this.settings.theme);
    this.onUpdate(this.settings);
  }

  resetToDefaults() {
    this.save({ ...DEFAULT_SETTINGS });
  }

  applyTheme(theme) {
    const isDark = theme === 'system'
      ? window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      : theme === 'dark';

    if (isDark) {
      document.body.classList.remove('theme-light');
      document.body.classList.add('theme-dark');
    } else {
      document.body.classList.remove('theme-dark');
      document.body.classList.add('theme-light');
    }
  }

  get() {
    return { ...this.settings };
  }
}
