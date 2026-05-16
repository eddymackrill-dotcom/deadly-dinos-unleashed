export class Input {
  private keysDown = new Set<string>();
  private _jumpPressedAt = -Infinity;

  constructor() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.keysDown.has(e.code)) return;
    this.keysDown.add(e.code);
    if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
      this._jumpPressedAt = performance.now();
      e.preventDefault();
    }
    if (e.code === "ArrowLeft" || e.code === "ArrowRight") {
      e.preventDefault();
    }
  };

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
