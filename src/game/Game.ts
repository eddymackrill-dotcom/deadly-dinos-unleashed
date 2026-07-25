import * as THREE from "three";
import gsap from "gsap";
import { Scene } from "./Scene";
import { Camera } from "./Camera";
import { Input } from "./Input";
import { PostProcess } from "./PostProcess";
import { buildLevel } from "../levels/buildLevel";
import { LEVELS } from "../data/levels";
import type { Level } from "../levels/Level";
import type { CollectedEvent } from "../levels/ScentSequence";
import { Dinosaur } from "../entities/Dinosaur";
import { PreyAnimal } from "../entities/PreyAnimal";
import { Rival } from "../entities/Rival";
import { WakeTrail } from "../entities/WakeTrail";
import { TrackingSystem } from "../systems/TrackingSystem";
import { ChaseSystem } from "../systems/ChaseSystem";
import { StealthSystem } from "../systems/StealthSystem";
import { FishingSystem } from "../systems/FishingSystem";
import { DefenseSystem } from "../systems/DefenseSystem";
import { CatchFX } from "../systems/CatchFX";
import { HiddenSecretsSystem } from "../systems/HiddenSecretsSystem";
import { PowerSystem } from "../systems/PowerSystem";
import { trackingDuration, DINOS, type DinoId, type DinoDef } from "../data/dinosaurs";
import { SCORE } from "../data/scoring";
import { getBiome } from "../data/biomes";
import { useGameState } from "../state/gameState";
import { commitMissionResult, getDinoSave, getMissionSave } from "../progression/Save";

const JUMP_BUFFER_MS = 100;
const REACH_RADIUS = 1.5;
const CHASE_FOV = 28;
/** Wading is faster than walking the bank — Spinosaurus is at home in the river. */
const WATER_SPEED_MULT = 1.3;
/** How deep the mesh sits while wading (fraction of model height). */
const WATER_SUBMERSION = 0.4;

export class GameFX {
  constructor(private intensityRef: { value: number }) {}

  titleSting() {
    gsap.killTweensOf(this.intensityRef);
    gsap
      .timeline()
      .set(this.intensityRef, { value: 0 })
      .to(this.intensityRef, { value: 0.008, duration: 0.1, ease: "power2.out" })
      .to(this.intensityRef, { value: 0.003, duration: 0.1, ease: "power2.in" })
      .to(this.intensityRef, { value: 0.003, duration: 2.4 })
      .to(this.intensityRef, { value: 0, duration: 0.4, ease: "power2.in" });
  }

  catchSting() {
    gsap.killTweensOf(this.intensityRef);
    gsap
      .timeline()
      .set(this.intensityRef, { value: 0 })
      .to(this.intensityRef, { value: 0.012, duration: 0.05, ease: "power2.out" })
      .to(this.intensityRef, { value: 0.004, duration: 0.15, ease: "power2.in" })
      .to(this.intensityRef, { value: 0, duration: 0.5, ease: "power2.in" });
  }

  /** Catch-moment aberration spike — stronger and longer than the old sting. */
  catchSpike(peak: number, ms: number) {
    const seconds = ms / 1000;
    gsap.killTweensOf(this.intensityRef);
    gsap
      .timeline()
      .set(this.intensityRef, { value: 0 })
      .to(this.intensityRef, { value: peak, duration: seconds * 0.25, ease: "power2.out" })
      .to(this.intensityRef, { value: 0, duration: seconds * 0.75, ease: "power2.in" });
  }

  dashBurst() {
    gsap.killTweensOf(this.intensityRef);
    gsap
      .timeline()
      .set(this.intensityRef, { value: 0 })
      .to(this.intensityRef, { value: 0.012, duration: 0.05, ease: "power2.out" })
      .to(this.intensityRef, { value: 0, duration: 0.15, ease: "power2.in" });
  }
}

