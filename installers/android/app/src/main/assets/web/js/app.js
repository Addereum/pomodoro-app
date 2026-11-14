/**
 * Pomodoro Main Application Controller
 */

import { PomodoroTimer } from './timer.js';
import { SoundManager } from './audio.js';
import { AmbientSoundManager } from './ambient.js';
import { TaskManager } from './tasks.js';
import { StatsTracker } from './stats.js';
import { SettingsManager } from './settings.js';
import { DesktopBridge } from './bridge.js';

class App {
  constructor() {
    this.CIRCUMFERENCE = 2 * Math.PI * 120; // 753.982px

    this.settings = new SettingsManager();
    const config = this.settings.get();

    this.sound = new SoundManager({
      soundType: config.soundType,
      volume: config.soundVolume
    });

    this.ambient = new AmbientSoundManager({
      soundType: config.ambientSound,
      volume: config.ambientVolume
    });

    this.tasks = new TaskManager();
    this.stats = new StatsTracker();
    this.bridge = new DesktopBridge();

    this.timer = new PomodoroTimer({
      focusMinutes: config.focusMinutes,
      shortBreakMinutes: config.shortBreakMinutes,
      longBreakMinutes: config.longBreakMinutes,
      cyclesBeforeLongBreak: config.cyclesBeforeLongBreak,
      onTick: (data) => this.handleTimerTick(data),
      onPhaseComplete: (data) => this.handlePhaseComplete(data),
      onStateChange: (data) => this.handleTimerStateChange(data)
    });

    this.taskFilter = 'all';
    this.isCompactMode = false;
    this.lastCompletedSession = null;

    this.initDOM();
    this.bindEvents();
    this.refreshAll();
  }

