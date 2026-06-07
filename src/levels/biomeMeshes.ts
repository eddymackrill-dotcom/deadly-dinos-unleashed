import * as THREE from "three";

/**
 * Procedural mesh generators shared by all biomes. Each parallax/prop mesh is a
 * stylised low-poly silhouette in a single layer colour; biomes vary palette and
 * shape via `meshType`. Moved out of L1_Eoraptor in M4 so every biome reuses it.
 */

export type MeshType =
  | "mountains"
  | "hills"
  | "rocks"
  | "trees"
  | "ferns"
  | "swamp_trees";

export function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeMountainTile(width: number, peakHeight: number, color: number, seed: number, segments = 14): THREE.Mesh {
  const rng = mulberry32(seed);
  const shape = new THREE.Shape();
  const halfW = width / 2;
  shape.moveTo(-halfW, 0);
  for (let i = 0; i <= segments; i++) {
    const x = -halfW + (i / segments) * width;
    const h = peakHeight * (0.4 + rng() * 0.6);
    shape.lineTo(x, h);
  }
  shape.lineTo(halfW, 0);
  shape.closePath();
  const geom = new THREE.ShapeGeometry(shape);
  const mat = new THREE.MeshBasicMaterial({ color, fog: true });
  return new THREE.Mesh(geom, mat);
}

export function makeHillsTile(width: number, peakHeight: number, color: number, seed: number, segments = 28): THREE.Mesh {
  const rng = mulberry32(seed);
  const shape = new THREE.Shape();
  const halfW = width / 2;
  shape.moveTo(-halfW, 0);
  for (let i = 0; i <= segments; i++) {
    const x = -halfW + (i / segments) * width;
    const wave = Math.sin((i / segments) * Math.PI * 3.2) * 0.4 + 0.55;
    const h = peakHeight * (wave + (rng() - 0.5) * 0.25);
    shape.lineTo(x, h);
  }
  shape.lineTo(halfW, 0);
  shape.closePath();
  const geom = new THREE.ShapeGeometry(shape);
  const mat = new THREE.MeshLambertMaterial({ color, flatShading: true });
  return new THREE.Mesh(geom, mat);
}

export function makeRockCluster(width: number, color: number, seed: number): THREE.Group {
  const rng = mulberry32(seed);
  const group = new THREE.Group();
  const count = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < count; i++) {
    const size = 0.4 + rng() * 0.7;
    const geom = new THREE.DodecahedronGeometry(size, 0);
    const mat = new THREE.MeshLambertMaterial({ color, flatShading: true });
    const m = new THREE.Mesh(geom, mat);
    m.position.x = -width / 2 + rng() * width;
    m.position.y = size * 0.5;
    m.rotation.set(rng() * 6.28, rng() * 6.28, rng() * 6.28);
    group.add(m);
  }
  return group;
}

export function makeFernCluster(width: number, color: number, seed: number): THREE.Group {
  const rng = mulberry32(seed);
  const group = new THREE.Group();
  const count = 1 + Math.floor(rng() * 2);
  for (let i = 0; i < count; i++) {
    const frondCount = 6 + Math.floor(rng() * 3);
    const fern = new THREE.Group();
    for (let j = 0; j < frondCount; j++) {
      const len = 0.7 + rng() * 0.6;
      const geom = new THREE.PlaneGeometry(0.22, len);
      const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, fog: false });
      const f = new THREE.Mesh(geom, mat);
      const angle = (j / frondCount) * Math.PI - Math.PI / 2 + (rng() - 0.5) * 0.25;
      f.position.y = len / 2;
      f.rotation.z = angle;
      fern.add(f);
    }
    fern.position.x = -width / 2 + rng() * width;
    group.add(fern);
  }
  return group;
}

