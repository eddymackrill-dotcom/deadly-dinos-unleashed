import * as THREE from "three";
import gsap from "gsap";
import { PreyAnimal } from "../entities/PreyAnimal";
import { useGameState } from "../state/gameState";

// Catch math (player at full sprint should beat the timer with ~2s margin):
//   time_to_close = head_start / (PLAYER_MAX_SPEED * (1 - PREY_SPEED_RATIO))
//   = 4 / (5 * 0.18) = 4.44s. Timer 7s -> conservative margin 2.56s. ✓
//   With catch radius factored in: (4 - 2.0) / 0.9 = 2.22s -> real margin 4.78s.
const CHASE_DURATION_SECONDS = 7;
const PREY_SPAWN_AHEAD_X = 4;
const PREY_SPEED_RATIO = 0.82;
const CATCH_RADIUS = 2.0;
const PLAYER_MAX_SPEED = 5.0;
const FLASH_DURATION_MS = 900;

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
  private prey: PreyAnimal | null = null;
  private timer = 0;

  constructor(private cb: ChaseCallbacks) {}

  get isActive() {
    return this.active;
  }

  start(scentNodeX: number, playerFacing: 1 | -1) {
    if (this.active) return;
    this.active = true;
    this.timer = CHASE_DURATION_SECONDS;

    this.prey = new PreyAnimal();
    const spawnX = scentNodeX + playerFacing * PREY_SPAWN_AHEAD_X;
    this.prey.setPosition(spawnX, 0, 0);
    this.prey.setRunSpeed(playerFacing * PLAYER_MAX_SPEED * PREY_SPEED_RATIO);
    this.cb.scene.add(this.prey.root);

    this.cb.setChevronOverride(this.prey.position.x);
    this.cb.onFOVPulse();

    useGameState.getState().startChase();
  }

  update(dt: number, playerPosition: THREE.Vector3) {
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
    if (!this.active || !this.prey) return;
    this.active = false;
    const flashUntil = performance.now() + FLASH_DURATION_MS;
    useGameState.getState().endChase(result, flashUntil);

    if (result === "win") {
      this.cb.onCameraShake(0.18, 0.1);
      this.cb.onGlitchSting();
      this.cb.setPlayerInputLocked(true);
      gsap.delayedCall(FLASH_DURATION_MS / 1000, () => {
        this.cb.setPlayerInputLocked(false);
        this.cleanup();
        this.cb.onFOVReset();
        this.onResolved?.(result);
      });
    } else {
      // Prey escapes off-screen — let it run a bit before cleanup.
      gsap.delayedCall(0.8, () => {
        this.cleanup();
        this.cb.onFOVReset();
        this.onResolved?.(result);
      });
    }
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
