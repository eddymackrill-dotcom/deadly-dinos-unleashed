import { useGameState } from "../state/gameState";

const DASH_SPEED_MULT = 1.6; // +60% move speed (DESIGN.md §7)
const MAX_HOLD_S = 3; // hold cap — past this the dash is force-released.
const COOLDOWN_HOLD_FACTOR = 1.5; // cooldown = 1.5 × time held.
const MAX_HOLD_COOLDOWN_S = 8; // full penalty cooldown when the cap is hit.
const BURST_DURATION_MS = 200;

type Phase = "ready" | "active" | "cooldown";

export interface PowerCallbacks {
  setDashSpeedMult: (m: number) => void;
  onActivate: () => void;
}

/**
 * Eoraptor's animal power: Quick Dash (+60% speed), HOLD-TO-ACTIVATE.
 *
 * This deviates from the original "tap once, fixed 3s timer" spec (DESIGN.md
 * §7, updated): the boost lasts only while X is held. Releasing starts a
 * cooldown of 1.5× the time held (brief hold → short cooldown, discouraging
 * spam). Holding for the full MAX_HOLD_S force-releases and incurs the full
 * MAX_HOLD_COOLDOWN_S penalty, so you can't just pin X down.
 *
 * Phase progression: ready → press X → active (while held, ≤3s) → release/cap
 * → cooldown → ready. Stats publish to gameState each frame for the HUD radial.
 */
export class PowerSystem {
  private phase: Phase = "ready";
  private heldTime = 0;
  private cooldownTimeLeft = 0;
  private cooldownDuration = 0;

  constructor(private cb: PowerCallbacks) {
    useGameState.getState().setPowerState({
      ready: true,
      active: false,
      cooldownPercent: 0,
    });
  }

  get isActive(): boolean {
    return this.phase === "active";
  }

  /** Call on a fresh X press. Starts the dash if ready. Returns true if it did. */
  tryActivate(): boolean {
    if (this.phase !== "ready") return false;
    this.phase = "active";
    this.heldTime = 0;
    this.cb.setDashSpeedMult(DASH_SPEED_MULT);
    this.cb.onActivate();
    useGameState.getState().setPowerState({
      ready: false,
      active: true,
      cooldownPercent: 1,
      burstUntil: performance.now() + BURST_DURATION_MS,
    });
    return true;
  }

  /** Call when X is released. Ends the dash and starts a hold-scaled cooldown. */
  release() {
    if (this.phase !== "active") return;
    this.beginCooldown(this.heldTime * COOLDOWN_HOLD_FACTOR);
  }

  private beginCooldown(duration: number) {
    this.cb.setDashSpeedMult(1);
    this.cooldownDuration = duration;
    this.cooldownTimeLeft = duration;
    if (duration <= 0) {
      // A single-frame tap — no meaningful cooldown, ready immediately.
      this.phase = "ready";
      useGameState.getState().setPowerState({
        ready: true,
        active: false,
        cooldownPercent: 0,
      });
      return;
    }
    this.phase = "cooldown";
    useGameState.getState().setPowerState({
      ready: false,
      active: false,
      cooldownPercent: 1,
    });
  }

  update(dt: number) {
    if (this.phase === "active") {
      this.heldTime += dt;
      if (this.heldTime >= MAX_HOLD_S) {
        // Held to the cap — force off and take the full penalty cooldown.
        this.beginCooldown(MAX_HOLD_COOLDOWN_S);
      }
      return;
    }
    if (this.phase === "cooldown") {
      this.cooldownTimeLeft = Math.max(0, this.cooldownTimeLeft - dt);
      const pct =
        this.cooldownDuration > 0 ? this.cooldownTimeLeft / this.cooldownDuration : 0;
      useGameState.getState().setPowerState({
        ready: false,
        active: false,
        cooldownPercent: pct,
      });
      if (this.cooldownTimeLeft <= 0) {
        this.phase = "ready";
        useGameState.getState().setPowerState({
          ready: true,
          active: false,
          cooldownPercent: 0,
        });
      }
    }
  }

  /** Test/debug snapshot. */
  getDebugState() {
    return {
      phase: this.phase,
      heldTime: this.heldTime,
      cooldownTimeLeft: this.cooldownTimeLeft,
      cooldownDuration: this.cooldownDuration,
    };
  }
}
