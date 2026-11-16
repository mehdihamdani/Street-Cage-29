export type GameMode = 'panna1v1' | 'cage2v2';
export type DifficultyLevel = 'street' | 'pro' | 'legend';
export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';
export type SkillMoveType = 'stepover' | 'elastico' | 'roulette' | 'panna';

export type MusicStationId = 'boombap' | 'trap' | 'funk' | 'off';
export type BeatMood = 'chill' | 'match' | 'skill' | 'gamebreaker' | 'goal' | 'ducked';

export interface PlayerKitConfig {
  jerseyPrimary: string;
  jerseyStripe: string;
  bootColor: string;
  striped: boolean;
}

export interface MusicStationInfo {
  id: MusicStationId;
  name: string;
  arabicName: string;
  baseBpm: number;
  vibe: string;
}

export interface CalloutEvent {
  id: number;
  title: string;
  subtitle: string;
  accent: 'gold' | 'cyan' | 'emerald' | 'rose';
}

export interface MatchStats {
  playerGoals: number;
  aiGoals: number;
  ankleBreakers: number;
  pannas: number;
  skillsLanded: number;
  shotsOnTarget: number;
  stylePoints: number;
  roundsPlayed: number;
  totalRounds: number;
}

export interface GameHudState {
  phase: GamePhase;
  mode: GameMode;
  difficulty: DifficultyLevel;
  playerGoals: number;
  aiGoals: number;
  timeRemaining: number; // match clock (2v2) or shot clock (1v1)
  roundNumber: number;
  totalRounds: number;
  styleMeter: number; // 0..100
  gamebreakerActive: boolean;
  shotCharge: number; // 0..1
  hasBall: boolean;
  stylePoints: number;
  ankleBreakers: number;
  pannas: number;
  shotsOnTarget: number;
  callout: CalloutEvent | null;
  winner: 'player' | 'ai' | 'draw' | null;
  musicStation: MusicStationId;
  beatMood: BeatMood;
  beatBpm: number;
}

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  shootHeld: boolean;
  shootJustPressed: boolean;
  shootJustReleased: boolean;
  passOrPannaJustPressed: boolean;
  tackleJustPressed: boolean;
  skillStepoverJustPressed: boolean;
  skillElasticoJustPressed: boolean;
  skillRouletteJustPressed: boolean;
}
