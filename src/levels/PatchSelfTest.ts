import * as THREE from "three";
import { FishingSystem, FISHING_TUNING, inSnapHitbox } from "../systems/FishingSystem";
import { CatchFX, CATCH_TIMING, CATCH_TOTAL_MS, type CatchTarget } from "../systems/CatchFX";
import { ScentSequence } from "./ScentSequence";
import { LEVELS } from "../data/levels";
import { DINOS, DINO_ORDER } from "../data/dinosaurs";
import { SCORE, nodePoints, missionBonusPoints } from "../data/scoring";
import { useGameState } from "../state/gameState";
import type { Dinosaur } from "../entities/Dinosaur";

/**
 * v0.4.1 patch self-tests: the Spinosaurus fishing encounter end-to-end, the
 * catch choreography's timing contract, and the flat point economy.
 *
 * Same pattern as the M3/M4 suites — drive the real systems with stub callbacks
 * and a bare three.js Group as the scene (no WebGL needed), log a trace, throw
 * on failure.
 */
export function runPatchSelfTests() {
  testFishingEncounter();
  testFishingMissAndRespawn();
  testFishingTimeout();
  testSnapHitbox();
  testCatchTiming();
  testCatchSequence();
  testPointEconomy();
  console.log(
    "[patch-selftest] PASS — fishing encounter, jaw-snap hitbox, catch timings, flat economy.",
  );
}

const DT = 1 / 60;
const FRAME_MS = (1 / 60) * 1000;

/** Beats land on a frame boundary, so allow one frame of quantisation. */
function nearMs(actual: number, expected: number): boolean {
  return actual >= expected - 0.001 && actual < expected + FRAME_MS + 0.001;
}
const WADE_SPEED = 5.0 * 1.3;

interface FishingHarness {
  sys: FishingSystem;
  scene: THREE.Group;
  state: {
    locked: boolean;
    resolved: "win" | "lose" | null;
    catchPlayed: number;
    textFlashes: number;
    despawned: number;
  };
  /** Step the encounter with the player parked at `playerX`. */
  step(playerX: number, seconds: number): void;
}

function makeFishing(waterRange: [number, number] = [30, 70]): FishingHarness {
  const scene = new THREE.Group();
  const state = { locked: false, resolved: null as "win" | "lose" | null, catchPlayed: 0, textFlashes: 0, despawned: 0 };

  const sys = new FishingSystem({
    scene,
    setChevronOverride: () => {},
    onCameraShake: () => {},
    setPlayerInputLocked: (l) => {
      state.locked = l;
    },
    playCatch: (target, _facing, onTextFlash) => {
      state.catchPlayed += 1;
      // Stand in for CatchFX: fire the text beat, then despawn the target.
      onTextFlash();
      state.textFlashes += 1;
      if (target) {
        target.freezeForCatch?.();
        target.onDespawn?.();
        state.despawned += 1;
      }
    },
    waterRangeFor: () => waterRange,
    playerWadeSpeed: WADE_SPEED,
  });
  sys.onResolved = (r) => {
    state.resolved = r;
  };

  const pos = new THREE.Vector3();
  return {
    sys,
    scene,
    state,
    step(playerX: number, seconds: number) {
      const steps = Math.max(1, Math.round(seconds / DT));
      for (let i = 0; i < steps; i++) {
        pos.set(playerX, 0, 0);
        sys.update(DT, pos);
      }
    },
  };
}

/** Walk up behind the nearest swimming fish and snap it. Returns false if none. */
function snapNearestFish(h: FishingHarness): boolean {
  const dbg = h.sys.getDebugState();
  const idx = dbg.fishStates.findIndex((s) => s === "swimming");
  if (idx < 0) return false;
  // Stand one unit behind the fish, facing right, so it sits inside the 2-unit
  // jaw reach for the whole 300ms window even as it swims.
  const playerX = dbg.fishPositions[idx] - 1;
  h.sys.triggerSnap(1);
  h.step(playerX, FISHING_TUNING.SNAP_WINDOW_MS / 1000 + DT * 2);
  return true;
}

