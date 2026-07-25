import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import gsap from "gsap";
import "@fontsource/bangers";
import "@fontsource/inter";
import { useGameState, type EncounterSource } from "../state/gameState";
import type { ArrowDir } from "../game/Input";
import type { DinoId } from "../data/dinosaurs";
import { ScoreSummary } from "./ScoreSummary";
import { MissionSelect } from "./MissionSelect";

export interface UICallbacks {
  /** Create + start the Game for the chosen dino. */
  onStartMission: (dinoId: DinoId) => void;
  /** Dispose the running Game and return to Mission Select. */
  onReturnToSelect: () => void;
}

function TrackingBar() {
  const trackingPercent = useGameState((s) => s.trackingPercent);
  const scentCollected = useGameState((s) => s.scentCollected);
  const scentTotal = useGameState((s) => s.scentTotal);
  const status = useGameState((s) => s.missionStatus);

  const pct = Math.max(0, Math.min(1, trackingPercent));
  const danger = pct < 0.25;

  // "TRAIL: 3 OF 6" — n is the 1-indexed active (next-to-collect) node while any
  // remain, and the total once they're all collected. Spelled out rather than
  // "3/6" so it reads as progress along a trail, not a score.
  const activeOrdinal = Math.min(scentCollected + 1, scentTotal);
  const barColor =
    status === "complete"
      ? "linear-gradient(90deg, #62d99a, #a5f0c4)"
      : danger
        ? "linear-gradient(90deg, #ff4d6a, #ff8e6a)"
        : "linear-gradient(90deg, #a45cf2, #ff6ae0)";

  return (
    <div className="absolute top-4 left-4 right-4 flex flex-col gap-2 select-none pointer-events-none">
      <div className="flex items-center gap-3">
        <div className="font-display text-amber-100 text-xl tracking-wider drop-shadow">
          TRACKING
        </div>
        <div className="relative h-3 flex-1 max-w-xl bg-black/55 rounded-full overflow-hidden border border-white/10">
          <div
            className="absolute left-0 top-0 bottom-0 transition-[width] duration-100 ease-linear"
            style={{ width: `${pct * 100}%`, background: barColor }}
          />
          {danger && status === "playing" && (
            <div
              className="absolute inset-0 animate-pulse"
              style={{ background: "rgba(255,80,100,0.18)" }}
            />
          )}
        </div>
        <div className="font-ui text-sm text-white/85 tabular-nums w-16">
          {Math.round(pct * 100)}%
        </div>
      </div>
      <div className="font-ui text-xs text-white/70 tracking-wide">
        TRAIL: {activeOrdinal} OF {scentTotal}
      </div>
    </div>
  );
}

function ChaseTimerBar() {
  const active = useGameState((s) => s.chaseActive);
  const pct = useGameState((s) => s.chasePercent);
  if (!active) return null;
  const danger = pct < 0.3;
  return (
    <div className="absolute top-20 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 pointer-events-none select-none">
      <div className="font-display text-rose-100 text-lg tracking-[0.3em] drop-shadow">
        CHASE
      </div>
      <div className="relative h-3 w-72 bg-black/55 rounded-full overflow-hidden border border-white/15">
        <div
          className="absolute left-0 top-0 bottom-0 transition-[width] duration-75 ease-linear"
          style={{
            width: `${pct * 100}%`,
            background: danger
              ? "linear-gradient(90deg, #ffae42, #ff4d6a)"
              : "linear-gradient(90deg, #ffd166, #ff8e6a)",
          }}
        />
      </div>
    </div>
  );
}

