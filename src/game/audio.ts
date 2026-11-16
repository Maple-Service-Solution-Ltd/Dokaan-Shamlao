/**
 * Web Audio API sound effects and background music synthesizer.
 * Zero external copyrighted audio files; works offline and respects mobile autoplay rules.
 */

export type SoundEffect =
  | 'arrive'
  | 'tap'
  | 'correct'
  | 'wrong'
  | 'cash'
  | 'win'
  | 'lose'
  | 'bossIntro'
  | 'bossHit'
  | 'bossDefeat'
  | 'achievement'
  | 'warning';

export interface AudioSettings {
  musicOn: boolean;
  sfxOn: boolean;
  musicVolume: number; // 0..1
  sfxVolume: number;   // 0..1
}

class SoundManager {
  private ctx: AudioContext | null = null;
  private settings: AudioSettings = {
    musicOn: true,
    sfxOn: true,
    musicVolume: 0.35,
    sfxVolume: 0.7,
  };
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private stepIdx = 0;
  private playingMusic = false;

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.ctx?.suspend().catch(() => undefined);
        } else if (this.playingMusic && this.settings.musicOn) {
          this.ctx?.resume().catch(() => undefined);
        }
      });
    }
  }

  private ensureCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      try {
        this.ctx = new Ctor();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => undefined);
    }
    return this.ctx;
  }

  getSettings(): AudioSettings {
    return { ...this.settings };
  }

  updateSettings(partial: Partial<AudioSettings>): AudioSettings {
    this.settings = { ...this.settings, ...partial };
    if (!this.settings.musicOn) {
      this.stopMusicLoop();
    } else if (this.playingMusic && !this.musicTimer) {
      this.startMusicLoop();
    }
    return this.getSettings();
  }

  private tone(freq: number, durSec: number, type: OscillatorType = 'triangle', delaySec = 0, volScale = 1): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    const peak = Math.max(0.001, Math.min(1, this.settings.sfxVolume * 0.25 * volScale));
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durSec);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + durSec + 0.02);
  }

  play(effect: SoundEffect): void {
    if (!this.settings.sfxOn || this.settings.sfxVolume <= 0.01) return;
    switch (effect) {
      case 'tap':
        this.tone(520, 0.06, 'sine', 0, 0.8);
        break;
      case 'arrive':
        this.tone(660, 0.09, 'triangle', 0, 0.7);
        this.tone(880, 0.12, 'triangle', 0.07, 0.7);
        break;
      case 'correct':
        this.tone(587.33, 0.08, 'triangle', 0, 0.9);
        this.tone(880, 0.14, 'triangle', 0.07, 0.9);
        break;
      case 'wrong':
        this.tone(190, 0.14, 'sawtooth', 0, 0.9);
        this.tone(150, 0.18, 'sawtooth', 0.1, 0.9);
        break;
      case 'cash':
        this.tone(987.77, 0.08, 'sine', 0, 1);
        this.tone(1318.51, 0.18, 'sine', 0.07, 1);
        break;
      case 'win':
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, 0.16, 'triangle', i * 0.09, 1));
        break;
      case 'lose':
        [392, 349.23, 311.13, 261.63].forEach((f, i) => this.tone(f, 0.18, 'sawtooth', i * 0.11, 0.8));
        break;
      case 'bossIntro':
        [146.83, 220, 293.66, 277.18].forEach((f, i) => this.tone(f, 0.22, 'sawtooth', i * 0.12, 1));
        break;
      case 'bossHit':
        this.tone(440, 0.08, 'square', 0, 0.9);
        this.tone(659.25, 0.14, 'triangle', 0.06, 1);
        break;
      case 'bossDefeat':
        [523.25, 659.25, 783.99, 987.77, 1046.5].forEach((f, i) => this.tone(f, 0.18, 'triangle', i * 0.08, 1));
        break;
      case 'achievement':
        [659.25, 880, 1174.66, 1318.51].forEach((f, i) => this.tone(f, 0.14, 'sine', i * 0.07, 0.95));
        break;
      case 'warning':
        this.tone(740, 0.1, 'square', 0, 0.75);
        this.tone(554.37, 0.12, 'square', 0.11, 0.75);
        break;
    }
  }

  startMusic(): void {
    this.playingMusic = true;
    if (this.settings.musicOn) this.startMusicLoop();
  }

  stopMusic(): void {
    this.playingMusic = false;
    this.stopMusicLoop();
  }

  private startMusicLoop(): void {
    if (this.musicTimer || typeof window === 'undefined') return;
    // Cheerful Bangladeshi folk pentatonic melody (C D E G A)
    const notes = [261.63, 293.66, 329.63, 392.0, 440.0, 392.0, 329.63, 293.66, 329.63, 392.0, 523.25, 440.0, 392.0, 329.63, 293.66, 261.63];
    this.musicTimer = setInterval(() => {
      if (!this.settings.musicOn || !this.playingMusic || (typeof document !== 'undefined' && document.hidden)) return;
      const ctx = this.ensureCtx();
      if (!ctx || ctx.state !== 'running') return;
      const freq = notes[this.stepIdx % notes.length]!;
      this.stepIdx++;
      const t0 = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      const peak = Math.max(0.0005, this.settings.musicVolume * 0.06);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.3);
    }, 340);
  }

  private stopMusicLoop(): void {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}

export const sound = new SoundManager();
