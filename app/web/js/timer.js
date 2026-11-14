/**
 * Timer Engine
 * Absolute drift-free, timestamp-calibrated countdown timer.
 */

export class PomodoroTimer {
  constructor(options = {}) {
    this.durations = {
      focus: (options.focusMinutes || 25) * 60,
      shortBreak: (options.shortBreakMinutes || 5) * 60,
      longBreak: (options.longBreakMinutes || 15) * 60,
    };

    this.cyclesBeforeLongBreak = options.cyclesBeforeLongBreak || 4;

    this.currentPhase = 'focus'; // 'focus' | 'shortBreak' | 'longBreak'
    this.status = 'idle'; // 'idle' | 'running' | 'paused'
    this.completedFocusSessionsInCycle = 0;

    this.remainingSeconds = this.durations.focus;
    this.totalSeconds = this.durations.focus;

    this.endTime = null;
    this.timerId = null;

    // Callbacks
    this.onTick = options.onTick || (() => {});
    this.onPhaseComplete = options.onPhaseComplete || (() => {});
    this.onStateChange = options.onStateChange || (() => {});
  }

  setDurations(config) {
    if (config.focusMinutes) this.durations.focus = Math.max(1, config.focusMinutes) * 60;
    if (config.shortBreakMinutes) this.durations.shortBreak = Math.max(1, config.shortBreakMinutes) * 60;
    if (config.longBreakMinutes) this.durations.longBreak = Math.max(1, config.longBreakMinutes) * 60;
    if (config.cyclesBeforeLongBreak) this.cyclesBeforeLongBreak = Math.max(1, config.cyclesBeforeLongBreak);

    // If idle, refresh current remaining seconds
    if (this.status === 'idle') {
      this.totalSeconds = this.durations[this.currentPhase];
      this.remainingSeconds = this.totalSeconds;
      this.emitTick();
    }
  }

  setPhase(phase) {
    if (!this.durations[phase]) return;
    clearInterval(this.timerId);
    this.timerId = null;
    this.currentPhase = phase;
    this.status = 'idle';
    this.totalSeconds = this.durations[phase];
    this.remainingSeconds = this.totalSeconds;
    this.endTime = null;

    this.emitStateChange();
    this.emitTick();
  }

  start() {
    if (this.status === 'running') return;

    if (this.status === 'idle') {
      this.totalSeconds = this.durations[this.currentPhase];
      this.remainingSeconds = this.totalSeconds;
    }

    this.endTime = Date.now() + (this.remainingSeconds * 1000);
    this.status = 'running';

    this.emitStateChange();
    this.emitTick();

    clearInterval(this.timerId);
    this.timerId = setInterval(() => this.step(), 200);
  }

  pause() {
    if (this.status !== 'running') return;

    clearInterval(this.timerId);
    this.timerId = null;

    // Recalculate remaining seconds precisely before pausing
    const now = Date.now();
    this.remainingSeconds = Math.max(0, Math.ceil((this.endTime - now) / 1000));
    this.status = 'paused';
    this.endTime = null;

    this.emitStateChange();
    this.emitTick();
  }

  toggle() {
    if (this.status === 'running') {
      this.pause();
    } else {
      this.start();
    }
  }

  reset() {
    clearInterval(this.timerId);
    this.timerId = null;
    this.status = 'idle';
    this.endTime = null;
    this.totalSeconds = this.durations[this.currentPhase];
    this.remainingSeconds = this.totalSeconds;

    this.emitStateChange();
    this.emitTick();
  }

  skip() {
    this.handleIntervalFinished(true);
  }

  addMinutes(minutes = 5) {
    const extraSeconds = Math.max(1, minutes) * 60;
    this.totalSeconds += extraSeconds;
    this.remainingSeconds += extraSeconds;
    if (this.status === 'running') {
      this.endTime += extraSeconds * 1000;
    }
    this.emitTick();
  }

  step() {
    if (this.status !== 'running') return;

    const now = Date.now();
    const diff = Math.ceil((this.endTime - now) / 1000);

    if (diff <= 0) {
      this.remainingSeconds = 0;
      this.emitTick();
      this.handleIntervalFinished(false);
    } else {
      if (diff !== this.remainingSeconds) {
        this.remainingSeconds = diff;
        this.emitTick();
      }
    }
  }

  handleIntervalFinished(isSkipped = false) {
    clearInterval(this.timerId);
    this.timerId = null;

    const finishedPhase = this.currentPhase;
    let nextPhase = 'focus';

    if (finishedPhase === 'focus') {
      if (!isSkipped) {
        this.completedFocusSessionsInCycle += 1;
      }

      if (this.completedFocusSessionsInCycle >= this.cyclesBeforeLongBreak) {
        nextPhase = 'longBreak';
      } else {
        nextPhase = 'shortBreak';
      }
    } else if (finishedPhase === 'longBreak') {
      // Finished long break -> start brand new cycle
      this.completedFocusSessionsInCycle = 0;
      nextPhase = 'focus';
    } else {
      // Finished short break, next is focus
      nextPhase = 'focus';
    }

    this.status = 'idle';
    const completedInfo = {
      finishedPhase,
      nextPhase,
      isSkipped,
      cycleCount: this.completedFocusSessionsInCycle,
      targetCycles: this.cyclesBeforeLongBreak,
      durationMinutes: Math.round(this.totalSeconds / 60)
    };

    // Transition to next phase
    this.currentPhase = nextPhase;
    this.totalSeconds = this.durations[nextPhase];
    this.remainingSeconds = this.totalSeconds;
    this.endTime = null;

    this.onPhaseComplete(completedInfo);
    this.emitStateChange();
    this.emitTick();
  }

  emitTick() {
    const minutes = Math.floor(this.remainingSeconds / 60);
    const seconds = this.remainingSeconds % 60;
    const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    const progress = this.totalSeconds > 0 
      ? Math.max(0, Math.min(1, (this.totalSeconds - this.remainingSeconds) / this.totalSeconds)) 
      : 0;

    this.onTick({
      remainingSeconds: this.remainingSeconds,
      totalSeconds: this.totalSeconds,
      progress,
      formattedTime: formatted,
      phase: this.currentPhase,
      cycleCount: this.completedFocusSessionsInCycle,
      targetCycles: this.cyclesBeforeLongBreak
    });
  }

  emitStateChange() {
    this.onStateChange({
      status: this.status,
      phase: this.currentPhase,
      cycleCount: this.completedFocusSessionsInCycle,
      targetCycles: this.cyclesBeforeLongBreak
    });
  }
}