function StealthBar() {
  const active = useGameState((s) => s.stealthActive);
  const pct = useGameState((s) => s.stealthPercent);
  const inBush = useGameState((s) => s.stealthInBush);
  if (!active) return null;
  const danger = pct < 0.3;
  const fill = inBush
    ? "linear-gradient(90deg, #b6e3a4, #efff7c)"
    : danger
      ? "linear-gradient(90deg, #ffae42, #ff6a4d)"
      : "linear-gradient(90deg, #ffe066, #ffd166)";
  return (
    <div className="absolute top-20 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 pointer-events-none select-none">
      <div className="flex items-center gap-2">
        <span className="text-xl" aria-hidden>
          {inBush ? "🌿" : "👁"}
        </span>
        <div className="font-display text-amber-100 text-lg tracking-[0.3em] drop-shadow">
          STEALTH
        </div>
      </div>
      <div className="relative h-3 w-72 bg-black/55 rounded-full overflow-hidden border border-white/15">
        <div
          className="absolute left-0 top-0 bottom-0 transition-[width] duration-75 ease-linear"
          style={{ width: `${pct * 100}%`, background: fill }}
        />
      </div>
      <div className="font-ui text-xs text-white/70 tracking-wide">
        {inBush ? "HIDDEN" : "EXPOSED"}
      </div>
    </div>
  );
}

function FishingBar() {
  const active = useGameState((s) => s.fishingActive);
  const pct = useGameState((s) => s.fishingPercent);
  const caught = useGameState((s) => s.fishCaught);
  const needed = useGameState((s) => s.fishNeeded);
  if (!active) return null;
  const danger = pct < 0.3;
  return (
    <div className="absolute top-20 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 pointer-events-none select-none">
      <div className="flex items-center gap-2">
        <span className="text-xl" aria-hidden>
          🐟
        </span>
        <div className="font-display text-cyan-100 text-lg tracking-[0.3em] drop-shadow">
          FISHING
        </div>
      </div>
      <div className="relative h-3 w-72 bg-black/55 rounded-full overflow-hidden border border-white/15">
        <div
          className="absolute left-0 top-0 bottom-0 transition-[width] duration-75 ease-linear"
          style={{
            width: `${pct * 100}%`,
            background: danger
              ? "linear-gradient(90deg, #ffae42, #ff4d6a)"
              : "linear-gradient(90deg, #7ce8ff, #4aa3ff)",
          }}
        />
      </div>
      <div className="flex items-center gap-2 font-ui text-xs text-white/75 tracking-wide">
        <span>
          CAUGHT {caught} OF {needed}
        </span>
        <span className="text-white/45">· HOLD X TO SNAP</span>
      </div>
    </div>
  );
}

// Single arrow asset rotated per direction — guarantees all 4 render at
// identical pixel dimensions (unicode glyphs vary in size per direction).
const ARROW_ROTATION: Record<ArrowDir, number> = {
  up: 0,
  right: 90,
  down: 180,
  left: 270,
};

const ARROW_SIZE = 150;
const QTE_CYAN = "#22d3ee";

function ArrowIcon({
  dir,
  size = ARROW_SIZE,
  color,
  glow,
}: {
  dir: ArrowDir;
  size?: number;
  color: string;
  glow?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{
        transform: `rotate(${ARROW_ROTATION[dir]}deg)`,
        display: "block",
        filter: glow ? `drop-shadow(0 0 22px ${glow})` : undefined,
      }}
    >
      <path d="M50 8 L88 50 L66 50 L66 92 L34 92 L34 50 L12 50 Z" fill={color} />
    </svg>
  );
}

/** Screen-edge glow strip in the direction of the active arrow. */
function EdgeGlow({ dir }: { dir: ArrowDir }) {
  const c = "34,211,238"; // cyan rgb
  const base: React.CSSProperties = { position: "absolute" };
  let style: React.CSSProperties;
  if (dir === "left") {
    style = { ...base, left: 0, top: 0, bottom: 0, width: "16vw", background: `linear-gradient(90deg, rgba(${c},0.45), rgba(${c},0))` };
  } else if (dir === "right") {
    style = { ...base, right: 0, top: 0, bottom: 0, width: "16vw", background: `linear-gradient(270deg, rgba(${c},0.45), rgba(${c},0))` };
  } else if (dir === "up") {
    style = { ...base, top: 0, left: 0, right: 0, height: "16vh", background: `linear-gradient(180deg, rgba(${c},0.45), rgba(${c},0))` };
  } else {
    style = { ...base, bottom: 0, left: 0, right: 0, height: "16vh", background: `linear-gradient(0deg, rgba(${c},0.45), rgba(${c},0))` };
  }
  return <div style={style} className="animate-pulse" />;
}

