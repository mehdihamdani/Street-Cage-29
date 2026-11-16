import type { User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { OperationType, db, handleFirestoreError } from '../firebase';
import type { PlayerKitConfig } from './types';

export const LEADERBOARD_COLLECTION = 'leaderboard';
export const MAX_PLAYER_NAME_LENGTH = 32;
export const POINTS_PER_GOAL = 400;
export const POINTS_PER_ANKLE_BREAKER = 250;
export const POINTS_PER_PANNA = 350;

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export interface LeaderboardEntry {
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
}

export interface MatchContribution {
  goalsScored: number;
  ankleBreakers: number;
  pannas: number;
  isWin: boolean;
}

export function sanitizePlayerName(rawName: string | null | undefined): string {
  const cleaned = (rawName ?? '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'نجم الشوارع';
  return cleaned.slice(0, MAX_PLAYER_NAME_LENGTH);
}

export function sanitizeHexColor(rawHex: string | null | undefined, fallback: string): string {
  if (typeof rawHex === 'string' && HEX_COLOR_RE.test(rawHex)) {
    return rawHex.toLowerCase();
  }
  return fallback;
}

export function computeMatchPoints(contribution: MatchContribution): number {
  const goals = Math.max(0, Math.min(30, Math.floor(contribution.goalsScored)));
  const ankle = Math.max(0, Math.min(40, Math.floor(contribution.ankleBreakers)));
  const pannas = Math.max(0, Math.min(30, Math.floor(contribution.pannas)));
  return (
    goals * POINTS_PER_GOAL +
    ankle * POINTS_PER_ANKLE_BREAKER +
    pannas * POINTS_PER_PANNA
  );
}

function parseEntry(data: Record<string, unknown>, docId: string): LeaderboardEntry {
  return {
    uid: typeof data.uid === 'string' ? data.uid : docId,
    playerName: typeof data.playerName === 'string' ? data.playerName : 'لاعب الشوارع',
    jerseyColor: sanitizeHexColor(data.jerseyColor as string, '#f8fafc'),
    bootColor: sanitizeHexColor(data.bootColor as string, '#f59e0b'),
    totalScore: typeof data.totalScore === 'number' ? data.totalScore : 0,
    goalsScored: typeof data.goalsScored === 'number' ? data.goalsScored : 0,
    dribblesLanded: typeof data.dribblesLanded === 'number' ? data.dribblesLanded : 0,
    ankleBreakers: typeof data.ankleBreakers === 'number' ? data.ankleBreakers : 0,
    pannas: typeof data.pannas === 'number' ? data.pannas : 0,
    matchesPlayed: typeof data.matchesPlayed === 'number' ? data.matchesPlayed : 0,
    wins: typeof data.wins === 'number' ? data.wins : 0,
    bestMatchScore: typeof data.bestMatchScore === 'number' ? data.bestMatchScore : 0,
  };
}

function buildLeaderboardQuery(maxRows = 25) {
  return query(
    collection(db, LEADERBOARD_COLLECTION),
    where('totalScore', '>=', 0),
    orderBy('totalScore', 'desc'),
    limit(maxRows),
  );
}

export async function fetchLeaderboardOnce(maxRows = 25): Promise<LeaderboardEntry[]> {
  try {
    const snap = await getDocs(buildLeaderboardQuery(maxRows));
    return snap.docs.map((d) => parseEntry(d.data() as Record<string, unknown>, d.id));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, LEADERBOARD_COLLECTION);
  }
}

export function subscribeToLeaderboard(
  onData: (entries: LeaderboardEntry[]) => void,
  onError: (err: Error) => void,
  maxRows = 25,
): Unsubscribe {
  return onSnapshot(
    buildLeaderboardQuery(maxRows),
    (snapshot) => {
      const rows = snapshot.docs.map((d) =>
        parseEntry(d.data() as Record<string, unknown>, d.id),
      );
      onData(rows);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, LEADERBOARD_COLLECTION);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    },
  );
}

