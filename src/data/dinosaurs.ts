// Single source of truth for the playable roster. M4 ships 4 of the 8 dinos;
// the rest are commented placeholders for future expansion (see CLAUDE.md).

export interface DinoStats {
  speed: number; // all 1–12
  toughness: number;
  power: number;
  senses: number;
}

export type DinoId = "eoraptor" | "deinonychus" | "trex" | "spinosaurus";

export type AnimalPowerId =
  | "quick_dash"
  | "sickle_strike"
  | "apex_roar"
  | "jaw_snap";

export type BiomeId =
  | "triassic_argentina"
  | "cretaceous_jungle"
  | "cretaceous_plains"
  | "cretaceous_swamp";

/**
 * Every animal power is HOLD-TO-ACTIVATE (DESIGN.md §7): the effect lasts while
 * X is held, up to `maxHoldSeconds`; releasing starts a cooldown of
 * `cooldownHoldFactor × time-held`; hitting the hold cap force-releases into the
 * full `cooldownSeconds` penalty. The remaining fields configure the effect.
 */
export interface AnimalPower {
  id: AnimalPowerId;
  displayName: string;
  description: string; // shown on the mission-select card
  cooldownSeconds: number; // full penalty cooldown when the hold cap is hit
  maxHoldSeconds: number; // hold cap (3s across the roster)
  cooldownHoldFactor: number; // cooldown = factor × seconds held (1.5)
  /** Move-speed multiplier while held (1 = no movement bonus). */
  speedMultiplier: number;
  /** Contact with prey/rivals while active = instant catch / stun (Deinonychus). */
  instantCatch?: boolean;
  /** Faint sickle-shaped after-image trail while active (Deinonychus). */
  trail?: boolean;
  /** Emits expanding shockwaves that push back/stun nearby rivals (T-Rex). */
  shockwave?: { intervalSeconds: number; radius: number };
  /** Subtle continuous screen shake while held (T-Rex). */
  screenShake?: boolean;
  /**
   * Jaw Snap (Spinosaurus): activation opens a short catch window in which the
   * catch hitbox extends `reachUnits` ahead of the snout. Any fish inside it
   * when the jaws close is caught.
   */
  jawSnap?: { reachUnits: number; windowMs: number };
  /** Screen-tint colour during activation (hex), matches the dino. */
  tintColor?: string;
}

export interface DinoDef {
  id: DinoId;
  displayName: string;
  era: string;
  region: string;
  modelPath: string;
  /** In-world target height in units; the loader scales the mesh to this. */
  modelScale: number;
  /**
   * Y-rotation (radians) that turns the raw GLB so the animal faces +X. The
   * Quaternius rigs all model forward on -Z, hence the π/2 default; the
   * Spinosaurus mesh is a static sculpt posed on a diagonal and needs its own
   * value (see PATCH_04_1_PROGRESS.md).
   */
  modelRotationY?: number;
  stats: DinoStats;
  /** Base seconds for the tracking bar before senses / power-card modifiers. */
  baseTrackingDuration: number;
  animalPower: AnimalPower;
  biomeId: BiomeId;
}

