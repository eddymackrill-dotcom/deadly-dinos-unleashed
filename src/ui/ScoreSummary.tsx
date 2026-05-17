import { useEffect, useRef } from "react";
import gsap from "gsap";
import { useGameState, type ActivityTag, type ActivityResult, type DinoStatsView } from "../state/gameState";

const STAT_MAX = 12; // matches CLAUDE.md stat scale (1..12)

const ACTIVITY_LABELS: Record<ActivityTag, string> = {
  collect: "Scent Trail",
  chase: "Chase",
  stealth: "Stealth Hunt",
  defense: "Defense",
};

const STAT_LABELS: Array<{ key: keyof DinoStatsView; label: string; tint: string }> = [
  { key: "speed", label: "SPEED", tint: "#62d99a" },
  { key: "toughness", label: "TOUGH", tint: "#f6b663" },
  { key: "power", label: "POWER", tint: "#ef6f7e" },
  { key: "senses", label: "SENSES", tint: "#9aa9ff" },
];

function StatBar({ label, value, max, tint }: { label: string; value: number; max: number; tint: string }) {
  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="font-display tracking-widest text-xs text-white/80 w-16">{label}</div>
      <div className="relative flex-1 h-2 bg-black/55 rounded-full overflow-hidden border border-white/10">
        <div className="h-full" style={{ width: `${pct * 100}%`, background: tint }} />
      </div>
      <div className="font-ui text-xs tabular-nums text-white/70 w-6 text-right">{value}</div>
    </div>
  );
}

function CompletionArc({ percent }: { percent: number }) {
  const size = 160;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - percent);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.12)" strokeWidth={stroke} fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="url(#arcGrad)"
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 600ms ease-out" }}
      />
      <defs>
        <linearGradient id="arcGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#a45cf2" />
          <stop offset="100%" stopColor="#ff6ae0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function RankShield({ rank }: { rank: number }) {
  return (
    <div className="relative w-16 h-20 select-none">
      <svg viewBox="0 0 64 80" className="absolute inset-0">
        <path
          d="M32 2 L60 14 L60 42 Q60 64 32 78 Q4 64 4 42 L4 14 Z"
          fill="url(#shieldGrad)"
          stroke="rgba(255,220,180,0.6)"
          strokeWidth="2"
        />
        <defs>
          <linearGradient id="shieldGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3d2615" />
            <stop offset="100%" stopColor="#1a0d05" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center font-display text-amber-100">
        <div className="text-[10px] tracking-widest opacity-80">RANK</div>
        <div className="text-3xl leading-none">{rank}</div>
      </div>
    </div>
  );
}

function ActivityRow({ r, index }: { r: ActivityResult; index: number }) {
  const label = ACTIVITY_LABELS[r.tag];
  return (
    <li className="flex items-center justify-between gap-3 py-1.5 border-b border-white/5 last:border-b-0">
      <div className="flex items-center gap-2">
        <div
          className={`w-5 h-5 flex items-center justify-center rounded-full text-[11px] font-display ${
            r.success ? "bg-emerald-400/30 text-emerald-100" : "bg-rose-400/30 text-rose-100"
          }`}
        >
          {r.success ? "✓" : "×"}
        </div>
        <div className="font-ui text-sm text-white/85">
          {index + 1}. {label}
        </div>
      </div>
      <div
        className={`font-display tabular-nums text-sm tracking-wider ${
          r.success ? "text-amber-200" : "text-white/40"
        }`}
      >
        +{r.points}
      </div>
    </li>
  );
}

interface ScoreSummaryProps {
  onRestart: () => void;
  onMissions: () => void;
}

