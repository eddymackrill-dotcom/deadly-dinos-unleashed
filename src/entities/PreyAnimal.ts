import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

const PREY_GLB_URL = "/models/prey_parasaurolophus.glb";
const PREY_TARGET_HEIGHT = 1.0;
const FACING_TURN_RATE = 12;
const FALLBACK_RUN_TIMESCALE = 1.5;

interface PreyAssets {
  scene: THREE.Object3D;
  animations: THREE.AnimationClip[];
}

let preyAssetsPromise: Promise<PreyAssets> | null = null;
function loadPreyAssets(): Promise<PreyAssets> {
  if (!preyAssetsPromise) {
    const loader = new GLTFLoader();
    preyAssetsPromise = loader.loadAsync(PREY_GLB_URL).then((gltf) => ({
      scene: gltf.scene,
      animations: gltf.animations,
    }));
  }
  return preyAssetsPromise;
}

function stripPBRMaterials(model: THREE.Object3D) {
  model.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const oldMat = mesh.material;
    const mats = Array.isArray(oldMat) ? oldMat : [oldMat];
    const replaced = mats.map((m) => {
      const color =
        (m as THREE.MeshStandardMaterial).color?.clone?.() ??
        new THREE.Color(0x8c9a52);
      const lambert = new THREE.MeshLambertMaterial({ color, flatShading: true });
      m.dispose?.();
      return lambert;
    });
    mesh.material = Array.isArray(oldMat) ? replaced : replaced[0];
  });
}

function findClip(
  clips: THREE.AnimationClip[],
  hint: string,
): THREE.AnimationClip | null {
  const lower = hint.toLowerCase();
  return clips.find((c) => c.name.toLowerCase().includes(lower)) ?? null;
}

export class PreyAnimal {
  readonly root = new THREE.Group();
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();

  private mixer: THREE.AnimationMixer | null = null;
  private model: THREE.Object3D | null = null;
  private readonly modelBaseRotationY = Math.PI / 2;
  private currentRotationY = Math.PI / 2;
  private disposed = false;

  constructor() {
    void this.attachModel();
  }

  /** Eager prefetch so the first chase doesn't pop. Game can call this at boot. */
  static preload() {
    void loadPreyAssets();
  }

  private async attachModel() {
    let assets: PreyAssets;
    try {
      assets = await loadPreyAssets();
    } catch (err) {
      console.warn("[PreyAnimal] GLB load failed; running with empty root.", err);
      return;
    }
    if (this.disposed) return;

    const model = cloneSkinned(assets.scene);
    stripPBRMaterials(model);

    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const scale = PREY_TARGET_HEIGHT / Math.max(size.y, 0.001);
    model.scale.setScalar(scale);

    model.updateMatrixWorld(true);
    const scaledBox = new THREE.Box3().setFromObject(model);
    model.position.y -= scaledBox.min.y;
    model.rotation.y = this.modelBaseRotationY;
    this.currentRotationY = this.modelBaseRotationY;

    this.root.add(model);
    this.model = model;

    if (assets.animations.length > 0) {
      this.mixer = new THREE.AnimationMixer(model);
      const runClip =
        findClip(assets.animations, "run") ??
        findClip(assets.animations, "walk") ??
        findClip(assets.animations, "idle") ??
        assets.animations[0];
      if (runClip) {
        const action = this.mixer.clipAction(runClip);
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.setEffectiveWeight(1);
        action.timeScale = /run/i.test(runClip.name) ? 1 : FALLBACK_RUN_TIMESCALE;
        action.play();
      }
    }
  }

  setPosition(x: number, y: number, z: number) {
    this.position.set(x, y, z);
    this.root.position.copy(this.position);
  }

  setRunSpeed(vx: number) {
    this.velocity.x = vx;
  }

  update(dt: number) {
    this.position.x += this.velocity.x * dt;
    this.root.position.x = this.position.x;
    this.root.position.y = this.position.y;
    this.root.position.z = this.position.z;

    if (this.model && Math.abs(this.velocity.x) > 0.1) {
      const targetRot =
        this.velocity.x >= 0
          ? this.modelBaseRotationY
          : this.modelBaseRotationY + Math.PI;
      let delta = targetRot - this.currentRotationY;
      while (delta > Math.PI) delta -= 2 * Math.PI;
      while (delta < -Math.PI) delta += 2 * Math.PI;
      this.currentRotationY += delta * (1 - Math.exp(-FACING_TURN_RATE * dt));
      this.model.rotation.y = this.currentRotationY;
    }

    if (this.mixer) this.mixer.update(dt);
  }

  dispose() {
    this.disposed = true;
    if (this.mixer) this.mixer.stopAllAction();
    // Geometries are shared via SkeletonUtils.clone with the cached source — do
    // not dispose them, or the next chase's clone will render empty. Materials
    // are per-instance (created in stripPBRMaterials), safe to dispose.
    this.root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else if (mat) (mat as THREE.Material).dispose();
    });
  }
}
