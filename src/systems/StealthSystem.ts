import * as THREE from "three";
import { Bush } from "../entities/Bush";
import { PreyAnimal } from "../entities/PreyAnimal";
import { useGameState } from "../state/gameState";

// Drain math: at senses=5 we want ~10s in the open to fully empty.
//   drainRate = 1 / (BASE_DRAIN_SECONDS * (1 + senses * SENSES_DRAIN_FACTOR))
// Hiding refills at REFILL_MULTIPLIER × drain rate (so 2× drain).
export const STEALTH_TUNING = {
  BASE_DRAIN_SECONDS: 6,
  SENSES_DRAIN_FACTOR: 0.12,
  REFILL_MULTIPLIER: 2,
};
const BASE_DRAIN_SECONDS = STEALTH_TUNING.BASE_DRAIN_SECONDS;
const SENSES_DRAIN_FACTOR = STEALTH_TUNING.SENSES_DRAIN_FACTOR;
const REFILL_MULTIPLIER = STEALTH_TUNING.REFILL_MULTIPLIER;

/** Pure bar-step used by StealthSystem.update() and the self-test. */
export function stealthBarStep(
  current: number,
  dt: number,
  inBush: boolean,
  sensesStat: number,
): number {
  const drainPerSecond =
    1 / (BASE_DRAIN_SECONDS * (1 + sensesStat * SENSES_DRAIN_FACTOR));
  if (inBush) return Math.min(1, current + drainPerSecond * REFILL_MULTIPLIER * dt);
  return Math.max(0, current - drainPerSecond * dt);
}
const BUSH_SPEED_MULT = 0.5;
const PREY_SPAWN_AHEAD_X = 6;
const CATCH_RADIUS = 1.8;
const TINT_COLOR = new THREE.Color(0x67d6ff);
const TINT_MIX_OPEN = 0.35;
const TINT_MIX_BUSH = 0.55;
const BUSH_OPACITY = 0.25;
const FLASH_DURATION_MS = 900;
const WIN_RESOLVE_SECONDS = FLASH_DURATION_MS / 1000;
const LOSE_RESOLVE_SECONDS = 0.8;

export interface StealthCallbacks {
  scene: THREE.Object3D;
  setChevronOverride: (x: number | null) => void;
  onCameraShake: (mag: number, dur: number) => void;
  onGlitchSting: () => void;
  setPlayerInputLocked: (locked: boolean) => void;
  setPlayerSpeedMult: (m: number) => void;
  setPlayerTint: (color: THREE.Color | null, mix: number, opacity: number) => void;
  /** Higher sensesStat → slower drain (more lenient). */
  sensesStat: number;
}

type StealthPhase = "idle" | "running" | "resolving";

/**
 * Stealth encounter runner. Player approaches a stationary prey along a path
 * dotted with bushes. Bar drains in the open, refills inside a bush, slows
 * movement to 50% while hidden. Reach the prey before the bar empties to win;
 * empty bar = prey spooked → lose.
 */
export class StealthSystem {
  private phase: StealthPhase = "idle";
  private prey: PreyAnimal | null = null;
  private bushes: Bush[] = [];
  private barPercent = 1;
  private resolveTimeLeft = 0;
  private pendingResult: "win" | "lose" | null = null;
  private playerFacing: 1 | -1 = 1;

  constructor(private cb: StealthCallbacks) {}

  get isActive(): boolean {
    return this.phase !== "idle";
  }

  start(nodeX: number, playerFacing: 1 | -1) {
    if (this.phase !== "idle") return;
    this.phase = "running";
    this.barPercent = 1;
    this.resolveTimeLeft = 0;
    this.pendingResult = null;
    this.playerFacing = playerFacing;

    // Spawn the prey ahead of the player, stationary (slow graze idle handled
    // by the run animation playing at low speed visually — keep vx near 0).
    this.prey = new PreyAnimal();
    const preyX = nodeX + playerFacing * PREY_SPAWN_AHEAD_X;
    this.prey.setPosition(preyX, 0, 0);
    this.prey.setRunSpeed(0);
    this.cb.scene.add(this.prey.root);

    // Scatter 3 bushes along the path between node and prey.
    this.bushes = [];
    const span = PREY_SPAWN_AHEAD_X - 1.2;
    for (let i = 0; i < 3; i++) {
      const t = (i + 1) / 4;
      const x = nodeX + playerFacing * span * t;
      const z = (i % 2 === 0 ? -0.2 : 0.2) + (Math.random() - 0.5) * 0.2;
      const bush = new Bush(new THREE.Vector3(x, 0, z), 0.95, (nodeX | 0) * 31 + i);
      this.bushes.push(bush);
      this.cb.scene.add(bush.root);
    }

    this.cb.setChevronOverride(this.prey.position.x);
    useGameState.getState().startStealth();
  }

  update(dt: number, playerPosition: THREE.Vector3) {
    if (this.phase === "resolving") {
      this.resolveTimeLeft -= dt;
      if (this.resolveTimeLeft <= 0 && this.pendingResult !== null) {
        this.finalize(this.pendingResult);
      }
      return;
    }

    if (this.phase !== "running" || !this.prey) return;

    const inBush = this.bushes.some((b) => b.contains(playerPosition.x));

    this.barPercent = stealthBarStep(this.barPercent, dt, inBush, this.cb.sensesStat);
    if (inBush) {
      this.cb.setPlayerSpeedMult(BUSH_SPEED_MULT);
      this.cb.setPlayerTint(TINT_COLOR, TINT_MIX_BUSH, BUSH_OPACITY);
    } else {
      this.cb.setPlayerSpeedMult(1);
      this.cb.setPlayerTint(TINT_COLOR, TINT_MIX_OPEN, 1);
    }

    useGameState.getState().setStealthState(this.barPercent, inBush);

    // Update prey (mostly stationary; ensure facing toward player so it reads
    // as alert).
    this.prey.update(dt);

    const dx = this.prey.position.x - playerPosition.x;
    if (Math.abs(dx) <= CATCH_RADIUS) {
      this.beginResolve("win");
      return;
    }
    if (this.barPercent <= 0) {
      // Prey spooks — sprint away in the direction it's facing.
      this.prey.setRunSpeed(this.playerFacing * 6);
      this.beginResolve("lose");
    }
  }

  private beginResolve(result: "win" | "lose") {
    this.phase = "resolving";
    this.pendingResult = result;
    this.resolveTimeLeft = result === "win" ? WIN_RESOLVE_SECONDS : LOSE_RESOLVE_SECONDS;
    const flashUntil = performance.now() + FLASH_DURATION_MS;
    useGameState.getState().endStealth(result, flashUntil);

    if (result === "win") {
      this.cb.onCameraShake(0.18, 0.1);
      this.cb.onGlitchSting();
      this.cb.setPlayerInputLocked(true);
    }
  }

  private finalize(result: "win" | "lose") {
    if (this.prey) {
      this.cb.scene.remove(this.prey.root);
      this.prey.dispose();
      this.prey = null;
    }
    for (const bush of this.bushes) {
      this.cb.scene.remove(bush.root);
      bush.dispose();
    }
    this.bushes = [];
    this.cb.setChevronOverride(null);
    this.cb.setPlayerSpeedMult(1);
    this.cb.setPlayerTint(null, 0, 1);
    if (result === "win") this.cb.setPlayerInputLocked(false);
    this.phase = "idle";
    this.pendingResult = null;
    this.resolveTimeLeft = 0;
    this.onResolved?.(result);
  }

  onResolved: ((result: "win" | "lose") => void) | null = null;
}
