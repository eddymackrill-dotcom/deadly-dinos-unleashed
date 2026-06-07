import * as THREE from "three";
import type { BiomeId, DinoId } from "./dinosaurs";
import type { ScentNodeConfig } from "../levels/ScentSequence";
import type { SecretConfig } from "../systems/HiddenSecretsSystem";

export interface LedgeConfig {
  x: number;
  y: number;
  halfWidth: number;
}

export interface LevelConfig {
  id: string; // mission id, e.g. "L1_eoraptor"
  dinoId: DinoId;
  biomeId: BiomeId;
  nodes: ScentNodeConfig[];
  secrets: SecretConfig[];
  ledges?: LedgeConfig[];
}

// Each mission uses a distinct node count/positions/ordering so they feel
// different. Sequences mix all 4 mechanics (collect / chase / stealth / defense).

export const LEVELS: Record<DinoId, LevelConfig> = {
  // Mission 1 — Eoraptor, Triassic (the original L1 layout).
  eoraptor: {
    id: "L1_eoraptor",
    dinoId: "eoraptor",
    biomeId: "triassic_argentina",
    nodes: [
      { position: new THREE.Vector3(12, 0.4, 0), type: "collect", points: 100 },
      { position: new THREE.Vector3(28, 0.4, 0), type: "chase", points: 250 },
      { position: new THREE.Vector3(46, 0.4, 0), type: "collect", points: 100 },
      { position: new THREE.Vector3(62, 0.4, 0), type: "stealth", points: 300 },
      { position: new THREE.Vector3(80, 0.4, 0), type: "defense", points: 300 },
      { position: new THREE.Vector3(95, 0.4, 0), type: "collect", points: 100 },
    ],
    secrets: [
      { id: "l1_secret_ground_37", position: new THREE.Vector3(37, 0.4, 0), pointsRange: [100, 300] },
      { id: "l1_secret_ledge_85", position: new THREE.Vector3(90, 1.35, 0), pointsRange: [200, 500] },
    ],
    ledges: [{ x: 90, y: 1.0, halfWidth: 1.6 }],
  },

  // Mission 2 — Deinonychus, Jungle. Fast hunter: chase-heavy, double chase.
  deinonychus: {
    id: "L2_deinonychus",
    dinoId: "deinonychus",
    biomeId: "cretaceous_jungle",
    nodes: [
      { position: new THREE.Vector3(10, 0.4, 0), type: "collect", points: 100 },
      { position: new THREE.Vector3(24, 0.4, 0), type: "chase", points: 250 },
      { position: new THREE.Vector3(40, 0.4, 0), type: "stealth", points: 300 },
      { position: new THREE.Vector3(58, 0.4, 0), type: "chase", points: 250 },
      { position: new THREE.Vector3(74, 0.4, 0), type: "defense", points: 300 },
      { position: new THREE.Vector3(90, 0.4, 0), type: "collect", points: 100 },
    ],
    secrets: [
      { id: "l2_secret_ground_33", position: new THREE.Vector3(33, 0.4, 0), pointsRange: [150, 350] },
      { id: "l2_secret_ledge_66", position: new THREE.Vector3(66, 1.45, 0), pointsRange: [250, 550] },
    ],
    ledges: [{ x: 66, y: 1.1, halfWidth: 1.6 }],
  },

  // Mission 3 — T-Rex, Plains. Tanky apex: defense-heavy, double defense.
  trex: {
    id: "L3_trex",
    dinoId: "trex",
    biomeId: "cretaceous_plains",
    nodes: [
      { position: new THREE.Vector3(14, 0.4, 0), type: "collect", points: 100 },
      { position: new THREE.Vector3(30, 0.4, 0), type: "stealth", points: 300 },
      { position: new THREE.Vector3(48, 0.4, 0), type: "defense", points: 300 },
      { position: new THREE.Vector3(66, 0.4, 0), type: "chase", points: 250 },
      { position: new THREE.Vector3(82, 0.4, 0), type: "defense", points: 300 },
      { position: new THREE.Vector3(96, 0.4, 0), type: "collect", points: 100 },
    ],
    secrets: [
      { id: "l3_secret_ground_22", position: new THREE.Vector3(22, 0.4, 0), pointsRange: [150, 350] },
      { id: "l3_secret_ledge_74", position: new THREE.Vector3(74, 1.55, 0), pointsRange: [250, 550] },
    ],
    ledges: [{ x: 74, y: 1.2, halfWidth: 1.8 }],
  },

  // Mission 4 — Spinosaurus, Swamp. Water tiles at [12,22],[44,56],[80,92]
  // (see biomes.ts) — collect nodes sit in water so River Ambush traversal pays off.
  spinosaurus: {
    id: "L4_spinosaurus",
    dinoId: "spinosaurus",
    biomeId: "cretaceous_swamp",
    nodes: [
      { position: new THREE.Vector3(16, 0.4, 0), type: "collect", points: 100 }, // water
      { position: new THREE.Vector3(30, 0.4, 0), type: "chase", points: 250 },
      { position: new THREE.Vector3(40, 0.4, 0), type: "collect", points: 100 },
      { position: new THREE.Vector3(50, 0.4, 0), type: "stealth", points: 300 }, // water
      { position: new THREE.Vector3(68, 0.4, 0), type: "defense", points: 300 },
      { position: new THREE.Vector3(86, 0.4, 0), type: "collect", points: 100 }, // water
    ],
    secrets: [
      { id: "l4_secret_ground_60", position: new THREE.Vector3(60, 0.4, 0), pointsRange: [150, 350] },
      { id: "l4_secret_ledge_74", position: new THREE.Vector3(74, 1.45, 0), pointsRange: [250, 550] },
    ],
    ledges: [{ x: 74, y: 1.1, halfWidth: 1.6 }],
  },
};

export function getLevel(dinoId: DinoId): LevelConfig {
  return LEVELS[dinoId];
}
