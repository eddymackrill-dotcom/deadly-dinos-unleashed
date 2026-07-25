import * as THREE from "three";
import type { BiomeId, DinoId } from "./dinosaurs";
import type { ScentNodeConfig } from "../levels/ScentSequence";
import type { SecretConfig } from "../systems/HiddenSecretsSystem";
import { nodePoints } from "./scoring";

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

/** Node values are never authored by hand — they come from the flat economy. */
function node(x: number, type: ScentNodeConfig["type"]): ScentNodeConfig {
  return { position: new THREE.Vector3(x, 0.4, 0), type, points: nodePoints(type) };
}

// Each mission uses a distinct node count/positions/ordering so they feel
// different. Sequences mix the mechanics (collect / chase / stealth / defense,
// and fish in place of chase for Spinosaurus).

export const LEVELS: Record<DinoId, LevelConfig> = {
  // Mission 1 — Eoraptor, Triassic (the original L1 layout).
  eoraptor: {
    id: "L1_eoraptor",
    dinoId: "eoraptor",
    biomeId: "triassic_argentina",
    nodes: [
      node(12, "collect"),
      node(28, "chase"),
      node(46, "collect"),
      node(62, "stealth"),
      node(80, "defense"),
      node(95, "collect"),
    ],
    secrets: [
      { id: "l1_secret_ground_37", position: new THREE.Vector3(37, 0.4, 0) },
      { id: "l1_secret_ledge_85", position: new THREE.Vector3(90, 1.35, 0) },
    ],
    ledges: [{ x: 90, y: 1.0, halfWidth: 1.6 }],
  },

  // Mission 2 — Deinonychus, Jungle. Fast hunter: chase-heavy, double chase.
  deinonychus: {
    id: "L2_deinonychus",
    dinoId: "deinonychus",
    biomeId: "cretaceous_jungle",
    nodes: [
      node(10, "collect"),
      node(24, "chase"),
      node(40, "stealth"),
      node(58, "chase"),
      node(74, "defense"),
      node(90, "collect"),
    ],
    secrets: [
      { id: "l2_secret_ground_33", position: new THREE.Vector3(33, 0.4, 0) },
      { id: "l2_secret_ledge_66", position: new THREE.Vector3(66, 1.45, 0) },
    ],
    ledges: [{ x: 66, y: 1.1, halfWidth: 1.6 }],
  },

  // Mission 3 — T-Rex, Plains. Tanky apex: defense-heavy, double defense.
  trex: {
    id: "L3_trex",
    dinoId: "trex",
    biomeId: "cretaceous_plains",
    nodes: [
      node(14, "collect"),
      node(30, "stealth"),
      node(48, "defense"),
      node(66, "chase"),
      node(82, "defense"),
      node(96, "collect"),
    ],
    secrets: [
      { id: "l3_secret_ground_22", position: new THREE.Vector3(22, 0.4, 0) },
      { id: "l3_secret_ledge_74", position: new THREE.Vector3(74, 1.55, 0) },
    ],
    ledges: [{ x: 74, y: 1.2, halfWidth: 1.8 }],
  },

  // Mission 4 — Spinosaurus, Swamp. The river runs [30,70] (see biomes.ts): the
  // three fish nodes sit in the water, everything else is on the banks. No chase
  // node on this level — fish-catching is Spinosaurus's hunting mechanic.
  spinosaurus: {
    id: "L4_spinosaurus",
    dinoId: "spinosaurus",
    biomeId: "cretaceous_swamp",
    nodes: [
      node(12, "collect"), // near bank
      node(22, "stealth"), // reeds
      node(38, "fish"), // water
      node(52, "fish"), // water
      node(66, "fish"), // water
      node(84, "defense"), // far bank
    ],
    secrets: [
      { id: "l4_secret_ground_76", position: new THREE.Vector3(76, 0.4, 0) },
      { id: "l4_secret_ledge_26", position: new THREE.Vector3(26, 1.45, 0) },
    ],
    ledges: [{ x: 26, y: 1.1, halfWidth: 1.6 }],
  },
};

export function getLevel(dinoId: DinoId): LevelConfig {
  return LEVELS[dinoId];
}