/** Tall low-poly trees (trunk + stacked conical canopy), single-colour silhouette. */
export function makeTreeCluster(width: number, color: number, seed: number): THREE.Group {
  const rng = mulberry32(seed);
  const group = new THREE.Group();
  const count = 1 + Math.floor(rng() * 2);
  for (let i = 0; i < count; i++) {
    const tree = new THREE.Group();
    const trunkH = 1.6 + rng() * 1.4;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.18, trunkH, 5),
      new THREE.MeshLambertMaterial({ color, flatShading: true }),
    );
    trunk.position.y = trunkH / 2;
    tree.add(trunk);
    const tiers = 2 + Math.floor(rng() * 2);
    for (let t = 0; t < tiers; t++) {
      const r = 0.9 - t * 0.22 + rng() * 0.15;
      const canopy = new THREE.Mesh(
        new THREE.ConeGeometry(r, 1.1, 6),
        new THREE.MeshLambertMaterial({ color, flatShading: true }),
      );
      canopy.position.y = trunkH + t * 0.7;
      tree.add(canopy);
    }
    tree.position.x = -width / 2 + rng() * width;
    tree.scale.setScalar(0.8 + rng() * 0.5);
    group.add(tree);
  }
  return group;
}

/** Swamp trees: squat trunk, broad drooping canopy, a couple of hanging vines. */
export function makeSwampTreeCluster(width: number, color: number, seed: number): THREE.Group {
  const rng = mulberry32(seed);
  const group = new THREE.Group();
  const count = 1 + Math.floor(rng() * 2);
  for (let i = 0; i < count; i++) {
    const tree = new THREE.Group();
    const trunkH = 1.8 + rng() * 1.2;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.3, trunkH, 6),
      new THREE.MeshLambertMaterial({ color, flatShading: true }),
    );
    trunk.position.y = trunkH / 2;
    tree.add(trunk);
    // Broad flat-ish canopy.
    const canopy = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.3 + rng() * 0.4, 0),
      new THREE.MeshLambertMaterial({ color, flatShading: true }),
    );
    canopy.position.y = trunkH + 0.4;
    canopy.scale.set(1.3, 0.7, 1.0);
    tree.add(canopy);
    // Hanging vines.
    const vines = 2 + Math.floor(rng() * 3);
    for (let v = 0; v < vines; v++) {
      const len = 0.8 + rng() * 1.1;
      const vine = new THREE.Mesh(
        new THREE.PlaneGeometry(0.08, len),
        new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, fog: true }),
      );
      vine.position.set((rng() - 0.5) * 2.2, trunkH + 0.2 - len / 2, (rng() - 0.5) * 0.6);
      tree.add(vine);
    }
    tree.position.x = -width / 2 + rng() * width;
    tree.scale.setScalar(0.85 + rng() * 0.4);
    group.add(tree);
  }
  return group;
}

/** Per-meshType depth/tiling defaults — the biome config supplies scroll + colour. */
export const MESH_DEFAULTS: Record<
  MeshType,
  { z: number; tileWidth: number; numTiles: number }
> = {
  mountains: { z: -32, tileWidth: 80, numTiles: 3 },
  hills: { z: -18, tileWidth: 60, numTiles: 3 },
  rocks: { z: -6, tileWidth: 18, numTiles: 5 },
  trees: { z: -10, tileWidth: 22, numTiles: 5 },
  ferns: { z: 4, tileWidth: 14, numTiles: 5 },
  swamp_trees: { z: -9, tileWidth: 22, numTiles: 5 },
};

/** Build one parallax/prop tile of the given type in the given colour. */
export function buildMeshTile(type: MeshType, width: number, color: number, seed: number): THREE.Object3D {
  switch (type) {
    case "mountains":
      return makeMountainTile(width, 16, color, seed);
    case "hills":
      return makeHillsTile(width, 7, color, seed);
    case "rocks":
      return makeRockCluster(width, color, seed);
    case "trees":
      return makeTreeCluster(width, color, seed);
    case "ferns":
      return makeFernCluster(width, color, seed);
    case "swamp_trees":
      return makeSwampTreeCluster(width, color, seed);
  }
}

export function hexToInt(hex: string): number {
  return parseInt(hex.replace("#", ""), 16);
}
