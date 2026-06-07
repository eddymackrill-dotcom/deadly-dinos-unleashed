import * as THREE from "three";
import { stealthBarStep } from "../systems/StealthSystem";
import {
  defenseOutcomeFor,
  defenseScore,
  defenseOutcomeFromResults,
} from "../systems/DefenseSystem";
import { PowerSystem } from "../systems/PowerSystem";
import { DINOS } from "../data/dinosaurs";
import { HiddenSecretsSystem, type SecretConfig } from "../systems/HiddenSecretsSystem";
import { useGameState } from "../state/gameState";

/**
 * M3 logic self-tests. Each test verifies the core state machine of one M3
 * mechanic by driving its pure helpers (stealth bar math, defense outcome
 * helper) or by instantiating the system with mock callbacks (power timer,
 * secret pickup dedup). Heavy rendering paths (PreyAnimal GLB load,
 * three.js scene side-effects) are bypassed.
 *
 * Pattern matches runScentSequenceSelfTest: log a trace, throw on failure.
 */
export function runM3SelfTests() {
  runStealthBarTest();
  runDefenseOutcomeTest();
  runHiddenSecretsTest();
  runPowerCooldownTest();
  console.log("[m3-selftest] PASS — stealth bar, defense outcomes, hidden secrets, power cooldown.");
}

function runStealthBarTest() {
  const tag = "[m3-selftest][stealth]";
  // senses=5 → drain rate = 1 / (6 * 1.6) = 0.10417/s → 9.6s to empty in open.
  const senses = 5;

  // Open ground: bar should monotonically decrease.
  let bar = 1;
  for (let i = 0; i < 96; i++) bar = stealthBarStep(bar, 0.1, false, senses);
  assert(bar < 0.06, `${tag}: open drain over 9.6s should empty bar (got ${bar.toFixed(3)})`);
  console.log(`${tag} drain to ${bar.toFixed(3)} over 9.6s in the open — OK`);

  // Bush refill: 2× drain rate. From 0 to full should take ~4.8s.
  bar = 0;
  for (let i = 0; i < 48; i++) bar = stealthBarStep(bar, 0.1, true, senses);
  assert(bar >= 0.95, `${tag}: bush refill over 4.8s should approach full (got ${bar.toFixed(3)})`);
  console.log(`${tag} refill to ${bar.toFixed(3)} over 4.8s in bush — OK`);

  // Mixed: enter bush at 0.4, hide 2s → expect bar to rise; exit and drain 1s.
  bar = 0.4;
  for (let i = 0; i < 20; i++) bar = stealthBarStep(bar, 0.1, true, senses);
  assert(bar > 0.4, `${tag}: 2s in bush should raise bar from 0.4 (got ${bar.toFixed(3)})`);
  const peak = bar;
  for (let i = 0; i < 10; i++) bar = stealthBarStep(bar, 0.1, false, senses);
  assert(bar < peak, `${tag}: 1s in open after bush should drop from ${peak.toFixed(3)}, got ${bar.toFixed(3)}`);
  console.log(`${tag} bush→open transition: ${peak.toFixed(3)} → ${bar.toFixed(3)} — OK`);

  // Reach prey while bar > 0 → win (we just verify the bar is non-zero after
  // the simulated approach; the actual catch check lives in StealthSystem).
  assert(bar > 0, `${tag}: bar should still have charge when reaching prey (got ${bar.toFixed(3)})`);
}

