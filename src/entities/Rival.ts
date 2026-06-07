import * as THREE from "three";
import gsap from "gsap";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

const RIVAL_GLB_URL = "/models/rival_trex.glb";
// T-Rex was ~12m, but for readable side-scroll gameplay it should loom over
// the ~0.8u Eoraptor without filling the screen. ~2× the player height.
const RIVAL_TARGET_HEIGHT = 1.8;
const FALLBACK_LUNGE_NUDGE = 0.6;

interface RivalAssets {
  scene: THREE.Object3D;
  animations: THREE.AnimationClip[];
}

let rivalAssetsPromise: Promise<RivalAssets> | null = null;
function loadRivalAssets(): Promise<RivalAssets> {
  if (!rivalAssetsPromise) {
    const loader = new GLTFLoader();
    rivalAssetsPromise = loader.loadAsync(RIVAL_GLB_URL).then((gltf) => ({
      scene: gltf.scene,
      animations: gltf.animations,
    }));
  }
  return rivalAssetsPromise;
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
        new THREE.Color(0x7a4a3a);
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

/**
 * Rival predator: a flat-shaded T-Rex (Quaternius Animated Dinosaur Bundle,
 * same source as the prey Parasaurolophus). Looms ~2× the player's height to
 * read as a genuine threat during the defense QTE. Loops its Idle animation,
 * plays Attack as a lunge on a player miss, and a GSAP recoil nudge on a hit.
 *
 * The GLB loads async; the model may attach a frame or two into an encounter.
 * Call Rival.preload() at boot to warm the cache so the first defense doesn't
 * pop in empty.
 */
export class Rival {
  readonly root = new THREE.Group();
  readonly position = new THREE.Vector3();

  private model: THREE.Object3D | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private idleAction: THREE.AnimationAction | null = null;
  private attackAction: THREE.AnimationAction | null = null;
  private lookDir: 1 | -1 = -1;
  private readonly modelBaseRotationY = Math.PI / 2;
  private disposed = false;

  constructor() {
    void this.attachModel();
  }

  /** Eager prefetch so the first defense encounter doesn't pop. */
  static preload() {
    void loadRivalAssets();
  }

  private async attachModel() {
    let assets: RivalAssets;
    try {
      assets = await loadRivalAssets();
    } catch (err) {
      console.warn("[Rival] GLB load failed; running with empty root.", err);
      return;
    }
    if (this.disposed) return;

    const model = cloneSkinned(assets.scene);
    stripPBRMaterials(model);

    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const scale = RIVAL_TARGET_HEIGHT / Math.max(size.y, 0.001);
    model.scale.setScalar(scale);

    model.updateMatrixWorld(true);
    const scaledBox = new THREE.Box3().setFromObject(model);
    model.position.y -= scaledBox.min.y;

    this.root.add(model);
    this.model = model;
    this.applyFacing();

    if (assets.animations.length > 0) {
      this.mixer = new THREE.AnimationMixer(model);
      const idleClip =
        findClip(assets.animations, "idle") ?? assets.animations[0];
      const attackClip =
        findClip(assets.animations, "attack") ??
        findClip(assets.animations, "bite") ??
        findClip(assets.animations, "jump");

      if (idleClip) {
        this.idleAction = this.mixer.clipAction(idleClip);
        this.idleAction.setLoop(THREE.LoopRepeat, Infinity);
        this.idleAction.play();
      }
      if (attackClip) {
        this.attackAction = this.mixer.clipAction(attackClip);
        this.attackAction.setLoop(THREE.LoopOnce, 1);
        this.attackAction.clampWhenFinished = true;
        // When the one-shot attack ends, ease back to the idle loop.
        this.mixer.addEventListener("finished", this.onAnimFinished);
      }
    }
  }

  private onAnimFinished = (e: { action: THREE.AnimationAction }) => {
    if (e.action === this.attackAction && this.idleAction) {
      this.attackAction.fadeOut(0.2);
      this.idleAction.reset().fadeIn(0.2).play();
    }
  };

  setPosition(x: number, y: number, z: number) {
    this.position.set(x, y, z);
    this.root.position.copy(this.position);
  }

  /**
   * `lookDir` is the direction the rival faces: -1 looks left (toward a player
   * on its left), +1 looks right. Matches the prey model's axis convention.
   */
  setFacing(lookDir: 1 | -1) {
    this.lookDir = lookDir;
    this.applyFacing();
  }

  private applyFacing() {
    if (!this.model) return;
    this.model.rotation.y =
      this.lookDir === 1
        ? this.modelBaseRotationY
        : this.modelBaseRotationY + Math.PI;
  }

  /** Player defended (full or late hit): rival flinches back, slight tilt. */
  playRecoil(playerDirection: 1 | -1) {
    gsap.killTweensOf(this.root.position);
    gsap.killTweensOf(this.root.rotation);
    const startX = this.position.x;
    // Recoil away from the player (player is "behind" the rival in playerDirection).
    gsap
      .timeline()
      .to(this.root.position, {
        x: startX + playerDirection * 0.4,
        duration: 0.09,
        ease: "power2.out",
      })
      .to(this.root.position, { x: startX, duration: 0.25, ease: "back.out(2)" });
    gsap
      .timeline()
      .to(this.root.rotation, { z: -playerDirection * 0.12, duration: 0.09, ease: "power2.out" })
      .to(this.root.rotation, { z: 0, duration: 0.25, ease: "back.out(2)" });
  }

  /** Player missed: rival lunges toward the player (Attack anim if present). */
  playLunge(playerDirection: 1 | -1) {
    if (this.attackAction) {
      this.attackAction.reset().fadeIn(0.05).play();
      if (this.idleAction) this.idleAction.fadeOut(0.05);
    }
    gsap.killTweensOf(this.root.position);
    const startX = this.position.x;
    // Lunge toward the player (opposite of recoil), then settle back.
    gsap
      .timeline()
      .to(this.root.position, {
        x: startX - playerDirection * FALLBACK_LUNGE_NUDGE,
        duration: 0.1,
        ease: "power3.out",
      })
      .to(this.root.position, { x: startX, duration: 0.3, ease: "power1.in" });
  }

  update(dt: number) {
    if (this.mixer) this.mixer.update(dt);
  }

  dispose() {
    this.disposed = true;
    gsap.killTweensOf(this.root.position);
    gsap.killTweensOf(this.root.rotation);
    if (this.mixer) {
      this.mixer.removeEventListener("finished", this.onAnimFinished);
      this.mixer.stopAllAction();
    }
    // Geometries are shared with the cached source via SkeletonUtils.clone — do
    // NOT dispose them or the next encounter's clone renders empty. Materials
    // are per-instance (created in stripPBRMaterials), so dispose those.
    this.root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else if (mat) (mat as THREE.Material).dispose();
    });
  }
}
