import type { BeatMood, MusicStationId, MusicStationInfo } from './types';

export const STREET_STATIONS: MusicStationInfo[] = [
  {
    id: 'boombap',
    name: 'BOOM BAP 94',
    arabicName: 'بوم باب 94',
    baseBpm: 92,
    vibe: 'هيب هوب كلاسيكي',
  },
  {
    id: 'trap',
    name: 'CAGE TRAP',
    arabicName: 'تراب القفص',
    baseBpm: 122,
    vibe: 'إيقاع 808 ليلي',
  },
  {
    id: 'funk',
    name: 'URBAN FUNK',
    arabicName: 'فانك الشوارع',
    baseBpm: 106,
    vibe: 'بريك بيت حماسي',
  },
  {
    id: 'off',
    name: 'BEAT OFF',
    arabicName: 'إيقاف الموسيقى',
    baseBpm: 0,
    vibe: 'صوت الملعب فقط',
  },
];

interface StationPattern {
  kick: number[];
  snare: number[];
  hat: number[];
  openHat: number[];
  bassNotes: number[]; // MIDI notes (0 = rest)
  chordRoots: number[]; // MIDI roots on 16-step bar
  leadNotes: number[]; // Extra hype lead notes on skill/goal/gamebreaker
  swing: number; // 0..0.35
}

