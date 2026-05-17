import * as THREE from "three";
import { ScentParticles } from "./ScentParticles";
import type { ScentNodeTag } from "../levels/Level";

export interface ScentNodeConfig {
  position: THREE.Vector3;
  tag: ScentNodeTag;
}

/** A waypoint in the scent sequence. Owns its own particle emitter; visible only when active. */
export class ScentNode {
  readonly position: THREE.Vector3;
  readonly tag: ScentNodeTag;
  readonly particles: ScentParticles;
  private _collected = false;

  constructor(cfg: ScentNodeConfig) {
    this.position = cfg.position.clone();
    this.tag = cfg.tag;
    this.particles = new ScentParticles();
    this.particles.setPosition(this.position.x, this.position.y, this.position.z);
    this.particles.setActive(false);
  }

  get collected(): boolean {
    return this._collected;
  }

  setActive(active: boolean) {
    this.particles.setActive(active && !this._collected);
  }

  collect() {
    this._collected = true;
    this.particles.setActive(false);
  }

  update(dt: number, cameraQuaternion: THREE.Quaternion) {
    this.particles.update(dt, cameraQuaternion);
  }

  dispose() {
    this.particles.dispose();
  }
}
