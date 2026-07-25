import * as THREE from "three";
import gsap from "gsap";
import type { Dinosaur } from "../entities/Dinosaur";

/**
 * Timing for the shared catch choreography. Every successful catch — chase,
 * stealth pounce, fish snap — runs this one sequence; only the word on screen
 * differs. Values are the spec's, kept in one exported object so the self-test
 * can assert them rather than re-deriving them.
 */
export const CATCH_TIMING = {
  /** Player control is frozen for this long from the moment of contact. */
  freezeMs: 800,
  /** Forward lunge: distance and duration. */
  lungeMs: 150,
  lungeDistanceUnits: 0.5,
  /** Downward pitch during the lunge — only used when the GLB has no attack clip. */
  lungeTiltDegrees: 15,
  /** Prey tumble: drop, rotation and squash. */
  preyTumbleMs: 250,
  preyNudgeUnits: 0.25,
  preyDropUnits: 0.3,
  preySquashY: 0.7,
  preySquashX: 1.15,
  /** The word ("CAUGHT!") appears after the tackle lands, not on contact. */
  textDelayMs: 200,
  /** Prey fade-out, starting the moment the freeze ends. */
  fadeMs: 400,
  /** Camera shake. */
  shakeMs: 150,
  shakeMagnitude: 0.2,
  /** Camera punch-in. */
  fovDropDegrees: 2,
  fovPunchMs: 200,
  /** Chromatic aberration spike. */
  glitchPeak: 0.015,
  glitchMs: 250,
};

/** Total time from contact to the prey being gone. */
export const CATCH_TOTAL_MS = CATCH_TIMING.freezeMs + CATCH_TIMING.fadeMs;

/**
 * Anything that can be tackled. The FX never disposes the target — it fades it
 * and calls `onDespawn`, leaving ownership with whoever spawned it.
 */
export interface CatchTarget {
  root: THREE.Object3D;
  setOpacity(opacity: number): void;
  /** Freeze the entity's own per-frame transform writes so GSAP owns the mesh. */
  freezeForCatch?(): void;
  onDespawn?: () => void;
}

export interface CatchFXDeps {
  player: Dinosaur;
  setPlayerInputLocked: (locked: boolean) => void;
  onCameraShake: (magnitude: number, durationSeconds: number) => void;
  onFOVPunch: (dropDegrees: number, ms: number) => void;
  onGlitchSpike: (peak: number, ms: number) => void;
}

export interface CatchPlayOptions {
  target: CatchTarget | null;
  /** Direction from player to prey — the lunge and tumble both follow it. */
  facing: 1 | -1;
  /** Fires at `textDelayMs`: the caller publishes its result flash here. */
  onTextFlash: () => void;
  /** Fires once the prey has faded and despawned. */
  onComplete?: () => void;
}

type Stage = "idle" | "freeze" | "fade";

/**
 * The predator moment, shared by every encounter that ends with an animal being
 * taken. Bloodless per the CBBC audience (CLAUDE.md §Confirmed Decisions): the
 * player lunges, the prey is knocked off its feet and lies still, then it fades
 * out. No kill is shown.
 *
 * Timeline (ms from contact):
 *   0    input frozen · player lunges (attack clip if the rig has one, else a
 *        tilt) · prey nudged, tumbled and squashed · shake · FOV punch · glitch
 *   200  the word appears — after the tackle lands, so it reads as earned
 *   800  input released · prey begins its 400 ms fade
 *   1200 prey despawns, onComplete fires
 *
 * Stage transitions are driven from the game loop (`update`), not gsap
 * callbacks, so a hitch in the tween ticker can't strand the player frozen.
 */
export class CatchFX {
  private stage: Stage = "idle";
  private elapsedMs = 0;
  private textFired = false;
  private target: CatchTarget | null = null;
  private onTextFlash: (() => void) | null = null;
  private onComplete: (() => void) | null = null;

  constructor(private deps: CatchFXDeps) {}

  get isPlaying(): boolean {
    return this.stage !== "idle";
  }