const PATTERNS: Record<Exclude<MusicStationId, 'off'>, StationPattern> = {
  boombap: {
    // Classic 90s swung street boom-bap (16 steps)
    kick:       [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0],
    snare:      [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
    hat:        [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
    openHat:    [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0],
    bassNotes:  [36, 0, 0, 39, 0, 0, 41, 0, 43, 0, 39, 0, 36, 0, 34, 0],
    chordRoots: [48, 0, 0, 0, 0, 0, 51, 0, 0, 0, 46, 0, 0, 0, 0, 0],
    leadNotes:  [72, 0, 75, 0, 79, 0, 75, 0, 77, 0, 75, 0, 72, 70, 72, 0],
    swing: 0.24,
  },
  trap: {
    // Heavy nighttime 808 cage trap
    kick:       [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0],
    snare:      [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    hat:        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    openHat:    [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    bassNotes:  [34, 0, 0, 0, 0, 0, 34, 0, 37, 0, 34, 0, 0, 41, 0, 39],
    chordRoots: [58, 0, 0, 0, 0, 0, 0, 0, 61, 0, 0, 0, 60, 0, 0, 0],
    leadNotes:  [70, 0, 73, 75, 0, 77, 0, 75, 73, 0, 70, 0, 75, 0, 77, 82],
    swing: 0.04,
  },
  funk: {
    // High-energy FIFA Street urban breakbeat funk
    kick:       [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0],
    snare:      [0, 0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0],
    hat:        [1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1],
    openHat:    [0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0],
    bassNotes:  [38, 0, 41, 0, 43, 0, 45, 43, 38, 0, 41, 0, 45, 0, 48, 45],
    chordRoots: [50, 0, 0, 53, 0, 0, 0, 0, 55, 0, 0, 0, 53, 0, 50, 0],
    leadNotes:  [74, 77, 0, 81, 79, 0, 77, 74, 74, 0, 77, 81, 84, 0, 81, 79],
    swing: 0.14,
  },
};

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export class StreetBeatPlayer {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private masterGain: GainNode | null = null;
  private masterFilter: BiquadFilterNode | null = null;

  private station: MusicStationId = 'boombap';
  private mood: BeatMood = 'chill';
  private muted = false;
  private schedulerId: number | null = null;
  private currentStep = 0;
  private barIndex = 0;
  private nextStepTime = 0;
  private moodBoostTimer = 0;
  private temporaryMood: BeatMood | null = null;

  public attachContext(ctx: AudioContext, noiseBuffer: AudioBuffer): void {
    if (this.ctx === ctx) return;
    this.ctx = ctx;
    this.noiseBuffer = noiseBuffer;

    this.masterFilter = ctx.createBiquadFilter();
    this.masterFilter.type = 'lowpass';
    this.masterFilter.frequency.value = 14000;
    this.masterFilter.Q.value = 0.7;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : 0.34;

    this.masterFilter.connect(this.masterGain);
    this.masterGain.connect(ctx.destination);

    this.applyFilterAndGain();
    this.startScheduler();
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyFilterAndGain();
  }

  public setStation(station: MusicStationId): void {
    this.station = station;
    this.currentStep = 0;
    this.barIndex = 0;
    if (this.ctx) {
      this.nextStepTime = this.ctx.currentTime + 0.04;
    }
    this.applyFilterAndGain();
  }

  public getStation(): MusicStationId {
    return this.station;
  }

  public cycleStation(): MusicStationId {
    const idx = STREET_STATIONS.findIndex((s) => s.id === this.station);
    const next = STREET_STATIONS[(idx + 1) % STREET_STATIONS.length];
    this.setStation(next.id);
    return next.id;
  }

  public setBaseMood(mood: BeatMood): void {
    this.mood = mood;
    this.applyFilterAndGain();
  }

  public triggerDynamicEvent(eventMood: 'skill' | 'goal', durationSec: number): void {
    this.temporaryMood = eventMood;
    this.moodBoostTimer = durationSec;
    this.applyFilterAndGain();
  }

  public update(dt: number): void {
    if (this.moodBoostTimer > 0) {
      this.moodBoostTimer -= dt;
      if (this.moodBoostTimer <= 0) {
        this.temporaryMood = null;
        this.applyFilterAndGain();
      }
    }
  }

  public getEffectiveMood(): BeatMood {
    if (this.mood === 'ducked' || this.mood === 'chill') {
      return this.mood;
    }
    if (this.temporaryMood) return this.temporaryMood;
    return this.mood;
  }

  public getCurrentBpm(): number {
    if (this.station === 'off') return 0;
    const info = STREET_STATIONS.find((s) => s.id === this.station);
    const base = info ? info.baseBpm : 96;
    const effective = this.getEffectiveMood();
    switch (effective) {
      case 'chill':
        return Math.round(base * 0.92);
      case 'ducked':
        return Math.round(base * 0.95);
      case 'match':
        return base;
      case 'skill':
        return Math.round(base * 1.12);
      case 'gamebreaker':
        return Math.round(base * 1.16);
      case 'goal':
        return Math.round(base * 1.2);
    }
  }

  private applyFilterAndGain(): void {
    if (!this.ctx || !this.masterGain || !this.masterFilter) return;
    const now = this.ctx.currentTime;
    const effective = this.getEffectiveMood();

    let targetGain = 0.34;
    let targetFreq = 16000;

    if (this.muted || this.station === 'off') {
      targetGain = 0;
    } else if (effective === 'chill') {
      targetGain = 0.22;
      targetFreq = 2600;
    } else if (effective === 'ducked') {
      targetGain = 0.14;
      targetFreq = 650;
    } else if (effective === 'skill' || effective === 'gamebreaker' || effective === 'goal') {
      targetGain = 0.42;
      targetFreq = 18000;
    }

    this.masterGain.gain.setTargetAtTime(targetGain, now, 0.08);
    this.masterFilter.frequency.setTargetAtTime(targetFreq, now, 0.12);
  }

  private startScheduler(): void {
    if (this.schedulerId !== null || !this.ctx) return;
    this.nextStepTime = this.ctx.currentTime + 0.05;
    this.schedulerId = window.setInterval(() => this.schedulerTick(), 25);
  }

  private schedulerTick(): void {
    if (!this.ctx || this.station === 'off' || this.muted) {
      if (this.ctx) {
        this.nextStepTime = this.ctx.currentTime + 0.05;
      }
      return;
    }
    if (this.ctx.state !== 'running') return;

    const scheduleAheadTime = 0.12;
    while (this.nextStepTime < this.ctx.currentTime + scheduleAheadTime) {
      this.scheduleStep(this.currentStep, this.nextStepTime);
      this.advanceStep();
    }
  }

  private advanceStep(): void {
    const bpm = Math.max(60, this.getCurrentBpm());
    const secondsPer16th = 60 / bpm / 4;
    const pattern = PATTERNS[this.station === 'off' ? 'boombap' : this.station];
    const isSwingStep = this.currentStep % 2 === 1;
    const swingOffset = isSwingStep ? secondsPer16th * pattern.swing : -secondsPer16th * pattern.swing * 0.5;

    this.nextStepTime += secondsPer16th + (this.currentStep % 2 === 0 ? swingOffset : -swingOffset * 0.5);
    this.currentStep = (this.currentStep + 1) % 16;
    if (this.currentStep === 0) {
      this.barIndex = (this.barIndex + 1) % 4;
    }
  }

  private scheduleStep(step: number, time: number): void {
    if (!this.ctx || !this.masterFilter || this.station === 'off') return;
    const pattern = PATTERNS[this.station];
    const effective = this.getEffectiveMood();
    const isHighHype = effective === 'skill' || effective === 'gamebreaker' || effective === 'goal';

    // 1. Kick drum (extra hype double-kick on goal / skill turnaround)
    const kickHit =
      pattern.kick[step] ||
      (effective === 'goal' && step % 4 === 0) ||
      (isHighHype && step === 14 && this.barIndex % 2 === 1);
    if (kickHit) {
      this.triggerKick(time, this.station === 'trap' ? 1.05 : 0.9);
    }

    // 2. Snare / Street Clap
    const snareFill = isHighHype && step === 15 && this.barIndex === 3;
    if (pattern.snare[step] || snareFill) {
      this.triggerSnare(time, snareFill ? 0.65 : 0.95);
    }

    // 3. Hi-Hats (32nd rolls during skill/gamebreaker/goal!)
    if (pattern.hat[step] || isHighHype) {
      const accent = step % 2 === 0 ? 0.85 : 0.55;
      this.triggerHat(time, accent, false);
      if (isHighHype && (step === 6 || step === 14 || (effective === 'goal' && step % 4 === 3))) {
        const bpm = Math.max(60, this.getCurrentBpm());
        const thirtySecond = 60 / bpm / 8;
        this.triggerHat(time + thirtySecond, 0.45, false);
      }
    }

    if (pattern.openHat[step] && effective !== 'chill') {
      this.triggerHat(time, 0.7, true);
    }

    // 4. Bassline (808 / Funk Bass)
    const bassMidi = pattern.bassNotes[step];
    if (bassMidi > 0) {
      const transpose = this.barIndex === 2 ? 3 : this.barIndex === 3 ? -2 : 0;
      this.triggerBass(
        time,
        midiToFreq(bassMidi + transpose),
        this.station === 'trap' ? 0.34 : 0.22,
      );
    }

    // 5. Rhodes Chords / Dark Trap Bells
    const chordMidi = pattern.chordRoots[step];
    if (chordMidi > 0) {
      this.triggerChord(time, chordMidi);
    }

    // 6. Hype Lead Synth / Brass Stab during skill moves, Gamebreaker, and goals
    if (isHighHype) {
      const leadMidi = pattern.leadNotes[step];
      if (leadMidi > 0) {
        this.triggerLead(time, midiToFreq(leadMidi), effective === 'goal' ? 0.16 : 0.11);
      }
    }
  }

  private triggerKick(time: number, level: number): void {
    if (!this.ctx || !this.masterFilter) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(135, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.11);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.75 * level, time + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.24);

    osc.connect(gain);
    gain.connect(this.masterFilter);
    osc.start(time);
    osc.stop(time + 0.26);
  }

  private triggerSnare(time: number, level: number): void {
    if (!this.ctx || !this.masterFilter || !this.noiseBuffer) return;

    // Body snap
    const osc = this.ctx.createOscillator();
    const oGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(195, time);
    osc.frequency.exponentialRampToValueAtTime(95, time + 0.09);
    oGain.gain.setValueAtTime(0.32 * level, time);
    oGain.gain.exponentialRampToValueAtTime(0.001, time + 0.11);
    osc.connect(oGain);
    oGain.connect(this.masterFilter);
    osc.start(time);
    osc.stop(time + 0.12);

    // Crisp noise crack
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(1150, time);
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.34 * level, time);
    nGain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);
    noise.connect(hp);
    hp.connect(nGain);
    nGain.connect(this.masterFilter);
    noise.start(time);
    noise.stop(time + 0.16);
  }

  private triggerHat(time: number, level: number, open: boolean): void {
    if (!this.ctx || !this.masterFilter || !this.noiseBuffer) return;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(open ? 6200 : 7800, time);
    const gain = this.ctx.createGain();
    const dur = open ? 0.18 : 0.045;
    gain.gain.setValueAtTime(0.16 * level, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    noise.connect(hp);
    hp.connect(gain);
    gain.connect(this.masterFilter);
    noise.start(time);
    noise.stop(time + dur + 0.02);
  }

  private triggerBass(time: number, freq: number, dur: number): void {
    if (!this.ctx || !this.masterFilter) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = this.station === 'funk' ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(this.station === 'funk' ? 680 : 380, time);
    filter.frequency.exponentialRampToValueAtTime(150, time + dur);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.45, time + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterFilter);
    osc.start(time);
    osc.stop(time + dur + 0.03);
  }

  private triggerChord(time: number, rootMidi: number): void {
    if (!this.ctx || !this.masterFilter) return;
    const intervals = [0, 3, 7]; // Minor street triad
    const dur = this.station === 'boombap' ? 0.36 : 0.22;
    intervals.forEach((semi) => {
      if (!this.ctx || !this.masterFilter) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = this.station === 'trap' ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(midiToFreq(rootMidi + semi), time);
      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(0.065, time + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
      osc.connect(gain);
      gain.connect(this.masterFilter);
      osc.start(time);
      osc.stop(time + dur + 0.02);
    });
  }

  private triggerLead(time: number, freq: number, volume: number): void {
    if (!this.ctx || !this.masterFilter) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2200, time);
    filter.frequency.exponentialRampToValueAtTime(750, time + 0.14);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterFilter);
    osc.start(time);
    osc.stop(time + 0.17);
  }

  public dispose(): void {
    if (this.schedulerId !== null) {
      clearInterval(this.schedulerId);
      this.schedulerId = null;
    }
    this.masterGain?.disconnect();
    this.masterFilter?.disconnect();
  }
}
