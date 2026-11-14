/**
 * Audio Synthesizer using Web Audio API
 * Generates soothing, high-definition sound cues completely offline.
 */

export class SoundManager {
  constructor(options = {}) {
    this.soundType = options.soundType || 'bell';
    this.volume = options.volume !== undefined ? options.volume / 100 : 0.8;
    this.audioCtx = null;
  }

  initContext() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  setSoundType(type) {
    this.soundType = type;
  }

  setVolume(volumePercent) {
    this.volume = Math.max(0, Math.min(100, volumePercent)) / 100;
  }

  play(type = null) {
    const selected = type || this.soundType;
    if (selected === 'none' || this.volume <= 0) return;

    try {
      this.initContext();
      if (!this.audioCtx) return;

      switch (selected) {
        case 'bell':
          this.playZenBell();
          break;
        case 'chime':
          this.playChime();
          break;
        case 'digital':
          this.playDigital();
          break;
        default:
          this.playZenBell();
      }
    } catch (e) {
      console.warn('Audio playback not permitted or failed:', e);
    }
  }

  /**
   * Warm Tibetan Singing Bowl / Gong
   * Fundamental frequency with overtone harmonic blend and natural decay
   */
  playZenBell() {
    const ctx = this.audioCtx;
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(this.volume * 0.7, now);
    masterGain.connect(ctx.destination);

    // Fundamental (432 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(432, now);
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.exponentialRampToValueAtTime(0.9, now + 0.05);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);

    // Harmonic 2nd partial (864 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(864, now);
    gain2.gain.setValueAtTime(0.001, now);
    gain2.gain.exponentialRampToValueAtTime(0.4, now + 0.03);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);

    // Sub shimmer (216 Hz)
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(216, now);
    gain3.gain.setValueAtTime(0.001, now);
    gain3.gain.exponentialRampToValueAtTime(0.5, now + 0.08);
    gain3.gain.exponentialRampToValueAtTime(0.0001, now + 3.6);

    osc1.connect(gain1);
    osc2.connect(gain2);
    osc3.connect(gain3);

    gain1.connect(masterGain);
    gain2.connect(masterGain);
    gain3.connect(masterGain);

    osc1.start(now);
    osc2.start(now);
    osc3.start(now);

    osc1.stop(now + 3.5);
    osc2.stop(now + 2.5);
    osc3.stop(now + 3.8);
  }

  /**
   * Crystal Chime Chord (C5 - E5 - G5 - C6)
   */
  playChime() {
    const ctx = this.audioCtx;
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(this.volume * 0.6, now);
    masterGain.connect(ctx.destination);

    const notes = [
      { freq: 523.25, time: 0.00 }, // C5
      { freq: 659.25, time: 0.12 }, // E5
      { freq: 783.99, time: 0.24 }, // G5
      { freq: 1046.50, time: 0.36 } // C6
    ];

    notes.forEach(note => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.freq, now + note.time);

      gain.gain.setValueAtTime(0.001, now + note.time);
      gain.gain.exponentialRampToValueAtTime(0.6, now + note.time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + note.time + 1.8);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now + note.time);
      osc.stop(now + note.time + 1.9);
    });
  }

  /**
   * Crisp Modern Electronic Double-Beep
   */
  playDigital() {
    const ctx = this.audioCtx;
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(this.volume * 0.5, now);
    masterGain.connect(ctx.destination);

    const beeps = [0.0, 0.16];
    beeps.forEach(delay => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, now + delay); // B5

      gain.gain.setValueAtTime(0.001, now + delay);
      gain.gain.linearRampToValueAtTime(0.8, now + delay + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.10);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now + delay);
      osc.stop(now + delay + 0.11);
    });
  }
}
