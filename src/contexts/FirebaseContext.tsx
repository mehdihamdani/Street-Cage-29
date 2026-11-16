import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import {
  fetchLeaderboardOnce,
  fetchPlayerLeaderboardEntry,
  sanitizePlayerName,
  submitMatchToLeaderboard,
  subscribeToLeaderboard,
  updateLeaderboardProfile,
  type LeaderboardEntry,
  type MatchContribution,
} from '../game/leaderboardService';
import type { PlayerKitConfig } from '../game/types';

const NICKNAME_STORAGE_KEY = 'street_cage_29_nickname_v1';

interface FirebaseContextValue {
  user: User | null;
  authReady: boolean;
  authBusy: boolean;
  authError: string | null;
  playerName: string;
  setPlayerName: (name: string) => void;
  entries: LeaderboardEntry[];
  myEntry: LeaderboardEntry | null;
  loadingLeaderboard: boolean;
  leaderboardError: string | null;
  signIn: () => Promise<User | null>;
  logOut: () => Promise<void>;
  refreshLeaderboard: () => Promise<void>;
  saveProfile: (name: string, kit: PlayerKitConfig) => Promise<void>;
  submitMatch: (
    contribution: MatchContribution,
    kit: PlayerKitConfig,
  ) => Promise<{ matchScore: number; newTotalScore: number } | null>;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

function loadStoredNickname(): string {
  try {
    return window.localStorage.getItem(NICKNAME_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function persistNickname(name: string): void {
  try {
    window.localStorage.setItem(NICKNAME_STORAGE_KEY, name);
  } catch {
    // Ignore storage quota errors
  }
}

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [playerName, setPlayerNameState] = useState<string>(() => loadStoredNickname());
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [myEntry, setMyEntry] = useState<LeaderboardEntry | null>(null);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);

  const setPlayerName = useCallback((name: string) => {
    const trimmed = name.slice(0, 32);
    setPlayerNameState(trimmed);
    persistNickname(trimmed);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (nextUser) {
        setPlayerNameState((prev) => {
          if (prev.trim()) return prev;
          const fallback = sanitizePlayerName(nextUser.displayName);
          persistNickname(fallback);
          return fallback;
        });
      }
    });
    return () => unsub();
  }, []);

  const refreshLeaderboard = useCallback(async () => {
    setLoadingLeaderboard(true);
    setLeaderboardError(null);
    try {
      const rows = await fetchLeaderboardOnce(25);
      setEntries(rows);
      if (auth.currentUser) {
        const mine =
          rows.find((r) => r.uid === auth.currentUser?.uid) ??
          (await fetchPlayerLeaderboardEntry(auth.currentUser.uid));
        setMyEntry(mine);
        if (mine?.playerName) {
          setPlayerNameState(mine.playerName);
          persistNickname(mine.playerName);
        }
      } else {
        setMyEntry(null);
      }
    } catch {
      setLeaderboardError('تعذر تحميل لوحة الصدارة حالياً. حاول التحديث بعد لحظات.');
    } finally {
      setLoadingLeaderboard(false);
    }
  }, []);

  // Only attach live onSnapshot when auth is ready and user is authenticated;
  // otherwise load public top players snapshot once.
  useEffect(() => {
    if (!authReady) return;

    if (!user) {
      setMyEntry(null);
      void refreshLeaderboard();
      return;
    }

    setLoadingLeaderboard(true);
    setLeaderboardError(null);

    const unsub = subscribeToLeaderboard(
      (rows) => {
        setEntries(rows);
        setLoadingLeaderboard(false);
        const inTop = rows.find((r) => r.uid === user.uid);
        if (inTop) {
          setMyEntry(inTop);
        } else {
          void fetchPlayerLeaderboardEntry(user.uid)
            .then((mine) => {
              setMyEntry(mine);
              if (mine?.playerName) {
                setPlayerNameState(mine.playerName);
                persistNickname(mine.playerName);
              }
            })
            .catch(() => {
              // Handled gracefully
            });
        }
      },
      () => {
        setLoadingLeaderboard(false);
        setLeaderboardError('تعذر مزامنة الترتيب المباشر.');
      },
      25,
    );

    return () => unsub();
  }, [authReady, user, refreshLeaderboard]);

  const signIn = useCallback(async (): Promise<User | null> => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const nextName = playerName.trim() || sanitizePlayerName(cred.user.displayName);
      setPlayerName(nextName);
      return cred.user;
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setAuthError(null);
      } else if (code === 'auth/popup-blocked') {
        setAuthError('المتصفح منع نافذة تسجيل الدخول. يرجى السماح بالنوافذ المنبثقة.');
      } else {
        setAuthError('تعذر تسجيل الدخول عبر Google. حاول مرة أخرى.');
      }
      return null;
    } finally {
      setAuthBusy(false);
    }
  }, [playerName, setPlayerName]);

  const logOut = useCallback(async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await signOut(auth);
      setMyEntry(null);
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const saveProfile = useCallback(
    async (name: string, kit: PlayerKitConfig) => {
      if (!auth.currentUser) return;
      const cleanName = sanitizePlayerName(name);
      setPlayerName(cleanName);
      await updateLeaderboardProfile(auth.currentUser, cleanName, kit);
      await refreshLeaderboard();
    },
    [setPlayerName, refreshLeaderboard],
  );

  const submitMatch = useCallback(
    async (contribution: MatchContribution, kit: PlayerKitConfig) => {
      const currentUser = auth.currentUser;
      if (!currentUser) return null;
      const cleanName = sanitizePlayerName(playerName || currentUser.displayName);
      const res = await submitMatchToLeaderboard(currentUser, contribution, cleanName, kit);
      const mine = await fetchPlayerLeaderboardEntry(currentUser.uid);
      if (mine) setMyEntry(mine);
      return res;
    },
    [playerName],
  );

  return (
    <FirebaseContext.Provider
      value={{
        user,
        authReady,
        authBusy,
        authError,
        playerName,
        setPlayerName,
        entries,
        myEntry,
        loadingLeaderboard,
        leaderboardError,
        signIn,
        logOut,
        refreshLeaderboard,
        saveProfile,
        submitMatch,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
};

export function useFirebase(): FirebaseContextValue {
  const ctx = useContext(FirebaseContext);
  if (!ctx) {
    throw new Error('useFirebase must be used inside FirebaseProvider');
  }
  return ctx;
}
