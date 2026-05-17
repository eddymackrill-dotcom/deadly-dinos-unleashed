import * as THREE from "three";
import gsap from "gsap";

export interface CameraTarget {
  position: THREE.Vector3;
  velocityX?: number;
}

/** Convert a "lerp factor at 60fps" into a framerate-independent factor for arbitrary dt. */
function lerpFactor(perFrame60: number, dt: number): number {
  return 1 - Math.pow(1 - perFrame60, dt * 60);
}

const BASE_FOV = 25;

export class Camera {
  readonly camera: THREE.PerspectiveCamera;
  private target: CameraTarget | null = null;

  private xSmoothing = 0.08;
  private ySmoothing = 0.05;
  private lookaheadSmoothing = 0.04;
  private lookaheadUnits = 2;
  private lookaheadSpeedRef = 3;
  private deadzone = 0.5;
  private currentLookahead = 0;

  private distanceZ = 18;
  private yOffset = 2;

  private shakeTimeLeft = 0;
  private shakeMagnitude = 0;
  private shakeOffset = new THREE.Vector2();

  private currentFOV = BASE_FOV;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(
      BASE_FOV,
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

  shake(magnitude: number, durationSeconds: number) {
    this.shakeMagnitude = Math.max(this.shakeMagnitude, magnitude);
    this.shakeTimeLeft = Math.max(this.shakeTimeLeft, durationSeconds);
  }

  /** Smoothly tween FOV. Returns the gsap tween so callers can chain if needed. */
  setFOV(targetFOV: number, durationSeconds = 0.4) {
    const ref = { v: this.currentFOV };
    return gsap.to(ref, {
      v: targetFOV,
      duration: durationSeconds,
      ease: "power2.out",
      onUpdate: () => {
        this.currentFOV = ref.v;
        this.camera.fov = ref.v;
        this.camera.updateProjectionMatrix();
      },
    });
  }

  resetFOV(durationSeconds = 0.4) {
    return this.setFOV(BASE_FOV, durationSeconds);
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

    if (this.shakeTimeLeft > 0) {
      this.shakeTimeLeft = Math.max(0, this.shakeTimeLeft - dt);
      const t = this.shakeTimeLeft / Math.max(this.shakeTimeLeft + dt, 0.0001); // ratio remaining (used only as damp source)
      // Decaying random kicks:
      const damp = this.shakeTimeLeft > 0 ? Math.max(0, t) : 0;
      this.shakeOffset.set(
        (Math.random() * 2 - 1) * this.shakeMagnitude * damp,
        (Math.random() * 2 - 1) * this.shakeMagnitude * damp,
      );
      if (this.shakeTimeLeft <= 0) {
        this.shakeOffset.set(0, 0);
        this.shakeMagnitude = 0;
      }
    }

    this.camera.position.x += this.shakeOffset.x;
    this.camera.position.y += this.shakeOffset.y;
    this.camera.lookAt(this.camera.position.x - this.shakeOffset.x, this.camera.position.y - this.shakeOffset.y - 1, 0);
    this.camera.position.x -= this.shakeOffset.x;
    this.camera.position.y -= this.shakeOffset.y;
  }

  private onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }
}
