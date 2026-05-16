import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export interface DinosaurOptions {
  url: string;
  targetHeight: number;
  idleNameHint?: string;
  runNameHint?: string;
}

export type DinoAnimState = "idle" | "run";

export class Dinosaur {
  readonly root = new THREE.Group();
  position = new THREE.Vector3(0, 0, 0);
  velocityX = 0;

  private mixer: THREE.AnimationMixer | null = null;
  private idleAction: THREE.AnimationAction | null = null;
  private runAction: THREE.AnimationAction | null = null;
  private currentState: DinoAnimState = "idle";
  private loaded = false;

  constructor() {
    this.root.name = "Dinosaur";
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

    model.rotation.y = Math.PI / 2;

    this.root.add(model);

    const idleClip = this.findClip(gltf.animations, opts.idleNameHint ?? "idle");
    const runClip = this.findClip(gltf.animations, opts.runNameHint ?? "run");

    if (gltf.animations.length > 0) {
      this.mixer = new THREE.AnimationMixer(model);

      if (idleClip) {
        this.idleAction = this.mixer.clipAction(idleClip);
        this.idleAction.setLoop(THREE.LoopRepeat, Infinity);
        this.idleAction.play();
        this.idleAction.setEffectiveWeight(1);
      }
      if (runClip) {
        this.runAction = this.mixer.clipAction(runClip);
        this.runAction.setLoop(THREE.LoopRepeat, Infinity);
        this.runAction.play();
        this.runAction.setEffectiveWeight(0);
      }
    }

    this.loaded = true;
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

  setMoveBlend(runWeight: number) {
    if (!this.idleAction || !this.runAction) return;
    const w = THREE.MathUtils.clamp(runWeight, 0, 1);
    this.idleAction.setEffectiveWeight(1 - w);
    this.runAction.setEffectiveWeight(w);
    const newState: DinoAnimState = w > 0.5 ? "run" : "idle";
    this.currentState = newState;
  }

  get animState(): DinoAnimState {
    return this.currentState;
  }

  get isLoaded(): boolean {
    return this.loaded;
  }

  update(dt: number) {
    this.root.position.copy(this.position);
    if (this.mixer) this.mixer.update(dt);
  }
}