/** The big arrow + shrinking timer ring. */
function ArrowPrompt({
  arrow,
  windowMs,
  deadline,
  graceDeadline,
}: {
  arrow: ArrowDir;
  windowMs: number;
  deadline: number;
  graceDeadline: number;
}) {
  const now = performance.now();
  const remaining = deadline - now;
  const frac = Math.max(0, Math.min(1, remaining / windowMs));
  const inGrace = now > deadline && now <= graceDeadline;

  const size = 220;
  const r = size / 2 - 10;
  const circumference = 2 * Math.PI * r;
  // Full ring at window start, depletes to empty at the deadline.
  const dashOffset = circumference * (1 - frac);
  const ringColor = inGrace ? "#ff5566" : frac < 0.3 ? "#ffae42" : QTE_CYAN;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className={inGrace ? "animate-pulse" : ""}
      >
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={8} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={ringColor}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div
        key={`${arrow}-${deadline}`}
        className="absolute inset-0 flex items-center justify-center qte-punch"
      >
        <ArrowIcon dir={arrow} color={QTE_CYAN} glow="rgba(34,211,238,0.7)" />
      </div>
    </div>
  );
}

/** Green pulse (hit/late) or red shake (miss) on the just-pressed arrow. */
function FeedbackArrow({ arrow, result }: { arrow: ArrowDir; result: "hit" | "late" | "miss" }) {
  const color = result === "hit" ? "#62d99a" : result === "late" ? "#ffd166" : "#ff5566";
  const glow = result === "miss" ? "255,85,102" : result === "late" ? "255,209,102" : "98,217,154";
  const anim = result === "miss" ? "qte-shake" : "qte-pop";
  return (
    <div className="relative" style={{ width: 220, height: 220 }}>
      <div className={`absolute inset-0 flex items-center justify-center ${anim}`}>
        <ArrowIcon dir={arrow} color={color} glow={`rgba(${glow},0.85)`} />
      </div>
    </div>
  );
}

function DefenseOverlay() {
  const active = useGameState((s) => s.defenseActive);
  const intro = useGameState((s) => s.defenseIntro);
  const prompt = useGameState((s) => s.defensePrompt);
  const total = useGameState((s) => s.defenseTotalRounds);
  const results = useGameState((s) => s.defenseRoundResults);
  const feedback = useGameState((s) => s.defenseFeedback);
  const [, setTick] = useState(0);

  // Drive the shrinking ring; only needs to spin while an arrow is shown.
  useEffect(() => {
    if (!prompt) return;
    let raf = 0;
    const loop = () => {
      setTick((n) => n + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [prompt]);

  if (!active) return null;

  const dotColor = (i: number) => {
    const r = results[i];
    if (!r) return "transparent";
    return r === "hit" ? "#62d99a" : r === "late" ? "#ffd166" : "#ff5566";
  };

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
      {/* Layer 1: dark veil sells the frozen "moment". */}
      <div className="absolute inset-0 bg-black/45" />

      {prompt && <EdgeGlow dir={prompt.arrow} />}

      <div className="relative flex flex-col items-center">
        {/* DEFEND! banner */}
        <div className="font-display text-rose-200 text-6xl md:text-7xl tracking-[0.2em] drop-shadow-lg title-glitch mb-2">
          DEFEND!
        </div>

        {/* Layer 1 instructions — first encounter only. */}
        {intro?.showInstructions && (
          <div className="font-ui text-base md:text-lg text-white/85 tracking-wide mb-4">
            Press the arrow keys as they appear
          </div>
        )}

        {/* Round dots */}
        <div className="flex items-center gap-3 mb-5">
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              className="w-3.5 h-3.5 rounded-full border border-white/40 transition-colors"
              style={{ background: dotColor(i) }}
            />
          ))}
        </div>

        {/* Countdown / prompt / feedback */}
        <div className="flex items-center justify-center" style={{ minHeight: 220 }}>
          {intro && intro.countdown !== null && (
            <div key={intro.countdown} className="font-display text-amber-100 qte-punch" style={{ fontSize: 160, lineHeight: 1, textShadow: "0 0 24px rgba(255,209,102,0.6)" }}>
              {intro.countdown}
            </div>
          )}
          {intro && intro.countdown === null && intro.showInstructions && (
            <div className="font-display text-amber-200/80 tracking-[0.3em] text-3xl">READY…</div>
          )}
          {prompt && (
            <ArrowPrompt
              arrow={prompt.arrow}
              windowMs={prompt.windowMs}
              deadline={prompt.deadline}
              graceDeadline={prompt.graceDeadline}
            />
          )}
          {!prompt && !intro && feedback && (
            <FeedbackArrow arrow={feedback.arrow} result={feedback.result} />
          )}
        </div>
      </div>
    </div>
  );
}