export class Game {
  private scene: Scene;
  private camera: Camera;
  private clock: THREE.Clock;
  private level: Level;
  private player: Dinosaur;
  private input: Input;
  private postProcess: PostProcess;
  private tracking: TrackingSystem;
  private chase: ChaseSystem;
  private stealth: StealthSystem;
  private fishing: FishingSystem;
  private defense: DefenseSystem;
  private secrets: HiddenSecretsSystem;
  private power: PowerSystem;
  private catchFX: CatchFX;
  private wake: WakeTrail | null = null;
  private stealthSpeedMult = 1;
  private powerSpeedMult = 1;
  private waterSpeedMult = 1;
  private inputLocked = false;
  // Power effect state (driven by the active dino's AnimalPower config).
  private instantCatchActive = false; // Sickle Strike: contact = catch
  private shockwaveTimer = 0; // Apex Roar: pulse cadence
  private readonly dino: DinoDef;
  private readonly missionId: string;
  readonly fx: GameFX;
  private rafId: number | null = null;
  private running = false;

  constructor(canvas: HTMLCanvasElement, dinoId: DinoId = "eoraptor") {
    const dino = DINOS[dinoId];
    const levelConfig = LEVELS[dinoId];
    this.dino = dino;
    this.missionId = levelConfig.id;

    this.scene = new Scene(canvas);
    this.camera = new Camera();
    this.clock = new THREE.Clock();
    this.input = new Input();

    this.level = buildLevel(levelConfig);
    this.scene.scene.add(this.level.root);
    this.scene.applyBiome(getBiome(dino.biomeId));

    this.player = new Dinosaur();
    this.scene.scene.add(this.player.root);
    this.camera.follow(this.player);

    this.postProcess = new PostProcess(this.scene.renderer, this.scene.scene, this.camera.camera);
    this.fx = new GameFX(this.postProcess.glitchIntensity);

    // One choreography for every kind of catch — chase, stealth, fish.
    this.catchFX = new CatchFX({
      player: this.player,
      setPlayerInputLocked: (locked) => {
        this.inputLocked = locked;
      },
      onCameraShake: (mag, dur) => this.camera.shake(mag, dur),
      onFOVPunch: (drop, ms) => this.camera.punchFOV(drop, ms),
      onGlitchSpike: (peak, ms) => this.fx.catchSpike(peak, ms),
    });

    const dinoSave = getDinoSave(dino.id);
    const missionSave = getMissionSave(dino.id, this.missionId);

    const state = useGameState.getState();
    state.reset();
    state.setDino({
      id: dino.id,
      name: dino.displayName,
      era: dino.era,
      region: dino.region,
      stats: dino.stats,
      rank: dinoSave.rank,
    });
    state.setScentProgress(0, this.level.sequence.total);

    state.setPersistedTotals({
      totalPredatorPoints: dinoSave.predatorPoints,
      bestMissionCompletion: missionSave.completion,
      bestMissionPoints: missionSave.bestPoints,
    });

    const duration = trackingDuration(dino.stats, dino.baseTrackingDuration);
    this.tracking = new TrackingSystem(duration, () => this.onMissionFail());

    this.chase = new ChaseSystem({
      scene: this.scene.scene,
      setChevronOverride: (x) => this.level.setChevronTargetOverride(x),
      onFOVPulse: () => this.camera.setFOV(CHASE_FOV, 0.5),
      onFOVReset: () => this.camera.resetFOV(0.5),
      setPlayerInputLocked: (locked) => {
        this.inputLocked = locked;
      },
      playCatch: (target, facing, onTextFlash) =>
        this.catchFX.play({ target, facing, onTextFlash }),
      isInstantCatchActive: () => this.instantCatchActive,
    });
    this.chase.onResolved = (outcome) => {
      const ev = this.level.sequence.resolveEncounter(outcome);
      if (ev && ev.kind === "collected") this.applyCollected(ev);
    };

    this.stealth = new StealthSystem({
      scene: this.scene.scene,
      setChevronOverride: (x) => this.level.setChevronTargetOverride(x),
      setPlayerInputLocked: (locked) => {
        this.inputLocked = locked;
      },
      playCatch: (target, facing, onTextFlash) =>
        this.catchFX.play({ target, facing, onTextFlash }),
      setPlayerSpeedMult: (m) => {
        this.stealthSpeedMult = m;
        this.applySpeedMultiplier();
      },
      setPlayerTint: (color, mix, opacity) => this.player.setTint(color, mix, opacity),
      sensesStat: this.dino.stats.senses,
    });
    this.stealth.onResolved = (outcome) => {
      const ev = this.level.sequence.resolveEncounter(outcome);
      if (ev && ev.kind === "collected") this.applyCollected(ev);
    };

    // Spinosaurus fish-catching. Only the swamp level has water tiles, so on
    // every other mission this system simply never starts.
    this.fishing = new FishingSystem({
      scene: this.scene.scene,
      setChevronOverride: (x) => this.level.setChevronTargetOverride(x),
      onCameraShake: (mag, dur) => this.camera.shake(mag, dur),
      setPlayerInputLocked: (locked) => {
        this.inputLocked = locked;
      },
      playCatch: (target, facing, onTextFlash) =>
        this.catchFX.play({ target, facing, onTextFlash }),
      waterRangeFor: (x) => this.level.waterRangeAt?.(x) ?? null,
      playerWadeSpeed: 5.0 * WATER_SPEED_MULT,
    });
    this.fishing.onResolved = (outcome) => {
      const ev = this.level.sequence.resolveEncounter(outcome);
      if (ev && ev.kind === "collected") this.applyCollected(ev);
    };
    this.fishing.onFishCaught = (fish, caughtCount) => {
      // The last fish is handed to the catch choreography, which does the fade.
      if (caughtCount < 2) fish.setOpacity(0.35);
      useGameState.getState().pushRewardPopup("FISH!");
    };

    if (getBiome(dino.biomeId).water) {
      this.wake = new WakeTrail();
      this.scene.scene.add(this.wake.root);
    }

    this.defense = new DefenseSystem({
      scene: this.scene.scene,
      input: this.input,
      setChevronOverride: (x) => this.level.setChevronTargetOverride(x),
      setPlayerInputLocked: (locked) => {
        this.inputLocked = locked;
      },
      setPlayerTint: (color, mix, opacity) => this.player.setTint(color, mix, opacity),
      onCameraShake: (mag, dur) => this.camera.shake(mag, dur),
      onGlitchSting: () => this.fx.catchSting(),
      toughnessStat: this.dino.stats.toughness,
    });
    this.secrets = new HiddenSecretsSystem(
      { scene: this.scene.scene },
      this.level.secrets,
      missionSave.foundSecretIds ?? [],
    );

    // The active dino's animal power (selected via Mission Select in chunk 5).
    const power = dino.animalPower;
    state.setPowerName(power.displayName);
    this.power = new PowerSystem(power, {
      setSpeedMult: (m) => {
        this.powerSpeedMult = m;
        this.applySpeedMultiplier();
      },
      onActivate: () => {
        this.fx.dashBurst();
        this.shockwaveTimer = 0;
        this.instantCatchActive = !!power.instantCatch;
        if (power.jawSnap) {
          // Jaw Snap: lunge, and open the extended catch hitbox for the window.
          const facing: 1 | -1 = this.player.facingDirection;
          this.player.playJawSnap(facing, power.jawSnap.windowMs);
          this.fishing.triggerSnap(facing);
          this.camera.shake(0.08, 0.08);
        } else if (power.trail) {
          // Sickle Strike: glowing surge (full after-image trail deferred — M5).
          this.player.setTint(new THREE.Color(power.tintColor ?? "#ffd24a"), 0.4, 1);
        }
      },
      onDeactivate: () => {
        this.instantCatchActive = false;
        this.shockwaveTimer = 0;
        this.player.setTint(null, 0, 1);
      },
      onActiveTick: (dt) => {
        if (power.shockwave) {
          // Apex Roar: emit an expanding shockwave on a fixed cadence.
          this.shockwaveTimer += dt;
          if (this.shockwaveTimer >= power.shockwave.intervalSeconds) {
            this.shockwaveTimer -= power.shockwave.intervalSeconds;
            useGameState.getState().pushShockwave();
            this.camera.shake(0.1, 0.12);
          }
        }
      },
    });

    this.defense.onResolved = (outcome) => {
      // Flat economy: all three arrows = 200, any credit = 100, none = 0. The
      // hit ratio decides win/partial/lose, it does not scale the award.
      const ev = this.level.sequence.resolveEncounter(
        outcome,
        outcome === "partial" ? SCORE.defensePartial : undefined,
      );
      if (ev && ev.kind === "collected") this.applyCollected(ev);
    };

    void this.player.load({
      url: dino.modelPath,
      targetHeight: dino.modelScale,
      idleNameHint: "idle",
      runNameHint: "run",
      baseRotationY: dino.modelRotationY,
    });

    // Warm the GLB caches so the first chase / defense doesn't pop in.
    PreyAnimal.preload();
    Rival.preload();
  }

