import React from 'react';
import { Check, LogIn, Trophy } from 'lucide-react';
import { useFirebase } from '../contexts/FirebaseContext';
import { computeMatchPoints } from '../game/leaderboardService';
import type { GameHudState } from '../game/types';

interface MatchModalProps {
  hud: GameHudState;
  matchSubmitted: boolean;
  submittingMatch: boolean;
  submitError: string | null;
  onSaveWithGoogle: () => void;
  onOpenLeaderboard: () => void;
  onResume: () => void;
  onRestart: () => void;
  onReturnTitle: () => void;
}

export const MatchModal: React.FC<MatchModalProps> = ({
  hud,
  matchSubmitted,
  submittingMatch,
  submitError,
  onSaveWithGoogle,
  onOpenLeaderboard,
  onResume,
  onRestart,
  onReturnTitle,
}) => {
  const { user, authBusy, myEntry } = useFirebase();
  const isPaused = hud.phase === 'paused';

  const earnedLeaderboardPoints = computeMatchPoints({
    goalsScored: hud.playerGoals,
    ankleBreakers: hud.ankleBreakers,
    pannas: hud.pannas,
    isWin: hud.winner === 'player',
  });

  const resultHeadline =
    hud.winner === 'player'
      ? 'فوز مستحق! ملك الشوارع'
      : hud.winner === 'ai'
        ? 'انتهت المواجهة — حاول مجدداً'
        : 'تعادل مثير في القفص!';

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-[#060910]/85">
      <div className="w-full max-w-md rounded-2xl bg-[#0f1624] border border-white/12 p-6 md:p-7 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="text-center mb-5">
          <div className="font-athletic text-xs font-bold tracking-wider text-amber-400 mb-1">
            {isPaused ? 'إيقاف مؤقت' : 'نهاية المواجهة'}
          </div>
          <h2 className="font-display text-2xl md:text-3xl font-black text-white">
            {isPaused ? 'المباراة متوقفة' : resultHeadline}
          </h2>
        </div>

        {/* Scoreline */}
        <div
          dir="ltr"
          className="flex items-center justify-center gap-6 py-4 px-5 rounded-xl bg-[#090d16] border border-white/10 mb-4"
        >
          <div className="text-center">
            <div className="text-xs font-bold text-cyan-300 mb-0.5">#29 YOU</div>
            <div className="font-num text-4xl font-black text-white">{hud.playerGoals}</div>
          </div>
          <div className="font-num text-xl text-slate-500">-</div>
          <div className="text-center">
            <div className="text-xs font-bold text-teal-400 mb-0.5">CAGE AI</div>
            <div className="font-num text-4xl font-black text-white">{hud.aiGoals}</div>
          </div>
        </div>

        {/* Match Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 rounded-xl bg-[#090d16] border border-white/8">
            <div className="text-xs text-slate-400">كسر الكاحل</div>
            <div className="font-num text-xl font-bold text-amber-400 mt-0.5">
              {hud.ankleBreakers}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-[#090d16] border border-white/8">
            <div className="text-xs text-slate-400">مهارة الكوبري</div>
            <div className="font-num text-xl font-bold text-cyan-300 mt-0.5">
              {hud.pannas}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-[#090d16] border border-white/8">
            <div className="text-xs text-slate-400">تسديدات</div>
            <div className="font-num text-xl font-bold text-white mt-0.5">
              {hud.shotsOnTarget}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-[#090d16] border border-white/8">
            <div className="text-xs text-slate-400">نقاط الأسلوب</div>
            <div className="font-num text-xl font-bold text-emerald-400 mt-0.5">
              {hud.stylePoints}
            </div>
          </div>
        </div>

        {/* Global Leaderboard Sync Banner (Gameover only) */}
        {!isPaused && (
          <div className="p-3.5 rounded-xl bg-[#090d16] border border-amber-400/25 mb-5">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                <Trophy className="w-4 h-4 shrink-0" />
                <span>نقاط الترتيب العالمي المكتسبة</span>
              </div>
              <span className="font-num text-sm font-black text-amber-400">
                +{earnedLeaderboardPoints}
              </span>
            </div>

            {submitError && (
              <div className="text-[11px] text-rose-400 mb-2">{submitError}</div>
            )}

            {user ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  {submittingMatch
                    ? 'جاري رفع النقاط إلى Firebase...'
                    : matchSubmitted
                      ? `تم التحديث! مجموعك: ${(myEntry?.totalScore ?? 0).toLocaleString('en-US')}`
                      : 'جاهز للمزامنة'}
                </span>
                <button
                  type="button"
                  onClick={onOpenLeaderboard}
                  className="px-3 py-1.5 rounded-lg bg-white/8 hover:bg-white/14 border border-white/12 text-xs font-bold text-white cursor-pointer whitespace-nowrap"
                >
                  عرض الصدارة
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={authBusy || submittingMatch}
                  onClick={onSaveWithGoogle}
                  className="flex-1 py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>سجّل بـ Google لحفظ نقاطك</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenLeaderboard}
                  className="py-2 px-3 rounded-lg bg-white/8 hover:bg-white/14 border border-white/12 text-xs font-bold text-white cursor-pointer whitespace-nowrap"
                >
                  الترتيب
                </button>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2.5">
          {isPaused && (
            <button
              type="button"
              onClick={onResume}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm transition-colors cursor-pointer"
            >
              متابعة اللعب
            </button>
          )}
          <button
            type="button"
            onClick={onRestart}
            className={`w-full py-3 rounded-xl font-extrabold text-sm transition-colors cursor-pointer ${
              isPaused
                ? 'bg-white/8 hover:bg-white/14 text-white border border-white/10'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
            }`}
          >
            إعادة المباراة
          </button>
          <button
            type="button"
            onClick={onReturnTitle}
            className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-sm border border-white/10 transition-colors cursor-pointer"
          >
            القائمة الرئيسية
          </button>
        </div>
      </div>
    </div>
  );
};
