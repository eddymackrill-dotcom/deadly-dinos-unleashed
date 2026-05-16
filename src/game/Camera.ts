import * as THREE from "three";

export interface CameraTarget {
  position: THREE.Vector3;
  velocityX?: number;
}

/** Convert a "lerp factor at 60fps" into a framerate-independent factor for arbitrary dt. */
function lerpFactor(perFrame60: number, dt: number): number {
  return 1 - Math.pow(1 - perFrame60, dt * 60);
}

export class Camera {
  readonly camera: THREE.PerspectiveCamera;
  private target: CameraTarget | null = null;

  private xSmoothing = 0.08;
  private ySmoothing = 0.05;
  private lookaheadSmoothing = 0.04;
  private lookaheadUnits = 2;
  private lookaheadSpeedRef = 3; // ratio velocity at which lookahead saturates
  private deadzone = 0.5;
  private currentLookahead = 0;

  private distanceZ = 18;
  private yOffset = 2;

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
    this.camera.position.x = target.position.x;
  }

  update(dt: number) {
    if (!this.target || dt <= 0) return;

    const vx = this.target.velocityX ?? 0;
    const lookaheadTarget =
      Math.sign(vx) * this.lookaheadUnits * Math.min(Math.abs(vx) / this.lookaheadSpeedRef, 1);
    this.currentLookahead +=
      (lookaheadTarget - this.currentLookahead) * lerpFactor(this.lookaheadSmoothing, dt);

    const desiredX = this.target.position.x + this.currentLookahead;
    const diffX = desiredX - this.camera.position.x;
    if (Math.abs(diffX) > this.deadzone) {
      const overshoot = diffX - Math.sign(diffX) * this.deadzone;
      this.camera.position.x += overshoot * lerpFactor(this.xSmoothing, dt);
    }

    const desiredY = this.target.position.y + this.yOffset;
    this.camera.position.y +=
      (desiredY - this.camera.position.y) * lerpFactor(this.ySmoothing, dt);

    this.camera.lookAt(this.camera.position.x, this.camera.position.y - 1, 0);
  }

  private onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }
}