// Per-encounter verbs — each mechanic gets its own win/lose language.
const RESULT_VERBS: Record<EncounterSource, { win: string; lose: string }> = {
  chase: { win: "CAUGHT!", lose: "ESCAPED!" },
  stealth: { win: "POUNCED!", lose: "SPOTTED!" },
  defense: { win: "DEFENDED!", lose: "OVERPOWERED!" },
  fish: { win: "SNAPPED!", lose: "SLIPPED AWAY!" },
};

function ChaseResultFlash() {
  const result = useGameState((s) => s.chaseResult);
  const flashUntil = useGameState((s) => s.chaseResultFlashUntil);
  const source = useGameState((s) => s.chaseResultSource);
  const labelOverride = useGameState((s) => s.chaseResultLabel);
  const [now, setNow] = useState(() => performance.now());

  useEffect(() => {
    if (flashUntil <= performance.now()) return;
    let raf = 0;
    const tick = () => {
      setNow(performance.now());
      if (performance.now() < flashUntil) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [flashUntil]);

  if (result === null || now >= flashUntil) return null;
  const verbs = source ? RESULT_VERBS[source] : RESULT_VERBS.chase;
  let label: string;
  let tint: string;
  let bg: string;
  if (result === "win") {
    label = verbs.win;
    tint = "text-rose-100";
    bg = "radial-gradient(circle, rgba(255,200,255,0.25), rgba(0,0,0,0.45))";
  } else if (result === "partial") {
    // Only defense yields a partial (some arrows landed) — held the line.
    label = "HELD GROUND";
    tint = "text-amber-100";
    bg = "radial-gradient(circle, rgba(255,220,120,0.18), rgba(0,0,0,0.5))";
  } else {
    label = verbs.lose;
    tint = "text-slate-200";
    bg = "radial-gradient(circle, rgba(120,120,160,0.15), rgba(0,0,0,0.55))";
  }
  // An explicit override (e.g. dash blowing your cover) wins, with an alarm tint.
  if (labelOverride) {
    label = labelOverride;
    tint = "text-rose-200";
    bg = "radial-gradient(circle, rgba(255,90,110,0.22), rgba(0,0,0,0.55))";
  }
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="absolute inset-0" style={{ background: bg }} />
      <div className="relative text-center select-none px-8 py-6">
        <div className={`text-7xl font-display tracking-widest title-glitch ${tint}`}>
          {label}
        </div>
      </div>
    </div>
  );
}

function PowerIcon() {
  const ready = useGameState((s) => s.powerReady);
  const active = useGameState((s) => s.powerActive);
  const pct = useGameState((s) => s.powerCooldownPercent);
  const powerName = useGameState((s) => s.powerName);

  const size = 56;
  const r = size / 2 - 4;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * pct;

  const ring = active ? "#ff5566" : ready ? "#62d99a" : "#ffd166";
  const fill = active ? "rgba(255,80,100,0.18)" : "rgba(0,0,0,0.55)";
  // While held the ring is full (the dash drains nothing); cooldown depletes it.
  const ringOffset = active ? 0 : dashOffset;

  return (
    <div className="absolute top-14 right-4 pointer-events-none select-none flex flex-col items-center gap-1">
      <div
        className={`relative ${ready ? "power-pulse" : ""}`}
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill={fill} stroke="rgba(255,255,255,0.18)" strokeWidth={1.5} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={ring}
            strokeWidth={3.5}
            strokeDasharray={circumference}
            strokeDashoffset={ringOffset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: "stroke-dashoffset 80ms linear" }}
          />
          <text
            x="50%"
            y="55%"
            dominantBaseline="middle"
            textAnchor="middle"
            fill="#fde68a"
            fontFamily="Bangers, sans-serif"
            fontSize="22"
          >
            X
          </text>
        </svg>
      </div>
      <div
        className="font-display tracking-widest text-[10px] leading-none"
        style={{ color: active ? "#ff8e9e" : ready ? "#9ff0c0" : "#ffd166" }}
      >
        {active ? "ACTIVE · HOLD" : ready ? powerName.toUpperCase() : "COOLDOWN"}
      </div>
    </div>
  );
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, "$1$1") : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function PowerBurstTint() {
  const burstUntil = useGameState((s) => s.powerBurstUntil);
  const tint = useGameState((s) => s.powerTint);
  const [now, setNow] = useState(() => performance.now());

  useEffect(() => {
    if (burstUntil <= performance.now()) return;
    let raf = 0;
    const tick = () => {
      setNow(performance.now());
      if (performance.now() < burstUntil) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [burstUntil]);

  if (now >= burstUntil) return null;
  const remaining = burstUntil - now;
  const opacity = Math.min(1, remaining / 200) * 0.4;
  const { r, g, b } = hexToRgb(tint);
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        background: `radial-gradient(circle, rgba(${r},${g},${b},${opacity}), rgba(0,0,0,0))`,
      }}
    />
  );
}

