import * as THREE from "three";

/**
 * Bow wake for a dinosaur wading through water. A small pool of flat rings that
 * lie on the surface behind the player, expanding and fading out. Deliberately
 * geometry-only (no canvas textures, no post-process) — this has to stay cheap
 * on the Chromebook-tier perf floor in CLAUDE.md.
 */
const POOL_SIZE = 14;
const RING_LIFE = 1.1;
const SPAWN_INTERVAL = 0.13;
const SURFACE_Y = 0.06;
const MIN_SPEED_TO_EMIT = 0.6;

interface Ripple {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  age: number;
  alive: boolean;
}

export class WakeTrail {
  readonly root = new THREE.Group();
  private ripples: Ripple[] = [];
  private spawnTimer = 0;
  private readonly geom: THREE.RingGeometry;

  constructor(color = 0xbfeff7) {
    const geom = new THREE.RingGeometry(0.18, 0.3, 12);
    this.geom = geom;
    for (let i = 0; i < POOL_SIZE; i++) {
      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
      });
      const mesh = new THREE.Mesh(geom, material);
      mesh.rotation.x = -Math.PI / 2; // lie flat on the water
      mesh.visible = false;
      this.root.add(mesh);
      this.ripples.push({ mesh, material, age: 0, alive: false });
    }
  }

  /**
   * @param emitting  true while the player is actually in water
   * @param x         player world X
   * @param speed     absolute player speed (drives spawn rate and size)
   */
  update(dt: number, emitting: boolean, x: number, speed: number) {
    if (emitting && speed > MIN_SPEED_TO_EMIT) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = SPAWN_INTERVAL;
        this.spawn(x, speed);
      }
    }

    for (const r of this.ripples) {
      if (!r.alive) continue;
      r.age += dt;
      const t = r.age / RING_LIFE;
      if (t >= 1) {
        r.alive = false;
        r.mesh.visible = false;
        r.material.opacity = 0;
        continue;
      }
      const scale = 0.6 + t * 1.9;
      r.mesh.scale.setScalar(scale);
      r.material.opacity = 0.45 * (1 - t);
    }
  }

  private spawn(x: number, speed: number) {
    const r = this.ripples.find((p) => !p.alive);
    if (!r) return;
    r.alive = true;
    r.age = 0;
    r.mesh.visible = true;
    r.mesh.position.set(x, SURFACE_Y, (Math.random() - 0.5) * 0.5);
    r.mesh.scale.setScalar(0.6);
    r.material.opacity = 0.45 * Math.min(1, speed / 4);
  }

  dispose() {
    for (const r of this.ripples) r.material.dispose();
    this.geom.dispose();
    this.ripples = [];
  }
}
