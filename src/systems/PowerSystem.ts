import { useGameState } from "../state/gameState";
import type { AnimalPower } from "../data/dinosaurs";

const BURST_DURATION_MS = 200;

type Phase = "ready" | "active" | "cooldown";

/**
 * Effect hooks wired by Game. The PowerSystem owns the hold/cooldown state
 * machine (identical across the roster); the hooks apply each dino's distinct
 * effect. All are optional except the speed channel and the activation FX.
 */
export interface PowerHooks {
  /** Apply the power's move-speed multiplier (1 = none). */
  setSpeedMult: (m: number) => void;
  /** Activation FX (chromatic burst / tint). */
  onActivate: () => void;
  /** Cleanup when the effect ends (release or hold-cap). */
  onDeactivate?: () => void;
  /** Gate — return false to block activation (e.g. River Ambush needs water). */
  canActivate?: () => boolean;
  /** Called when canActivate() blocked the press (e.g. NEEDS WATER tooltip). */
  onActivateRejected?: () => void;
  /** Per-frame while active — shockwave timing, contact checks, transparency. */
  onActiveTick?: (dt: number, heldSeconds: number) => void;
  /** Called on release while active (before cooldown) — e.g. ambush teleport. */
  onRelease?: (heldSeconds: number) => void;
}

/**
 * Generic HOLD-TO-ACTIVATE animal power (DESIGN.md §7), config-driven from the
 * dino's `AnimalPower`. The boost lasts while X is held, up to
 * `maxHoldSeconds`; releasing starts a cooldown of `cooldownHoldFactor × held`;
 * hitting the cap force-releases into the full `cooldownSeconds` penalty.
 *
 * Phase: ready → press X → active (while held) → release/cap → cooldown → ready.
 * Stats publish to gameState each frame for the HUD radial.
 */
export class PowerSystem {
  private phase: Phase = "ready";
  private heldTime = 0;
  private cooldownTimeLeft = 0;
  private cooldownDuration = 0;

  constructor(
    private power: AnimalPower,
    private hooks: PowerHooks,
  ) {
    useGameState.getState().setPowerState({
      ready: true,
      active: false,
      cooldownPercent: 0,
    });
  }

  get isActive(): boolean {
    return this.phase === "active";
  }

  /** Call on a fresh X press. Starts the power if ready and the gate allows. */
  tryActivate(): boolean {
    if (this.phase !== "ready") return false;
    if (this.hooks.canActivate && !this.hooks.canActivate()) {
      this.hooks.onActivateRejected?.();
      return false;
    }
    this.phase = "active";
    this.heldTime = 0;
    this.hooks.setSpeedMult(this.power.speedMultiplier);
    this.hooks.onActivate();
    useGameState.getState().setPowerState({
      ready: false,
      active: true,
      cooldownPercent: 1,
      burstUntil: performance.now() + BURST_DURATION_MS,
      tintColor: this.power.tintColor,
    });
    return true;
  }

  /** Call when X is released. Ends the effect and starts a hold-scaled cooldown. */
  release() {
    if (this.phase !== "active") return;
    this.hooks.onRelease?.(this.heldTime);
    this.beginCooldown(this.heldTime * this.power.cooldownHoldFactor);
  }

  private beginCooldown(duration: number) {
    this.hooks.setSpeedMult(1);
    this.hooks.onDeactivate?.();
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
      this.hooks.onActiveTick?.(dt, this.heldTime);
      if (this.heldTime >= this.power.maxHoldSeconds) {
        // Held to the cap — force off and take the full penalty cooldown.
        this.beginCooldown(this.power.cooldownSeconds);
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
