import * as THREE from "three";
import { PreyAnimal } from "../entities/PreyAnimal";
import { useGameState } from "../state/gameState";

// Catch math (player at full sprint should beat the timer with ~1.5s margin):
//   time_to_close = head_start / (PLAYER_MAX_SPEED * (1 - PREY_SPEED_RATIO))
//   = 4 / (5 * 0.18) = 4.44s. Timer 7s -> conservative margin 2.56s. ✓
//   With catch radius factored in: (4 - 1.2) / 0.9 = 3.11s -> real margin 3.89s.
//   Hitbox tightened from 2.0 -> 1.2 after playtest reported catches firing
//   when the player was visibly a couple of units short of the prey.
const CHASE_DURATION_SECONDS = 7;
const PREY_SPAWN_AHEAD_X = 4;
const PREY_SPEED_RATIO = 0.82;
const CATCH_RADIUS = 1.2;
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

export class ChaseSystem {
  private active = false;
  // Resolving covers the still-frame window between catch (or timer expiry) and
  // final cleanup. While resolving, isActive stays true so the proximity check
  // in handleScentProgress does not re-trigger chase.start() and wedge the
  // sequence forever. The countdown is driven by the game loop (chase.update)
  // rather than gsap.delayedCall, so it survives any external ticker issue.
  private resolving = false;
  private resolveTimeLeft = 0;
  private pendingResult: "win" | "lose" | null = null;
  private prey: PreyAnimal | null = null;
  private timer = 0;

  constructor(private cb: ChaseCallbacks) {}

  get isActive() {
    return this.active || this.resolving;
  }

  start(scentNodeX: number, playerFacing: 1 | -1) {
    if (this.active || this.resolving) {
      console.log(`[chase] start rejected: active=${this.active} resolving=${this.resolving}`);
      return;
    }
    this.active = true;
    this.resolving = false;
    this.resolveTimeLeft = 0;
    this.pendingResult = null;
    this.timer = CHASE_DURATION_SECONDS;

    this.prey = new PreyAnimal();
    const spawnX = scentNodeX + playerFacing * PREY_SPAWN_AHEAD_X;
    this.prey.setPosition(spawnX, 0, 0);
    this.prey.setRunSpeed(playerFacing * PLAYER_MAX_SPEED * PREY_SPEED_RATIO);
    this.cb.scene.add(this.prey.root);

    this.cb.setChevronOverride(this.prey.position.x);
    this.cb.onFOVPulse();

    useGameState.getState().startChase();
    console.log(`[chase] start: node@${scentNodeX} facing=${playerFacing} prey@${spawnX} speed=${(playerFacing * PLAYER_MAX_SPEED * PREY_SPEED_RATIO).toFixed(2)} timer=${this.timer}`);
  }

  update(dt: number, playerPosition: THREE.Vector3) {
    if (this.resolving) {
      this.resolveTimeLeft -= dt;
      if (this.resolveTimeLeft <= 0 && this.pendingResult !== null) {
        this.finalize(this.pendingResult);
      }
      return;
    }

    if (!this.active || !this.prey) return;

    this.prey.update(dt);
    this.cb.setChevronOverride(this.prey.position.x);

    this.timer -= dt;
    useGameState.getState().setChasePercent(this.timer / CHASE_DURATION_SECONDS);

    const dx = this.prey.position.x - playerPosition.x;
    if (Math.abs(dx) <= CATCH_RADIUS) {
      this.resolve("win");
      return;
    }

    if (this.timer <= 0) {
      this.resolve("lose");
    }
  }

  private resolve(result: "win" | "lose") {
    if (!this.active || this.resolving || !this.prey) {
      console.log(`[chase] resolve rejected: active=${this.active} resolving=${this.resolving} prey=${!!this.prey}`);
      return;
    }
    console.log(`[chase] resolve(${result}): entering ${result === "win" ? WIN_RESOLVE_SECONDS : LOSE_TAIL_SECONDS}s wind-down`);
    this.resolving = true;
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
    console.log(`[chase] finalize: cleanup + flags reset + onResolved(${result})`);
    this.cleanup();
    this.cb.onFOVReset();
    if (result === "win") this.cb.setPlayerInputLocked(false);
    this.active = false;
    this.resolving = false;
    this.pendingResult = null;
    this.resolveTimeLeft = 0;
    this.onResolved?.(result);
  }

  private cleanup() {
    if (this.prey) {
      this.cb.scene.remove(this.prey.root);
      this.prey.dispose();
      this.prey = null;
    }
    this.cb.setChevronOverride(null);
  }

  onResolved: ((result: "win" | "lose") => void) | null = null;
}
