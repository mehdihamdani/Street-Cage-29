import React, { useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Disc3, Pause, Volume2, VolumeX } from 'lucide-react';
import { STREET_STATIONS } from '../game/music';
import type { GameHudState, SkillMoveType } from '../game/types';

interface PlayingHudProps {
  hud: GameHudState;
  muted: boolean;
  onToggleMute: () => void;
  onCycleStation: () => void;
  onPause: () => void;
  onSkill: (skill: SkillMoveType) => void;
  onShootStart: () => void;
  onShootEnd: () => void;
  onVirtualAxis: (dx: number, dz: number, sprint: boolean) => void;
}

export const PlayingHud: React.FC<PlayingHudProps> = ({
  hud,
  muted,
  onToggleMute,
  onCycleStation,
  onPause,
  onSkill,
  onShootStart,
  onShootEnd,
  onVirtualAxis,
}) => {
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const padRef = useRef<HTMLDivElement | null>(null);
  const [stickPos, setStickPos] = useState({ x: 0, y: 0 });
  const activePointerId = useRef<number | null>(null);

  const handlePadMove = (clientX: number, clientY: number) => {
    const el = padRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.42;
    let dx = (clientX - cx) / maxR;
    let dy = (clientY - cy) / maxR;
    const mag = Math.hypot(dx, dy);
    if (mag > 1) {
      dx /= mag;
      dy /= mag;
    }
    setStickPos({ x: dx * 22, y: dy * 22 });
    onVirtualAxis(dx, dy, mag > 0.85);
  };

  const resetPad = () => {
    activePointerId.current = null;
    setStickPos({ x: 0, y: 0 });
    onVirtualAxis(0, 0, false);
  };

  const minutes = Math.floor(hud.timeRemaining / 60);
  const seconds = hud.timeRemaining % 60;
  const clockStr =
    hud.mode === 'panna1v1'
      ? `${hud.timeRemaining}s`
      : `${minutes}:${seconds.toString().padStart(2, '0')}`;

  const accentColor =
    hud.callout?.accent === 'gold'
      ? 'border-amber-400 text-amber-300'
      : hud.callout?.accent === 'cyan'
        ? 'border-cyan-400 text-cyan-300'
        : hud.callout?.accent === 'emerald'
          ? 'border-emerald-400 text-emerald-300'
          : 'border-rose-400 text-rose-300';

  return (
    <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 md:p-5">
      {/* Top Perimeter Bar */}
      <div className="flex items-start justify-between gap-4">
        {/* Top-Right (RTL start): Minimal Utility & Street Beat Radio Switcher */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={onPause}
            aria-label="إيقاف مؤقت"
            className="w-10 h-10 rounded-lg bg-[#090d16]/90 border border-white/10 text-slate-200 hover:text-white hover:border-white/25 flex items-center justify-center transition-colors cursor-pointer"
          >
            <Pause className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? 'تشغيل الصوت' : 'كتم الصوت'}
            className="w-10 h-10 rounded-lg bg-[#090d16]/90 border border-white/10 text-slate-200 hover:text-white hover:border-white/25 flex items-center justify-center transition-colors cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          {(() => {
            const st = STREET_STATIONS.find((s) => s.id === hud.musicStation) ?? STREET_STATIONS[0];
            const boosted =
              hud.beatMood === 'skill' ||
              hud.beatMood === 'goal' ||
              hud.beatMood === 'gamebreaker';
            return (
              <button
                type="button"
                onClick={onCycleStation}
                title="تغيير إذاعة الهيب هوب [M]"
                className={`h-10 px-3 rounded-lg bg-[#090d16]/90 border text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                  boosted && st.id !== 'off'
                    ? 'border-amber-400/60 text-amber-300'
                    : 'border-white/10 text-slate-200 hover:text-white hover:border-white/25'
                }`}
              >
                <Disc3 className="w-4 h-4 shrink-0" />
                <span>{st.arabicName}</span>
                {st.id !== 'off' && (
                  <span className="font-num text-[11px] text-slate-400 hidden sm:inline">
                    {hud.beatBpm} BPM
                  </span>
                )}
              </button>
            );
          })()}
        </div>

        {/* Top-Center: Compact Scoreboard & Gamebreaker Bar */}
        <div className="flex flex-col items-center gap-1.5">
          <div
            dir="ltr"
            className="flex items-center gap-3 px-4 py-2 rounded-xl bg-[#090d16]/92 border border-white/12 shadow-lg"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-cyan-300 whitespace-nowrap">#29 YOU</span>
              <span className="font-num text-xl md:text-2xl font-bold text-white">
                {hud.playerGoals}
              </span>
            </div>

            <div className="px-2.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-center">
              <div className="font-num text-sm md:text-base font-bold text-amber-400 leading-tight">
                {clockStr}
              </div>
              {hud.mode === 'panna1v1' && (
                <div className="font-num text-[10px] text-slate-400 leading-none">
                  R{hud.roundNumber}/{hud.totalRounds}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="font-num text-xl md:text-2xl font-bold text-white">
                {hud.aiGoals}
              </span>
              <span className="text-xs font-bold text-teal-400 whitespace-nowrap">CAGE AI</span>
            </div>
          </div>

          {/* Style / Gamebreaker Gauge */}
          <div className="w-56 md:w-64 bg-[#090d16]/90 border border-white/10 rounded-lg px-2.5 py-1.5">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="font-bold text-slate-300">
                {hud.gamebreakerActive ? 'GAMEBREAKER جاهز!' : 'طاقة المهارة'}
              </span>
              <span className="font-num text-amber-400 font-bold">
                {hud.stylePoints} PTS
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full transition-all duration-100 ${
                  hud.gamebreakerActive ? 'bg-amber-400' : 'bg-cyan-400'
                }`}
                style={{ width: `${hud.gamebreakerActive ? 100 : hud.styleMeter}%` }}
              />
            </div>
          </div>
        </div>

        {/* Top-Left (RTL end): Compact Match Metrics (Unboxed clean typography) */}
        <div className="hidden sm:flex items-center gap-3 px-3 py-2 rounded-lg bg-[#090d16]/88 border border-white/10 text-xs text-slate-300">
          <span>
            كسر كاحل: <strong className="font-num text-amber-400">{hud.ankleBreakers}</strong>
          </span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span>
            كوبري: <strong className="font-num text-cyan-300">{hud.pannas}</strong>
          </span>
        </div>
      </div>

      {/* Transient Callout Banner (High-center, never blocks pitch center) */}
      <div className="flex flex-col items-center pointer-events-none">
        {hud.callout && (
          <div
            key={hud.callout.id}
            className={`px-5 py-2 rounded-xl bg-[#090d16]/92 border ${accentColor} text-center shadow-xl`}
          >
            <div className="font-athletic text-lg md:text-2xl font-black tracking-wide">
              {hud.callout.title}
            </div>
            <div className="text-xs text-slate-200">{hud.callout.subtitle}</div>
          </div>
        )}
      </div>

      {/* Bottom Area: Shot Charge Meter + Collapsible Action Dock */}
      <div className="flex flex-col items-center gap-2">
        {/* Shot Charge Bar when charging */}
        {hud.shotCharge > 0.02 && (
          <div className="w-48 bg-[#090d16]/95 border border-amber-400/50 rounded-lg px-3 py-1.5">
            <div className="flex justify-between text-[11px] font-bold text-amber-300 mb-1">
              <span>قوة التسديدة</span>
              <span className="font-num">{Math.round(hud.shotCharge * 100)}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-500"
                style={{ width: `${hud.shotCharge * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Touch Virtual Joystick (visible on touch/small screens) */}
        <div className="w-full flex items-end justify-between md:hidden pointer-events-auto px-1">
          <div
            ref={padRef}
            onPointerDown={(e) => {
              activePointerId.current = e.pointerId;
              e.currentTarget.setPointerCapture(e.pointerId);
              handlePadMove(e.clientX, e.clientY);
            }}
            onPointerMove={(e) => {
              if (activePointerId.current === e.pointerId) {
                handlePadMove(e.clientX, e.clientY);
              }
            }}
            onPointerUp={resetPad}
            onPointerCancel={resetPad}
            className="w-24 h-24 rounded-full bg-[#090d16]/80 border border-white/15 flex items-center justify-center relative touch-none"
          >
            <div
              className="w-10 h-10 rounded-full bg-amber-400/90 shadow-md"
              style={{
                transform: `translate(${stickPos.x}px, ${stickPos.y}px)`,
              }}
            />
          </div>
        </div>

        {/* Collapsible Bottom Action Dock */}
        <div className="flex flex-col items-center pointer-events-auto">
          <button
            type="button"
            onClick={() => setDockCollapsed((v) => !v)}
            className="px-3 py-1 rounded-t-lg bg-[#090d16]/90 border border-b-0 border-white/12 text-[11px] text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer"
          >
            {dockCollapsed ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>إظهار أزرار المهارات</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>إخفاء التحكم</span>
              </>
            )}
          </button>

          {!dockCollapsed && (
            <div className="flex flex-wrap items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#090d16]/92 border border-white/12 shadow-xl">
              <button
                type="button"
                onClick={() => onSkill('stepover')}
                className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/12 active:scale-95 text-xs font-bold text-slate-100 border border-white/10 transition-transform cursor-pointer whitespace-nowrap"
              >
                تمويه <span className="font-num text-amber-400 mr-1">[J]</span>
              </button>
              <button
                type="button"
                onClick={() => onSkill('elastico')}
                className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/12 active:scale-95 text-xs font-bold text-slate-100 border border-white/10 transition-transform cursor-pointer whitespace-nowrap"
              >
                إيلاستيكو <span className="font-num text-amber-400 mr-1">[K]</span>
              </button>
              <button
                type="button"
                onClick={() => onSkill('roulette')}
                className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/12 active:scale-95 text-xs font-bold text-slate-100 border border-white/10 transition-transform cursor-pointer whitespace-nowrap"
              >
                دوران 360° <span className="font-num text-amber-400 mr-1">[L]</span>
              </button>
              <button
                type="button"
                onClick={() => onSkill('panna')}
                className="px-3 py-2 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 active:scale-95 text-xs font-bold text-cyan-300 border border-cyan-400/30 transition-transform cursor-pointer whitespace-nowrap"
              >
                {hud.mode === 'cage2v2' ? 'تمرير / كوبري' : 'كوبري (Panna)'}{' '}
                <span className="font-num text-cyan-200 mr-1">[E]</span>
              </button>
              <button
                type="button"
                onPointerDown={onShootStart}
                onPointerUp={onShootEnd}
                onPointerLeave={onShootEnd}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 active:scale-95 text-xs font-extrabold text-slate-950 transition-transform cursor-pointer whitespace-nowrap"
              >
                {hud.hasBall ? 'تسديد (اضغط مطولاً)' : 'تزحلق / قطع الكرة'}{' '}
                <span className="font-num mr-1">[Space]</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
