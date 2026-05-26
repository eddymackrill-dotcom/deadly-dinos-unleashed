import { useGameState } from "../state/gameState";

const DASH_SPEED_MULT = 1.6;
const DASH_DURATION_S = 3;
const BASE_COOLDOWN_S = 8;
const POWER_COOLDOWN_FACTOR = 0.05; // 5% off per powerStat point
const MIN_COOLDOWN_S = 4;
const BURST_DURATION_MS = 200;

type Phase = "ready" | "active" | "cooldown";

export interface PowerCallbacks {
  setDashSpeedMult: (m: number) => void;
  onActivate: () => void;
  /** Higher powerStat → shorter cooldown. */
  powerStat: number;
}

/**
 * Eoraptor's animal power: Quick Dash (+60% speed for 3s, 8s cooldown).
 * Cooldown only begins once the effect ends, per DESIGN.md §7.
 *
 * Phase progression: ready → press X → active (3s) → cooldown (≈8s) → ready.
 * During cooldown, presses are ignored. Stats publish to gameState each frame
 * so the HUD radial reflects the current cooldown.
 */
export class PowerSystem {
  private phase: Phase = "ready";
  private activeTimeLeft = 0;
  private cooldownTimeLeft = 0;
  private cooldownDuration: number;

  constructor(private cb: PowerCallbacks) {
    this.cooldownDuration = Math.max(
      MIN_COOLDOWN_S,
      BASE_COOLDOWN_S * (1 - cb.powerStat * POWER_COOLDOWN_FACTOR),
    );
    useGameState.getState().setPowerState({
      ready: true,
      active: false,
      cooldownPercent: 0,
    });
  }

  /** Returns true if the press triggered the effect (i.e. we were ready). */
  tryActivate(): boolean {
    if (this.phase !== "ready") return false;
    this.phase = "active";
    this.activeTimeLeft = DASH_DURATION_S;
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

  update(dt: number) {
    if (this.phase === "active") {
      this.activeTimeLeft -= dt;
      if (this.activeTimeLeft <= 0) {
        this.phase = "cooldown";
        this.activeTimeLeft = 0;
        this.cooldownTimeLeft = this.cooldownDuration;
        this.cb.setDashSpeedMult(1);
        useGameState.getState().setPowerState({
          ready: false,
          active: false,
          cooldownPercent: 1,
        });
      }
      return;
    }
    if (this.phase === "cooldown") {
      this.cooldownTimeLeft = Math.max(0, this.cooldownTimeLeft - dt);
      const pct = this.cooldownTimeLeft / this.cooldownDuration;
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
      activeTimeLeft: this.activeTimeLeft,
      cooldownTimeLeft: this.cooldownTimeLeft,
      cooldownDuration: this.cooldownDuration,
    };
  }
}
