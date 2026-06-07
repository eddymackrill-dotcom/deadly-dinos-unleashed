import * as THREE from "three";
import type { BiomeConfig } from "../data/biomes";
import { ParallaxBackground, type ParallaxLayerConfig } from "./ParallaxBackground";
import {
  MESH_DEFAULTS,
  buildMeshTile,
  mulberry32,
  hexToInt,
  type MeshType,
} from "./biomeMeshes";

export interface BiomeWorld {
  root: THREE.Group;
  /** True if world-X falls on a water tile (drives River Ambush). */
  isWater: (x: number) => boolean;
  /** Advance parallax (and any water animation). */
  update: (cameraX: number, dt: number) => void;
  dispose: () => void;
}

function lighten(color: number, amount: number): number {
  const c = new THREE.Color(color);
  c.lerp(new THREE.Color(0xffffff), amount);
  return c.getHex();
}

function disposeTree(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material;
    if (mat) {
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat.dispose();
    }
  });
}

function propColorFor(type: MeshType, biome: BiomeConfig, layerColor: Map<MeshType, number>): number {
  if (type === "rocks") return 0xa37046;
  const base = layerColor.get(type) ?? hexToInt(biome.ground.color);
  return lighten(base, 0.4); // brighter foreground version of the silhouette tone
}

function addGroundDecorations(parent: THREE.Object3D, halfRange: number, biome: BiomeConfig, seed: number) {
  const rng = mulberry32(seed);
  const layerColor = new Map<MeshType, number>();
  for (const l of biome.parallaxLayers) layerColor.set(l.meshType, hexToInt(l.color));
  const types = biome.ground.propMeshes;
  if (types.length === 0) return;

  for (let x = -halfRange; x < halfRange; x += 2 + rng() * 3) {
    // Don't scatter props in open water.
    if (biome.water && biome.water.tiles.some(([a, b]) => x >= a - 1 && x <= b + 1)) continue;
    const type = types[Math.floor(rng() * types.length)];
    const offsetZ = (rng() - 0.5) * 1.6;
    const prop = buildMeshTile(type, 1.4, propColorFor(type, biome, layerColor), Math.floor(rng() * 1e6));
    prop.position.set(x, 0, offsetZ);
    prop.scale.setScalar(0.55 + rng() * 0.4);
    parent.add(prop);
  }
}

/**
 * Build a biome's scene geometry from data: ground plane, optional water tiles,
 * scattered ground props, and the layered parallax background. Sky/fog/lights are
 * applied separately by Scene.applyBiome(). Level-specific geometry (ledges,
 * scent nodes) is added by the level on top of this.
 */
export function buildBiomeWorld(biome: BiomeConfig): BiomeWorld {
  const root = new THREE.Group();

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 30),
    new THREE.MeshLambertMaterial({ color: hexToInt(biome.ground.color), flatShading: true }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.name = "ground";
  root.add(ground);

  const waterRanges: Array<[number, number]> = biome.water?.tiles ?? [];
  const waterMats: THREE.MeshLambertMaterial[] = [];
  if (biome.water) {
    for (const [x0, x1] of biome.water.tiles) {
      const mat = new THREE.MeshLambertMaterial({
        color: hexToInt(biome.water.color),
        transparent: true,
        opacity: 0.82,
        flatShading: true,
      });
      waterMats.push(mat);
      const wm = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, 6), mat);
      wm.rotation.x = -Math.PI / 2;
      wm.position.set((x0 + x1) / 2, 0.03, 0); // just above ground (avoid z-fight)
      wm.name = "water";
      root.add(wm);
    }
  }

  addGroundDecorations(root, 60, biome, 7);

  const layerConfigs: ParallaxLayerConfig[] = biome.parallaxLayers.map((layer, i) => {
    const d = MESH_DEFAULTS[layer.meshType];
    return {
      parallaxFactor: layer.scrollRate,
      z: d.z,
      tileWidth: d.tileWidth,
      numTiles: d.numTiles,
      build: () => {
        const tile = buildMeshTile(layer.meshType, d.tileWidth, hexToInt(layer.color), 1009 * (i + 1) + 31);
        tile.position.y = layer.yOffset;
        return tile;
      },
    };
  });
  const parallax = new ParallaxBackground(layerConfigs);
  root.add(parallax.root);

  let waterClock = 0;
  return {
    root,
    isWater: (x: number) => waterRanges.some(([a, b]) => x >= a && x <= b),
    update: (cameraX: number, dt: number) => {
      parallax.update(cameraX);
      // Cheap "ripple": gently pulse water opacity instead of a shader (perf floor).
      if (waterMats.length > 0) {
        waterClock += dt;
        const o = 0.78 + Math.sin(waterClock * 1.6) * 0.06;
        for (const m of waterMats) m.opacity = o;
      }
    },
    dispose: () => disposeTree(root),
  };
}