function testFishingEncounter() {
  const tag = "[patch-selftest][fishing]";
  useGameState.getState().reset();

  const h = makeFishing();
  h.sys.start(38, 1);

  let store = useGameState.getState();
  assert(h.sys.isActive, `${tag}: encounter active after start`);
  assert(store.fishingActive, `${tag}: HUD shows the fishing encounter`);
  assert(
    store.fishNeeded === FISHING_TUNING.FISH_NEEDED,
    `${tag}: HUD needs ${FISHING_TUNING.FISH_NEEDED} fish (got ${store.fishNeeded})`,
  );
  assert(
    h.scene.children.length === FISHING_TUNING.FISH_COUNT,
    `${tag}: ${FISHING_TUNING.FISH_COUNT} fish spawned (got ${h.scene.children.length})`,
  );
  const spawnedInWater = h.sys
    .getDebugState()
    .fishPositions.every((x) => x >= 30 && x <= 70);
  assert(spawnedInWater, `${tag}: every fish spawns inside the river`);
  console.log(`${tag} start: 4 fish in the river, HUD armed for 2 — OK`);

  // Snap #1 — a fish inside the jaw hitbox is caught when the jaws close.
  assert(snapNearestFish(h), `${tag}: a swimming fish should be available`);
  let dbg = h.sys.getDebugState();
  assert(dbg.caught === 1, `${tag}: first snap catches one fish (got ${dbg.caught})`);
  store = useGameState.getState();
  assert(store.fishCaught === 1, `${tag}: HUD count follows (got ${store.fishCaught})`);
  console.log(`${tag} snap 1: hitbox catch registered, HUD 1/2 — OK`);

  // Snap #2 — hitting the target count resolves the encounter as a win.
  assert(snapNearestFish(h), `${tag}: a second swimming fish should be available`);
  dbg = h.sys.getDebugState();
  assert(dbg.caught === 2, `${tag}: second snap catches another (got ${dbg.caught})`);
  assert(dbg.phase === "resolving", `${tag}: 2 fish → encounter resolving (got ${dbg.phase})`);
  assert(h.state.catchPlayed === 1, `${tag}: the winning fish runs the catch choreography`);
  assert(h.state.textFlashes === 1, `${tag}: the SNAPPED! flash fires once`);
  store = useGameState.getState();
  assert(store.chaseResult === "win", `${tag}: result flash is a win (got ${store.chaseResult})`);
  assert(
    store.chaseResultSource === "fish",
    `${tag}: flash source is 'fish' so the verb is SNAPPED! (got ${store.chaseResultSource})`,
  );

  // Let the resolve window run out — the node advances and the shoal despawns.
  h.step(45, CATCH_TOTAL_MS / 1000 + 0.2);
  assert(h.state.resolved === "win", `${tag}: onResolved('win') fired (got ${h.state.resolved})`);
  assert(!h.sys.isActive, `${tag}: encounter back to idle`);
  assert(h.scene.children.length === 0, `${tag}: all fish removed from the scene`);
  console.log(`${tag} snap 2: win → choreography → node resolved, scene cleaned — OK`);

  useGameState.getState().reset();
}

function testFishingMissAndRespawn() {
  const tag = "[patch-selftest][fishing-miss]";
  useGameState.getState().reset();

  const h = makeFishing();
  h.sys.start(38, 1);

  // Wade past the shoal and snap into empty water: the jaws open to the right,
  // every fish is behind the snout, close enough to be spooked by the splash.
  const before = h.sys.getDebugState();
  const playerX = Math.max(...before.fishPositions) + 2.5;
  h.sys.triggerSnap(1);
  h.step(playerX, FISHING_TUNING.SNAP_WINDOW_MS / 1000 + DT * 2);

  let dbg = h.sys.getDebugState();
  assert(dbg.caught === 0, `${tag}: a snap into empty water catches nothing`);
  const fleeing = dbg.fishStates.filter((s) => s === "fleeing").length;
  assert(fleeing > 0, `${tag}: nearby fish are spooked by the miss (got ${fleeing})`);
  console.log(`${tag} miss: no catch, ${fleeing} fish darted away — OK`);

  // After the respawn delay they're back in the water, swimming.
  h.step(playerX, FISHING_TUNING.RESPAWN_SECONDS + 0.2);
  dbg = h.sys.getDebugState();
  const swimming = dbg.fishStates.filter((s) => s === "swimming").length;
  assert(
    swimming === FISHING_TUNING.FISH_COUNT,
    `${tag}: all fish back after ${FISHING_TUNING.RESPAWN_SECONDS}s (got ${swimming})`,
  );
  const inWater = dbg.fishPositions.every((x) => x >= 30 && x <= 70);
  assert(inWater, `${tag}: respawns land inside the river`);
  console.log(`${tag} respawn: shoal restored inside the river after 2s — OK`);

  useGameState.getState().reset();
}