  private onMissionFail() {
    useGameState.getState().setStatus("failed");
    this.fx.titleSting();
    this.commitMissionToSave();
  }

  private applySpeedMultiplier() {
    this.player.setSpeedMultiplier(
      this.stealthSpeedMult * this.powerSpeedMult * this.waterSpeedMult,
    );
  }

  /** True if the active dino is standing on a level water tile. */
  private isPlayerInWater(): boolean {
    return this.level.isWater?.(this.player.position.x) ?? false;
  }

  /**
   * Wading: in water the dino sits ~40% submerged, moves 30% faster, and drags a
   * bow wake behind it. Applied every frame so entering/leaving the river is
   * driven purely by position — no state to get stuck.
   */
  private updateWading(dt: number) {
    const inWater = this.isPlayerInWater();
    const targetMult = inWater ? WATER_SPEED_MULT : 1;
    if (targetMult !== this.waterSpeedMult) {
      this.waterSpeedMult = targetMult;
      this.applySpeedMultiplier();
    }
    this.player.setSubmersion(inWater ? WATER_SUBMERSION : 0);
    this.wake?.update(dt, inWater, this.player.position.x, this.player.speed);
  }

  /**
   * The mission-complete bonus: a flat 500, and only when every activity in the
   * mission was completed successfully. A partial or missed node forfeits it.
   */
  private missionBonusFor(): number {
    const seq = this.level.sequence;
    if (!seq.isComplete) return 0;
    const results = seq.getResults();
    const allWon = results.length === seq.total && results.every((r) => r.outcome === "win");
    return allWon ? SCORE.missionCompleteBonus : 0;
  }

