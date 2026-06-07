import type { BiomeId } from "./dinosaurs";
import type { MeshType } from "../levels/biomeMeshes";

export interface BiomeParallaxLayer {
  meshType: MeshType;
  color: string;
  /** Screen-velocity factor (parallaxFactor): 0.2 barely moves, 1.2 = foreground. */
  scrollRate: number;
  /** Vertical offset of the layer's tiles, in world units. */
  yOffset: number;
}

export interface BiomeConfig {
  id: BiomeId;
  skyGradient: [string, string]; // [top, bottom]
  parallaxLayers: BiomeParallaxLayer[];
  ground: { color: string; propMeshes: MeshType[] };
  ambientLight: { color: string; intensity: number };
  fogColor: string;
  fogNear: number;
  fogFar: number;
  /** Swamp only — water tile x-ranges (world space) + tint. Drives River Ambush. */
  water?: { color: string; tiles: Array<[number, number]> };
}

export const BIOMES: Record<BiomeId, BiomeConfig> = {
  // Existing Triassic look, preserved from the old hardcoded L1.
  triassic_argentina: {
    id: "triassic_argentina",
    skyGradient: ["#e6b877", "#d4a373"],
    parallaxLayers: [
      { meshType: "mountains", color: "#6b3f24", scrollRate: 0.2, yOffset: 0 },
      { meshType: "hills", color: "#8a5a35", scrollRate: 0.5, yOffset: 0 },
      { meshType: "rocks", color: "#b88060", scrollRate: 0.8, yOffset: 0 },
      { meshType: "ferns", color: "#1e1208", scrollRate: 1.2, yOffset: 0 },
    ],
    ground: { color: "#b37a48", propMeshes: ["rocks", "ferns"] },
    ambientLight: { color: "#ffd2a8", intensity: 0.65 },
    fogColor: "#d4a373",
    fogNear: 22,
    fogFar: 70,
  },

  // Lush, humid, layered greens; cool fog closes in.
  cretaceous_jungle: {
    id: "cretaceous_jungle",
    skyGradient: ["#0c3b2e", "#1f8a6e"],
    parallaxLayers: [
      { meshType: "mountains", color: "#14342a", scrollRate: 0.2, yOffset: 0 },
      { meshType: "hills", color: "#1f5c43", scrollRate: 0.5, yOffset: 0 },
      { meshType: "trees", color: "#2f7d52", scrollRate: 0.8, yOffset: 0 },
      { meshType: "ferns", color: "#0a2417", scrollRate: 1.2, yOffset: 0 },
    ],
    ground: { color: "#2e5e34", propMeshes: ["ferns", "trees"] },
    ambientLight: { color: "#bfeecf", intensity: 0.6 },
    fogColor: "#1f6b54",
    fogNear: 18,
    fogFar: 60,
  },

  // Golden-hour grassland: warm sky, sparse trees, distant warm fog.
  cretaceous_plains: {
    id: "cretaceous_plains",
    skyGradient: ["#ffd27a", "#ff9e7a"],
    parallaxLayers: [
      { meshType: "mountains", color: "#b5793f", scrollRate: 0.2, yOffset: 0 },
      { meshType: "hills", color: "#c98f4a", scrollRate: 0.5, yOffset: 0 },
      { meshType: "trees", color: "#8a6a3a", scrollRate: 0.8, yOffset: 0 },
      { meshType: "ferns", color: "#6b4a2a", scrollRate: 1.2, yOffset: 0 },
    ],
    ground: { color: "#caa45a", propMeshes: ["ferns", "trees"] },
    ambientLight: { color: "#ffe0b0", intensity: 0.7 },
    fogColor: "#ffb27a",
    fogNear: 26,
    fogFar: 80,
  },

  // Murky, dense, green-brown; water tiles in the ground plane.
  cretaceous_swamp: {
    id: "cretaceous_swamp",
    skyGradient: ["#243b34", "#3a4a3a"],
    parallaxLayers: [
      { meshType: "mountains", color: "#1a2a24", scrollRate: 0.2, yOffset: 0 },
      { meshType: "hills", color: "#2a3a2e", scrollRate: 0.5, yOffset: 0 },
      { meshType: "swamp_trees", color: "#1f3a2a", scrollRate: 0.8, yOffset: 0 },
      { meshType: "ferns", color: "#0c1810", scrollRate: 1.2, yOffset: 0 },
    ],
    ground: { color: "#3a4030", propMeshes: ["swamp_trees", "ferns"] },
    ambientLight: { color: "#9fc0a8", intensity: 0.55 },
    fogColor: "#243a2e",
    fogNear: 14,
    fogFar: 50,
    water: {
      color: "#2a8fa0",
      // Aligns with the Spinosaurus level's scent layout (chunk 4).
      tiles: [
        [12, 22],
        [44, 56],
        [80, 92],
      ],
    },
  },
};

export function getBiome(id: BiomeId): BiomeConfig {
  return BIOMES[id];
}
