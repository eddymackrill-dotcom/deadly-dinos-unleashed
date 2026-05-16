import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import gsap from "gsap";
import "@fontsource/bangers";
import "@fontsource/inter";

interface AppProps {
  onTitleStart: () => void;
}

function HUD() {
  return (
    <div className="absolute top-4 left-4 font-display text-2xl text-white/90 tracking-wide">
      <div className="px-3 py-1 bg-black/40 backdrop-blur-sm rounded">
        DEADLY DINOS · M1
      </div>
      <div className="mt-2 px-3 py-1 bg-black/30 backdrop-blur-sm rounded text-base font-ui">
        ◀ ▶ move &nbsp;·&nbsp; space jump
      </div>
    </div>
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
