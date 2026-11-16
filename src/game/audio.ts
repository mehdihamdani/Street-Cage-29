import { StreetBeatPlayer } from './music';
import type { BeatMood, MusicStationId, SkillMoveType } from './types';

export class StreetAudio {
  private ctx: AudioContext | null = null;
  private muted = false;
  private noiseBuffer: AudioBuffer | null = null;
  public readonly beat = new StreetBeatPlayer();

  private ensureContext(): AudioContext | null {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    if (!this.noiseBuffer && this.ctx) {
      const sampleRate = this.ctx.sampleRate;
      const length = sampleRate * 1.5;
      const buffer = this.ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buffer;
    }
    if (this.ctx && this.noiseBuffer) {
      this.beat.attachContext(this.ctx, this.noiseBuffer);
    }
    if (this.muted) return null;
    return this.ctx;
  }

  public unlock(): void {
    this.ensureContext();
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    this.beat.setMuted(muted);
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setBeatMood(mood: BeatMood): void {
    this.beat.setBaseMood(mood);
  }

  public triggerBeatEvent(event: 'skill' | 'goal', durationSec: number): void {
    this.beat.triggerDynamicEvent(event, durationSec);
  }

  public setStation(station: MusicStationId): void {
    this.ensureContext();
    this.beat.setStation(station);
  }

  public cycleStation(): MusicStationId {
    this.ensureContext();
    return this.beat.cycleStation();
  }

  public dispose(): void {
    this.beat.dispose();
  }

  public playDribble(intensity = 0.6): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(145 + intensity * 35, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.065);

    gain.gain.setValueAtTime(0.12 * intensity, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.075);
  }

  public playKick(power = 0.7, isGamebreaker = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Punchy low thump
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isGamebreaker ? 210 : 170 + power * 60, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.14);

    gain.gain.setValueAtTime(0.32 + power * 0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.17);

    // Crisp leather snap
    if (this.noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(isGamebreaker ? 1800 : 1200, now);
      filter.Q.value = 1.4;
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.18 * (0.5 + power), now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(ctx.destination);
      noise.start(now);
      noise.stop(now + 0.09);
    }

    if (isGamebreaker) {
      const sub = ctx.createOscillator();
      const sGain = ctx.createGain();
      sub.type = 'sawtooth';
      sub.frequency.setValueAtTime(320, now);
      sub.frequency.exponentialRampToValueAtTime(95, now + 0.28);
      sGain.gain.setValueAtTime(0.14, now);
      sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      sub.connect(sGain);
      sGain.connect(ctx.destination);
      sub.start(now);
      sub.stop(now + 0.31);
    }
  }

  public playSkill(skill: SkillMoveType): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (this.noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      const startFreq = skill === 'roulette' ? 500 : skill === 'elastico' ? 900 : 700;
      const endFreq = skill === 'panna' ? 2400 : 1700;
      filter.frequency.setValueAtTime(startFreq, now);
      filter.frequency.exponentialRampToValueAtTime(endFreq, now + 0.14);
      filter.Q.value = 2.5;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(now);
      noise.stop(now + 0.17);
    }

    const osc = ctx.createOscillator();
    const oGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(skill === 'elastico' ? 420 : 320, now);
    osc.frequency.exponentialRampToValueAtTime(skill === 'panna' ? 680 : 520, now + 0.09);
    oGain.gain.setValueAtTime(0.08, now);
    oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(oGain);
    oGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  public playAnkleBreaker(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Bass drop
    const bass = ctx.createOscillator();
    const bGain = ctx.createGain();
    bass.type = 'sine';
    bass.frequency.setValueAtTime(140, now);
    bass.frequency.exponentialRampToValueAtTime(34, now + 0.38);
    bGain.gain.setValueAtTime(0.36, now);
    bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
    bass.connect(bGain);
    bGain.connect(ctx.destination);
    bass.start(now);
    bass.stop(now + 0.44);

    // Crowd "OOOOH!" filtered noise swell
    this.playCrowdSwell(0.55, 720, 0.28);
  }

  public playPanna(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const freqs = [523.25, 659.25, 783.99];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + idx * 0.04);
      g.gain.setValueAtTime(0.11, now + idx * 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.18);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now + idx * 0.04);
      osc.stop(now + idx * 0.04 + 0.2);
    });

    this.playCrowdSwell(0.45, 950, 0.22);
  }

  public playPostClang(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc1.type = 'triangle';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(790, now);
    osc2.frequency.setValueAtTime(1185, now);
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.46);
    osc2.stop(now + 0.46);
  }

  public playGoal(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Street stadium horn chord
    const notes = [220, 277.18, 329.63, 440];
    notes.forEach((freq) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, now);
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.08, now + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
      osc.connect(filter);
      filter.connect(g);
      g.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.68);
    });

    this.playCrowdSwell(1.1, 1100, 0.32);
  }

  public playWhistle(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(2850, now);
    lfo.frequency.setValueAtTime(38, now);
    lfoGain.gain.setValueAtTime(110, now);
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.11, now + 0.02);
    gain.gain.setValueAtTime(0.11, now + 0.22);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    lfo.start(now);
    osc.stop(now + 0.36);
    lfo.stop(now + 0.36);
  }

  public playCrowdSwell(duration = 0.6, centerFreq = 800, volume = 0.25): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(centerFreq * 0.75, now);
    filter.frequency.linearRampToValueAtTime(centerFreq * 1.25, now + duration * 0.4);
    filter.frequency.linearRampToValueAtTime(centerFreq * 0.85, now + duration);
    filter.Q.value = 1.1;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume, now + duration * 0.25);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + duration + 0.05);
  }

  public playBodyImpact(intensity = 0.7): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110 + intensity * 40, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.14);

    gain.gain.setValueAtTime(0.28 * intensity, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.17);
  }
}
