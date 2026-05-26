import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import gsap from "gsap";

export interface DinosaurOptions {
  url: string;
  targetHeight: number;
  idleNameHint?: string;
  runNameHint?: string;
}

const MAX_SPEED = 5.0;
const ACCEL_RATE = 15;    // 95% in ~0.2s
const DECEL_RATE = 25;    // 95% in ~0.12s
const REVERSE_SKID_DURATION = 0.1;
const JUMP_VELOCITY = 8.0;
const GRAVITY = -22;
const HANGTIME_GRAVITY_MULT = 0.35;
const HANGTIME_VY_THRESHOLD = 1.5;
const COYOTE_TIME = 0.08;
const ANIM_BLEND_RATE = 30; // 95% in ~100ms
const FACING_TURN_RATE = 12;

function approach(current: number, target: number, rate: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}

export class Dinosaur {
  readonly root = new THREE.Group();
  position = new THREE.Vector3(0, 0, 0);
  velocity = new THREE.Vector3();

  private onGround = true;
  private timeSinceGrounded = 0;
  private skidTimer = 0;
  private pendingMoveDir = 0;

  private mixer: THREE.AnimationMixer | null = null;
  private idleAction: THREE.AnimationAction | null = null;
  private runAction: THREE.AnimationAction | null = null;
  private runWeight = 0;

  private model: THREE.Object3D | null = null;
  private modelBaseRotationY = Math.PI / 2;
  private facing: 1 | -1 = 1;
  private currentRotationY = Math.PI / 2;

  private inAirArc: "rising" | "falling" | "grounded" = "grounded";

  private speedMultiplier = 1;
  private tintMaterials: {
    mat: THREE.MeshLambertMaterial;
    baseColor: THREE.Color;
  }[] = [];

  constructor() {
    this.root.name = "Dinosaur";
  }

  /** Multiplier on top of MAX_SPEED. Use for stealth slow (0.5), dash boost (1.6). */
  setSpeedMultiplier(m: number) {
    this.speedMultiplier = Math.max(0, m);
  }

  /**
   * Tint every mesh material toward `color` (additive ratio 0..1) and apply
   * transparency. Pass `null` to clear tint and reset opacity to 1.
   */
  setTint(color: THREE.Color | null, mixAmount = 0.5, opacity = 1) {
    if (this.tintMaterials.length === 0) {
      // Lazily capture base colors the first time tint is requested.
      this.captureTintMaterials();
    }
    for (const t of this.tintMaterials) {
      if (color) {
        const c = t.baseColor.clone().lerp(color, Math.max(0, Math.min(1, mixAmount)));
        t.mat.color.copy(c);
      } else {
        t.mat.color.copy(t.baseColor);
      }
      const wantsTransparency = opacity < 1;
      if (wantsTransparency !== t.mat.transparent) {
        t.mat.transparent = wantsTransparency;
        t.mat.needsUpdate = true;
      }
      t.mat.opacity = opacity;
    }
  }