  play(opts: CatchPlayOptions) {
    // A second catch landing mid-sequence (shouldn't happen — encounters are
    // exclusive) finishes the first one cleanly rather than stacking tweens.
    if (this.stage !== "idle") this.finish();

    this.stage = "freeze";
    this.elapsedMs = 0;
    this.textFired = false;
    this.target = opts.target;
    this.onTextFlash = opts.onTextFlash;
    this.onComplete = opts.onComplete ?? null;

    this.deps.setPlayerInputLocked(true);
    this.deps.player.playCatchLunge(opts.facing);
    this.deps.onCameraShake(CATCH_TIMING.shakeMagnitude, CATCH_TIMING.shakeMs / 1000);
    this.deps.onFOVPunch(CATCH_TIMING.fovDropDegrees, CATCH_TIMING.fovPunchMs);
    this.deps.onGlitchSpike(CATCH_TIMING.glitchPeak, CATCH_TIMING.glitchMs);

    if (this.target) tumbleTarget(this.target, opts.facing);
  }

  update(dt: number) {
    if (this.stage === "idle") return;
    this.elapsedMs += dt * 1000;

    if (!this.textFired && this.elapsedMs >= CATCH_TIMING.textDelayMs) {
      this.textFired = true;
      this.onTextFlash?.();
    }

    if (this.stage === "freeze" && this.elapsedMs >= CATCH_TIMING.freezeMs) {
      this.stage = "fade";
      this.deps.setPlayerInputLocked(false);
    }

    if (this.stage === "fade" && this.elapsedMs >= CATCH_TOTAL_MS) {
      this.finish();
      return;
    }

    if (this.stage === "fade" && this.target) {
      const t = (this.elapsedMs - CATCH_TIMING.freezeMs) / CATCH_TIMING.fadeMs;
      this.target.setOpacity(Math.max(0, 1 - t));
    }
  }

  /** Force the sequence to its end state (also used on dispose). */
  finish() {
    if (this.stage === "idle") return;
    const target = this.target;
    const done = this.onComplete;
    this.stage = "idle";
    this.target = null;
    this.onTextFlash = null;
    this.onComplete = null;

    if (!this.textFired) {
      this.textFired = true;
    }
    this.deps.setPlayerInputLocked(false);
    if (target) {
      gsap.killTweensOf(target.root.position);
      gsap.killTweensOf(target.root.rotation);
      gsap.killTweensOf(target.root.scale);
      target.setOpacity(0);
      target.onDespawn?.();
    }
    done?.();
  }

  /** Test/debug snapshot. */
  getDebugState() {
    return { stage: this.stage, elapsedMs: this.elapsedMs, textFired: this.textFired };
  }
}

/**
 * Knock the prey off its feet: a short forward nudge, then a topple with a
 * squash on impact. The topple is in the screen plane (Z) rather than the spec's
 * literal X — side-on, an X-axis roll would tip the animal away from camera and
 * foreshorten into nothing, where a Z topple reads as "bowled over".
 */
function tumbleTarget(target: CatchTarget, facing: 1 | -1) {
  target.freezeForCatch?.();
  const root = target.root;
  const tumbleSeconds = CATCH_TIMING.preyTumbleMs / 1000;

  gsap.killTweensOf(root.position);
  gsap.killTweensOf(root.rotation);
  gsap.killTweensOf(root.scale);

  gsap
    .timeline()
    .to(root.position, {
      x: root.position.x + facing * CATCH_TIMING.preyNudgeUnits,
      duration: tumbleSeconds * 0.35,
      ease: "power2.out",
    })
    .to(root.position, {
      y: root.position.y - CATCH_TIMING.preyDropUnits,
      duration: tumbleSeconds * 0.65,
      ease: "power2.in",
    });

  gsap.to(root.rotation, {
    z: -facing * (Math.PI / 2),
    duration: tumbleSeconds,
    ease: "power2.in",
  });

  gsap
    .timeline()
    .to(root.scale, {
      x: CATCH_TIMING.preySquashX,
      y: CATCH_TIMING.preySquashY,
      duration: tumbleSeconds * 0.6,
      ease: "power2.out",
    })
    .to(root.scale, { x: 1, y: 1, duration: tumbleSeconds * 0.6, ease: "power1.inOut" });
}
