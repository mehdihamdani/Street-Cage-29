/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LeaderboardModal } from './components/LeaderboardModal';
import { MatchModal } from './components/MatchModal';
import { PlayingHud } from './components/PlayingHud';
import { TitleOverlay } from './components/TitleOverlay';
import { FirebaseProvider, useFirebase } from './contexts/FirebaseContext';
import { StreetFootballEngine } from './game/engine';
import { loadSavedKit, saveKitToStorage } from './game/kitStorage';
import type {
  DifficultyLevel,
  GameHudState,
  GameMode,
  MusicStationId,
  PlayerKitConfig,
  SkillMoveType,
} from './game/types';

const INITIAL_HUD: GameHudState = {
  phase: 'title',
  mode: 'panna1v1',
  difficulty: 'pro',
  playerGoals: 0,
  aiGoals: 0,
  timeRemaining: 25,
  roundNumber: 1,
  totalRounds: 5,
  styleMeter: 0,
  gamebreakerActive: false,
  shotCharge: 0,
  hasBall: true,
  stylePoints: 0,
  ankleBreakers: 0,
  pannas: 0,
  shotsOnTarget: 0,
  callout: null,
  winner: null,
  musicStation: 'boombap',
  beatMood: 'chill',
  beatBpm: 85,
};

function StreetCageApp() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<StreetFootballEngine | null>(null);

  const { user, signIn, submitMatch } = useFirebase();

  const [selectedMode, setSelectedMode] = useState<GameMode>('panna1v1');
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel>('pro');
  const [playerKit, setPlayerKit] = useState<PlayerKitConfig>(() => loadSavedKit());
  const [muted, setMuted] = useState(false);
  const [hud, setHud] = useState<GameHudState>(INITIAL_HUD);
  const [webglError, setWebglError] = useState(false);

  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [matchSubmitted, setMatchSubmitted] = useState(false);
  const [submittingMatch, setSubmittingMatch] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const matchSubmittedRef = useRef(false);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    try {
      const engine = new StreetFootballEngine(container, (nextHud) => {
        setHud(nextHud);
      });
      engineRef.current = engine;
      return () => {
        engine.dispose();
        engineRef.current = null;
      };
    } catch {
      setWebglError(true);
    }
  }, []);

  const handleStart = useCallback(() => {
    matchSubmittedRef.current = false;
    setMatchSubmitted(false);
    setSubmitError(null);
    setLeaderboardOpen(false);
    engineRef.current?.startMatch(selectedMode, selectedDifficulty);
  }, [selectedMode, selectedDifficulty]);

  const submitCurrentMatch = useCallback(async () => {
    if (matchSubmittedRef.current || submittingMatch) return;
    matchSubmittedRef.current = true;
    setSubmittingMatch(true);
    setSubmitError(null);
    try {
      const result = await submitMatch(
        {
          goalsScored: hud.playerGoals,
          ankleBreakers: hud.ankleBreakers,
          pannas: hud.pannas,
          isWin: hud.winner === 'player',
        },
        playerKit,
      );
      if (result) {
        setMatchSubmitted(true);
      } else {
        matchSubmittedRef.current = false;
      }
    } catch {
      matchSubmittedRef.current = false;
      setSubmitError('تعذر حفظ نتيجة المباراة في لوحة الصدارة.');
    } finally {
      setSubmittingMatch(false);
    }
  }, [hud.ankleBreakers, hud.pannas, hud.playerGoals, hud.winner, playerKit, submitMatch, submittingMatch]);

  // Reset submission flag when leaving gameover
  useEffect(() => {
    if (hud.phase !== 'gameover') {
      matchSubmittedRef.current = false;
      setMatchSubmitted(false);
      setSubmitError(null);
    }
  }, [hud.phase]);

  // Auto-submit match points when game ends and user is authenticated
  useEffect(() => {
    if (hud.phase === 'gameover' && user && !matchSubmittedRef.current) {
      void submitCurrentMatch();
    }
  }, [hud.phase, user, submitCurrentMatch]);

  const handleSaveWithGoogle = useCallback(async () => {
    const signedInUser = await signIn();
    if (signedInUser && hud.phase === 'gameover' && !matchSubmittedRef.current) {
      await submitCurrentMatch();
    }
  }, [hud.phase, signIn, submitCurrentMatch]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (hud.phase === 'title' && !leaderboardOpen && e.code === 'Enter') {
        e.preventDefault();
        handleStart();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hud.phase, leaderboardOpen, handleStart]);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      engineRef.current?.setMuted(next);
      return next;
    });
  }, []);

  const handleSkill = useCallback((skill: SkillMoveType) => {
    engineRef.current?.triggerVirtualSkill(skill);
  }, []);

  const handleChangeKit = useCallback((kit: PlayerKitConfig) => {
    setPlayerKit(kit);
    engineRef.current?.setPlayerKit(kit);
  }, []);

  const handleSaveKit = useCallback((kit: PlayerKitConfig) => {
    setPlayerKit(kit);
    engineRef.current?.setPlayerKit(kit);
    saveKitToStorage(kit);
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#080c14]">
      {/* Dedicated isolated WebGL canvas container (never re-rendered by HUD state) */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full" dir="ltr" />

      {webglError && (
        <div className="absolute inset-0 z-40 flex items-center justify-center p-6 bg-[#080c14] text-center">
          <div className="max-w-md rounded-2xl bg-[#0f1624] border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-2">
              تعذر تشغيل العرض ثلاثي الأبعاد
            </h2>
            <p className="text-sm text-slate-300">
              يرجى تفعيل تسريع الرسوميات (WebGL) في متصفحك وإعادة تحميل الصفحة للعب.
            </p>
          </div>
        </div>
      )}

      {hud.phase === 'title' && !webglError && (
        <TitleOverlay
          mode={selectedMode}
          difficulty={selectedDifficulty}
          musicStation={hud.musicStation}
          playerKit={playerKit}
          onChangeMode={setSelectedMode}
          onChangeDifficulty={setSelectedDifficulty}
          onChangeStation={(st: MusicStationId) => engineRef.current?.setMusicStation(st)}
          onChangeKit={handleChangeKit}
          onSaveKit={handleSaveKit}
          onOpenLeaderboard={() => setLeaderboardOpen(true)}
          onStart={handleStart}
        />
      )}

      {hud.phase === 'playing' && !webglError && (
        <PlayingHud
          hud={hud}
          muted={muted}
          onToggleMute={handleToggleMute}
          onCycleStation={() => engineRef.current?.cycleMusicStation()}
          onPause={() => engineRef.current?.pauseGame()}
          onSkill={handleSkill}
          onShootStart={() => engineRef.current?.triggerVirtualShootStart()}
          onShootEnd={() => engineRef.current?.triggerVirtualShootEnd()}
          onVirtualAxis={(dx, dz, sprint) =>
            engineRef.current?.setVirtualAxis(dx, dz, sprint)
          }
        />
      )}

      {(hud.phase === 'paused' || hud.phase === 'gameover') && !webglError && (
        <MatchModal
          hud={hud}
          matchSubmitted={matchSubmitted}
          submittingMatch={submittingMatch}
          submitError={submitError}
          onSaveWithGoogle={() => void handleSaveWithGoogle()}
          onOpenLeaderboard={() => setLeaderboardOpen(true)}
          onResume={() => engineRef.current?.resumeGame()}
          onRestart={handleStart}
          onReturnTitle={() => engineRef.current?.returnToTitle()}
        />
      )}

      <LeaderboardModal
        open={leaderboardOpen}
        playerKit={playerKit}
        onClose={() => setLeaderboardOpen(false)}
      />
    </main>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <FirebaseProvider>
        <StreetCageApp />
      </FirebaseProvider>
    </ErrorBoundary>
  );
}
