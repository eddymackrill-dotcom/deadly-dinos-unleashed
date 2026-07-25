import { DINOS, DINO_ORDER, type DinoId } from "../data/dinosaurs";
import { LEVELS } from "../data/levels";
import { BIOMES, getBiome } from "../data/biomes";
import { buildBiomeWorld } from "./Biome";
import { ScentSequence } from "./ScentSequence";
import { migrateSave } from "../progression/Save";

/**
 * M4 logic self-tests: roster data integrity, animal-power config, biome
 * loading, save migration, and an end-to-end simulation of each mission's
 * scent sequence. Mirrors the runScentSequenceSelfTest pattern — log a trace,
 * throw on failure.
 */
export function runM4SelfTests() {
  testDinoStats();
  testPowers();
  testBiomes();
  testSaveMigration();
  testMissionSequences();
  console.log("[m4-selftest] PASS — roster, powers, biomes, save migration, 4 missions.");
}

// Stats straight from CLAUDE.md's roster table.
const EXPECTED_STATS: Record<DinoId, [number, number, number, number]> = {
  eoraptor: [6, 3, 2, 5],
  deinonychus: [9, 4, 5, 7],
  trex: [6, 11, 12, 9],
  spinosaurus: [8, 10, 11, 8],
};

function testDinoStats() {
  const tag = "[m4-selftest][dinos]";
  assert(DINO_ORDER.length === 4, `${tag}: 4 dinos in roster`);
  for (const id of DINO_ORDER) {
    const d = DINOS[id];
    assert(d.id === id, `${tag}: ${id} id matches key`);
    const [sp, to, po, se] = EXPECTED_STATS[id];
    assert(
      d.stats.speed === sp && d.stats.toughness === to && d.stats.power === po && d.stats.senses === se,
      `${tag}: ${id} stats ${JSON.stringify(d.stats)} != ${EXPECTED_STATS[id]}`,
    );
    assert(!!d.modelPath && !!d.displayName && !!d.era && !!d.region, `${tag}: ${id} has display fields`);
    assert(d.modelScale > 0, `${tag}: ${id} modelScale > 0`);
  }
  console.log(`${tag} 4 dinos, stats match CLAUDE.md table — OK`);
}

function testPowers() {
  const tag = "[m4-selftest][powers]";
  const expectedPowerId: Record<DinoId, string> = {
    eoraptor: "quick_dash",
    deinonychus: "sickle_strike",
    trex: "apex_roar",
    spinosaurus: "jaw_snap",
  };
  for (const id of DINO_ORDER) {
    const p = DINOS[id].animalPower;
    assert(p.id === expectedPowerId[id], `${tag}: ${id} power id ${p.id} != ${expectedPowerId[id]}`);
    assert(p.maxHoldSeconds === 3, `${tag}: ${id} maxHold should be 3s (got ${p.maxHoldSeconds})`);
    assert(p.cooldownHoldFactor === 1.5, `${tag}: ${id} cooldown factor should be 1.5`);
    assert(p.cooldownSeconds > 0, `${tag}: ${id} penalty cooldown > 0`);
    assert(p.speedMultiplier >= 1, `${tag}: ${id} speedMultiplier >= 1 (got ${p.speedMultiplier})`);
  }
  // Spot-check the distinctive effects.
  assert(DINOS.eoraptor.animalPower.speedMultiplier === 1.6, `${tag}: Quick Dash +60%`);
  assert(DINOS.deinonychus.animalPower.instantCatch === true, `${tag}: Sickle Strike instantCatch`);
  assert(!!DINOS.trex.animalPower.shockwave, `${tag}: Apex Roar shockwave`);
  const jaw = DINOS.spinosaurus.animalPower.jawSnap;
  assert(!!jaw, `${tag}: Jaw Snap has a jawSnap config`);
  assert(jaw!.reachUnits === 2, `${tag}: Jaw Snap reaches 2 units (got ${jaw!.reachUnits})`);
  assert(jaw!.windowMs === 300, `${tag}: Jaw Snap window is 300ms (got ${jaw!.windowMs})`);
  console.log(`${tag} 4 powers configured (hold 3s, cd ×1.5) with correct effects — OK`);
}

