import * as THREE from "three";
import { Fish } from "../entities/Fish";
import { useGameState } from "../state/gameState";
import { CATCH_TOTAL_MS, type CatchTarget } from "./CatchFX";

/**
 * Spinosaurus fish-catching encounter (replaces "chase" on the swamp level).
 *
 * The loop: fish cruise up and down the river ahead of the player; the player
 * wades in and holds X to fire a Jaw Snap, which extends the catch hitbox
 * SNAP_REACH units ahead of the snout for SNAP_WINDOW_MS. Any fish inside the
 * box when the jaws close is caught. Catch FISH_NEEDED of them to complete the
 * activity. Snap and miss (or blunder into a fish without snapping) and it
 * darts away, respawning elsewhere in the river after RESPAWN_SECONDS.
 *
 * Same contract as ChaseSystem: this owns visuals + timing only; on resolution
 * it calls `onResolved` and the orchestrator advances the scent sequence.
 */
export const FISHING_TUNING = {
  /** Fish per encounter. */
  FISH_COUNT: 4,
  /** How many must be caught to complete the activity. */
  FISH_NEEDED: 2,
  /** Encounter timer — running it out loses the node. */
  DURATION_SECONDS: 20,
  /** Jaw Snap reach ahead of the player, in world units. */
  SNAP_REACH: 2,
  /** How long the extended hitbox stays live, in ms. */
  SNAP_WINDOW_MS: 300,
  /** Vertical/temporal slop on the hitbox so a snap feels generous. */
  SNAP_HALF_HEIGHT: 1.2,
  /** Fish that get this close without a snap spook and dart away. */
  SPOOK_RADIUS: 0.9,
  /** Seconds a spooked fish stays gone before respawning elsewhere. */
  RESPAWN_SECONDS: 2,
  /** Fish cruise speed as a fraction of the player's in-water wade speed. */
  SPEED_RATIO: 0.5,
};

const FLASH_DURATION_MS = 900;
/** A win now runs the shared tackle choreography, so it resolves on its clock. */
const WIN_RESOLVE_SECONDS = CATCH_TOTAL_MS / 1000;
const LOSE_RESOLVE_SECONDS = 0.8;

export interface FishingCallbacks {
  scene: THREE.Object3D;
  setChevronOverride: (x: number | null) => void;
  onCameraShake: (mag: number, dur: number) => void;
  setPlayerInputLocked: (locked: boolean) => void;
  /** Run the shared catch choreography (snap → tumble → fade). */
  playCatch: (target: CatchTarget | null, facing: 1 | -1, onTextFlash: () => void) => void;
  /** World-X range of the river this encounter takes place in. */
  waterRangeFor: (x: number) => [number, number] | null;
  /** Player's in-water wade speed — fish cruise at SPEED_RATIO × this. */
  playerWadeSpeed: number;
}

type Phase = "idle" | "running" | "resolving";

export class FishingSystem {
  private phase: Phase = "idle";
  private fish: Fish[] = [];
  private timer = 0;
  private caught = 0;
  private resolveTimeLeft = 0;
  private pendingResult: "win" | "lose" | null = null;
  /** Seconds left on the open jaw hitbox. Driven by dt, not the wall clock, so
   *  the window is frame-consistent and the self-test can step it. */
  private snapTimeLeft = 0;
  private snapFacing: 1 | -1 = 1;
  private snapResolved = true;
  private waterRange: [number, number] = [0, 0];
  private playerFacing: 1 | -1 = 1;
  private lastCaught: Fish | null = null;

  constructor(private cb: FishingCallbacks) {}

  get isActive(): boolean {
    return this.phase !== "idle";
  }

  /** True while an extended-jaw hitbox is live (HUD + debug). */
  get isSnapping(): boolean {
    return this.snapTimeLeft > 0;
  }

  start(nodeX: number, playerFacing: 1 | -1) {
    if (this.phase !== "idle") return;
    this.phase = "running";
    this.timer = FISHING_TUNING.DURATION_SECONDS;
    this.caught = 0;
    this.resolveTimeLeft = 0;
    this.pendingResult = null;
    this.playerFacing = playerFacing;
    this.lastCaught = null;
    this.waterRange = this.cb.waterRangeFor(nodeX) ?? [nodeX - 8, nodeX + 8];

    const speed = this.cb.playerWadeSpeed * FISHING_TUNING.SPEED_RATIO;
    this.fish = [];
    for (let i = 0; i < FISHING_TUNING.FISH_COUNT; i++) {
      const f = new Fish((i * Math.PI) / 2);
      f.spawn(this.spawnX(nodeX, i), (i % 2 === 0 ? -0.35 : 0.3), i % 2 === 0 ? speed : -speed);
      this.fish.push(f);
      this.cb.scene.add(f.root);
    }

    this.cb.setChevronOverride(this.nearestFishX(nodeX));
    useGameState.getState().startFishing(FISHING_TUNING.FISH_NEEDED);
  }