/** Expanding ring pulse for Apex Roar (screen-space approximation). */
function ShockwaveRing() {
  const sw = useGameState((s) => s.powerShockwave);
  const tint = useGameState((s) => s.powerTint);
  if (!sw) return null;
  const { r, g, b } = hexToRgb(tint);
  return (
    <div
      key={sw.id}
      className="absolute left-1/2 top-1/2 shockwave-ring pointer-events-none"
      style={{ border: `6px solid rgba(${r},${g},${b},0.55)`, borderRadius: "50%" }}
    />
  );
}

function HiddenSecretsCounter() {
  const claimed = useGameState((s) => s.hiddenSecretsClaimed);
  const total = useGameState((s) => s.hiddenSecretsTotal);
  if (total === 0) return null;
  return (
    <div className="absolute top-4 right-4 pointer-events-none select-none">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/45 border border-white/15">
        <span className="text-base" aria-hidden>
          ✦
        </span>
        <span className="font-display text-amber-100 text-sm tracking-widest">
          {claimed}/{total} HIDDEN
        </span>
      </div>
    </div>
  );
}

function RewardPopup() {
  const popup = useGameState((s) => s.rewardPopup);
  const [now, setNow] = useState(() => performance.now());

  useEffect(() => {
    if (!popup) return;
    let raf = 0;
    const tick = () => {
      setNow(performance.now());
      if (performance.now() - popup.spawnedAt < 1800) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [popup]);

  if (!popup) return null;
  const age = now - popup.spawnedAt;
  if (age > 1800) return null;
  const t = Math.min(1, age / 1800);
  const yOffset = -t * 40;
  const opacity = t < 0.85 ? 1 : 1 - (t - 0.85) / 0.15;

  return (
    <div
      key={popup.id}
      className="absolute inset-x-0 top-1/3 flex justify-center pointer-events-none select-none"
      style={{ transform: `translateY(${yOffset}px)`, opacity }}
    >
      <div className="font-display tracking-widest text-amber-200 text-3xl drop-shadow-lg"
           style={{ textShadow: "0 0 12px rgba(255,209,102,0.6)" }}>
        {popup.text}
      </div>
    </div>
  );
}

function HUD() {
  return (
    <>
      <TrackingBar />
      <HiddenSecretsCounter />
      <PowerIcon />
      <ChaseTimerBar />
      <StealthBar />
      <FishingBar />
      <DefenseOverlay />
      <RewardPopup />
      <PowerBurstTint />
      <ShockwaveRing />
      <ChaseResultFlash />
    </>
  );
}

/** Full-game title card, shown once before Mission Select. */
function TitleCard({ onComplete }: { onComplete: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const tl = gsap.timeline({ onComplete });
    tl.fromTo(el, { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: 0.6, ease: "power2.out" });
    tl.to(el, { duration: 1.6 });
    tl.to(el, { opacity: 0, scale: 1.02, duration: 0.5, ease: "power2.in" });
    return () => {
      tl.kill();
    };
  }, [onComplete]);

  return (
    <div ref={ref} className="absolute inset-0 flex items-center justify-center pointer-events-none bg-[#0b2a2a]" style={{ opacity: 0 }}>
      <div className="text-center select-none">
        <div className="text-6xl md:text-8xl font-display text-amber-100 tracking-wider title-glitch">DEADLY DINOS</div>
        <div className="mt-2 text-3xl md:text-5xl font-display text-orange-300 tracking-[0.3em] title-glitch">UNLEASHED</div>
      </div>
    </div>
  );
}

/** Per-mission intro card, driven by gameState; replays each time a mission starts. */
function MissionIntro({ runKey }: { runKey: number }) {
  const dinoName = useGameState((s) => s.dinoName);
  const era = useGameState((s) => s.era);
  const region = useGameState((s) => s.region);
  const ref = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDone(false);
    if (!ref.current) return;
    const el = ref.current;
    const tl = gsap.timeline({ onComplete: () => setDone(true) });
    tl.fromTo(el, { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: 0.6, ease: "power2.out" });
    tl.to(el, { duration: 1.8 });
    tl.to(el, { opacity: 0, scale: 1.02, duration: 0.5, ease: "power2.in" });
    return () => {
      tl.kill();
    };
  }, [runKey]);

  if (done) return null;
  return (
    <div ref={ref} className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ opacity: 0 }}>
      <div className="text-center select-none">
        <div className="text-5xl md:text-7xl font-display text-amber-100 tracking-wider title-glitch">{dinoName}</div>
        <div className="mt-3 text-base md:text-xl font-display text-amber-200/85 tracking-widest">
          {era.toUpperCase()} · {region.toUpperCase()}
        </div>
      </div>
    </div>
  );
}

type Screen = "title" | "select" | "playing";

function App({ onStartMission, onReturnToSelect }: UICallbacks) {
  const [screen, setScreen] = useState<Screen>("title");
  const [currentDino, setCurrentDino] = useState<DinoId>("eoraptor");
  // Bumped on every (re)start so MissionIntro re-plays even for the same dino.
  const [runKey, setRunKey] = useState(0);

  const launch = (id: DinoId) => {
    setCurrentDino(id);
    onStartMission(id);
    setRunKey((k) => k + 1);
    setScreen("playing");
  };

  if (screen === "title") {
    return <TitleCard onComplete={() => setScreen("select")} />;
  }

  if (screen === "select") {
    return <MissionSelect onSelect={launch} />;
  }

  return (
    <>
      <HUD />
      <MissionIntro runKey={runKey} />
      <ScoreSummary
        onRestart={() => launch(currentDino)}
        onMissions={() => {
          onReturnToSelect();
          setScreen("select");
        }}
      />
    </>
  );
}

export function mountUI(rootEl: HTMLElement, callbacks: UICallbacks) {
  const root = createRoot(rootEl);
  root.render(<App {...callbacks} />);
  return root;
}
