import "./styles.css";
import { Game } from "./game/Game";
import { mountUI } from "./ui/App";
import { runScentSequenceSelfTest } from "./levels/ScentSequence";
import type { DinoId } from "./data/dinosaurs";

if (import.meta.env.DEV) {
  // Throws if the state machine drifts from the spec. Fails the dev session
  // loudly rather than letting a broken sequence reach the player.
  runScentSequenceSelfTest();
}

const canvas = document.getElementById("game-canvas") as HTMLCanvasElement | null;
const uiRoot = document.getElementById("ui-root");

if (!canvas) throw new Error("#game-canvas not found in index.html");
if (!uiRoot) throw new Error("#ui-root not found in index.html");

// A WebGL canvas only ever yields one context, so reusing the element across
// missions would hand the next Game a disposed context. Swap in a fresh canvas
// (same id → same CSS) for each mission instead.
function freshCanvas(): HTMLCanvasElement {
  const old = document.getElementById("game-canvas");
  const next = document.createElement("canvas");
  next.id = "game-canvas";
  old?.replaceWith(next);
  return next;
}

// One Game instance at a time; created on mission select, disposed on return.
let game: Game | null = null;

function startMission(dinoId: DinoId) {
  game?.dispose();
  game = new Game(freshCanvas(), dinoId);
  game.start();
  game.fx.titleSting(); // chromatic sting under the mission intro card
}

function returnToSelect() {
  game?.dispose();
  game = null;
}

mountUI(uiRoot, { onStartMission: startMission, onReturnToSelect: returnToSelect });

if (import.meta.hot) {
  import.meta.hot.dispose(() => game?.dispose());
}