export function ScoreSummary({ onRestart, onMissions }: ScoreSummaryProps) {
  const status = useGameState((s) => s.missionStatus);
  const dinoName = useGameState((s) => s.dinoName);
  const era = useGameState((s) => s.era);
  const region = useGameState((s) => s.region);
  const stats = useGameState((s) => s.dinoStats);
  const rank = useGameState((s) => s.rank);
  const activities = useGameState((s) => s.activityResults);
  const points = useGameState((s) => s.predatorPointsEarned);
  const scentTotal = useGameState((s) => s.scentTotal);
  const totalPredatorPoints = useGameState((s) => s.totalPredatorPoints);
  const bestMissionCompletion = useGameState((s) => s.bestMissionCompletion);
  const bestMissionPoints = useGameState((s) => s.bestMissionPoints);
  const newBestCompletion = useGameState((s) => s.newBestCompletion);
  const newBestPoints = useGameState((s) => s.newBestPoints);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    gsap.fromTo(
      ref.current,
      { opacity: 0, y: 24 },
      { opacity: 1, y: 0, duration: 0.6, ease: "power2.out", delay: 0.2 },
    );
  }, []);

  if (status !== "complete" && status !== "failed") return null;

  const successCount = activities.filter((a) => a.success).length;
  const completion = scentTotal === 0 ? 0 : successCount / scentTotal;
  const headline = status === "complete" ? "MISSION COMPLETE" : "MISSION FAILED";
  const headlineColor = status === "complete" ? "text-emerald-200" : "text-rose-300";

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/55 pointer-events-auto">
      <div
        ref={ref}
        className="w-[640px] max-w-[92vw] bg-stone-950/90 border border-white/10 rounded-2xl p-6 shadow-2xl backdrop-blur"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <RankShield rank={rank} />
            <div>
              <div className={`font-display text-2xl tracking-widest title-glitch ${headlineColor}`}>
                {headline}
              </div>
              <div className="font-display text-3xl text-amber-100 tracking-wider">{dinoName}</div>
              <div className="font-ui text-xs text-white/60 tracking-widest">
                {era.toUpperCase()} · {region.toUpperCase()}
              </div>
            </div>
          </div>
          <div className="relative">
            <CompletionArc percent={completion} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="font-display text-3xl text-white">{Math.round(completion * 100)}%</div>
              <div className="font-ui text-[10px] tracking-widest text-white/60">COMPLETE</div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2">
          {STAT_LABELS.map((s) => (
            <StatBar key={s.key} label={s.label} value={stats[s.key]} max={STAT_MAX} tint={s.tint} />
          ))}
        </div>

        <div className="mt-5">
          <div className="font-display tracking-widest text-xs text-white/70 mb-2">ACTIVITIES</div>
          <ul className="bg-black/30 rounded-lg px-3 py-2">
            {activities.length === 0 ? (
              <li className="font-ui text-sm text-white/40 py-2">No activities completed.</li>
            ) : (
              activities.map((a, i) => <ActivityRow key={i} r={a} index={i} />)
            )}
          </ul>
        </div>

        <div className="mt-5 flex items-end justify-between">
          <div>
            <div className="font-ui text-[11px] tracking-widest text-white/55">
              PREDATOR POINTS
              {newBestPoints && (
                <span className="ml-2 px-1.5 py-0.5 rounded text-amber-200 bg-amber-200/10 border border-amber-200/30">
                  NEW BEST
                </span>
              )}
            </div>
            <div className="font-display text-3xl text-amber-200 tracking-wider tabular-nums">
              +{points}
            </div>
            <div className="mt-1 font-ui text-[11px] text-white/45 tracking-wider tabular-nums">
              Total {totalPredatorPoints.toLocaleString()} · Best run +{bestMissionPoints}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="font-ui text-[11px] text-white/45 tracking-wider">
              Best completion {Math.round(bestMissionCompletion * 100)}%
              {newBestCompletion && (
                <span className="ml-2 px-1.5 py-0.5 rounded text-amber-200 bg-amber-200/10 border border-amber-200/30">
                  NEW BEST
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={onMissions}
                className="px-4 py-2 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 font-display tracking-wider text-white/85"
              >
                MISSIONS
              </button>
              <button
                onClick={onRestart}
                className="px-4 py-2 rounded-lg border border-rose-300/40 bg-rose-500/20 hover:bg-rose-500/30 font-display tracking-wider text-rose-100"
              >
                RESTART
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