export async function fetchPlayerLeaderboardEntry(uid: string): Promise<LeaderboardEntry | null> {
  const docPath = `${LEADERBOARD_COLLECTION}/${uid}`;
  try {
    const snap = await getDoc(doc(db, LEADERBOARD_COLLECTION, uid));
    if (!snap.exists()) return null;
    return parseEntry(snap.data() as Record<string, unknown>, snap.id);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, docPath);
  }
}

export async function updateLeaderboardProfile(
  user: User,
  rawName: string,
  kit: PlayerKitConfig,
): Promise<void> {
  const docPath = `${LEADERBOARD_COLLECTION}/${user.uid}`;
  const docRef = doc(db, LEADERBOARD_COLLECTION, user.uid);
  const playerName = sanitizePlayerName(rawName || user.displayName);
  const jerseyColor = sanitizeHexColor(kit.jerseyPrimary, '#f8fafc');
  const bootColor = sanitizeHexColor(kit.bootColor, '#f59e0b');

  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      await setDoc(docRef, {
        uid: user.uid,
        playerName,
        jerseyColor,
        bootColor,
        totalScore: 0,
        goalsScored: 0,
        dribblesLanded: 0,
        ankleBreakers: 0,
        pannas: 0,
        matchesPlayed: 0,
        wins: 0,
        bestMatchScore: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(docRef, {
        playerName,
        jerseyColor,
        bootColor,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function submitMatchToLeaderboard(
  user: User,
  contribution: MatchContribution,
  rawName: string,
  kit: PlayerKitConfig,
): Promise<{ matchScore: number; newTotalScore: number }> {
  const docPath = `${LEADERBOARD_COLLECTION}/${user.uid}`;
  const docRef = doc(db, LEADERBOARD_COLLECTION, user.uid);

  const goalsDelta = Math.max(0, Math.min(30, Math.floor(contribution.goalsScored)));
  const ankleDelta = Math.max(0, Math.min(40, Math.floor(contribution.ankleBreakers)));
  const pannaDelta = Math.max(0, Math.min(30, Math.floor(contribution.pannas)));
  const matchScore = computeMatchPoints({
    goalsScored: goalsDelta,
    ankleBreakers: ankleDelta,
    pannas: pannaDelta,
    isWin: contribution.isWin,
  });

  const playerName = sanitizePlayerName(rawName || user.displayName);
  const jerseyColor = sanitizeHexColor(kit.jerseyPrimary, '#f8fafc');
  const bootColor = sanitizeHexColor(kit.bootColor, '#f59e0b');

  try {
    const newTotalScore = await runTransaction(db, async (tx) => {
      const snap = await tx.get(docRef);
      if (!snap.exists()) {
        tx.set(docRef, {
          uid: user.uid,
          playerName,
          jerseyColor,
          bootColor,
          totalScore: matchScore,
          goalsScored: goalsDelta,
          dribblesLanded: ankleDelta + pannaDelta,
          ankleBreakers: ankleDelta,
          pannas: pannaDelta,
          matchesPlayed: 1,
          wins: contribution.isWin ? 1 : 0,
          bestMatchScore: matchScore,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return matchScore;
      }

      const current = parseEntry(snap.data() as Record<string, unknown>, snap.id);
      const nextGoals = current.goalsScored + goalsDelta;
      const nextAnkle = current.ankleBreakers + ankleDelta;
      const nextPannas = current.pannas + pannaDelta;
      const nextDribbles = nextAnkle + nextPannas;
      const nextTotalScore =
        nextGoals * POINTS_PER_GOAL +
        nextAnkle * POINTS_PER_ANKLE_BREAKER +
        nextPannas * POINTS_PER_PANNA;
      const nextBestMatch = Math.max(current.bestMatchScore, matchScore);

      tx.update(docRef, {
        playerName,
        jerseyColor,
        bootColor,
        totalScore: nextTotalScore,
        goalsScored: nextGoals,
        dribblesLanded: nextDribbles,
        ankleBreakers: nextAnkle,
        pannas: nextPannas,
        matchesPlayed: current.matchesPlayed + 1,
        wins: current.wins + (contribution.isWin ? 1 : 0),
        bestMatchScore: nextBestMatch,
        updatedAt: serverTimestamp(),
      });
      return nextTotalScore;
    });

    return { matchScore, newTotalScore };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}
