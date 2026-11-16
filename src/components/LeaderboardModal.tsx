import React, { useState } from 'react';
import { Award, Check, LogIn, LogOut, RefreshCw, Trophy, X } from 'lucide-react';
import { useFirebase } from '../contexts/FirebaseContext';
import { MAX_PLAYER_NAME_LENGTH } from '../game/leaderboardService';
import type { PlayerKitConfig } from '../game/types';

interface LeaderboardModalProps {
  open: boolean;
  playerKit: PlayerKitConfig;
  onClose: () => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  open,
  playerKit,
  onClose,
}) => {
  const {
    user,
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
  } = useFirebase();

  const [savingProfile, setSavingProfile] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  if (!open) return null;

  const myRankIdx = user ? entries.findIndex((e) => e.uid === user.uid) : -1;
  const myRank = myRankIdx >= 0 ? myRankIdx + 1 : null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    try {
      await saveProfile(playerName, playerKit);
      setSavedNotice(true);
      window.setTimeout(() => setSavedNotice(false), 1800);
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#060910]/88">
      <div className="w-full max-w-2xl rounded-2xl bg-[#0f1624] border border-white/12 shadow-2xl flex flex-col max-h-[88vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-400/35 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="font-display text-lg md:text-xl font-black text-white leading-tight">
                لوحة الصدارة العالمية
              </h2>
              <p className="text-[11px] text-slate-400">
                هدف = 400 نقطة · كوبري = 350 نقطة · كسر كاحل = 250 نقطة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void refreshLeaderboard()}
              title="تحديث الترتيب"
              className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loadingLeaderboard ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق"
              className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Auth & Profile Bar */}
        <div className="px-5 py-3.5 bg-[#090d16] border-b border-white/10 shrink-0">
          {!user ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs md:text-sm font-bold text-white">
                  نافس لاعبي الشوارع حول العالم
                </div>
                <div className="text-[11px] text-slate-400">
                  سجّل الدخول بحساب Google لحفظ أهدافك ومراوغاتك تلقائياً في الترتيب العالمي.
                </div>
              </div>
              <button
                type="button"
                disabled={authBusy}
                onClick={() => void signIn()}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-extrabold text-xs md:text-sm flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <LogIn className="w-4 h-4" />
                <span>{authBusy ? 'جاري الدخول...' : 'الدخول بحساب Google'}</span>
              </button>
            </div>
          ) : (
            <form
              onSubmit={(e) => void handleSaveProfile(e)}
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[220px]">
                <span
                  className="w-7 h-7 rounded-lg border border-white/25 shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${playerKit.jerseyPrimary} 55%, ${playerKit.bootColor} 55%)`,
                  }}
                  title="ألوان القميص والحذاء الحالية"
                />
                <input
                  type="text"
                  maxLength={MAX_PLAYER_NAME_LENGTH}
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="اسمك في الملعب"
                  className="flex-1 min-w-[140px] max-w-[210px] px-3 py-1.5 rounded-lg bg-[#0f1624] border border-white/15 focus:border-amber-400 outline-none text-xs md:text-sm font-bold text-white"
                />
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 font-bold text-xs flex items-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  {savedNotice && <Check className="w-3.5 h-3.5" />}
                  <span>
                    {savingProfile ? 'حفظ...' : savedNotice ? 'تم الحفظ' : 'حفظ الاسم والطقم'}
                  </span>
                </button>
              </div>

              <div className="flex items-center gap-3">
                {myEntry && (
                  <div className="text-xs text-slate-300 flex items-center gap-2">
                    <span>
                      ترتيبك:{' '}
                      <strong className="font-num text-amber-400">
                        {myRank ? `#${myRank}` : 'خارج أول 25'}
                      </strong>
                    </span>
                    <span className="text-slate-600">·</span>
                    <span>
                      نقاطك:{' '}
                      <strong className="font-num text-cyan-300">
                        {myEntry.totalScore.toLocaleString('en-US')}
                      </strong>
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  disabled={authBusy}
                  onClick={() => void logOut()}
                  title="تسجيل الخروج"
                  className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>خروج</span>
                </button>
              </div>
            </form>
          )}

          {authError && (
            <div className="mt-2 text-xs text-rose-400 font-semibold">{authError}</div>
          )}
        </div>

        {/* Leaderboard Table */}
        <div className="flex-1 overflow-y-auto p-4 md:p-5">
          {leaderboardError && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-400/30 text-rose-300 text-xs md:text-sm text-center mb-3">
              {leaderboardError}
            </div>
          )}

          {loadingLeaderboard && entries.length === 0 ? (
            <div className="py-14 text-center text-sm text-slate-400">
              جاري تحميل ترتيب أبطال الشوارع...
            </div>
          ) : entries.length === 0 ? (
            <div className="py-14 text-center">
              <Award className="w-10 h-10 text-amber-400/70 mx-auto mb-2" />
              <div className="text-sm font-bold text-white mb-1">
                لا توجد نتائج مسجلة بعد
              </div>
              <div className="text-xs text-slate-400">
                سجّل الدخول والعب مباراتك الأولى لتتصدر القائمة العالمية!
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Column Header */}
              <div className="grid grid-cols-12 px-3 py-1.5 text-[11px] font-bold text-slate-400">
                <div className="col-span-2 text-center">المركز</div>
                <div className="col-span-4">اللاعب</div>
                <div className="col-span-2 text-center">الأهداف</div>
                <div className="col-span-2 text-center">المراوغات</div>
                <div className="col-span-2 text-left">النقاط</div>
              </div>

              {entries.map((entry, idx) => {
                const rank = idx + 1;
                const isMe = user?.uid === entry.uid;
                const rankTone =
                  rank === 1
                    ? 'text-amber-400 border-amber-400/40 bg-amber-500/10'
                    : rank === 2
                      ? 'text-slate-200 border-slate-300/30 bg-slate-400/10'
                      : rank === 3
                        ? 'text-orange-400 border-orange-400/30 bg-orange-500/10'
                        : 'text-slate-400 border-white/10 bg-[#090d16]';

                return (
                  <div
                    key={entry.uid}
                    className={`grid grid-cols-12 items-center px-3 py-2.5 rounded-xl border transition-colors ${
                      isMe
                        ? 'bg-cyan-500/10 border-cyan-400/45'
                        : 'bg-[#090d16]/90 border-white/8'
                    }`}
                  >
                    <div className="col-span-2 flex justify-center">
                      <span
                        className={`font-num text-xs md:text-sm font-black px-2.5 py-0.5 rounded-lg border ${rankTone}`}
                      >
                        #{rank}
                      </span>
                    </div>

                    <div className="col-span-4 flex items-center gap-2 min-w-0">
                      <span
                        className="w-5 h-5 rounded-md border border-white/25 shrink-0"
                        style={{
                          background: `linear-gradient(135deg, ${entry.jerseyColor} 58%, ${entry.bootColor} 58%)`,
                        }}
                      />
                      <div className="min-w-0">
                        <div className="text-xs md:text-sm font-bold text-white truncate">
                          {entry.playerName}
                          {isMe && (
                            <span className="text-[10px] text-cyan-300 font-bold mr-1.5">
                              (أنت)
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-num">
                          {entry.matchesPlayed}M · {entry.wins}W
                        </div>
                      </div>
                    </div>

                    <div className="col-span-2 text-center font-num text-xs md:text-sm font-bold text-emerald-400">
                      {entry.goalsScored}
                    </div>

                    <div className="col-span-2 text-center font-num text-xs md:text-sm font-bold text-cyan-300">
                      {entry.dribblesLanded}
                    </div>

                    <div className="col-span-2 text-left font-num text-xs md:text-base font-black text-amber-400">
                      {entry.totalScore.toLocaleString('en-US')}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
