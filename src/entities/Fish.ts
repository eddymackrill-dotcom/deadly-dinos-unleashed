import * as THREE from "three";

/**
 * A river fish for the Spinosaurus fishing encounter. Fully procedural (no GLB):
 * an elongated silver/blue body with a tail fin and a dorsal fin, built small
 * enough to read side-on at the waterline.
 *
 * Fish live *at* the surface (y ≈ SURFACE_Y). Anything below y=0 is hidden
 * behind the ground plane from the side-scroll camera, so a fish that swam
 * "under" the water would simply be invisible.
 */
const SURFACE_Y = 0.16;
const BODY_LENGTH = 0.55;
const SWIM_BOB_AMPLITUDE = 0.05;
const SWIM_BOB_FREQ = 3.2;
const WRIGGLE_AMPLITUDE = 0.22; // radians of yaw wag
const WRIGGLE_FREQ = 8;
const FLEE_SPEED = 5.5;

export type FishState = "swimming" | "fleeing" | "caught";

export class Fish {
  readonly root = new THREE.Group();
  readonly position = new THREE.Vector3();
  state: FishState = "swimming";
  /** Seconds until this fish respawns (only counted down while state==="fleeing"). */
  respawnTimer = 0;

  private body: THREE.Group;
  private clock: number;
  private velocityX = 0;
  private baseSpeed = 0;
  private materials: THREE.MeshLambertMaterial[] = [];

  constructor(seedPhase = Math.random() * Math.PI * 2) {
    this.clock = seedPhase;
    this.body = new THREE.Group();

    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x9fc7d8, flatShading: true });
    const finMat = new THREE.MeshLambertMaterial({ color: 0x5a92b0, flatShading: true });
    this.materials.push(bodyMat, finMat);

    // Body: a stretched octahedron reads as a fish silhouette at low poly.
    const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), bodyMat);
    body.scale.set(BODY_LENGTH / 0.18 / 2, 0.55, 0.45);
    this.body.add(body);

    // Tail fin.
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.2, 3), finMat);
    tail.rotation.z = Math.PI / 2;
    tail.position.x = -BODY_LENGTH * 0.55;
    this.body.add(tail);

    // Dorsal fin — the bit that actually stays visible above the waterline.
    const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 3), finMat);
    dorsal.position.set(0.02, 0.12, 0);
    this.body.add(dorsal);

    this.root.add(this.body);
    this.root.position.set(0, SURFACE_Y, 0);
  }

  /** Place the fish and give it a cruising speed (signed: +X swims right). */
  spawn(x: number, z: number, speed: number) {
    this.position.set(x, SURFACE_Y, z);
    this.baseSpeed = speed;
    this.velocityX = speed;
    this.state = "swimming";
    this.respawnTimer = 0;
    this.root.visible = true;
    this.root.position.copy(this.position);
    this.setOpacity(1);
  }

  /** Spooked: dart away from `awayFromX` and start the respawn countdown. */
  flee(awayFromX: number, respawnSeconds: number) {
    if (this.state !== "swimming") return;
    this.state = "fleeing";
    const dir = this.position.x >= awayFromX ? 1 : -1;
    this.velocityX = dir * FLEE_SPEED;
    this.respawnTimer = respawnSeconds;
  }

  markCaught() {
    this.state = "caught";
    this.velocityX = 0;
  }

  setOpacity(opacity: number) {
    for (const m of this.materials) {
      const wantsTransparency = opacity < 1;
      if (wantsTransparency !== m.transparent) {
        m.transparent = wantsTransparency;
        m.needsUpdate = true;
      }
      m.opacity = opacity;
    }
  }

  update(dt: number) {
    this.clock += dt;

    if (this.state === "fleeing") {
      this.respawnTimer = Math.max(0, this.respawnTimer - dt);
      // Fade the flee-away over the first half-second so it doesn't just
      // teleport out of frame.
      this.velocityX *= Math.max(0, 1 - dt * 1.6);
    } else if (this.state === "swimming") {
      this.velocityX = this.baseSpeed;
    }

    this.position.x += this.velocityX * dt;
    this.position.y = SURFACE_Y + Math.sin(this.clock * SWIM_BOB_FREQ) * SWIM_BOB_AMPLITUDE;
    this.root.position.copy(this.position);

    // Sine-wave swim: yaw wag plus a facing flip based on travel direction.
    const facing = this.velocityX >= 0 ? 0 : Math.PI;
    this.body.rotation.y = facing + Math.sin(this.clock * WRIGGLE_FREQ) * WRIGGLE_AMPLITUDE;
    this.body.rotation.z = Math.sin(this.clock * SWIM_BOB_FREQ) * 0.08;
  }

  dispose() {
    this.root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry.dispose();
    });
    for (const m of this.materials) m.dispose();
  }
}
