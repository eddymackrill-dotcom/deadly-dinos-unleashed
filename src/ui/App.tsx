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
  const isWin = result === "win";
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div
        className="absolute inset-0"
        style={{
          background: isWin
            ? "radial-gradient(circle, rgba(255,200,255,0.25), rgba(0,0,0,0.45))"
            : "radial-gradient(circle, rgba(120,120,160,0.15), rgba(0,0,0,0.55))",
        }}
      />
      <div className="relative text-center select-none px-8 py-6">
        <div
          className={`text-7xl font-display tracking-widest title-glitch ${
            isWin ? "text-rose-100" : "text-slate-200"
          }`}
        >
          {isWin ? "CAUGHT!" : "ESCAPED"}
        </div>
      </div>
    </div>
  );
}

function HUD() {
  return (
    <>
      <TrackingBar />
      <ChaseTimerBar />
      <StealthBar />
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
