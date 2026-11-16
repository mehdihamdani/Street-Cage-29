/**
 * Security Rules Invariant Verification Spec (Dirty Dozen Adversarial Payloads)
 * Mirrors the exact constraints enforced in firestore.rules and firebase-blueprint.json.
 */

export interface AuthContext {
  uid: string;
  emailVerified: boolean;
}

export interface LeaderboardPayload {
  uid: string;
  playerName: string;
  jerseyColor: string;
  bootColor: string;
  totalScore: number;
  goalsScored: number;
  dribblesLanded: number;
  ankleBreakers: number;
  pannas: number;
  matchesPlayed: number;
  wins: number;
  bestMatchScore: number;
  createdAt: number;
  updatedAt: number;
  [extraKey: string]: unknown;
}

const ALLOWED_KEYS = new Set([
  'uid',
  'playerName',
  'jerseyColor',
  'bootColor',
  'totalScore',
  'goalsScored',
  'dribblesLanded',
  'ankleBreakers',
  'pannas',
  'matchesPlayed',
  'wins',
  'bestMatchScore',
  'createdAt',
  'updatedAt',
]);

const ID_RE = /^[a-zA-Z0-9_-]{1,128}$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function simulateCreateRule(
  auth: AuthContext | null,
  playerId: string,
  payload: LeaderboardPayload,
  serverTime: number,
): 'ALLOW' | 'PERMISSION_DENIED' {
  if (!auth || !auth.emailVerified) return 'PERMISSION_DENIED';
  if (!ID_RE.test(playerId) || auth.uid !== playerId) return 'PERMISSION_DENIED';

  const keys = Object.keys(payload);
  if (keys.length !== ALLOWED_KEYS.size || keys.some((k) => !ALLOWED_KEYS.has(k))) {
    return 'PERMISSION_DENIED';
  }
  if (!ID_RE.test(payload.uid) || payload.uid !== auth.uid) return 'PERMISSION_DENIED';
  if (
    typeof payload.playerName !== 'string' ||
    payload.playerName.trim().length < 1 ||
    payload.playerName.length > 32
  ) {
    return 'PERMISSION_DENIED';
  }
  if (!HEX_RE.test(payload.jerseyColor) || !HEX_RE.test(payload.bootColor)) {
    return 'PERMISSION_DENIED';
  }
  if (
    !Number.isInteger(payload.totalScore) ||
    !Number.isInteger(payload.goalsScored) ||
    !Number.isInteger(payload.dribblesLanded) ||
    !Number.isInteger(payload.ankleBreakers) ||
    !Number.isInteger(payload.pannas) ||
    !Number.isInteger(payload.matchesPlayed) ||
    !Number.isInteger(payload.wins) ||
    !Number.isInteger(payload.bestMatchScore)
  ) {
    return 'PERMISSION_DENIED';
  }
  if (
    payload.totalScore < 0 ||
    payload.goalsScored < 0 ||
    payload.goalsScored > 30 ||
    payload.ankleBreakers < 0 ||
    payload.ankleBreakers > 40 ||
    payload.pannas < 0 ||
    payload.pannas > 30 ||
    payload.matchesPlayed < 0 ||
    payload.matchesPlayed > 1 ||
    payload.wins < 0 ||
    payload.wins > payload.matchesPlayed ||
    payload.bestMatchScore !== payload.totalScore ||
    payload.bestMatchScore > 30000
  ) {
    return 'PERMISSION_DENIED';
  }
  if (payload.dribblesLanded !== payload.ankleBreakers + payload.pannas) {
    return 'PERMISSION_DENIED';
  }
  if (
    payload.totalScore !==
    payload.goalsScored * 400 + payload.ankleBreakers * 250 + payload.pannas * 350
  ) {
    return 'PERMISSION_DENIED';
  }
  if (payload.createdAt !== serverTime || payload.updatedAt !== serverTime) {
    return 'PERMISSION_DENIED';
  }
  return 'ALLOW';
}

export function runDirtyDozenChecks(): boolean {
  const now = 1700000000;
  const validAuth: AuthContext = { uid: 'player_1', emailVerified: true };
  const basePayload: LeaderboardPayload = {
    uid: 'player_1',
    playerName: 'Nabil29',
    jerseyColor: '#f8fafc',
    bootColor: '#f59e0b',
    totalScore: 1000,
    goalsScored: 1,
    dribblesLanded: 2,
    ankleBreakers: 1,
    pannas: 1,
    matchesPlayed: 1,
    wins: 1,
    bestMatchScore: 1000,
    createdAt: now,
    updatedAt: now,
  };

  const results: Array<[string, 'ALLOW' | 'PERMISSION_DENIED']> = [
    ['1. Unauthenticated', simulateCreateRule(null, 'player_1', basePayload, now)],
    [
      '2. Unverified Email',
      simulateCreateRule({ uid: 'player_1', emailVerified: false }, 'player_1', basePayload, now),
    ],
    [
      '3. Path Spoof',
      simulateCreateRule({ uid: 'player_2', emailVerified: true }, 'player_1', basePayload, now),
    ],
    [
      '4. Payload UID Spoof',
      simulateCreateRule(validAuth, 'player_1', { ...basePayload, uid: 'player_2' }, now),
    ],
    [
      '5. Ghost Field',
      simulateCreateRule(validAuth, 'player_1', { ...basePayload, isAdmin: true }, now),
    ],
    [
      '6. Formula Bypass',
      simulateCreateRule(validAuth, 'player_1', { ...basePayload, totalScore: 99999 }, now),
    ],
    [
      '7. Dribble Mismatch',
      simulateCreateRule(validAuth, 'player_1', { ...basePayload, dribblesLanded: 99 }, now),
    ],
    [
      '8. Spike Goals',
      simulateCreateRule(
        validAuth,
        'player_1',
        { ...basePayload, goalsScored: 100, totalScore: 40600 },
        now,
      ),
    ],
    [
      '9. Negative Score',
      simulateCreateRule(validAuth, 'player_1', { ...basePayload, totalScore: -100 }, now),
    ],
    [
      '10. Forged Timestamp',
      simulateCreateRule(validAuth, 'player_1', { ...basePayload, updatedAt: now - 500 }, now),
    ],
    [
      '11. Invalid Hex Color',
      simulateCreateRule(validAuth, 'player_1', { ...basePayload, jerseyColor: 'red' }, now),
    ],
    [
      '12. Blank Name',
      simulateCreateRule(validAuth, 'player_1', { ...basePayload, playerName: '   ' }, now),
    ],
  ];

  const allRejected = results.every(([, res]) => res === 'PERMISSION_DENIED');
  const validAllowed = simulateCreateRule(validAuth, 'player_1', basePayload, now) === 'ALLOW';
  return allRejected && validAllowed;
}
