/**
 * Ambient Focus Soundscape Synthesizer
 * Generates continuous soothing background noise via Web Audio API completely offline.
 */

export class AmbientSoundManager {
  constructor(options = {}) {
    this.soundType = options.soundType || 'none'; // 'none' | 'brown' | 'rain' | 'campfire'
    this.volume = options.volume !== undefined ? options.volume / 100 : 0.5;

    this.audioCtx = null;
    this.masterGain = null;
    this.activeNodes = [];
    this.timerId = null;
    this.isPlaying = false;
  }

  initContext() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
        this.masterGain = this.audioCtx.createGain();
        this.masterGain.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
        this.masterGain.connect(this.audioCtx.destination);
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  setSoundType(type) {
    const wasPlaying = this.isPlaying;
    this.soundType = type;
    if (wasPlaying) {
      this.stop();
      if (type !== 'none') {
        this.start();
      }
    }
  }

  setVolume(volumePercent) {
    this.volume = Math.max(0, Math.min(100, volumePercent)) / 100;
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.audioCtx.currentTime, 0.05);
    }
  }

  start() {
    if (this.soundType === 'none' || this.volume <= 0) {
      this.stop();
      return;
    }

    this.initContext();
    if (!this.audioCtx) return;

    this.stop(); // Stop any existing nodes first
    this.isPlaying = true;

    switch (this.soundType) {
      case 'brown':
        this.startBrownNoise();
        break;
      case 'rain':
        this.startRainSound();
        break;
      case 'campfire':
        this.startCampfireSound();
        break;
      default:
        this.isPlaying = false;
    }
  }

  stop() {
    this.isPlaying = false;
    clearInterval(this.timerId);
    this.timerId = null;

    if (this.activeNodes.length > 0) {
      this.activeNodes.forEach(node => {
        try {
          if (node.stop) node.stop();
          if (node.disconnect) node.disconnect();
        } catch (e) {
          // Ignore
        }
      });
      this.activeNodes = [];
    }
  }

  createNoiseBuffer(seconds = 5) {
    const ctx = this.audioCtx;
    const bufferSize = ctx.sampleRate * seconds;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  /**
   * Brown Noise (Deep rumbling warm sound - popular for ADHD / deep focus)
   */
  startBrownNoise() {
    const ctx = this.audioCtx;
    const noiseBuffer = this.createNoiseBuffer(5);

    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;

    // Filter white noise to brown noise via cascading lowpass filters
    const filter1 = ctx.createBiquadFilter();
    filter1.type = 'lowpass';
    filter1.frequency.setValueAtTime(380, ctx.currentTime);

    const filter2 = ctx.createBiquadFilter();
    filter2.type = 'lowpass';
    filter2.frequency.setValueAtTime(180, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(1.8, ctx.currentTime);

    source.connect(filter1);
    filter1.connect(filter2);
    filter2.connect(gain);
    gain.connect(this.masterGain);

    source.start();
    this.activeNodes.push(source, filter1, filter2, gain);
  }

  /**
   * Gentle Rain Sound
   */
  startRainSound() {
    const ctx = this.audioCtx;
    const noiseBuffer = this.createNoiseBuffer(5);

    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;

    // Bandpass filter for gentle rain frequency spectrum
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1000, ctx.currentTime);
    filter.Q.setValueAtTime(0.7, ctx.currentTime);

    // Subtle LFO modulation for wind/gust variation
    const lfo = ctx.createOscillator();
    lfo.frequency.setValueAtTime(0.2, ctx.currentTime);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(200, ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(1.4, ctx.currentTime);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    source.start();
    lfo.start();

    this.activeNodes.push(source, filter, lfo, lfoGain, gain);
  }

  /**
   * Cozy Campfire Crackle & Rumble
   */
  startCampfireSound() {
    const ctx = this.audioCtx;
    // Base low rumble
    const noiseBuffer = this.createNoiseBuffer(5);
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;

    const lowFilter = ctx.createBiquadFilter();
    lowFilter.type = 'lowpass';
    lowFilter.frequency.setValueAtTime(150, ctx.currentTime);

    const baseGain = ctx.createGain();
    baseGain.gain.setValueAtTime(1.2, ctx.currentTime);

    source.connect(lowFilter);
    lowFilter.connect(baseGain);
    baseGain.connect(this.masterGain);
    source.start();

    this.activeNodes.push(source, lowFilter, baseGain);

    // Occasional crackle pops
    const triggerCrackle = () => {
      if (!this.isPlaying) return;
      try {
        const osc = ctx.createOscillator();
        const crackleGain = ctx.createGain();
        const now = ctx.currentTime;

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800 + Math.random() * 1400, now);

        crackleGain.gain.setValueAtTime(0.001, now);
        crackleGain.gain.linearRampToValueAtTime(0.4 + Math.random() * 0.4, now + 0.003);
        crackleGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);

        osc.connect(crackleGain);
        crackleGain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.04);
      } catch (e) {
        // Ignore
      }

      // Schedule next crackle randomly (between 100ms and 700ms)
      const nextDelay = 100 + Math.random() * 600;
      this.timerId = setTimeout(triggerCrackle, nextDelay);
    };

    triggerCrackle();
  }
}
