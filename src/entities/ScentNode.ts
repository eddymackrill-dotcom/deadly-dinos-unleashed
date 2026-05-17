import * as THREE from "three";
import { ScentParticles } from "./ScentParticles";

/**
 * Visual for one scent waypoint — just the particle emitter at a position.
 * Collection state lives in ScentSequence; this entity is "view-only".
 */
export class ScentNode {
  readonly position: THREE.Vector3;
  readonly particles: ScentParticles;

  constructor(position: THREE.Vector3) {
    this.position = position.clone();
    this.particles = new ScentParticles();
    this.particles.setPosition(this.position.x, this.position.y, this.position.z);
    this.particles.setActive(false);
  }

  setVisible(visible: boolean) {
    this.particles.setActive(visible);
  }

  update(dt: number, cameraQuaternion: THREE.Quaternion) {
    this.particles.update(dt, cameraQuaternion);
  }

  dispose() {
    this.particles.dispose();
  }
}