function testFishingTimeout() {
  const tag = "[patch-selftest][fishing-timeout]";
  useGameState.getState().reset();

  const h = makeFishing();
  h.sys.start(38, 1);
  // Never snap: the encounter timer should run out and lose the node.
  h.step(31, FISHING_TUNING.DURATION_SECONDS + 1);
  assert(h.sys.getDebugState().caught === 0, `${tag}: no fish caught without snapping`);
  h.step(31, 1.0);
  assert(h.state.resolved === "lose", `${tag}: timer expiry loses the node (got ${h.state.resolved})`);
  assert(h.state.catchPlayed === 0, `${tag}: no catch choreography on a loss`);
  console.log(`${tag} timeout: 20s without a catch → lose — OK`);

  useGameState.getState().reset();
}

function testSnapHitbox() {
  const tag = "[patch-selftest][hitbox]";
  const player = new THREE.Vector3(40, 0, 0);
  const reach = FISHING_TUNING.SNAP_REACH;

  assert(
    inSnapHitbox(player, new THREE.Vector3(41.5, 0.16, 0), 1, reach),
    `${tag}: a fish 1.5u ahead is inside the jaws`,
  );
  assert(
    !inSnapHitbox(player, new THREE.Vector3(42.5, 0.16, 0), 1, reach),
    `${tag}: a fish 2.5u ahead is out of reach`,
  );
  assert(
    !inSnapHitbox(player, new THREE.Vector3(38.5, 0.16, 0), 1, reach),
    `${tag}: a fish behind the snout is not caught`,
  );
  assert(
    inSnapHitbox(player, new THREE.Vector3(38.5, 0.16, 0), -1, reach),
    `${tag}: facing left, that same fish is inside the jaws`,
  );
  console.log(`${tag} jaw reach: ${reach}u ahead only, direction-aware — OK`);
}

function testCatchTiming() {
  const tag = "[patch-selftest][catch-timing]";
  assert(CATCH_TIMING.freezeMs === 800, `${tag}: 800ms control freeze (got ${CATCH_TIMING.freezeMs})`);
  assert(CATCH_TIMING.textDelayMs === 200, `${tag}: word appears at 200ms (got ${CATCH_TIMING.textDelayMs})`);
  assert(CATCH_TIMING.lungeMs === 150, `${tag}: 150ms lunge`);
  assert(CATCH_TIMING.lungeDistanceUnits === 0.5, `${tag}: 0.5u lunge`);
  assert(CATCH_TIMING.lungeTiltDegrees === 15, `${tag}: 15° tilt fallback`);
  assert(CATCH_TIMING.preyTumbleMs === 250, `${tag}: 250ms prey tumble`);
  assert(CATCH_TIMING.preyDropUnits === 0.3, `${tag}: prey drops 0.3u`);
  assert(CATCH_TIMING.preySquashY === 0.7 && CATCH_TIMING.preySquashX === 1.15, `${tag}: squash 0.7/1.15`);
  assert(CATCH_TIMING.fadeMs === 400, `${tag}: 400ms fade`);
  assert(CATCH_TIMING.shakeMs === 150 && CATCH_TIMING.shakeMagnitude === 0.2, `${tag}: shake 0.2 for 150ms`);
  assert(CATCH_TIMING.fovDropDegrees === 2 && CATCH_TIMING.fovPunchMs === 200, `${tag}: FOV −2° for 200ms`);
  assert(CATCH_TIMING.glitchPeak === 0.015 && CATCH_TIMING.glitchMs === 250, `${tag}: aberration 0.015 for 250ms`);
  assert(CATCH_TOTAL_MS === 1200, `${tag}: contact→despawn is 1200ms (got ${CATCH_TOTAL_MS})`);
  console.log(`${tag} constants match the spec — OK`);
}