function runDefenseOutcomeTest() {
  const tag = "[m3-selftest][defense]";
  const total = 4;

  assert(defenseOutcomeFor(4, total) === "win", `${tag}: 4/4 → win`);
  assert(defenseOutcomeFor(3, total) === "partial", `${tag}: 3/4 → partial`);
  assert(defenseOutcomeFor(1, total) === "partial", `${tag}: 1/4 → partial`);
  assert(defenseOutcomeFor(0, total) === "lose", `${tag}: 0/4 → lose`);

  // Edge: total=0 always loses (defensive).
  assert(defenseOutcomeFor(0, 0) === "lose", `${tag}: 0/0 → lose`);

  console.log(`${tag} 4/4=win, 3/4=partial, 0/4=lose — OK`);

  // Layer-3 late-hit scoring: late hits are worth half a point.
  const ROUNDS = 3;
  assert(defenseScore(["hit", "hit", "hit"]) === 3, `${tag}: 3 hits → score 3`);
  assert(defenseScore(["hit", "late", "miss"]) === 1.5, `${tag}: hit+late+miss → 1.5`);
  assert(defenseScore(["late", "late", "late"]) === 1.5, `${tag}: 3 lates → 1.5`);

  assert(
    defenseOutcomeFromResults(["hit", "hit", "hit"], ROUNDS) === "win",
    `${tag}: all full hits → win`,
  );
  assert(
    defenseOutcomeFromResults(["hit", "late", "hit"], ROUNDS) === "partial",
    `${tag}: a late among hits → partial (not a clean win)`,
  );
  assert(
    defenseOutcomeFromResults(["late", "late", "late"], ROUNDS) === "partial",
    `${tag}: all lates → partial`,
  );
  assert(
    defenseOutcomeFromResults(["miss", "miss", "miss"], ROUNDS) === "lose",
    `${tag}: all misses → lose`,
  );
  assert(
    defenseOutcomeFromResults(["miss", "late", "miss"], ROUNDS) === "partial",
    `${tag}: a single late rescues from lose → partial`,
  );
  console.log(`${tag} late-hit scoring: late=½pt, any credit=partial, all-full=win — OK`);
}

function runHiddenSecretsTest() {
  const tag = "[m3-selftest][secrets]";
  useGameState.getState().reset();

  // Fake scene tree — three.js Group is fully usable in node.
  const scene = new THREE.Group();
  const configs: SecretConfig[] = [
    { id: "a", position: new THREE.Vector3(10, 0.5, 0), pointsRange: [200, 200] },
    { id: "b", position: new THREE.Vector3(20, 0.5, 0), pointsRange: [300, 300] },
  ];

  const sys = new HiddenSecretsSystem({ scene }, configs, []);
  // Re-read getters into locals each time so the asserts() type-narrowing
  // doesn't pin them to a literal across mutating calls.
  let claimed = sys.claimedCount;
  let bonus = useGameState.getState().secretBonusPoints;
  assert(sys.total === 2, `${tag}: total=2`);
  assert(claimed === 0, `${tag}: initial claimedCount=0`);
  assert(bonus === 0, `${tag}: initial bonusPoints=0`);

  // Walk player to (10, 0.5, 0) — should claim secret "a".
  sys.update(0.016, new THREE.Vector3(10, 0.5, 0));
  claimed = sys.claimedCount;
  bonus = useGameState.getState().secretBonusPoints;
  assert(claimed === 1, `${tag}: after walkover, claimedCount=1 (got ${claimed})`);
  assert(bonus === 200, `${tag}: bonus should be 200 (got ${bonus})`);
  const bonusAfterFirst = bonus;

  // Walk over "a" again — must NOT re-fire reward.
  for (let i = 0; i < 5; i++) sys.update(0.016, new THREE.Vector3(10, 0.5, 0));
  claimed = sys.claimedCount;
  bonus = useGameState.getState().secretBonusPoints;
  assert(claimed === 1, `${tag}: re-entry must not double-claim (got ${claimed})`);
  assert(bonus === bonusAfterFirst, `${tag}: bonus must not increase on re-entry`);
  console.log(`${tag} walkover claims once; re-entry no-op — OK`);

  // Walk to "b" — claims; both done.
  sys.update(0.016, new THREE.Vector3(20, 0.5, 0));
  claimed = sys.claimedCount;
  bonus = useGameState.getState().secretBonusPoints;
  assert(claimed === 2, `${tag}: after second walkover, claimedCount=2 (got ${claimed})`);
  assert(bonus === 500, `${tag}: total bonus should be 500 (got ${bonus})`);

  // Already-found secrets must not respawn on a fresh system.
  const scene2 = new THREE.Group();
  const sys2 = new HiddenSecretsSystem({ scene: scene2 }, configs, ["a", "b"]);
  const claimed2 = sys2.claimedCount;
  assert(claimed2 === 2, `${tag}: already-found ids should preset claimedCount (got ${claimed2})`);
  assert(scene2.children.length === 0, `${tag}: already-found secrets do not enter scene`);
  console.log(`${tag} persisted ids skip respawn — OK`);

  sys.dispose();
  sys2.dispose();
  useGameState.getState().reset();
}

