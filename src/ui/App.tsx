import { createRoot } from "react-dom/client";

function App() {
  return (
    <div className="absolute top-4 left-4 font-display text-2xl text-white/90 tracking-wide">
      <div className="px-3 py-1 bg-black/40 backdrop-blur-sm rounded">
        DEADLY DINOS · M0 SCAFFOLD
      </div>
    </div>
  );
}

export function mountUI(rootEl: HTMLElement) {
  const root = createRoot(rootEl);
  root.render(<App />);
  return root;
}