function testCatchSequence() {
  const tag = "[patch-selftest][catch-sequence]";
  const log = {
    locked: false,
    lunges: 0,
    shakes: [] as Array<[number, number]>,
    fovPunches: [] as Array<[number, number]>,
    glitches: [] as Array<[number, number]>,
    textAt: -1,
    unlockAt: -1,
    despawnAt: -1,
    completed: false,
  };
  let elapsed = 0;

  const stubPlayer = {
    playCatchLunge: () => {
      log.lunges += 1;
    },
  } as unknown as Dinosaur;

  const fx = new CatchFX({
    player: stubPlayer,
    setPlayerInputLocked: (l) => {
      log.locked = l;
      if (!l && log.unlockAt < 0 && elapsed > 0) log.unlockAt = elapsed;
    },
    onCameraShake: (m, d) => log.shakes.push([m, d]),
    onFOVPunch: (drop, ms) => log.fovPunches.push([drop, ms]),
    onGlitchSpike: (peak, ms) => log.glitches.push([peak, ms]),
  });

  const root = new THREE.Group();
  let opacity = 1;
  const target: CatchTarget = {
    root,
    setOpacity: (o) => {
      opacity = o;
    },
    onDespawn: () => {
      log.despawnAt = elapsed;
    },
  };

  fx.play({
    target,
    facing: 1,
    onTextFlash: () => {
      log.textAt = elapsed;
    },
    onComplete: () => {
      log.completed = true;
    },
  });

  assert(log.locked, `${tag}: control locked on contact`);
  assert(log.lunges === 1, `${tag}: player lunges once`);
  assert(
    log.shakes.length === 1 && log.shakes[0][0] === CATCH_TIMING.shakeMagnitude,
    `${tag}: one shake at magnitude ${CATCH_TIMING.shakeMagnitude}`,
  );
  assert(
    log.fovPunches.length === 1 && log.fovPunches[0][0] === CATCH_TIMING.fovDropDegrees,
    `${tag}: one FOV punch of ${CATCH_TIMING.fovDropDegrees}°`,
  );
  assert(
    log.glitches.length === 1 && log.glitches[0][0] === CATCH_TIMING.glitchPeak,
    `${tag}: aberration spike to ${CATCH_TIMING.glitchPeak}`,
  );
  assert(log.textAt < 0, `${tag}: the word does NOT appear on contact`);

  // Step to just before the text beat. The clock advances first so a timestamp
  // captured inside a callback matches the FX's own elapsed time.
  while (elapsed < CATCH_TIMING.textDelayMs - FRAME_MS) {
    elapsed += DT * 1000;
    fx.update(DT);
  }
  assert(log.textAt < 0, `${tag}: still no word at ${Math.round(elapsed)}ms`);

  // Past the text beat but well inside the freeze.
  while (elapsed < CATCH_TIMING.freezeMs - FRAME_MS * 2) {
    elapsed += DT * 1000;
    fx.update(DT);
  }
  assert(
    nearMs(log.textAt, CATCH_TIMING.textDelayMs),
    `${tag}: word fires on the 200ms beat (got ${log.textAt.toFixed(0)})`,
  );
  assert(log.locked, `${tag}: still frozen at ${Math.round(elapsed)}ms`);

  // Past the freeze: control returns, the fade starts.
  while (elapsed < CATCH_TIMING.freezeMs + 100) {
    elapsed += DT * 1000;
    fx.update(DT);
  }
  assert(!log.locked, `${tag}: control released at ${CATCH_TIMING.freezeMs}ms`);
  assert(
    nearMs(log.unlockAt, CATCH_TIMING.freezeMs),
    `${tag}: unlock lands on the 800ms mark (got ${log.unlockAt.toFixed(0)})`,
  );
  assert(opacity < 1 && opacity > 0, `${tag}: prey mid-fade (got ${opacity.toFixed(2)})`);

  // Past the fade: despawn and completion.
  while (elapsed < CATCH_TOTAL_MS + 60) {
    elapsed += DT * 1000;
    fx.update(DT);
  }
  assert(
    nearMs(log.despawnAt, CATCH_TOTAL_MS),
    `${tag}: despawn at ~1200ms (got ${log.despawnAt.toFixed(0)})`,
  );
  assert(opacity === 0, `${tag}: prey fully faded`);
  assert(log.completed, `${tag}: onComplete fired`);
  assert(!fx.isPlaying, `${tag}: choreography back to idle`);
  console.log(
    `${tag} 0ms freeze+lunge+shake+FOV+glitch · ${log.textAt.toFixed(0)}ms word · ` +
      `${log.unlockAt.toFixed(0)}ms unlock · ${log.despawnAt.toFixed(0)}ms despawn — OK`,
  );
}

