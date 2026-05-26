import * as THREE from "three";

/**
 * Procedural low-poly leafy cluster used as a hide spot in stealth encounters.
 * Visual: 3–5 overlapping flat-shaded green spheres of varying size, with a
 * thin ring of taller "fronds" poking through. Bush occupies the X range
 * [position.x - halfWidth, position.x + halfWidth] for hide-detection.
 */
export class Bush {
  readonly root = new THREE.Group();
  readonly position = new THREE.Vector3();
  readonly halfWidth: number;

  private materials: THREE.Material[] = [];
  private geometries: THREE.BufferGeometry[] = [];

  constructor(position: THREE.Vector3, halfWidth = 0.9, seed = 0) {
    this.position.copy(position);
    this.halfWidth = halfWidth;
    this.root.position.copy(position);

    const rng = mulberry32(seed || Math.floor(Math.random() * 1e6));
    const baseColor = 0x386a25;
    const accentColor = 0x4f8a30;

    const blobCount = 4 + Math.floor(rng() * 2);
    for (let i = 0; i < blobCount; i++) {
      const r = halfWidth * (0.55 + rng() * 0.35);
      const geom = new THREE.IcosahedronGeometry(r, 0);
      const mat = new THREE.MeshLambertMaterial({
        color: i === 0 ? baseColor : accentColor,
        flatShading: true,
      });
      const blob = new THREE.Mesh(geom, mat);
      const offsetX = (rng() - 0.5) * halfWidth * 1.4;
      const offsetY = r * 0.55 + rng() * 0.15;
      const offsetZ = (rng() - 0.5) * 0.35;
      blob.position.set(offsetX, offsetY, offsetZ);
      blob.rotation.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
      this.root.add(blob);
      this.materials.push(mat);
      this.geometries.push(geom);
    }

    // A few taller fronds (planes) to silhouette the bush.
    const frondCount = 5 + Math.floor(rng() * 3);
    for (let i = 0; i < frondCount; i++) {
      const len = halfWidth * (0.9 + rng() * 0.4);
      const geom = new THREE.PlaneGeometry(0.16, len);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x274a18,
        side: THREE.DoubleSide,
        fog: false,
      });
      const frond = new THREE.Mesh(geom, mat);
      frond.position.set(
        (rng() - 0.5) * halfWidth * 1.6,
        len / 2,
        (rng() - 0.5) * 0.4,
      );
      frond.rotation.z = (rng() - 0.5) * 0.4;
      this.root.add(frond);
      this.materials.push(mat);
      this.geometries.push(geom);
    }
  }

  /** True if the given world X falls inside the bush's hide zone. */
  contains(worldX: number): boolean {
    return Math.abs(worldX - this.position.x) <= this.halfWidth;
  }

  dispose() {
    for (const m of this.materials) m.dispose();
    for (const g of this.geometries) g.dispose();
  }
}

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
