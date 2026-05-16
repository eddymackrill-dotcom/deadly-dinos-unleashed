import * as THREE from "three";
import { Scene } from "./Scene";
import { Camera } from "./Camera";
import { createLevel1 } from "../levels/L1_Eoraptor";
import type { Level } from "../levels/Level";

export class Game {
  private scene: Scene;
  private camera: Camera;
  private clock: THREE.Clock;
  private level: Level;
  private rafId: number | null = null;
  private running = false;

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new Scene(canvas);
    this.camera = new Camera();
    this.clock = new THREE.Clock();

    this.level = createLevel1();
    this.scene.scene.add(this.level.root);

    const placeholder = {
      position: new THREE.Vector3(0, 1, 0),
      velocityX: 0,
    };
    this.camera.follow(placeholder);
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
    const dt = this.clock.getDelta();
    this.camera.update(dt);
    this.level.update(dt, this.camera.camera.position.x);
    this.scene.renderer.render(this.scene.scene, this.camera.camera);
    this.rafId = requestAnimationFrame(this.loop);
  };

  dispose() {
    this.stop();
    this.level.dispose();
    this.scene.dispose();
  }
}
