import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import gsap from "gsap";
import "@fontsource/bangers";
import "@fontsource/inter";
import { useGameState } from "../state/gameState";

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
        SCENT {scentCollected} / {scentTotal}
      </div>
    </div>
  );
}

function MissionFailCard() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="text-center select-none px-8 py-6 bg-black/70 rounded-xl border border-rose-400/30">
        <div className="text-5xl font-display text-rose-300 tracking-widest title-glitch">
          MISSION FAILED
        </div>
        <div className="mt-2 font-ui text-sm text-white/70 tracking-wide">
          The scent went cold.
        </div>
      </div>
    </div>
  );
}

function MissionCompleteCard() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="text-center select-none px-8 py-6 bg-black/70 rounded-xl border border-emerald-300/30">
        <div className="text-5xl font-display text-emerald-200 tracking-widest title-glitch">
          MISSION COMPLETE
        </div>
        <div className="mt-2 font-ui text-sm text-white/70 tracking-wide">
          All scents tracked.
        </div>
      </div>
    </div>
  );
}

function HUD() {
  const status = useGameState((s) => s.missionStatus);
  return (
    <>
      <TrackingBar />
      {status === "failed" && <MissionFailCard />}
      {status === "complete" && <MissionCompleteCard />}
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

  return (
    <>
      <HUD />
      {showTitle && <TitleCard onComplete={() => setShowTitle(false)} />}
    </>
  );
}

export function mountUI(rootEl: HTMLElement, onTitleStart: () => void) {
  const root = createRoot(rootEl);
  root.render(<App onTitleStart={onTitleStart} />);
  return root;
}
