import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import gsap from "gsap";
import "@fontsource/bangers";
import "@fontsource/inter";
import { useGameState } from "../state/gameState";
import { ScoreSummary } from "./ScoreSummary";

interface AppProps {
  onTitleStart: () => void;
}

function TrackingBar() {
  const trackingPercent = useGameState((s) => s.trackingPercent);
  const scentCollected = useGameState((s) => s.scentCollected);
  const scentTotal = useGameState((s) => s.scentTotal);
  const status = useGameState((s) => s.missionStatus);

  const pct = Math.max(0, Math.min(1, trackingPercent));
  const danger = pct < 0.25;

  // Per spec: while there are uncollected nodes, display "SCENT n/total" where
  // n is the 1-indexed active (i.e. next-to-collect) node. After all are
  // collected, show n=total.
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
        SCENT {activeOrdinal} / {scentTotal}
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

const ARROW_GLYPH: Record<string, string> = {
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
};

function DefenseOverlay() {
  const active = useGameState((s) => s.defenseActive);
  const prompt = useGameState((s) => s.defensePrompt);
  const total = useGameState((s) => s.defenseTotalRounds);
  const hits = useGameState((s) => s.defenseHits);
  const misses = useGameState((s) => s.defenseMisses);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const loop = () => {
      setTick((n) => n + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  if (!active) return null;

  let timerPct = 0;
  if (prompt) {
    const span = 700;
    const remaining = prompt.deadline - performance.now();
    timerPct = Math.max(0, Math.min(1, remaining / span));
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
      <div className="font-display text-rose-100 text-2xl tracking-[0.35em] drop-shadow mb-4">
        DEFEND
      </div>
      <div className="flex items-center gap-3 mb-3">
        {Array.from({ length: total }).map((_, i) => {
          const filled = i < hits + misses;
          const ok = i < hits;
          return (
            <div
              key={i}
              className="w-3 h-3 rounded-full border border-white/40"
              style={{
                background: filled ? (ok ? "#62d99a" : "#ff5566") : "transparent",
              }}
            />
          );
        })}
      </div>
      {prompt && (
        <>
          <div
            className="text-[140px] leading-none font-display drop-shadow-lg"
            style={{ color: "#ffd166", textShadow: "0 0 16px rgba(255,209,102,0.55)" }}
          >
            {ARROW_GLYPH[prompt.arrow]}
          </div>
          <div className="relative h-2 w-56 mt-3 bg-black/60 rounded-full overflow-hidden border border-white/20">
            <div
              className="absolute left-0 top-0 bottom-0"
              style={{
                width: `${timerPct * 100}%`,
                background:
                  timerPct < 0.3
                    ? "linear-gradient(90deg, #ff5566, #ff8e6a)"
                    : "linear-gradient(90deg, #ffd166, #ffae42)",
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

function ChaseResultFlash() {
  const result = useGameState((s) => s.chaseResult);
  const flashUntil = useGameState((s) => s.chaseResultFlashUntil);
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
  let label = "ESCAPED";
  let tint = "text-slate-200";
  let bg = "radial-gradient(circle, rgba(120,120,160,0.15), rgba(0,0,0,0.55))";
  if (result === "win") {
    label = "CAUGHT!";
    tint = "text-rose-100";
    bg = "radial-gradient(circle, rgba(255,200,255,0.25), rgba(0,0,0,0.45))";
  } else if (result === "partial") {
    label = "HELD GROUND";
    tint = "text-amber-100";
    bg = "radial-gradient(circle, rgba(255,220,120,0.18), rgba(0,0,0,0.5))";
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
      <ChaseTimerBar />
      <StealthBar />
      <DefenseOverlay />
      <RewardPopup />
      <ChaseResultFlash />
    </>
  );
}

function TitleCard({ onComplete }: { onComplete: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const tl = gsap.timeline({ onComplete });
    tl.fromTo(
      el,
      { opacity: 0, scale: 0.96 },
      { opacity: 1, scale: 1, duration: 0.6, ease: "power2.out" },
    );
    tl.to(el, { duration: 2.0 });
    tl.to(el, { opacity: 0, scale: 1.02, duration: 0.6, ease: "power2.in" });
    return () => {
      tl.kill();
    };
  }, [onComplete]);

  return (
    <div
      ref={ref}
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      style={{ opacity: 0 }}
    >
      <div className="text-center select-none">
        <div className="text-5xl md:text-7xl font-display text-amber-100 tracking-wider title-glitch">
          MISSION 1
        </div>
        <div className="mt-3 text-base md:text-xl font-display text-amber-200/85 tracking-widest">
          EORAPTOR · ARGENTINA · 230 MILLION YEARS AGO
        </div>
      </div>
    </div>
  );
}

function App({ onTitleStart }: AppProps) {
  const [showTitle, setShowTitle] = useState(true);
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    onTitleStart();
  }, [onTitleStart]);

  const handleRestart = () => window.location.reload();
  const handleMissions = () => window.location.reload();

  return (
    <>
      <HUD />
      {showTitle && <TitleCard onComplete={() => setShowTitle(false)} />}
      <ScoreSummary onRestart={handleRestart} onMissions={handleMissions} />
    </>
  );
}

export function mountUI(rootEl: HTMLElement, onTitleStart: () => void) {
  const root = createRoot(rootEl);
  root.render(<App onTitleStart={onTitleStart} />);
  return root;
}