export const DINOS: Record<DinoId, DinoDef> = {
  eoraptor: {
    id: "eoraptor",
    displayName: "Eoraptor",
    era: "Late Triassic",
    region: "Argentina, 230 mya",
    modelPath: "/models/player_eoraptor.glb",
    modelScale: 0.8,
    stats: { speed: 6, toughness: 3, power: 2, senses: 5 },
    baseTrackingDuration: 25,
    biomeId: "triassic_argentina",
    animalPower: {
      id: "quick_dash",
      displayName: "Quick Dash",
      description: "Hold X for a burst of speed (+60%). Run down anything.",
      cooldownSeconds: 8,
      maxHoldSeconds: 3,
      cooldownHoldFactor: 1.5,
      speedMultiplier: 1.6,
      tintColor: "#ff4040",
    },
  },

  deinonychus: {
    id: "deinonychus",
    displayName: "Deinonychus",
    era: "Early Cretaceous",
    region: "North America, 115 mya",
    // FALLBACK: player_deinonychus.glb is a broken placeholder (Cube, 0 anims).
    // Reuse the animated Velociraptor mesh. See M4_PROGRESS.md.
    modelPath: "/models/player_eoraptor.glb",
    modelScale: 0.9,
    stats: { speed: 9, toughness: 4, power: 5, senses: 7 },
    baseTrackingDuration: 24,
    biomeId: "cretaceous_jungle",
    animalPower: {
      id: "sickle_strike",
      displayName: "Sickle Strike",
      description: "Hold X to surge (+30%) — touch prey or a rival to drop it instantly.",
      cooldownSeconds: 8,
      maxHoldSeconds: 3,
      cooldownHoldFactor: 1.5,
      speedMultiplier: 1.3,
      instantCatch: true,
      trail: true,
      tintColor: "#ffd24a",
    },
  },

  trex: {
    id: "trex",
    displayName: "T-Rex",
    era: "Late Cretaceous",
    region: "North America, 68 mya",
    modelPath: "/models/player_trex.glb",
    modelScale: 1.5,
    stats: { speed: 6, toughness: 11, power: 12, senses: 9 },
    baseTrackingDuration: 26,
    biomeId: "cretaceous_plains",
    animalPower: {
      id: "apex_roar",
      displayName: "Apex Roar",
      description: "Hold X to roar — shockwaves blast back any rival that comes near.",
      cooldownSeconds: 8,
      maxHoldSeconds: 3,
      cooldownHoldFactor: 1.5,
      speedMultiplier: 1, // T-Rex is slow; the roar is the point, not speed.
      shockwave: { intervalSeconds: 0.8, radius: 8 },
      screenShake: true,
      tintColor: "#ff3030",
    },
  },

  spinosaurus: {
    id: "spinosaurus",
    displayName: "Spinosaurus",
    era: "Mid Cretaceous",
    region: "North Africa, 99 mya",
    modelPath: "/models/player_spinosaurus.glb",
    modelScale: 1.7,
    // Measured from the GLB: the sculpt's snout→tail axis sits at -52.75° in XZ,
    // so this is the rotation that lands it facing +X like the rest of the roster.
    modelRotationY: -0.9207,
    stats: { speed: 8, toughness: 10, power: 11, senses: 8 },
    baseTrackingDuration: 26,
    biomeId: "cretaceous_swamp",
    animalPower: {
      id: "jaw_snap",
      displayName: "Jaw Snap",
      description: "Hold X to lunge — the jaws reach 2 units ahead and snap up any fish in front.",
      cooldownSeconds: 8,
      maxHoldSeconds: 3,
      cooldownHoldFactor: 1.5,
      speedMultiplier: 1.2,
      jawSnap: { reachUnits: 2, windowMs: 300 },
      tintColor: "#3fb6ff",
    },
  },
};

export const DINO_ORDER: DinoId[] = ["eoraptor", "deinonychus", "trex", "spinosaurus"];

export function getDino(id: DinoId): DinoDef {
  return DINOS[id];
}

/* ---------------------------------------------------------------------------
 * Future expansion — the remaining 4 of the 8 (CLAUDE.md roster). Data only;
 * no models / biomes / powers wired yet.
 *
 * herrerasaurus:  Late Triassic, Argentina      — stats 7/4/4/6  — Lunge
 * tarbosaurus:    Late Cretaceous, Mongolia      — stats 5/8/8/7  — Bone-Crush Bite
 * albertosaurus:  Late Cretaceous, Canada        — stats 7/7/8/8  — Pack Howl
 * carcharodontosaurus: Mid Cretaceous, N. Africa — stats 7/9/11/7 — Shark-Tooth Slash
 * ------------------------------------------------------------------------- */

export function trackingDuration(stats: DinoStats, base: number, moreTimeCard = false): number {
  const sensesMult = 1 + stats.senses * 0.05;
  const cardMult = moreTimeCard ? 1.5 : 1;
  return base * sensesMult * cardMult;
}