  private commitMissionToSave() {
    const state = useGameState.getState();
    const seq = this.level.sequence;
    const successes = seq.getResults().filter((r) => r.outcome === "win").length;
    const completion = seq.total === 0 ? 0 : successes / seq.total;
    const secretIds = this.secrets.getClaimedIds();
    const result = commitMissionResult({
      dinoId: this.dino.id,
      missionId: this.missionId,
      completion,
      pointsEarned:
        seq.totalPointsEarned() + state.secretBonusPoints + state.missionBonusPoints,
      foundSecretIds: secretIds,
      hiddenSecretsFound: this.secrets.claimedCount,
    });
    state.setPersistedTotals({
      totalPredatorPoints: result.totalPredatorPoints,
      bestMissionCompletion: result.mission.completion,
      bestMissionPoints: result.mission.bestPoints,
    });
    state.setNewBests({
      newBestCompletion: result.isNewBestCompletion,
      newBestPoints: result.isNewBestPoints,
    });
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    this.loop();
  }

  stop() {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private loop = () => {
    if (!this.running) return;
    const dt = Math.min(this.clock.getDelta(), 1 / 30);

    this.player.setMoveInput(this.inputLocked ? 0 : this.input.dir);

    // Movement + jump follow the movement lock (chase/stealth win-resolve
    // freeze, and the defense QTE).
    if (!this.inputLocked) {
      const jumpAgeMs = performance.now() - this.input.jumpPressedAt();
      if (jumpAgeMs <= JUMP_BUFFER_MS && this.player.canJumpNow()) {
        if (this.player.tryJump()) {
          this.input.consumeJumpPress();
        }
      }
    }

    // Quick Dash (X) is HOLD-TO-ACTIVATE and a FREE-MOVEMENT power. ACTIVATION
    // is gated by the defense QTE (the only state that locks non-arrow input) so
    // a chase can never swallow it. A fresh press starts the dash while ready.
    if (!this.defense.isActive) {
      const powerAgeMs = performance.now() - this.input.powerPressedAt();
      if (powerAgeMs <= JUMP_BUFFER_MS && this.power.tryActivate()) {
        this.input.consumePowerPress();
        // Sprinting in cover blows your cover: the prey spots you and bolts.
        if (this.stealth.isActive) {
          useGameState.getState().setResultLabelOverride("STEALTH BROKEN");
          this.stealth.spook();
        }
      }
    }
    // RELEASE is unconditional and runs every frame X is not held — the +60%
    // boost can NEVER persist unless X is physically down this frame. This is
    // the hard guarantee that scent collection (or any state) can't leave a
    // speed multiplier applied: only a live X-hold drives the dash.
    if (!this.input.powerHeld) this.power.release();

    this.power.update(dt);
    this.catchFX.update(dt);
    this.player.update(dt);
    this.updateWading(dt);
    this.camera.update(dt);
    this.chase.update(dt, this.player.position);
    this.stealth.update(dt, this.player.position);
    this.fishing.update(dt, this.player.position);
    this.defense.update(dt);
    this.secrets.update(dt, this.player.position);
    this.level.update({
      dt,
      camera: this.camera.camera,
      playerPosition: this.player.position,
    });

    const state = useGameState.getState();
    if (state.missionStatus === "playing") {
      this.tickSequence();
      this.tracking.tick(dt);
    }

    this.postProcess.render();
    this.rafId = requestAnimationFrame(this.loop);
  };

  /**
   * The whole scent flow:
   *   1. Ask sequence if proximity just triggered something this frame.
   *   2. If 'collected': mirror to store, refill tracking, maybe end mission.
   *   3. If 'encounterStarted': kick off the visual encounter (chase, etc.).
   *      The encounter's onResolved callback will land back here via
   *      sequence.resolveEncounter -> applyCollected.
   *
   * Notice: there's only one place where state changes — applyCollected. The
   * sequence is the source of truth; the store is a projection.
   */
  private tickSequence() {
    const ev = this.level.sequence.tick(this.player.position, REACH_RADIUS);
    if (!ev) return;

    if (ev.kind === "collected") {
      this.applyCollected(ev);
    } else if (ev.kind === "encounterStarted") {
      const facing: 1 | -1 = this.player.velocityX >= 0 ? 1 : -1;
      if (ev.nodeType === "chase") {
        this.chase.start(ev.position.x, facing);
      } else if (ev.nodeType === "stealth") {
        this.stealth.start(ev.position.x, facing);
      } else if (ev.nodeType === "fish") {
        this.fishing.start(ev.position.x, facing);
      } else if (ev.nodeType === "defense") {
        this.defense.start(ev.position.x, facing);
      }
    }
  }

  private applyCollected(ev: CollectedEvent) {
    const seq = this.level.sequence;
    const state = useGameState.getState();

    state.setScentResults(seq.getResults());
    state.setScentProgress(seq.collectedCount, seq.total);

    console.log(
      `[scent] node #${ev.nodeIndex} (${ev.nodeType}) collected outcome=${ev.outcome} +${ev.points} -> ${seq.collectedCount}/${seq.total}`,
    );

    if (seq.isComplete) {
      state.setMissionBonus(this.missionBonusFor());
      state.setStatus("complete");
      this.commitMissionToSave();
    } else if (ev.outcome === "win") {
      this.tracking.refill();
    }
  }

  dispose() {
    this.stop();
    this.catchFX.finish();
    this.input.dispose();
    if (this.wake) {
      this.scene.scene.remove(this.wake.root);
      this.wake.dispose();
      this.wake = null;
    }
    this.secrets.dispose();
    this.level.dispose();
    this.postProcess.dispose();
    this.scene.dispose();
  }
}