function testBiomes() {
  const tag = "[m4-selftest][biomes]";
  for (const id of DINO_ORDER) {
    const biomeId = DINOS[id].biomeId;
    const biome = getBiome(biomeId);
    assert(!!biome && biome.id === biomeId, `${tag}: ${id} biome ${biomeId} resolves`);
    assert(biome.parallaxLayers.length >= 3, `${tag}: ${biomeId} has >=3 parallax layers`);
    assert(biome.skyGradient.length === 2, `${tag}: ${biomeId} sky gradient has 2 stops`);
    // Build the world (THREE scene graph; no WebGL needed) — must not throw.
    const world = buildBiomeWorld(biome);
    assert(world.root.children.length > 0, `${tag}: ${biomeId} world has geometry`);
    world.dispose();
  }
  // Swamp river query — one continuous band across the middle third.
  const swamp = buildBiomeWorld(BIOMES.cretaceous_swamp);
  assert(swamp.isWater(50) === true, `${tag}: swamp x=50 is water`);
  assert(swamp.isWater(16) === false, `${tag}: swamp x=16 is dry bank`);
  assert(swamp.isWater(84) === false, `${tag}: swamp x=84 is dry bank`);
  const range = swamp.waterRangeAt(50);
  assert(!!range && range[0] === 30 && range[1] === 70, `${tag}: river spans [30,70]`);
  assert(swamp.waterRangeAt(16) === null, `${tag}: no water range on the bank`);
  swamp.dispose();
  // Non-swamp biomes have no water.
  const tri = buildBiomeWorld(BIOMES.triassic_argentina);
  assert(tri.isWater(16) === false, `${tag}: triassic has no water`);
  tri.dispose();
  console.log(`${tag} 4 biomes build; swamp water query correct — OK`);
}

function testSaveMigration() {
  const tag = "[m4-selftest][save]";
  // A representative v1 save with only Eoraptor progress.
  const v1 = {
    version: 1,
    dinos: {
      eoraptor: {
        predatorPoints: 1234,
        unlockedStyles: ["juvenile"],
        missions: {
          L1_eoraptor: { completion: 0.83, bestPoints: 900, attempts: 4, hiddenSecretsFound: 1, foundSecretIds: ["l1_secret_ground_37"] },
        },
      },
    },
  };
  const migrated = migrateSave(v1);
  assert(migrated.version === 2, `${tag}: migrated to version 2 (got ${migrated.version})`);
  const eo = migrated.dinos.eoraptor;
  assert(!!eo, `${tag}: eoraptor entry preserved`);
  assert(eo.predatorPoints === 1234, `${tag}: predatorPoints preserved (got ${eo.predatorPoints})`);
  assert(eo.missions.L1_eoraptor.completion === 0.83, `${tag}: mission completion preserved`);
  assert(eo.missions.L1_eoraptor.foundSecretIds.length === 1, `${tag}: secret ids preserved`);
  assert(eo.unlockedStyles.length === 1, `${tag}: styles preserved`);
  // New v2 fields default in.
  assert(eo.rank === 1, `${tag}: rank defaults to 1 (got ${eo.rank})`);
  assert(eo.fossilProgrammePercent === 0, `${tag}: fossilProgrammePercent defaults to 0`);
  // Other dinos absent in v1 → default empty on access (not pre-populated).
  assert(migrated.dinos.trex === undefined, `${tag}: absent dinos stay absent (default on read)`);
  console.log(`${tag} v1 → v2 preserves Eoraptor progress, defaults new fields — OK`);
}

function testMissionSequences() {
  const tag = "[m4-selftest][missions]";
  for (const id of DINO_ORDER) {
    const config = LEVELS[id];
    assert(config.dinoId === id, `${tag}: ${id} level dinoId matches`);
    assert(config.nodes.length === 6, `${tag}: ${id} has 6 nodes (got ${config.nodes.length})`);
    assert(config.secrets.length === 2, `${tag}: ${id} has 2 secrets`);

    // Simulate the whole sequence: walk to each active node, win every encounter.
    const seq = new ScentSequence(config.nodes);
    let guard = 0;
    while (!seq.isComplete && guard < 200) {
      guard++;
      const active = seq.getActive();
      if (!active) break;
      const ev = seq.tick(active.position, 2.0);
      if (ev && ev.kind === "encounterStarted") seq.resolveEncounter("win");
    }
    assert(seq.isComplete, `${tag}: ${id} sequence completes`);
    assert(seq.collectedCount === config.nodes.length, `${tag}: ${id} all ${config.nodes.length} nodes collected`);
    console.log(`${tag} ${id} (${config.id}): 6/6 nodes, completes — OK`);
  }
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error(`[m4-selftest] FAIL: ${msg}`);
    throw new Error(`[m4-selftest] FAIL: ${msg}`);
  }
}