  initDOM() {
    // Navigation & Tabs
    this.navBtns = document.querySelectorAll('.nav-btn');
    this.tabPanes = document.querySelectorAll('.tab-pane');
    this.taskBadge = document.getElementById('task-badge');

    // Compact Mode View Elements
    this.compactView = document.getElementById('compact-view');
    this.compactPhase = document.getElementById('compact-phase');
    this.compactTime = document.getElementById('compact-time');
    this.compactToggle = document.getElementById('compact-toggle');
    this.compactIconPlay = document.getElementById('compact-icon-play');
    this.compactIconPause = document.getElementById('compact-icon-pause');
    this.compactAddTime = document.getElementById('compact-add-time');
    this.compactSkip = document.getElementById('compact-skip');

    // Daily Goal Bar
    this.dailyGoalBar = document.getElementById('daily-goal-bar');
    this.dailyGoalCount = document.getElementById('daily-goal-count');
    this.dailyGoalFill = document.getElementById('daily-goal-fill');

    // Timer Elements
    this.modePills = document.querySelectorAll('.mode-pill');
    this.timerProgress = document.getElementById('timer-progress');
    this.timerDisplay = document.getElementById('timer-display');
    this.timerModeLabel = document.getElementById('timer-mode-label');
    this.cycleIndicator = document.getElementById('cycle-indicator');
    this.cycleCountText = document.getElementById('cycle-count-text');

    this.btnToggle = document.getElementById('btn-toggle');
    this.btnToggleLabel = document.getElementById('btn-toggle-label');
    this.iconPlay = document.getElementById('icon-play');
    this.iconPause = document.getElementById('icon-pause');
    this.btnReset = document.getElementById('btn-reset');
    this.btnSkip = document.getElementById('btn-skip');
    this.btnAddTime = document.getElementById('btn-add-time');

    // Ambient Sound Bar Elements
    this.timerAmbientSelect = document.getElementById('timer-ambient-select');
    this.timerAmbientVolume = document.getElementById('timer-ambient-volume');

    // Active Task Banner
    this.activeTaskBanner = document.getElementById('active-task-banner');
    this.activeTaskLabel = document.getElementById('active-task-label');
    this.btnClearActiveTask = document.getElementById('clear-active-task-btn');

    // Quick Summary Bar
    this.quickTodayCount = document.getElementById('quick-today-count');
    this.quickTodayMins = document.getElementById('quick-today-mins');
    this.quickStreak = document.getElementById('quick-streak');

    // Tasks Elements
    this.taskForm = document.getElementById('task-form');
    this.taskInput = document.getElementById('task-input');
    this.taskEstInput = document.getElementById('task-est-input');
    this.taskList = document.getElementById('task-list');
    this.taskEmptyState = document.getElementById('task-empty-state');
    this.filterPills = document.querySelectorAll('.filter-pill');
    this.btnClearCompleted = document.getElementById('btn-clear-completed');

    // Stats Elements
    this.kpiTodayCount = document.getElementById('kpi-today-count');
    this.kpiTodayHours = document.getElementById('kpi-today-hours');
    this.kpiStreak = document.getElementById('kpi-streak');
    this.kpiTotalHours = document.getElementById('kpi-total-hours');
    this.barChart = document.getElementById('bar-chart');
    this.historyList = document.getElementById('history-list');
    this.btnResetStats = document.getElementById('btn-reset-stats');
    this.btnExportCsv = document.getElementById('btn-export-csv');
    this.btnExportJson = document.getElementById('btn-export-json');
    this.btnExportMarkdown = document.getElementById('btn-export-markdown');

    // Settings Elements
    this.settingsForm = document.getElementById('settings-form');
    this.inputFocusTime = document.getElementById('setting-focus-time');
    this.inputShortBreak = document.getElementById('setting-short-break');
    this.inputLongBreak = document.getElementById('setting-long-break');
    this.inputCycleTarget = document.getElementById('setting-cycle-target');
    this.inputDailyTarget = document.getElementById('setting-daily-target');
    this.settingAmbientType = document.getElementById('setting-ambient-type');
    this.settingAmbientVolume = document.getElementById('setting-ambient-volume');
    this.ambientVolumeLabel = document.getElementById('ambient-volume-label');
    this.inputAutoBreak = document.getElementById('setting-auto-break');
    this.inputAutoFocus = document.getElementById('setting-auto-focus');
    this.selectSoundType = document.getElementById('setting-sound-type');
    this.btnTestSound = document.getElementById('btn-test-sound');
    this.sliderSoundVolume = document.getElementById('setting-sound-volume');
    this.volumeLabel = document.getElementById('volume-label');
    this.inputNotifyDesktop = document.getElementById('setting-notify-desktop');
    this.inputAutoDnd = document.getElementById('setting-auto-dnd');
    this.inputCloseToTray = document.getElementById('setting-close-to-tray');
    this.selectTheme = document.getElementById('setting-theme');
    this.btnDefaults = document.getElementById('btn-defaults');

    // Session Note Modal
    this.noteModal = document.getElementById('note-modal');
    this.sessionNoteInput = document.getElementById('session-note-input');
    this.btnSaveNote = document.getElementById('btn-save-note');
    this.btnSkipNote = document.getElementById('btn-skip-note');

    // Toast Container
    this.toastContainer = document.getElementById('toast-container');

    // Setup SVG stroke dasharray
    this.timerProgress.style.strokeDasharray = this.CIRCUMFERENCE;
    this.timerProgress.style.strokeDashoffset = 0;
  }

