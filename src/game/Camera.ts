import * as THREE from "three";

export interface CameraTarget {
  position: THREE.Vector3;
  velocityX?: number;
}

export class Camera {
  readonly camera: THREE.PerspectiveCamera;
  private target: CameraTarget | null = null;
  private smoothing = 0.08;
  private lookaheadUnits = 2;
  private yLerp = 0.04;
  private distanceZ = 18;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(
      25,
      window.innerWidth / window.innerHeight,
      0.1,
      200,
    );
    this.camera.position.set(0, 2.5, this.distanceZ);
    this.camera.lookAt(0, 1.5, 0);

    window.addEventListener("resize", () => this.onResize());
  }

  follow(target: CameraTarget) {
    this.target = target;
  }

  update(_dt: number) {
    if (!this.target) return;
    const dir = this.target.velocityX ?? 0;
    const desiredX = this.target.position.x + Math.sign(dir) * this.lookaheadUnits * Math.min(Math.abs(dir), 1);
    const desiredY = this.target.position.y + 2;
    this.camera.position.x += (desiredX - this.camera.position.x) * this.smoothing;
    this.camera.position.y += (desiredY - this.camera.position.y) * this.yLerp;
    this.camera.lookAt(this.camera.position.x, this.camera.position.y - 1, 0);
  }

  private onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }
}
