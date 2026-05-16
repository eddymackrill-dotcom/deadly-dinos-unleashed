import "./styles.css";
import { Game } from "./game/Game";
import { mountUI } from "./ui/App";

const canvas = document.getElementById("game-canvas") as HTMLCanvasElement | null;
const uiRoot = document.getElementById("ui-root");

if (!canvas) throw new Error("#game-canvas not found in index.html");
if (!uiRoot) throw new Error("#ui-root not found in index.html");

const game = new Game(canvas);
game.start();
mountUI(uiRoot, () => game.fx.titleSting());

if (import.meta.hot) {
  import.meta.hot.dispose(() => game.dispose());
}
