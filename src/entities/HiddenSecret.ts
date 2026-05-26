import * as THREE from "three";
import gsap from "gsap";

/**
 * A glowing pile of bones/fossils/glinting stones. Walk over it (3D proximity
 * check) to claim. Visual: a few small low-poly chunks plus a soft point
 * light, with a gentle vertical bob and a slow rotation to draw the eye.
 */
export class HiddenSecret {
  readonly root = new THREE.Group();
  readonly position = new THREE.Vector3();
  readonly id: string;

  private materials: THREE.Material[] = [];
  private geometries: THREE.BufferGeometry[] = [];
  private inner: THREE.Group;
  private light: THREE.PointLight;
  private bobTime = Math.random() * Math.PI * 2;
  private claimed = false;

  constructor(id: string, position: THREE.Vector3, seed = 0) {
    this.id = id;
    this.position.copy(position);
    this.root.position.copy(position);
    this.root.name = `HiddenSecret:${id}`;

    this.inner = new THREE.Group();
    this.root.add(this.inner);

    const rng = mulberry32(seed || hashSeed(id));
    const chunkCount = 3 + Math.floor(rng() * 2);
    const palette = [0xeaca8a, 0xd7b066, 0xc2935b, 0xe9d8a6];

    for (let i = 0; i < chunkCount; i++) {
      const r = 0.16 + rng() * 0.12;
      const geom = new THREE.DodecahedronGeometry(r, 0);
      const mat = new THREE.MeshLambertMaterial({
        color: palette[i % palette.length],
        flatShading: true,
        emissive: new THREE.Color(0x9c7a32),
        emissiveIntensity: 0.35,
      });
      const chunk = new THREE.Mesh(geom, mat);
      chunk.position.set(
        (rng() - 0.5) * 0.4,
        r * 0.5 + rng() * 0.1,
        (rng() - 0.5) * 0.3,
      );
      chunk.rotation.set(rng() * 6.28, rng() * 6.28, rng() * 6.28);
      this.inner.add(chunk);
      this.materials.push(mat);
      this.geometries.push(geom);
    }

    // Soft warm point light to sell the "glow" without needing bloom.
    this.light = new THREE.PointLight(0xffd166, 1.2, 4, 2);
    this.light.position.y = 0.4;
    this.inner.add(this.light);
  }

  /** 3D distance check from given world position. */
  distanceTo(point: THREE.Vector3): number {
    return this.position.distanceTo(point);
  }

  update(dt: number) {
    if (this.claimed) return;
    this.bobTime += dt;
    this.inner.position.y = Math.sin(this.bobTime * 2.5) * 0.08;
    this.inner.rotation.y += dt * 0.7;
    this.light.intensity = 1.0 + Math.sin(this.bobTime * 5) * 0.2;
  }

  /** Play a quick claim animation and mark the secret claimed (visually). */
  playClaim(onComplete: () => void) {
    if (this.claimed) {
      onComplete();
      return;
    }
    this.claimed = true;
    // gsap may be unavailable in the headless self-test runner. Fall back to
    // an immediate completion rather than crashing — the visual is browser-only.
    // gsap may be unavailable in the headless self-test runner. Fall back to
    // an immediate completion rather than crashing — the visual is browser-only.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = gsap as any;
    if (typeof g?.timeline !== "function") {
      onComplete();
      return;
    }
    g.killTweensOf?.(this.inner.position);
    g.killTweensOf?.(this.inner.scale);
    g.timeline({ onComplete })
      .to(this.inner.position, { y: 1.0, duration: 0.35, ease: "power2.out" })
      .to(this.inner.scale, { x: 0, y: 0, z: 0, duration: 0.25, ease: "power2.in" }, "-=0.15");
  }

  dispose() {
    for (const m of this.materials) m.dispose();
    for (const g of this.geometries) g.dispose();
  }
}

function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
