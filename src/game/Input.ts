export type ArrowDir = "up" | "down" | "left" | "right";

export class Input {
  private keysDown = new Set<string>();
  private _jumpPressedAt = -Infinity;
  private _arrowPressedAt = new Map<ArrowDir, number>();
  private _powerPressedAt = -Infinity;

  constructor() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.keysDown.has(e.code)) return;
    this.keysDown.add(e.code);
    const now = performance.now();
    if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
      this._jumpPressedAt = now;
      e.preventDefault();
    }
    if (e.code === "KeyX") {
      this._powerPressedAt = now;
      e.preventDefault();
    }
    const arrow = this.arrowFromCode(e.code);
    if (arrow) {
      this._arrowPressedAt.set(arrow, now);
    }
    if (e.code === "ArrowLeft" || e.code === "ArrowRight") {
      e.preventDefault();
    }
  };

  private arrowFromCode(code: string): ArrowDir | null {
    switch (code) {
      case "ArrowUp":
      case "KeyW":
        return "up";
      case "ArrowDown":
      case "KeyS":
        return "down";
      case "ArrowLeft":
      case "KeyA":
        return "left";
      case "ArrowRight":
      case "KeyD":
        return "right";
      default:
        return null;
    }
  }

  arrowPressedAt(dir: ArrowDir): number {
    return this._arrowPressedAt.get(dir) ?? -Infinity;
  }

  consumeArrowPress(dir: ArrowDir) {
    this._arrowPressedAt.set(dir, -Infinity);
  }

  powerPressedAt(): number {
    return this._powerPressedAt;
  }

  consumePowerPress() {
    this._powerPressedAt = -Infinity;
  }

  private onKeyUp = (e: KeyboardEvent) => {
    this.keysDown.delete(e.code);
  };

  private onBlur = () => {
    this.keysDown.clear();
  };

  get dir(): number {
    const r = this.keysDown.has("ArrowRight") || this.keysDown.has("KeyD") ? 1 : 0;
    const l = this.keysDown.has("ArrowLeft") || this.keysDown.has("KeyA") ? 1 : 0;
    return r - l;
  }

  jumpPressedAt(): number {
    return this._jumpPressedAt;
  }

  consumeJumpPress() {
    this._jumpPressedAt = -Infinity;
  }

  dispose() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
  }
}
