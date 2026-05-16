import * as THREE from "three";
import { Scene } from "./Scene";
import { Camera } from "./Camera";
import { Input } from "./Input";
import { createLevel1 } from "../levels/L1_Eoraptor";
import type { Level } from "../levels/Level";
import { Dinosaur } from "../entities/Dinosaur";

const JUMP_BUFFER_MS = 100;

export class Game {
  private scene: Scene;
  private camera: Camera;
  private clock: THREE.Clock;
  private level: Level;
  private player: Dinosaur;
  private input: Input;
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

    void this.player.load({
      url: "/models/eoraptor.glb",
      targetHeight: 0.8,
      idleNameHint: "idle",
      runNameHint: "run",
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

    this.player.setMoveInput(this.input.dir);

    const jumpAgeMs = performance.now() - this.input.jumpPressedAt();
    if (jumpAgeMs <= JUMP_BUFFER_MS && this.player.canJumpNow()) {
      if (this.player.tryJump()) {
        this.input.consumeJumpPress();
      }
    }

    this.player.update(dt);
    this.camera.update(dt);
    this.level.update(dt, this.camera.camera.position.x);
    this.scene.renderer.render(this.scene.scene, this.camera.camera);
    this.rafId = requestAnimationFrame(this.loop);
  };

  dispose() {
    this.stop();
    this.input.dispose();
    this.level.dispose();
    this.scene.dispose();
  }
}