  /**
   * Fire a Jaw Snap. Opens the extended hitbox for SNAP_WINDOW_MS; the catch
   * check runs on the closing frame so the animation lands before the fish
   * disappears. No-op outside an encounter (the power still plays its FX).
   */
  triggerSnap(facing: 1 | -1) {
    if (this.phase !== "running") return;
    this.snapTimeLeft = FISHING_TUNING.SNAP_WINDOW_MS / 1000;
    this.snapFacing = facing;
    this.snapResolved = false;
  }

  update(dt: number, playerPosition: THREE.Vector3) {
    if (this.phase === "resolving") {
      for (const f of this.fish) f.update(dt);
      this.resolveTimeLeft -= dt;
      if (this.resolveTimeLeft <= 0 && this.pendingResult !== null) {
        this.finalize(this.pendingResult);
      }
      return;
    }
    if (this.phase !== "running") return;

    const [x0, x1] = this.waterRange;

    for (const f of this.fish) {
      f.update(dt);
      if (f.state === "swimming") {
        // Turn the fish around at the river banks so they stay in play.
        if (f.position.x < x0 + 1 || f.position.x > x1 - 1) {
          f.spawn(
            Math.min(x1 - 1.5, Math.max(x0 + 1.5, f.position.x)),
            f.position.z,
            f.position.x < x0 + 1 ? Math.abs(this.fishSpeed()) : -Math.abs(this.fishSpeed()),
          );
        }
        // Blundering into a fish without snapping spooks it.
        if (
          !this.isSnapping &&
          Math.abs(f.position.x - playerPosition.x) < FISHING_TUNING.SPOOK_RADIUS
        ) {
          f.flee(playerPosition.x, FISHING_TUNING.RESPAWN_SECONDS);
        }
      } else if (f.state === "fleeing" && f.respawnTimer <= 0) {
        f.spawn(this.respawnX(playerPosition.x), f.position.z, this.randomFishSpeed());
      }
    }

    // The jaws are live for the whole window: any fish that enters the hitbox
    // while it's open is caught, so the player doesn't have to lead a moving
    // target to the exact closing frame. Only a window that closes empty misses.
    if (this.snapTimeLeft > 0) {
      this.snapTimeLeft = Math.max(0, this.snapTimeLeft - dt);
      if (!this.snapResolved) {
        const caught = this.tryCatchDuringSnap(playerPosition);
        if (caught) {
          this.snapResolved = true;
          this.snapTimeLeft = 0;
        } else if (this.snapTimeLeft === 0) {
          this.snapResolved = true;
          this.onSnapMissed(playerPosition);
        }
      }
    }

    this.cb.setChevronOverride(this.nearestFishX(playerPosition.x));

    this.timer -= dt;
    useGameState.getState().setFishingState(
      this.timer / FISHING_TUNING.DURATION_SECONDS,
      this.caught,
    );

    if (this.caught >= FISHING_TUNING.FISH_NEEDED) {
      this.beginResolve("win", playerPosition.x);
      return;
    }
    if (this.timer <= 0) this.beginResolve("lose");
  }

  /** A snap that closed with nothing in the jaws — the shoal scatters. */
  private onSnapMissed(playerPosition: THREE.Vector3) {
    for (const f of this.fish) {
      if (f.state !== "swimming") continue;
      if (Math.abs(f.position.x - playerPosition.x) <= FISHING_TUNING.SNAP_REACH + 2) {
        f.flee(playerPosition.x, FISHING_TUNING.RESPAWN_SECONDS);
      }
    }
  }

  /** Per-frame check while the jaws are open. Returns true if a fish was taken. */
  private tryCatchDuringSnap(playerPosition: THREE.Vector3): boolean {
    const target = this.fish.find(
      (f) =>
        f.state === "swimming" &&
        inSnapHitbox(playerPosition, f.position, this.snapFacing, FISHING_TUNING.SNAP_REACH),
    );
    if (!target) return false;

    target.markCaught();
    this.lastCaught = target;
    this.caught += 1;
    useGameState.getState().setFishingState(
      this.timer / FISHING_TUNING.DURATION_SECONDS,
      this.caught,
    );
    this.onFishCaught?.(target, this.caught);
    // The final fish gets the full tackle choreography in beginResolve; the
    // earlier ones get a lighter kick so the encounter still has punctuation.
    if (this.caught < FISHING_TUNING.FISH_NEEDED) this.cb.onCameraShake(0.1, 0.08);
    return true;
  }

