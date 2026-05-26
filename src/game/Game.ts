import * as THREE from "three";
import gsap from "gsap";
import { Scene } from "./Scene";
import { Camera } from "./Camera";
import { Input } from "./Input";
import { PostProcess } from "./PostProcess";
import { createLevel1 } from "../levels/L1_Eoraptor";
import type { Level } from "../levels/Level";
import type { CollectedEvent } from "../levels/ScentSequence";
import { Dinosaur } from "../entities/Dinosaur";
import { PreyAnimal } from "../entities/PreyAnimal";
import { TrackingSystem } from "../systems/TrackingSystem";
import { ChaseSystem } from "../systems/ChaseSystem";
import { StealthSystem } from "../systems/StealthSystem";
import { DefenseSystem } from "../systems/DefenseSystem";
import { HiddenSecretsSystem } from "../systems/HiddenSecretsSystem";
import { EORAPTOR, trackingDuration } from "../data/dinosaurs";
import { useGameState } from "../state/gameState";
import { commitMissionResult, getDinoSave, getMissionSave } from "../progression/Save";

const MISSION_ID = "L1_eoraptor";
const JUMP_BUFFER_MS = 100;
const REACH_RADIUS = 1.5;
const CHASE_FOV = 28;

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
  private defense: DefenseSystem;
  private secrets: HiddenSecretsSystem;
  private inputLocked = false;
  readonly fx: GameFX;
  private rafId: number | null = null;
  private running = false;

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new Scene(canvas);
    this.camera = new Camera();
    this.clock = new THREE.Clock();
    this.input = new Input();

    this.level = createLevel1();
    this.scene.scene.add(this.level.root);

    this.player = new Dinosaur();
    this.scene.scene.add(this.player.root);
    this.camera.follow(this.player);

    this.postProcess = new PostProcess(this.scene.renderer, this.scene.scene, this.camera.camera);
    this.fx = new GameFX(this.postProcess.glitchIntensity);

    const state = useGameState.getState();
    state.reset();
    state.setDino({
      id: EORAPTOR.id,
      name: EORAPTOR.name,
      era: EORAPTOR.era,
      region: EORAPTOR.region,
      stats: EORAPTOR.stats,
      rank: 1,
    });
    state.setScentProgress(0, this.level.sequence.total);

    const dinoSave = getDinoSave(EORAPTOR.id);
    const missionSave = getMissionSave(EORAPTOR.id, MISSION_ID);
    state.setPersistedTotals({
      totalPredatorPoints: dinoSave.predatorPoints,
      bestMissionCompletion: missionSave.completion,
      bestMissionPoints: missionSave.bestPoints,
    });

    const duration = trackingDuration(EORAPTOR.stats, EORAPTOR.baseTrackingDuration);
    this.tracking = new TrackingSystem(duration, () => this.onMissionFail());

    this.chase = new ChaseSystem({
      scene: this.scene.scene,
      setChevronOverride: (x) => this.level.setChevronTargetOverride(x),
      onCameraShake: (mag, dur) => this.camera.shake(mag, dur),
      onFOVPulse: () => this.camera.setFOV(CHASE_FOV, 0.5),
      onFOVReset: () => this.camera.resetFOV(0.5),
      onGlitchSting: () => this.fx.catchSting(),
      setPlayerInputLocked: (locked) => {
        this.inputLocked = locked;
      },
    });
    this.chase.onResolved = (outcome) => {
      const ev = this.level.sequence.resolveEncounter(outcome);
      if (ev && ev.kind === "collected") this.applyCollected(ev);
    };

    this.stealth = new StealthSystem({
      scene: this.scene.scene,
      setChevronOverride: (x) => this.level.setChevronTargetOverride(x),
      onCameraShake: (mag, dur) => this.camera.shake(mag, dur),
      onGlitchSting: () => this.fx.catchSting(),
      setPlayerInputLocked: (locked) => {
        this.inputLocked = locked;
      },
      setPlayerSpeedMult: (m) => this.player.setSpeedMultiplier(m),
      setPlayerTint: (color, mix, opacity) => this.player.setTint(color, mix, opacity),
      sensesStat: EORAPTOR.stats.senses,
    });
    this.stealth.onResolved = (outcome) => {
      const ev = this.level.sequence.resolveEncounter(outcome);
      if (ev && ev.kind === "collected") this.applyCollected(ev);
    };

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
      toughnessStat: EORAPTOR.stats.toughness,
    });
    this.secrets = new HiddenSecretsSystem(
      { scene: this.scene.scene },
      this.level.secrets,
      missionSave.foundSecretIds ?? [],
    );

    this.defense.onResolved = (outcome) => {
      const basePoints = this.level.sequence.getActivePoints();
      const ratio = this.defense.partialPointsRatio();
      const partialPoints = Math.round(basePoints * ratio);
      const ev = this.level.sequence.resolveEncounter(
        outcome,
        outcome === "partial" ? partialPoints : undefined,
      );
      if (ev && ev.kind === "collected") this.applyCollected(ev);
    };

    void this.player.load({
      url: "/models/eoraptor.glb",
      targetHeight: 0.8,
      idleNameHint: "idle",
      runNameHint: "run",
    });

    // Warm the GLB cache so the first chase doesn't pop in.
    PreyAnimal.preload();
  }

  private onMissionFail() {
    useGameState.getState().setStatus("failed");
    this.fx.titleSting();
    this.commitMissionToSave();
  }

  private commitMissionToSave() {
    const state = useGameState.getState();
    const seq = this.level.sequence;
    const successes = seq.getResults().filter((r) => r.outcome === "win").length;
    const completion = seq.total === 0 ? 0 : successes / seq.total;
    const secretIds = this.secrets.getClaimedIds();
    const result = commitMissionResult({
      dinoId: EORAPTOR.id,
      missionId: MISSION_ID,
      completion,
      pointsEarned: seq.totalPointsEarned() + state.secretBonusPoints,
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

    if (!this.inputLocked) {
      const jumpAgeMs = performance.now() - this.input.jumpPressedAt();
      if (jumpAgeMs <= JUMP_BUFFER_MS && this.player.canJumpNow()) {
        if (this.player.tryJump()) {
          this.input.consumeJumpPress();
        }
      }
    }

    this.player.update(dt);
    this.camera.update(dt);
    this.chase.update(dt, this.player.position);
    this.stealth.update(dt, this.player.position);
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
      state.setStatus("complete");
      this.commitMissionToSave();
    } else if (ev.outcome === "win") {
      this.tracking.refill();
    }
  }

  dispose() {
    this.stop();
    this.input.dispose();
    this.secrets.dispose();
    this.level.dispose();
    this.postProcess.dispose();
    this.scene.dispose();
  }
}
