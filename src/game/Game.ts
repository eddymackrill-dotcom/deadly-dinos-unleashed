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
import { EORAPTOR, trackingDuration } from "../data/dinosaurs";
import { useGameState } from "../state/gameState";

const JUMP_BUFFER_MS = 100;

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
  private lastScentCollected = 0;
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
    });
    state.setScentProgress(0, this.level.getScentTotal());

    const duration = trackingDuration(EORAPTOR.stats, EORAPTOR.baseTrackingDuration);
    this.tracking = new TrackingSystem(duration, () => this.onMissionFail());

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

    this.player.setMoveInput(this.input.dir);

    const jumpAgeMs = performance.now() - this.input.jumpPressedAt();
    if (jumpAgeMs <= JUMP_BUFFER_MS && this.player.canJumpNow()) {
      if (this.player.tryJump()) {
        this.input.consumeJumpPress();
      }
    }

    this.player.update(dt);
    this.camera.update(dt);
    this.level.update({
      dt,
      camera: this.camera.camera,
      playerPosition: this.player.position,
    });

    const state = useGameState.getState();
    if (state.missionStatus === "playing") {
      const collected = this.level.getScentCollected();
      const total = this.level.getScentTotal();
      if (collected !== this.lastScentCollected) {
        this.lastScentCollected = collected;
        state.setScentProgress(collected, total);
        if (collected >= total) {
          state.setStatus("complete");
        } else {
          this.tracking.refill();
        }
      }
      this.tracking.tick(dt);
    }

    this.postProcess.render();
    this.rafId = requestAnimationFrame(this.loop);
  };

  dispose() {
    this.stop();
    this.input.dispose();
    this.level.dispose();
    this.postProcess.dispose();
    this.scene.dispose();
  }
}
