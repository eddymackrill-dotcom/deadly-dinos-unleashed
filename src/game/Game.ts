import * as THREE from "three";
import gsap from "gsap";
import { Scene } from "./Scene";
import { Camera } from "./Camera";
import { Input } from "./Input";
import { PostProcess } from "./PostProcess";
import { createLevel1 } from "../levels/L1_Eoraptor";
import type { Level } from "../levels/Level";
import { Dinosaur } from "../entities/Dinosaur";
import { TrackingSystem } from "../systems/TrackingSystem";
import { ChaseSystem } from "../systems/ChaseSystem";
import { EORAPTOR, trackingDuration } from "../data/dinosaurs";
import { useGameState } from "../state/gameState";
import { commitMissionResult, getDinoSave, getMissionSave } from "../progression/Save";

const MISSION_ID = "L1_eoraptor";

const JUMP_BUFFER_MS = 100;
const NODE_REACH_RADIUS = 3.0;
const CHASE_FOV = 28;

function activityPoints(tag: "collect" | "chase" | "stealth" | "defense", success: boolean): number {
  if (!success) return 0;
  switch (tag) {
    case "collect":
      return 100;
    case "chase":
      return 250;
    case "stealth":
      return 250;
    case "defense":
      return 300;
  }
}

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
  private inputLocked = false;
  private chasePendingResult: "win" | "lose" | null = null;
  private scentLogFrame = 0;
  private lastLoggedActiveIndex: number | null = null;
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
    state.setScentProgress(0, this.level.getScentTotal());

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
    this.chase.onResolved = (result) => {
      console.log(`[chase] onResolved fired with result=${result}; queued for next frame`);
      this.chasePendingResult = result;
    };

    void this.player.load({
      url: "/models/eoraptor.glb",
      targetHeight: 0.8,
      idleNameHint: "idle",
      runNameHint: "run",
    });
  }

  private onMissionFail() {
    useGameState.getState().setStatus("failed");
    this.fx.titleSting();
    this.commitMissionToSave();
  }

  private commitMissionToSave() {
    const state = useGameState.getState();
    const successes = state.activityResults.filter((a) => a.success).length;
    const total = state.scentTotal;
    const completion = total === 0 ? 0 : successes / total;
    const result = commitMissionResult({
      dinoId: EORAPTOR.id,
      missionId: MISSION_ID,
      completion,
      pointsEarned: state.predatorPointsEarned,
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

    this.level.update({
      dt,
      camera: this.camera.camera,
      playerPosition: this.player.position,
    });

    const state = useGameState.getState();
    if (state.missionStatus === "playing") {
      this.handleScentProgress();
      this.tracking.tick(dt);
    }

    this.postProcess.render();
    this.rafId = requestAnimationFrame(this.loop);
  };

  private handleScentProgress() {
    const active = this.level.getActiveScent();
    const px = this.player.position.x;
    const chaseActive = this.chase.isActive;
    const pending = this.chasePendingResult;

    // Log once every 30 frames (~0.5s), and immediately when the active node changes.
    this.scentLogFrame++;
    const activeIdx = active?.index ?? null;
    const indexChanged = activeIdx !== this.lastLoggedActiveIndex;
    if (indexChanged || this.scentLogFrame % 30 === 0) {
      const dx = active ? active.position.x - px : Infinity;
      console.log(
        `[scent.tick] player.x=${px.toFixed(2)} active=${
          active ? `#${active.index}(${active.tag})@x=${active.position.x}` : "none"
        } dx=${Number.isFinite(dx) ? dx.toFixed(2) : "n/a"} chase.isActive=${chaseActive} pending=${pending}`,
      );
      this.lastLoggedActiveIndex = activeIdx;
    }

    if (chaseActive) return;

    if (pending !== null) {
      console.log(`[scent] draining chasePendingResult=${pending} -> completeActivity`);
      this.chasePendingResult = null;
      this.completeActivity(pending === "win");
      return;
    }

    if (!active) return;

    const dx = active.position.x - px;
    if (Math.abs(dx) > NODE_REACH_RADIUS) return;

    if (active.tag === "chase") {
      const facing: 1 | -1 = this.player.velocityX >= 0 ? 1 : -1;
      console.log(`[scent] within reach of chase node #${active.index}; calling chase.start(${active.position.x}, ${facing})`);
      this.chase.start(active.position.x, facing);
    } else {
      console.log(`[scent] within reach of collect node #${active.index}; calling completeActivity(true)`);
      this.completeActivity(true);
    }
  }

  private completeActivity(success: boolean) {
    const active = this.level.getActiveScent();
    const state = useGameState.getState();
    if (active) {
      state.recordActivity({
        index: active.index,
        tag: active.tag,
        success,
        points: activityPoints(active.tag, success),
      });
    }

    this.level.collectActive();
    const collected = this.level.getScentCollected();
    const total = this.level.getScentTotal();
    state.setScentProgress(collected, total);

    console.log(
      `[scent] node ${active?.index ?? "?"} (${active?.tag ?? "?"}) ${
        success ? "completed" : "failed"
      } -> collected ${collected}/${total}, new active index ${collected}`,
    );

    if (collected >= total) {
      state.setStatus("complete");
      this.commitMissionToSave();
    } else if (success) {
      this.tracking.refill();
    }
  }

  dispose() {
    this.stop();
    this.input.dispose();
    this.level.dispose();
    this.postProcess.dispose();
    this.scene.dispose();
  }
}
