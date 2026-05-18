import * as THREE from "three";
import { PreyAnimal } from "../entities/PreyAnimal";
import { useGameState } from "../state/gameState";

// Catch math (player at full sprint should beat the timer with comfortable margin):
//   time_to_close = (head_start - catch_radius) / (PLAYER_MAX_SPEED * (1 - PREY_SPEED_RATIO))
//   = (4 - 1.8) / (5 * 0.18) = 2.44s. Timer 7s -> margin 4.56s.
// Catch radius bumped from 1.2 -> 1.8 because Parasaurolophus is ~3u long at
// target height 1u; the smaller radius let the player visually overlap the
// prey's tail before the catch fired.
const CHASE_DURATION_SECONDS = 7;
const PREY_SPAWN_AHEAD_X = 4;
const PREY_SPEED_RATIO = 0.82;
const CATCH_RADIUS = 1.8;
const PLAYER_MAX_SPEED = 5.0;
const FLASH_DURATION_MS = 900;
const LOSE_TAIL_SECONDS = 0.8;
const WIN_RESOLVE_SECONDS = FLASH_DURATION_MS / 1000;

export interface ChaseCallbacks {
  scene: THREE.Object3D;
  setChevronOverride: (x: number | null) => void;
  onCameraShake: (mag: number, dur: number) => void;
  onFOVPulse: () => void;
  onFOVReset: () => void;
  onGlitchSting: () => void;
  setPlayerInputLocked: (locked: boolean) => void;
}

type ChasePhase = "idle" | "running" | "resolving";

/**
 * Visual + input runner for a chase encounter. Knows nothing about the scent
 * sequence — when the encounter ends, it calls `onResolved` with the outcome,
 * and the orchestrator decides what to do (mark the node collected, advance
 * the sequence, refill tracking, etc.).
 *
 * Resolution timing is game-loop driven (not gsap.delayedCall) so the
 * countdown can't silently fail to fire if gsap's ticker hiccups.
 */
export class ChaseSystem {
  private phase: ChasePhase = "idle";
  private prey: PreyAnimal | null = null;
  private timer = 0;
  private resolveTimeLeft = 0;
  private pendingResult: "win" | "lose" | null = null;

  constructor(private cb: ChaseCallbacks) {}

  /** True from chase start through final cleanup (covers the still-frame window). */
  get isActive(): boolean {
    return this.phase !== "idle";
  }

  start(nodeX: number, playerFacing: 1 | -1) {
    if (this.phase !== "idle") return;
    this.phase = "running";
    this.timer = CHASE_DURATION_SECONDS;
    this.resolveTimeLeft = 0;
    this.pendingResult = null;

    this.prey = new PreyAnimal();
    const spawnX = nodeX + playerFacing * PREY_SPAWN_AHEAD_X;
    this.prey.setPosition(spawnX, 0, 0);
    this.prey.setRunSpeed(playerFacing * PLAYER_MAX_SPEED * PREY_SPEED_RATIO);
    this.cb.scene.add(this.prey.root);

    this.cb.setChevronOverride(this.prey.position.x);
    this.cb.onFOVPulse();

    useGameState.getState().startChase();
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

    this.prey.update(dt);
    this.cb.setChevronOverride(this.prey.position.x);

    this.timer -= dt;
    useGameState.getState().setChasePercent(this.timer / CHASE_DURATION_SECONDS);

    const dx = this.prey.position.x - playerPosition.x;
    if (Math.abs(dx) <= CATCH_RADIUS) {
      this.beginResolve("win");
      return;
    }
    if (this.timer <= 0) {
      this.beginResolve("lose");
    }
  }

  private beginResolve(result: "win" | "lose") {
    this.phase = "resolving";
    this.pendingResult = result;
    this.resolveTimeLeft = result === "win" ? WIN_RESOLVE_SECONDS : LOSE_TAIL_SECONDS;
    const flashUntil = performance.now() + FLASH_DURATION_MS;
    useGameState.getState().endChase(result, flashUntil);

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
    this.cb.setChevronOverride(null);
    this.cb.onFOVReset();
    if (result === "win") this.cb.setPlayerInputLocked(false);
    this.phase = "idle";
    this.pendingResult = null;
    this.resolveTimeLeft = 0;
    this.onResolved?.(result);
  }

  onResolved: ((result: "win" | "lose") => void) | null = null;
}