  /** Set by Game — per-fish feedback (popup, sound). */
  onFishCaught: ((fish: Fish, caughtCount: number) => void) | null = null;

  private fishSpeed(): number {
    return this.cb.playerWadeSpeed * FISHING_TUNING.SPEED_RATIO;
  }

  private randomFishSpeed(): number {
    return (Math.random() < 0.5 ? -1 : 1) * this.fishSpeed();
  }

  private spawnX(nodeX: number, i: number): number {
    const [x0, x1] = this.waterRange;
    const spread = 3 + i * 2.5;
    const x = nodeX + this.playerFacing * spread;
    return Math.min(x1 - 1.5, Math.max(x0 + 1.5, x));
  }

  /** Respawn somewhere else in the river, away from the player. */
  private respawnX(playerX: number): number {
    const [x0, x1] = this.waterRange;
    for (let attempt = 0; attempt < 8; attempt++) {
      const x = x0 + 1.5 + Math.random() * Math.max(1, x1 - x0 - 3);
      if (Math.abs(x - playerX) > 4) return x;
    }
    return Math.min(x1 - 1.5, Math.max(x0 + 1.5, playerX + 6));
  }

  private nearestFishX(fromX: number): number | null {
    let best: number | null = null;
    let bestDist = Infinity;
    for (const f of this.fish) {
      if (f.state !== "swimming") continue;
      const d = Math.abs(f.position.x - fromX);
      if (d < bestDist) {
        bestDist = d;
        best = f.position.x;
      }
    }
    return best;
  }

  private beginResolve(result: "win" | "lose", playerX = 0) {
    this.phase = "resolving";
    this.pendingResult = result;
    this.resolveTimeLeft = result === "win" ? WIN_RESOLVE_SECONDS : LOSE_RESOLVE_SECONDS;

    if (result === "lose") {
      useGameState.getState().endFishing(result, performance.now() + FLASH_DURATION_MS);
      return;
    }

    // Win: the fish that completed the catch gets the shared choreography, so a
    // snap lands with the same weight as a chase tackle — just a different word.
    const fish = this.lastCaught;
    const facing: 1 | -1 = fish && fish.position.x < playerX ? -1 : 1;
    const target: CatchTarget | null = fish
      ? {
          root: fish.root,
          setOpacity: (o) => fish.setOpacity(o),
          freezeForCatch: () => fish.freezeForCatch(),
          // Ownership stays with this system; finalize() disposes the shoal.
          onDespawn: () => {
            fish.root.visible = false;
          },
        }
      : null;
    this.cb.playCatch(target, facing, () => {
      useGameState.getState().endFishing("win", performance.now() + FLASH_DURATION_MS);
    });
  }

  private finalize(result: "win" | "lose") {
    for (const f of this.fish) {
      this.cb.scene.remove(f.root);
      f.dispose();
    }
    this.fish = [];
    this.lastCaught = null;
    this.cb.setChevronOverride(null);
    this.phase = "idle";
    this.pendingResult = null;
    this.resolveTimeLeft = 0;
    this.onResolved?.(result);
  }

  /** Test/debug snapshot. */
  getDebugState() {
    return {
      phase: this.phase,
      caught: this.caught,
      timer: this.timer,
      snapping: this.isSnapping,
      fishStates: this.fish.map((f) => f.state),
      fishPositions: this.fish.map((f) => f.position.x),
    };
  }

  onResolved: ((result: "win" | "lose") => void) | null = null;
}

/**
 * Jaw Snap hitbox: a box extending `reach` units ahead of the player in the
 * facing direction, with a little slop behind the snout so a fish the player is
 * standing on still counts.
 */
export function inSnapHitbox(
  playerPosition: THREE.Vector3,
  fishPosition: THREE.Vector3,
  facing: 1 | -1,
  reach: number,
): boolean {
  const dx = (fishPosition.x - playerPosition.x) * facing;
  if (dx < -0.5 || dx > reach) return false;
  return Math.abs(fishPosition.y - playerPosition.y) <= FISHING_TUNING.SNAP_HALF_HEIGHT;
}