function testPointEconomy() {
  const tag = "[patch-selftest][economy]";

  // Fixed values per activity type.
  assert(nodePoints("collect") === 100, `${tag}: collect = 100 (got ${nodePoints("collect")})`);
  assert(nodePoints("chase") === 200, `${tag}: chase = 200 (got ${nodePoints("chase")})`);
  assert(nodePoints("stealth") === 200, `${tag}: stealth = 200 (got ${nodePoints("stealth")})`);
  assert(nodePoints("defense") === 200, `${tag}: defense = 200 (got ${nodePoints("defense")})`);
  assert(
    nodePoints("fish") === SCORE.fishPerFish * SCORE.fishNeeded && nodePoints("fish") === 200,
    `${tag}: fish = 100 × 2 = 200 (got ${nodePoints("fish")})`,
  );
  assert(SCORE.defensePartial === 100, `${tag}: defense partial = 100`);
  assert(SCORE.hiddenSecret === 500, `${tag}: hidden secret = 500 flat`);
  assert(SCORE.missionCompleteBonus === 500, `${tag}: mission bonus = 500`);

  // Everything is a round hundred — no fractions, no odd numbers.
  for (const v of Object.values(SCORE)) {
    assert(v % 100 === 0 || v === SCORE.fishNeeded, `${tag}: ${v} is not a round hundred`);
  }
  console.log(`${tag} fixed values: 100 / 200 / 200 / 200 / 200 · secret 500 · bonus 500 — OK`);

  // Each mission's nodes carry exactly their type's value, and a clean run
  // totals the sum of those values.
  for (const id of DINO_ORDER) {
    const config = LEVELS[id];
    const expected = config.nodes.reduce((s, n) => s + nodePoints(n.type), 0);
    const seq = new ScentSequence(config.nodes);
    let guard = 0;
    while (!seq.isComplete && guard++ < 200) {
      const active = seq.getActive();
      if (!active) break;
      const ev = seq.tick(active.position, 2.0);
      if (ev && ev.kind === "encounterStarted") seq.resolveEncounter("win");
    }
    assert(
      seq.totalPointsEarned() === expected,
      `${tag}: ${id} clean run = ${expected} (got ${seq.totalPointsEarned()})`,
    );
    assert(
      missionBonusPoints(seq.getResults(), seq.total) === SCORE.missionCompleteBonus,
      `${tag}: ${id} 100% run earns the 500 bonus`,
    );
    console.log(`${tag} ${DINOS[id].displayName}: clean run ${expected} + ${SCORE.missionCompleteBonus} bonus — OK`);
  }

  // A defense partial awards exactly 100, and forfeits the mission bonus.
  const partialSeq = new ScentSequence(LEVELS.trex.nodes);
  let guard = 0;
  let partials = 0;
  while (!partialSeq.isComplete && guard++ < 200) {
    const active = partialSeq.getActive();
    if (!active) break;
    const ev = partialSeq.tick(active.position, 2.0);
    if (ev && ev.kind === "encounterStarted") {
      if (ev.nodeType === "defense" && partials === 0) {
        partials++;
        partialSeq.resolveEncounter("partial", SCORE.defensePartial);
      } else {
        partialSeq.resolveEncounter("win");
      }
    }
  }
  const partialResult = partialSeq.getResults().find((r) => r.outcome === "partial");
  assert(!!partialResult, `${tag}: the partial defense was recorded`);
  assert(
    partialResult!.points === SCORE.defensePartial,
    `${tag}: partial defense awards exactly 100 (got ${partialResult!.points})`,
  );
  assert(
    missionBonusPoints(partialSeq.getResults(), partialSeq.total) === 0,
    `${tag}: a partial forfeits the mission bonus`,
  );

  // A missed node awards 0 and also forfeits the bonus.
  const loseSeq = new ScentSequence(LEVELS.eoraptor.nodes);
  guard = 0;
  let losses = 0;
  while (!loseSeq.isComplete && guard++ < 200) {
    const active = loseSeq.getActive();
    if (!active) break;
    const ev = loseSeq.tick(active.position, 2.0);
    if (ev && ev.kind === "encounterStarted") {
      if (losses === 0) {
        losses++;
        loseSeq.resolveEncounter("lose");
      } else {
        loseSeq.resolveEncounter("win");
      }
    }
  }
  const lost = loseSeq.getResults().find((r) => r.outcome === "lose");
  assert(!!lost && lost.points === 0, `${tag}: a missed activity scores 0`);
  assert(
    missionBonusPoints(loseSeq.getResults(), loseSeq.total) === 0,
    `${tag}: a miss forfeits the mission bonus`,
  );
  console.log(`${tag} partial = 100, miss = 0, both forfeit the 500 bonus — OK`);
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error(`[patch-selftest] FAIL: ${msg}`);
    throw new Error(`[patch-selftest] FAIL: ${msg}`);
  }
}