  bindEvents() {
    // Navigation Tabs
    this.navBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.switchTab(btn.dataset.tab);
      });
    });

    // Compact Mode Controls
    if (this.compactToggle) {
      this.compactToggle.addEventListener('click', () => this.timer.toggle());
    }
    if (this.compactAddTime) {
      this.compactAddTime.addEventListener('click', () => {
        this.timer.addMinutes(5);
        this.showToast('+5 Minuten hinzugefügt');
      });
    }
    if (this.compactSkip) {
      this.compactSkip.addEventListener('click', async () => {
        const confirmed = await this.showConfirm({
          title: 'Phase überspringen?',
          message: 'Möchtest du zur nächsten Phase wechseln?',
          confirmText: 'Überspringen',
          cancelText: 'Abbrechen',
          icon: '⏭️'
        });
        if (confirmed) {
          this.timer.skip();
        }
      });
    }

    // Timer Controls
    this.btnToggle.addEventListener('click', () => this.timer.toggle());
    this.btnReset.addEventListener('click', () => this.timer.reset());
    this.btnSkip.addEventListener('click', async () => {
      const confirmed = await this.showConfirm({
        title: 'Phase überspringen?',
        message: 'Möchtest du die laufende Zeit vorzeitig beenden und zur nächsten Phase wechseln?',
        confirmText: 'Überspringen',
        cancelText: 'Abbrechen',
        icon: '⏭️'
      });
      if (confirmed) {
        this.timer.skip();
      }
    });

    // Add +5 Minutes Button
    if (this.btnAddTime) {
      this.btnAddTime.addEventListener('click', () => {
        this.timer.addMinutes(5);
        this.showToast('+5 Minuten hinzugefügt');
      });
    }

    // Ambient Sound Bar
    if (this.timerAmbientSelect) {
      this.timerAmbientSelect.addEventListener('change', (e) => {
        const type = e.target.value;
        this.ambient.setSoundType(type);
        this.settingAmbientType.value = type;
        if (this.timer.status === 'running' && this.timer.currentPhase === 'focus') {
          this.ambient.start();
        }
      });
    }
    if (this.timerAmbientVolume) {
      this.timerAmbientVolume.addEventListener('input', (e) => {
        const vol = parseInt(e.target.value, 10);
        this.ambient.setVolume(vol);
        this.settingAmbientVolume.value = vol;
        this.ambientVolumeLabel.textContent = `${vol}%`;
      });
    }

    // Mode Switcher
    this.modePills.forEach(pill => {
      pill.addEventListener('click', () => {
        const mode = pill.dataset.mode;
        this.timer.setPhase(mode);
      });
    });

    // Active Task Banner (Clicking opens Tasks Tab)
    this.activeTaskBanner.addEventListener('click', (e) => {
      if (e.target !== this.btnClearActiveTask) {
        this.switchTab('tasks');
      }
    });

    // Clear Active Task Banner
    this.btnClearActiveTask.addEventListener('click', (e) => {
      e.stopPropagation();
      this.tasks.setActive(null);
      this.refreshActiveTaskUI();
      this.showToast('Aufgaben-Fokus aufgehoben');
    });

    // Task Form
    this.taskForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = this.taskInput.value;
      const est = parseInt(this.taskEstInput.value, 10) || 2;
      if (this.tasks.add(title, est)) {
        this.taskInput.value = '';
        this.taskEstInput.value = '2';
        this.renderTasks();
        this.refreshActiveTaskUI();
        this.showToast('Aufgabe hinzugefügt');
      }
    });

    // Task Filters
    this.filterPills.forEach(pill => {
      pill.addEventListener('click', () => {
        this.filterPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.taskFilter = pill.dataset.filter;
        this.renderTasks();
      });
    });

    // Clear Completed Tasks
    this.btnClearCompleted.addEventListener('click', () => {
      this.tasks.clearCompleted();
      this.renderTasks();
      this.showToast('Erledigte Aufgaben gelöscht');
    });

    // Task Model change callback
    this.tasks.onChange = () => {
      this.renderTasks();
      this.refreshActiveTaskUI();
    };

    // Stats Reset
    this.btnResetStats.addEventListener('click', async () => {
      const confirmed = await this.showConfirm({
        title: 'Statistik zurücksetzen?',
        message: 'Möchtest du wirklich alle aufgezeichneten Sessions, Zyklen und Streaks unwiderruflich löschen?',
        confirmText: 'Alles löschen',
        cancelText: 'Abbrechen',
        isDanger: true,
        icon: '🗑️'
      });
      if (confirmed) {
        this.stats.clearStats();
        this.renderStats();
        this.refreshQuickSummary();
        this.showToast('Statistik erfolgreich zurückgesetzt');
      }
    });

    // CSV & JSON Export
    if (this.btnExportCsv) {
      this.btnExportCsv.addEventListener('click', () => {
        if (!this.stats.hasLogs()) {
          this.showToast('ℹ️ Keine Sessions zum Exportieren vorhanden.');
          return;
        }
        this.stats.exportCSV();
        this.showToast('📥 CSV-Export heruntergeladen');
      });
    }
    if (this.btnExportJson) {
      this.btnExportJson.addEventListener('click', () => {
        if (!this.stats.hasLogs()) {
          this.showToast('ℹ️ Keine Sessions zum Exportieren vorhanden.');
          return;
        }
        this.stats.exportJSON();
        this.showToast('📥 JSON-Export heruntergeladen');
      });
    }

    // Markdown / Standup Report Export
    if (this.btnExportMarkdown) {
      this.btnExportMarkdown.addEventListener('click', () => {
        const md = this.stats.generateMarkdownReport(this.tasks.getTasks());
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(md)
            .then(() => {
              this.showToast('📋 Standup-Bericht in Zwischenablage kopiert!');
            })
            .catch(() => {
              this.downloadMarkdownFile(md);
            });
        } else {
          this.downloadMarkdownFile(md);
        }
      });
    }

    // Session Note Modal Handlers
    if (this.btnSaveNote) {
      this.btnSaveNote.addEventListener('click', () => {
        const note = (this.sessionNoteInput.value || '').trim();
        if (this.lastCompletedSession && note) {
          this.stats.updateNote(this.lastCompletedSession.id, note);
          this.renderStats();
          this.showToast('Session-Notiz gespeichert');
        }
        this.noteModal.style.display = 'none';
      });
    }
    if (this.btnSkipNote) {
      this.btnSkipNote.addEventListener('click', () => {
        this.noteModal.style.display = 'none';
      });
    }

    // Settings Updates
    this.settingsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveSettingsFromForm();
      this.showToast('Einstellungen gespeichert');
    });

    this.btnDefaults.addEventListener('click', async () => {
      const confirmed = await this.showConfirm({
        title: 'Standardwerte wiederherstellen?',
        message: 'Alle Intervalle, Benachrichtigungen und Audio-Optionen auf Standardwerte zurücksetzen?',
        confirmText: 'Zurücksetzen',
        cancelText: 'Abbrechen',
        isDanger: true,
        icon: '🔄'
      });
      if (confirmed) {
        this.settings.resetToDefaults();
        this.populateSettingsForm();
        this.showToast('Standardwerte wiederhergestellt');
      }
    });

    this.btnTestSound.addEventListener('click', () => {
      const type = this.selectSoundType.value;
      this.sound.setVolume(parseInt(this.sliderSoundVolume.value, 10));
      this.sound.play(type);
    });

    this.sliderSoundVolume.addEventListener('input', (e) => {
      this.volumeLabel.textContent = `${e.target.value}%`;
      this.sound.setVolume(parseInt(e.target.value, 10));
    });

    this.settingAmbientVolume.addEventListener('input', (e) => {
      const vol = parseInt(e.target.value, 10);
      this.ambientVolumeLabel.textContent = `${vol}%`;
      this.ambient.setVolume(vol);
      this.timerAmbientVolume.value = vol;
    });

    this.settingAmbientType.addEventListener('change', (e) => {
      const type = e.target.value;
      this.ambient.setSoundType(type);
      this.timerAmbientSelect.value = type;
      if (this.timer.status === 'running' && this.timer.currentPhase === 'focus') {
        this.ambient.start();
      }
    });

    this.settings.onUpdate = (cfg) => {
      this.timer.setDurations({
        focusMinutes: cfg.focusMinutes,
        shortBreakMinutes: cfg.shortBreakMinutes,
        longBreakMinutes: cfg.longBreakMinutes,
        cyclesBeforeLongBreak: cfg.cyclesBeforeLongBreak
      });
      this.sound.setSoundType(cfg.soundType);
      this.sound.setVolume(cfg.soundVolume);
      this.ambient.setSoundType(cfg.ambientSound);
      this.ambient.setVolume(cfg.ambientVolume);
      this.refreshQuickSummary();
    };

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      // Ignore if typing in an input field
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        this.timer.toggle();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        this.timer.reset();
        this.showToast('Timer zurückgesetzt');
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        this.timer.skip();
      } else if (e.key === '1') {
        this.switchTab('timer');
      } else if (e.key === '2') {
        this.switchTab('tasks');
      } else if (e.key === '3') {
        this.switchTab('stats');
      } else if (e.key === '4') {
        this.switchTab('settings');
      } else if (e.key === 'f' || e.key === 'F') {
        this.timer.setPhase('focus');
      } else if (e.key === 'k' || e.key === 'K') {
        this.timer.setPhase('shortBreak');
      } else if (e.key === 'l' || e.key === 'L') {
        this.timer.setPhase('longBreak');
      }
    });
  }

  toggleCompactMode(forcedState = null, notifyNative = true) {
    const targetState = forcedState !== null ? forcedState : !this.isCompactMode;
    if (this.isCompactMode === targetState) {
      return; // Break recursion feedback loop
    }

    this.isCompactMode = targetState;
    document.body.classList.toggle('compact-mode', this.isCompactMode);

    if (notifyNative) {
      this.bridge.toggleCompact(this.isCompactMode);
    }
  }

  switchTab(tabId) {
    if (this.isCompactMode) {
      this.toggleCompactMode(false, true);
    }

    this.navBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    this.tabPanes.forEach(pane => {
      pane.classList.toggle('active', pane.id === `tab-${tabId}`);
    });

    if (tabId === 'stats') {
      this.renderStats();
    } else if (tabId === 'tasks') {
      this.renderTasks();
    } else if (tabId === 'settings') {
      this.populateSettingsForm();
    }
  }

  handleTimerTick(data) {
    // 1. Text Time Display
    this.timerDisplay.textContent = data.formattedTime;
    if (this.compactTime) {
      this.compactTime.textContent = data.formattedTime;
    }

    // 2. SVG Circular Progress
    const offset = this.CIRCUMFERENCE * (1 - data.progress);
    this.timerProgress.style.strokeDashoffset = offset;

    // 3. Document / Window Title & Bridge Status
    const phaseNames = { focus: 'Fokus', shortBreak: 'Kurze Pause', longBreak: 'Lange Pause' };
    const phaseLabel = phaseNames[data.phase] || 'Fokus';
    this.bridge.updateTitle(`(${data.formattedTime}) ${phaseLabel} - Addereums Pomodoro`);
    this.bridge.updateTimerStatus({
      phase: data.phase,
      formattedTime: data.formattedTime,
      isRunning: this.timer.isRunning
    });
  }

  handleTimerStateChange(data) {
    // Phase styling on body
    document.body.dataset.phase = data.phase;

    // Mode pills state
    this.modePills.forEach(pill => {
      pill.classList.toggle('active', pill.dataset.mode === data.phase);
    });

    // Phase labels
    const labels = {
      focus: 'Fokus',
      shortBreak: 'Kurze Pause',
      longBreak: 'Lange Pause'
    };
    const phaseText = labels[data.phase] || 'Fokus';
    this.timerModeLabel.textContent = phaseText;
    if (this.compactPhase) {
      this.compactPhase.textContent = phaseText;
    }

    // Play/Pause button icons & labels
    const isRunning = data.status === 'running';
    this.iconPlay.style.display = isRunning ? 'none' : 'block';
    this.iconPause.style.display = isRunning ? 'block' : 'none';
    this.btnToggleLabel.textContent = isRunning ? 'Pause' : (data.status === 'paused' ? 'Weiter' : 'Starten');

    // 🔕 Automatischer Nicht-Stören-Modus (DND)
    if (this.settings.get().autoDnd) {
      this.bridge.setDnd(data.phase === 'focus' && isRunning);
    }

    // Compact Play/Pause icons
    if (this.compactIconPlay && this.compactIconPause) {
      this.compactIconPlay.style.display = isRunning ? 'none' : 'block';
      this.compactIconPause.style.display = isRunning ? 'block' : 'none';
    }

    // Ambient Sound Auto-Play/Pause
    if (isRunning && data.phase === 'focus') {
      this.ambient.start();
    } else {
      this.ambient.stop();
    }

    // Cycle dots
    this.renderCycleDots(data.cycleCount, data.targetCycles, data.phase);
  }

  renderCycleDots(currentCount, targetCycles, phase = 'focus') {
    this.cycleIndicator.innerHTML = '';
    for (let i = 0; i < targetCycles; i++) {
      const dot = document.createElement('span');
      dot.className = 'cycle-dot';
      if (phase === 'longBreak') {
        dot.classList.add('completed');
      } else if (i < currentCount) {
        dot.classList.add('completed');
      } else if (i === currentCount) {
        dot.classList.add('active');
      }
      this.cycleIndicator.appendChild(dot);
    }

    if (phase === 'longBreak') {
      this.cycleCountText.textContent = `${targetCycles} von ${targetCycles} geschafft – Zeit für die lange Pause!`;
    } else {
      this.cycleCountText.textContent = `Runde ${Math.min(currentCount + 1, targetCycles)} von ${targetCycles}`;
    }
  }

  handlePhaseComplete(info) {
    const cfg = this.settings.get();
    const activeTask = this.tasks.getActive();

    // Stop ambient sound
    this.ambient.stop();

    if (info.finishedPhase === 'focus' && !info.isSkipped) {
      // 1. Record stats
      this.lastCompletedSession = this.stats.recordSession({
        phase: 'focus',
        durationMinutes: info.durationMinutes,
        taskTitle: activeTask ? activeTask.title : null
      });

      // 2. Increment active task progress
      if (activeTask) {
        this.tasks.incrementActivePomodoro();
      }

      this.refreshQuickSummary();

      // 3. Show Reflection Note Modal (non-blocking)
      if (this.noteModal) {
        this.sessionNoteInput.value = '';
        this.noteModal.style.display = 'flex';
        setTimeout(() => this.sessionNoteInput.focus(), 100);
      }
    }

    // 4. Audio notification
    this.sound.play();

    // 5. Desktop Notification
    if (cfg.desktopNotifications) {
      if (info.finishedPhase === 'focus') {
        const nextBreakType = info.nextPhase === 'longBreak' ? 'lange Pause' : 'kurze Pause';
        const taskInfo = activeTask ? ` zu "${activeTask.title}"` : '';
        this.bridge.sendNotification(
          '🎉 Fokus-Session abgeschlossen!',
          `Gut gemacht! Zeit für eine ${nextBreakType}.${taskInfo}`
        );
      } else {
        this.bridge.sendNotification(
          '⏰ Pause beendet!',
          'Bereit für den nächsten Fokus-Block? Weiter geht\'s!'
        );
      }
    }

    this.showToast(info.finishedPhase === 'focus' ? 'Fokus-Block abgeschlossen!' : 'Pause beendet!');

    // 6. Auto-start handling
    if (info.nextPhase === 'focus' && cfg.autoStartFocus) {
      setTimeout(() => this.timer.start(), 1000);
    } else if (info.nextPhase !== 'focus' && cfg.autoStartBreaks) {
      setTimeout(() => this.timer.start(), 1000);
    }
  }

  refreshActiveTaskUI() {
    const active = this.tasks.getActive();
    if (active) {
      this.activeTaskBanner.classList.add('has-task');
      this.activeTaskLabel.textContent = `Fokus: ${active.title} (${active.completedPomodoros}/${active.estimatedPomodoros} 🍅)`;
      this.btnClearActiveTask.style.display = 'block';
    } else {
      this.activeTaskBanner.classList.remove('has-task');
      this.activeTaskLabel.textContent = 'Keine Aufgabe gewählt (Klicke auf eine Aufgabe zum Verknüpfen)';
      this.btnClearActiveTask.style.display = 'none';
    }
  }

  renderTasks() {
    const list = this.tasks.getFiltered(this.taskFilter);
    const activeTask = this.tasks.getActive();
    this.taskList.innerHTML = '';

    const pendingCount = this.tasks.getPendingCount();
    if (pendingCount > 0) {
      this.taskBadge.textContent = pendingCount;
      this.taskBadge.style.display = 'inline-block';
    } else {
      this.taskBadge.style.display = 'none';
    }

    if (list.length === 0) {
      this.taskEmptyState.style.display = 'block';
      return;
    }
    this.taskEmptyState.style.display = 'none';

    list.forEach(task => {
      const li = document.createElement('li');
      li.className = 'task-item';
      if (task.completed) li.classList.add('completed');
      if (activeTask && activeTask.id === task.id) li.classList.add('active-target');

      li.innerHTML = `
        <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} title="Erledigt abhaken">
        <div class="task-details" title="Klicken um als Fokus-Ziel auszuwählen">
          <span class="task-title">${this.escapeHtml(task.title)}</span>
          <div class="task-progress-chips">
            <span>🍅 ${task.completedPomodoros} / ${task.estimatedPomodoros} Pomodoros</span>
            ${activeTask && activeTask.id === task.id ? '<span class="task-target-badge">Aktiv</span>' : ''}
          </div>
        </div>
        <div class="task-actions">
          <button class="task-btn delete" title="Aufgabe löschen">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
            </svg>
          </button>
        </div>
      `;

      // Event Listeners for Task item
      const checkbox = li.querySelector('.task-checkbox');
      checkbox.addEventListener('change', () => {
        this.tasks.toggle(task.id);
      });

      const details = li.querySelector('.task-details');
      details.addEventListener('click', () => {
        if (!task.completed) {
          this.tasks.setActive(task.id);
          this.showToast(`Aufgabe "${task.title}" als Fokus gewählt`);
        }
      });

      const btnDelete = li.querySelector('.task-btn.delete');
      btnDelete.addEventListener('click', (e) => {
        e.stopPropagation();
        this.tasks.delete(task.id);
      });

      this.taskList.appendChild(li);
    });
  }

  renderStats() {
    const today = this.stats.getTodayStats();
    const allTime = this.stats.getAllTimeStats();
    const streak = this.stats.getStreakDays();

    // KPIs
    this.kpiTodayCount.textContent = today.count;
    const todayHours = Math.floor(today.minutes / 60);
    const todayMinsRem = today.minutes % 60;
    this.kpiTodayHours.textContent = `${todayHours}h ${todayMinsRem}m`;

    this.kpiStreak.textContent = streak;

    const totalHours = Math.floor(allTime.minutes / 60);
    const totalMinsRem = allTime.minutes % 60;
    this.kpiTotalHours.textContent = `${totalHours}h ${totalMinsRem}m`;

    // 7-day Bar Chart
    this.stats.renderChart(this.barChart);

    // Recent History
    const history = this.stats.getRecentSessions(14);
    this.historyList.innerHTML = '';
    if (history.length === 0) {
      this.historyList.innerHTML = '<li class="empty-state" style="padding: 12px;">Noch keine Sessions abgeschlossen. Starte deinen ersten Fokus-Timer!</li>';
    } else {
      history.forEach(item => {
        const d = new Date(item.timestamp);
        const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        const dateStr = `${d.getDate()}.${d.getMonth() + 1}.`;
        const taskInfo = item.taskTitle ? ` – ${this.escapeHtml(item.taskTitle)}` : '';
        const noteBadge = item.note ? `<div class="history-note-badge">📝 ${this.escapeHtml(item.note)}</div>` : '';

        const li = document.createElement('li');
        li.className = 'history-item';
        li.innerHTML = `
          <div class="history-left">
            <span class="history-dot"></span>
            <div class="history-item-content">
              <span>Fokus-Block (${item.durationMinutes} Min.)${taskInfo}</span>
              ${noteBadge}
            </div>
          </div>
          <span class="history-time">${dateStr} ${timeStr}</span>
        `;
        this.historyList.appendChild(li);
      });
    }
  }

  refreshQuickSummary() {
    const today = this.stats.getTodayStats();
    const streak = this.stats.getStreakDays();
    const cfg = this.settings.get();

    // Quick summary
    this.quickTodayCount.textContent = today.count;
    const hours = Math.floor(today.minutes / 60);
    const mins = today.minutes % 60;
    this.quickTodayMins.textContent = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    this.quickStreak.textContent = `${streak} d`;

    // Daily Goal
    const target = cfg.dailyTarget || 6;
    const progressPercent = Math.min(100, Math.round((today.count / target) * 100));
    if (this.dailyGoalCount && this.dailyGoalFill) {
      this.dailyGoalCount.textContent = `${today.count} / ${target} (${progressPercent}%)`;
      this.dailyGoalFill.style.width = `${progressPercent}%`;
    }
  }

  populateSettingsForm() {
    const cfg = this.settings.get();
    this.inputFocusTime.value = cfg.focusMinutes;
    this.inputShortBreak.value = cfg.shortBreakMinutes;
    this.inputLongBreak.value = cfg.longBreakMinutes;
    this.inputCycleTarget.value = cfg.cyclesBeforeLongBreak;
    if (this.inputDailyTarget) {
      this.inputDailyTarget.value = cfg.dailyTarget || 6;
    }
    this.inputAutoBreak.checked = !!cfg.autoStartBreaks;
    this.inputAutoFocus.checked = !!cfg.autoStartFocus;
    this.selectSoundType.value = cfg.soundType;
    this.sliderSoundVolume.value = cfg.soundVolume;
    this.volumeLabel.textContent = `${cfg.soundVolume}%`;

    // Ambient settings
    if (this.settingAmbientType) {
      this.settingAmbientType.value = cfg.ambientSound || 'none';
    }
    if (this.settingAmbientVolume) {
      this.settingAmbientVolume.value = cfg.ambientVolume !== undefined ? cfg.ambientVolume : 50;
      this.ambientVolumeLabel.textContent = `${this.settingAmbientVolume.value}%`;
    }
    if (this.timerAmbientSelect) {
      this.timerAmbientSelect.value = cfg.ambientSound || 'none';
    }
    if (this.timerAmbientVolume) {
      this.timerAmbientVolume.value = cfg.ambientVolume !== undefined ? cfg.ambientVolume : 50;
    }

    this.inputNotifyDesktop.checked = !!cfg.desktopNotifications;
    if (this.inputAutoDnd) {
      this.inputAutoDnd.checked = cfg.autoDnd !== undefined ? !!cfg.autoDnd : true;
    }
    if (this.inputCloseToTray) {
      this.inputCloseToTray.checked = cfg.closeToTray !== undefined ? !!cfg.closeToTray : true;
    }
    this.selectTheme.value = cfg.theme;
  }

  saveSettingsFromForm() {
    const newSettings = {
      focusMinutes: parseInt(this.inputFocusTime.value, 10),
      shortBreakMinutes: parseInt(this.inputShortBreak.value, 10),
      longBreakMinutes: parseInt(this.inputLongBreak.value, 10),
      cyclesBeforeLongBreak: parseInt(this.inputCycleTarget.value, 10),
      dailyTarget: parseInt(this.inputDailyTarget.value, 10) || 6,
      ambientSound: this.settingAmbientType.value,
      ambientVolume: parseInt(this.settingAmbientVolume.value, 10),
      autoStartBreaks: this.inputAutoBreak.checked,
      autoStartFocus: this.inputAutoFocus.checked,
      soundType: this.selectSoundType.value,
      soundVolume: parseInt(this.sliderSoundVolume.value, 10),
      desktopNotifications: this.inputNotifyDesktop.checked,
      autoDnd: this.inputAutoDnd ? this.inputAutoDnd.checked : true,
      closeToTray: this.inputCloseToTray ? this.inputCloseToTray.checked : true,
      theme: this.selectTheme.value
    };

    this.settings.save(newSettings);
    this.bridge.updateCloseToTray(newSettings.closeToTray);
  }

  downloadMarkdownFile(content) {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pomodoro-standup-${this.stats.formatDateKey(new Date())}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    this.showToast('📥 Markdown-Bericht heruntergeladen');
  }

  /**
   * Modern in-app confirmation modal (replaces ugly browser confirm dialogs)
   * @param {Object} options
   * @param {string} options.title
   * @param {string} options.message
   * @param {string} [options.confirmText='OK']
   * @param {string} [options.cancelText='Abbrechen']
   * @param {boolean} [options.isDanger=false]
   * @param {string} [options.icon='⚠️']
   * @returns {Promise<boolean>}
   */
  showConfirm({
    title = 'Bestätigung erforderlich',
    message = 'Möchtest du diese Aktion durchführen?',
    confirmText = 'OK',
    cancelText = 'Abbrechen',
    isDanger = false,
    icon = '⚠️'
  } = {}) {
    return new Promise((resolve) => {
      const modal = document.getElementById('confirm-modal');
      const titleEl = document.getElementById('confirm-title');
      const messageEl = document.getElementById('confirm-message');
      const iconEl = document.getElementById('confirm-icon');
      const btnCancel = document.getElementById('btn-confirm-cancel');
      const btnOk = document.getElementById('btn-confirm-ok');

      if (!modal || !titleEl || !messageEl || !btnOk || !btnCancel) {
        resolve(window.confirm(message));
        return;
      }

      titleEl.textContent = title;
      messageEl.textContent = message;
      if (iconEl) {
        iconEl.textContent = icon;
        iconEl.className = 'confirm-icon-wrapper ' + (isDanger ? 'danger' : 'warning');
      }

      btnOk.textContent = confirmText;
      btnCancel.textContent = cancelText;

      if (isDanger) {
        btnOk.className = 'btn-action danger';
      } else {
        btnOk.className = 'btn-action primary';
      }

      let settled = false;
      const cleanup = (result) => {
        if (settled) return;
        settled = true;
        modal.style.display = 'none';
        btnOk.removeEventListener('click', onOk);
        btnCancel.removeEventListener('click', onCancel);
        window.removeEventListener('keydown', onKeyDown);
        resolve(result);
      };

      const onOk = () => cleanup(true);
      const onCancel = () => cleanup(false);
      const onKeyDown = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          cleanup(false);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          cleanup(true);
        }
      };

      btnOk.addEventListener('click', onOk);
      btnCancel.addEventListener('click', onCancel);
      window.addEventListener('keydown', onKeyDown);

      modal.style.display = 'flex';
      btnOk.focus();
    });
  }

  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>ℹ️</span> <span>${this.escapeHtml(message)}</span>`;
    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[m]);
  }

  refreshAll() {
    this.renderTasks();
    this.refreshActiveTaskUI();
    this.refreshQuickSummary();
    this.populateSettingsForm();
    this.bridge.updateCloseToTray(this.settings.get().closeToTray);
    this.timer.emitStateChange();
    this.timer.emitTick();
  }
}

// Instantiate application on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.pomodoroApp = new App();
});
