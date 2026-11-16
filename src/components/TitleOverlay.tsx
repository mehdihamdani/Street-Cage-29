import React, { useState } from 'react';
import { Check, Palette, RotateCcw, Trophy } from 'lucide-react';
import { useFirebase } from '../contexts/FirebaseContext';
import {
  BOOT_PRESETS,
  DEFAULT_PLAYER_KIT,
  JERSEY_PRESETS,
} from '../game/kitStorage';
import { STREET_STATIONS } from '../game/music';
import type {
  DifficultyLevel,
  GameMode,
  MusicStationId,
  PlayerKitConfig,
} from '../game/types';

interface TitleOverlayProps {
  mode: GameMode;
  difficulty: DifficultyLevel;
  musicStation: MusicStationId;
  playerKit: PlayerKitConfig;
  onChangeMode: (m: GameMode) => void;
  onChangeDifficulty: (d: DifficultyLevel) => void;
  onChangeStation: (s: MusicStationId) => void;
  onChangeKit: (kit: PlayerKitConfig) => void;
  onSaveKit: (kit: PlayerKitConfig) => void;
  onOpenLeaderboard: () => void;
  onStart: () => void;
}

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  mode,
  difficulty,
  musicStation,
  playerKit,
  onChangeMode,
  onChangeDifficulty,
  onChangeStation,
  onChangeKit,
  onSaveKit,
  onOpenLeaderboard,
  onStart,
}) => {
  const { user, myEntry, entries } = useFirebase();
  const myRank = user ? entries.findIndex((e) => e.uid === user.uid) + 1 : 0;
  const [kitOpen, setKitOpen] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSave = () => {
    onSaveKit(playerKit);
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 1800);
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-between p-5 md:p-9 pointer-events-none">
      {/* Measured scrim on the right/bottom side so text is 4.5:1+ legible while 3D arena shines */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(105deg, rgba(8,12,20,0.88) 0%, rgba(8,12,20,0.62) 44%, rgba(8,12,20,0.18) 100%)',
        }}
      />

      {/* Top row: minimal brand mark */}
      <div className="relative z-10 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <svg
            width="42"
            height="42"
            viewBox="0 0 42 42"
            fill="none"
            aria-hidden="true"
            className="shrink-0"
          >
            <rect
              x="2"
              y="2"
              width="38"
              height="38"
              rx="8"
              fill="#0f172a"
              stroke="#f59e0b"
              strokeWidth="2"
            />
            <polygon
              points="21,8 30,14.5 26.5,25 15.5,25 12,14.5"
              fill="#f59e0b"
            />
            <path
              d="M11 31H31"
              stroke="#06b6d4"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
          <div>
            <span className="font-athletic text-sm tracking-wider text-amber-400 font-bold block leading-none">
              STREET CAGE 29
            </span>
            <span className="text-xs text-slate-400">ملعب الشوارع الليلي</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenLeaderboard}
          className="pointer-events-auto px-3.5 py-2 rounded-xl bg-[#0d1320]/95 border border-white/12 hover:border-amber-400/50 text-xs font-bold text-slate-100 flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
        >
          <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
          {user && myEntry ? (
            <span>
              {myRank > 0 ? `#${myRank}` : 'تصنيفك'} ·{' '}
              <strong className="font-num text-amber-400">
                {myEntry.totalScore.toLocaleString('en-US')}
              </strong>{' '}
              نقطة
            </span>
          ) : (
            <span>لوحة الصدارة العالمية</span>
          )}
        </button>
      </div>

      {/* Main Title Lockup & Match Setup */}
      <div className="relative z-10 max-w-xl my-auto pointer-events-auto overflow-y-auto max-h-[78vh] pl-1">
        <h1 className="font-display text-3xl md:text-5xl font-black text-white leading-[1.12] tracking-tight mb-2.5">
          كرة قدم الشوارع
          <span className="block text-amber-400 font-athletic text-xl md:text-2xl mt-1">
            FIFA STREET — URBAN CAGE
          </span>
        </h1>
        <p className="text-slate-300 text-xs md:text-sm leading-relaxed max-w-md mb-5">
          واجه المدافعين تحت الأضواء الكاشفة، نفّذ مراوغات كسر الكاحل والكوبري لإسقاط خصمك على العشب، وسدّد بقوة نحو الشباك.
        </p>

        {/* Mode Selector */}
        <div className="mb-3.5">
          <div className="text-xs font-semibold text-slate-400 mb-1.5">
            نمط اللعب
          </div>
          <div className="inline-flex p-1 rounded-xl bg-[#0d1320]/95 border border-white/10 gap-1">
            <button
              type="button"
              onClick={() => onChangeMode('panna1v1')}
              className={`px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mode === 'panna1v1'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              تحدي المهارات 1 ضد 1
            </button>
            <button
              type="button"
              onClick={() => onChangeMode('cage2v2')}
              className={`px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mode === 'cage2v2'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              مباراة القفص 2 ضد 2
            </button>
          </div>
        </div>

        {/* Difficulty & Street Beat Row */}
        <div className="flex flex-wrap gap-4 mb-4">
          <div>
            <div className="text-xs font-semibold text-slate-400 mb-1.5">
              مستوى التحدي
            </div>
            <div className="inline-flex p-1 rounded-xl bg-[#0d1320]/95 border border-white/10 gap-1">
              {(
                [
                  { id: 'street', label: 'شوارع' },
                  { id: 'pro', label: 'محترف' },
                  { id: 'legend', label: 'أسطورة' },
                ] as const
              ).map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onChangeDifficulty(d.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    difficulty === d.id
                      ? 'bg-cyan-500 text-slate-950'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-400 mb-1.5">
              إذاعة الشوارع (Street Beat)
            </div>
            <div className="inline-flex flex-wrap p-1 rounded-xl bg-[#0d1320]/95 border border-white/10 gap-1">
              {STREET_STATIONS.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => onChangeStation(st.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    musicStation === st.id
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {st.arabicName}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Compact Kit & Boots Customizer Panel */}
        {kitOpen && (
          <div className="mb-4 p-3.5 rounded-xl bg-[#0d1320]/96 border border-white/12 max-w-md">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-white">
                تخصيص قميص وحذاء اللاعب #29
              </span>
              <button
                type="button"
                onClick={() => onChangeKit(DEFAULT_PLAYER_KIT)}
                className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>افتراضي</span>
              </button>
            </div>

            {/* Jersey Color */}
            <div className="mb-3">
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                <span>لون القميص</span>
                <button
                  type="button"
                  onClick={() =>
                    onChangeKit({ ...playerKit, striped: !playerKit.striped })
                  }
                  className="text-amber-400 hover:text-amber-300 font-semibold cursor-pointer"
                >
                  النمط: {playerKit.striped ? 'مخطط' : 'وشاح'}
                </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {JERSEY_PRESETS.map((preset) => {
                  const active =
                    playerKit.jerseyPrimary.toLowerCase() ===
                      preset.jerseyPrimary.toLowerCase() &&
                    playerKit.striped === preset.striped;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      title={preset.label}
                      onClick={() =>
                        onChangeKit({
                          ...playerKit,
                          jerseyPrimary: preset.jerseyPrimary,
                          jerseyStripe: preset.jerseyStripe,
                          striped: preset.striped,
                        })
                      }
                      className={`w-7 h-7 rounded-lg border-2 transition-transform cursor-pointer ${
                        active
                          ? 'border-amber-400 scale-110'
                          : 'border-white/20 hover:border-white/50'
                      }`}
                      style={{
                        background: preset.striped
                          ? `repeating-linear-gradient(90deg, ${preset.jerseyPrimary} 0 4px, ${preset.jerseyStripe} 4px 8px)`
                          : preset.jerseyPrimary,
                      }}
                    />
                  );
                })}
                <label
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] text-slate-300 cursor-pointer hover:border-white/25"
                  title="اختر لون قميص مخصص"
                >
                  <span>مخصص</span>
                  <input
                    type="color"
                    value={playerKit.jerseyPrimary}
                    onChange={(e) =>
                      onChangeKit({
                        ...playerKit,
                        jerseyPrimary: e.target.value,
                      })
                    }
                    className="w-5 h-5 rounded border-0 bg-transparent cursor-pointer p-0"
                  />
                </label>
              </div>
            </div>

            {/* Boot Color */}
            <div className="mb-3">
              <div className="text-[11px] text-slate-400 mb-1.5">لون الحذاء</div>
              <div className="flex items-center gap-2 flex-wrap">
                {BOOT_PRESETS.map((bp) => {
                  const active =
                    playerKit.bootColor.toLowerCase() === bp.color.toLowerCase();
                  return (
                    <button
                      key={bp.id}
                      type="button"
                      title={bp.label}
                      onClick={() =>
                        onChangeKit({ ...playerKit, bootColor: bp.color })
                      }
                      className={`w-7 h-7 rounded-lg border-2 transition-transform cursor-pointer ${
                        active
                          ? 'border-cyan-400 scale-110'
                          : 'border-white/20 hover:border-white/50'
                      }`}
                      style={{ backgroundColor: bp.color }}
                    />
                  );
                })}
                <label
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] text-slate-300 cursor-pointer hover:border-white/25"
                  title="اختر لون حذاء مخصص"
                >
                  <span>مخصص</span>
                  <input
                    type="color"
                    value={playerKit.bootColor}
                    onChange={(e) =>
                      onChangeKit({ ...playerKit, bootColor: e.target.value })
                    }
                    className="w-5 h-5 rounded border-0 bg-transparent cursor-pointer p-0"
                  />
                </label>
              </div>
            </div>

            {/* Save Locally */}
            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <span className="text-[11px] text-slate-400">
                يظهر التعديل فوراً على اللاعب #29
              </span>
              <button
                type="button"
                onClick={handleSave}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                {savedNotice && <Check className="w-3.5 h-3.5" />}
                <span>{savedNotice ? 'تم الحفظ محلياً' : 'حفظ الاختيارات'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Primary CTA & Customize Toggle */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onStart}
            className="px-8 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-slate-950 font-extrabold text-base md:text-lg transition-transform shadow-lg shadow-amber-500/20 cursor-pointer whitespace-nowrap"
          >
            ابدأ المباراة
          </button>

          <button
            type="button"
            onClick={() => setKitOpen((v) => !v)}
            className={`px-4 py-3 rounded-xl border text-xs md:text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
              kitOpen
                ? 'bg-white/15 border-amber-400/50 text-white'
                : 'bg-[#0d1320]/95 border-white/12 text-slate-200 hover:text-white hover:border-white/30'
            }`}
          >
            <Palette className="w-4 h-4 text-amber-400" />
            <span>القميص والحذاء</span>
            <span
              className="w-3 h-3 rounded-sm border border-white/30 inline-block"
              style={{ backgroundColor: playerKit.jerseyPrimary }}
            />
            <span
              className="w-3 h-3 rounded-sm border border-white/30 inline-block"
              style={{ backgroundColor: playerKit.bootColor }}
            />
          </button>

          <button
            type="button"
            onClick={onOpenLeaderboard}
            className="px-4 py-3 rounded-xl bg-[#0d1320]/95 border border-white/12 hover:border-amber-400/50 text-xs md:text-sm font-bold text-slate-200 hover:text-white flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>الترتيب العالمي</span>
          </button>
        </div>
      </div>

      {/* Bottom single flat control hint line */}
      <div className="relative z-10 text-xs md:text-sm text-slate-300/90 flex flex-wrap items-center gap-x-3 gap-y-1 shrink-0">
        <span>WASD / الأسهم: الحركة</span>
        <span aria-hidden="true" className="text-slate-600">·</span>
        <span>Shift: سرعة</span>
        <span aria-hidden="true" className="text-slate-600">·</span>
        <span>J / K / L: مراوغات</span>
        <span aria-hidden="true" className="text-slate-600">·</span>
        <span>E: كوبري / تمرير</span>
        <span aria-hidden="true" className="text-slate-600">·</span>
        <span>Space: تسديد / تزحلق</span>
        <span aria-hidden="true" className="text-slate-600">·</span>
        <span>M: تغيير الإذاعة</span>
        <span aria-hidden="true" className="text-slate-600">·</span>
        <span>Esc: إيقاف</span>
      </div>
    </div>
  );
};