  private captureTintMaterials() {
    this.root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        const lambert = m as THREE.MeshLambertMaterial;
        if (lambert.color) {
          this.tintMaterials.push({ mat: lambert, baseColor: lambert.color.clone() });
        }
      }
    });
  }

  get velocityX(): number {
    return this.velocity.x;
  }

  get airborne(): boolean {
    return !this.onGround;
  }

  async load(opts: DinosaurOptions): Promise<void> {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(opts.url);

    const model = gltf.scene;
    this.stripPBRMaterials(model);

    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const scale = opts.targetHeight / Math.max(size.y, 0.001);
    model.scale.setScalar(scale);

    model.updateMatrixWorld(true);
    const scaledBox = new THREE.Box3().setFromObject(model);
    model.position.y -= scaledBox.min.y;
    model.rotation.y = this.modelBaseRotationY;
    this.currentRotationY = this.modelBaseRotationY;

    this.root.add(model);
    this.model = model;

    if (gltf.animations.length > 0) {
      this.mixer = new THREE.AnimationMixer(model);
      const idleClip = this.findClip(gltf.animations, opts.idleNameHint ?? "idle");
      const runClip = this.findClip(gltf.animations, opts.runNameHint ?? "run");

      if (idleClip) {
        this.idleAction = this.mixer.clipAction(idleClip);
        this.idleAction.setLoop(THREE.LoopRepeat, Infinity);
        this.idleAction.setEffectiveWeight(1);
        this.idleAction.play();
      }
      if (runClip) {
        this.runAction = this.mixer.clipAction(runClip);
        this.runAction.setLoop(THREE.LoopRepeat, Infinity);
        this.runAction.setEffectiveWeight(0);
        this.runAction.play();
      }
    }
  }

  private findClip(clips: THREE.AnimationClip[], hint: string): THREE.AnimationClip | null {
    const lower = hint.toLowerCase();
    return clips.find((c) => c.name.toLowerCase().includes(lower)) ?? null;
  }

  private stripPBRMaterials(model: THREE.Object3D) {
    model.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const oldMat = mesh.material;
      const materials = Array.isArray(oldMat) ? oldMat : [oldMat];
      const replaced = materials.map((m) => {
        const color = (m as THREE.MeshStandardMaterial).color?.clone?.() ?? new THREE.Color(0xb88060);
        const lambert = new THREE.MeshLambertMaterial({ color, flatShading: true });
        m.dispose?.();
        return lambert;
      });
      mesh.material = Array.isArray(oldMat) ? replaced : replaced[0];
    });
  }

  setMoveInput(dir: number) {
    const sDir = Math.sign(dir);
    if (sDir !== 0 && Math.abs(this.velocity.x) > 0.5 && sDir === -Math.sign(this.velocity.x) && this.skidTimer <= 0) {
      this.skidTimer = REVERSE_SKID_DURATION;
    }
    if (sDir > 0) this.facing = 1;
    else if (sDir < 0) this.facing = -1;
    this.pendingMoveDir = sDir;
  }

  canJumpNow(): boolean {
    return this.onGround || this.timeSinceGrounded <= COYOTE_TIME;
  }

  tryJump(): boolean {
    if (!this.canJumpNow()) return false;
    this.velocity.y = JUMP_VELOCITY;
    this.onGround = false;
    this.timeSinceGrounded = COYOTE_TIME + 0.001;
    this.inAirArc = "rising";
    this.playTakeoffSquash();
    return true;
  }

  update(dt: number) {
    if (dt <= 0) return;

    let targetVx: number;
    if (this.skidTimer > 0) {
      this.skidTimer -= dt;
      targetVx = 0;
    } else {
      targetVx = this.pendingMoveDir * MAX_SPEED * this.speedMultiplier;
    }

    const reversing =
      Math.sign(targetVx) !== 0 &&
      Math.sign(targetVx) !== Math.sign(this.velocity.x) &&
      Math.abs(this.velocity.x) > 0.1;
    const slowing = Math.abs(targetVx) < Math.abs(this.velocity.x);
    const rate = slowing || reversing ? DECEL_RATE : ACCEL_RATE;
    this.velocity.x = approach(this.velocity.x, targetVx, rate, dt);

    let gravity = GRAVITY;
    if (this.inAirArc !== "grounded" && Math.abs(this.velocity.y) < HANGTIME_VY_THRESHOLD) {
      gravity = GRAVITY * HANGTIME_GRAVITY_MULT;
    }
    this.velocity.y += gravity * dt;

    if (this.inAirArc === "rising" && this.velocity.y <= 0) {
      this.inAirArc = "falling";
      this.playApexStretch();
    }

    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;

    if (this.position.y <= 0) {
      const wasAirborne = !this.onGround;
      this.position.y = 0;
      this.velocity.y = 0;
      this.onGround = true;
      this.timeSinceGrounded = 0;
      if (wasAirborne) {
        this.inAirArc = "grounded";
        this.playLandSquash();
      }
    } else {
      this.onGround = false;
      this.timeSinceGrounded += dt;
    }

    const speedRatio = Math.min(Math.abs(this.velocity.x) / MAX_SPEED, 1);
    this.runWeight = approach(this.runWeight, speedRatio, ANIM_BLEND_RATE, dt);
    if (this.idleAction && this.runAction) {
      this.idleAction.setEffectiveWeight(1 - this.runWeight);
      this.runAction.setEffectiveWeight(this.runWeight);
      this.runAction.timeScale = 0.7 + speedRatio * 0.9;
    }

    if (this.model) {
      const targetRot = this.facing === 1 ? this.modelBaseRotationY : this.modelBaseRotationY + Math.PI;
      let delta = targetRot - this.currentRotationY;
      while (delta > Math.PI) delta -= 2 * Math.PI;
      while (delta < -Math.PI) delta += 2 * Math.PI;
      this.currentRotationY += delta * (1 - Math.exp(-FACING_TURN_RATE * dt));
      this.model.rotation.y = this.currentRotationY;
    }

    this.root.position.copy(this.position);

    if (this.mixer) this.mixer.update(dt);
  }

  private playTakeoffSquash() {
    gsap.killTweensOf(this.root.scale);
    gsap
      .timeline()
      .to(this.root.scale, { x: 1.15, y: 0.85, z: 1.15, duration: 0.08, ease: "power2.out" })
      .to(this.root.scale, { x: 1, y: 1, z: 1, duration: 0.18, ease: "power1.in" });
  }

  private playApexStretch() {
    gsap.killTweensOf(this.root.scale);
    gsap
      .timeline()
      .to(this.root.scale, { x: 0.95, y: 1.1, z: 0.95, duration: 0.08, ease: "power2.out" })
      .to(this.root.scale, { x: 1, y: 1, z: 1, duration: 0.1, ease: "power1.in" });
  }

  private playLandSquash() {
    gsap.killTweensOf(this.root.scale);
    gsap
      .timeline()
      .to(this.root.scale, { x: 1.2, y: 0.8, z: 1.2, duration: 0.05, ease: "power2.out" })
      .to(this.root.scale, { x: 1, y: 1, z: 1, duration: 0.15, ease: "back.out(1.5)" });
  }
}