function runPowerCooldownTest() {
  const tag = "[m3-selftest][power]";
  useGameState.getState().reset();

  // Use an object so TS doesn't narrow the counter to a literal across asserts.
  const counters = { dashMult: 1, activations: 0 };
  const power = new PowerSystem(DINOS.eoraptor.animalPower, {
    setSpeedMult: (m) => {
      counters.dashMult = m;
    },
    onActivate: () => {
      counters.activations += 1;
    },
  });

  // Initially ready.
  assert(power.getDebugState().phase === "ready", `${tag}: initial phase=ready`);

  // --- Hold then release: cooldown = 1.5 × time held ---
  assert(power.tryActivate(), `${tag}: first tryActivate should succeed`);
  assert((counters.activations as number) === 1, `${tag}: onActivate fired once`);
  assert(counters.dashMult > 1, `${tag}: dash mult > 1 while held (got ${counters.dashMult})`);
  // Re-press while active is rejected.
  assert(!power.tryActivate(), `${tag}: tryActivate while active should fail`);

  // Hold for 1.0s (still under the 3s cap) — stays active.
  for (let i = 0; i < 10; i++) power.update(0.1);
  let dbg = power.getDebugState();
  assert(dbg.phase === "active", `${tag}: still active after 1s held (got ${dbg.phase})`);
  assert(counters.dashMult > 1, `${tag}: dash mult still boosted while held`);

  // Release — cooldown should be ≈ 1.5 × 1.0s = 1.5s.
  power.release();
  dbg = power.getDebugState();
  assert(dbg.phase === "cooldown", `${tag}: phase=cooldown after release (got ${dbg.phase})`);
  assert(counters.dashMult === 1, `${tag}: dash mult back to 1 after release`);
  assert(
    Math.abs(dbg.cooldownDuration - 1.5) < 0.05,
    `${tag}: cooldown should be ≈1.5s for a 1.0s hold (got ${dbg.cooldownDuration.toFixed(2)})`,
  );
  assert(!power.tryActivate(), `${tag}: tryActivate during cooldown should fail`);

  // Run out the cooldown → ready.
  for (let i = 0; i < 16; i++) power.update(0.1);
  assert(power.getDebugState().phase === "ready", `${tag}: ready after cooldown elapses`);
  console.log(`${tag} hold 1s → release → cooldown 1.5s → ready — OK`);

  // --- Max-hold cap: holding ≥3s force-releases into the full 8s penalty ---
  assert(power.tryActivate(), `${tag}: re-activate after cooldown should succeed`);
  for (let i = 0; i < 31; i++) power.update(0.1); // 3.1s held
  dbg = power.getDebugState();
  assert(dbg.phase === "cooldown", `${tag}: 3s cap force-releases to cooldown (got ${dbg.phase})`);
  assert(counters.dashMult === 1, `${tag}: dash mult off after cap`);
  assert(
    Math.abs(dbg.cooldownDuration - 8) < 0.0001,
    `${tag}: max-hold penalty cooldown should be 8s (got ${dbg.cooldownDuration})`,
  );
  console.log(`${tag} hold to 3s cap → forced off → full 8s cooldown — OK`);

  // --- Tap: press + immediate release (no update) ⇒ ~0 cooldown, ready at once ---
  for (let i = 0; i < 81; i++) power.update(0.1); // clear the 8s cooldown
  assert(power.getDebugState().phase === "ready", `${tag}: ready after 8s cooldown`);
  assert(power.tryActivate(), `${tag}: tap activate should succeed`);
  power.release(); // released same frame, heldTime ≈ 0
  assert(
    power.getDebugState().phase === "ready",
    `${tag}: a same-frame tap leaves no cooldown (got ${power.getDebugState().phase})`,
  );
  console.log(`${tag} instant tap → negligible cooldown → ready — OK`);

  useGameState.getState().reset();
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error(`[m3-selftest] FAIL: ${msg}`);
    throw new Error(`[m3-selftest] FAIL: ${msg}`);
  }
}
