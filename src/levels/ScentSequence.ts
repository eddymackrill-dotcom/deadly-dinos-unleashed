import * as THREE from "three";

export type ScentNodeType = "collect" | "chase" | "stealth" | "defense";

export type EncounterOutcome = "win" | "lose";

export interface ScentNodeConfig {
  position: THREE.Vector3;
  type: ScentNodeType;
  points: number;
}

export interface ActiveNode {
  index: number;
  position: THREE.Vector3;
  type: ScentNodeType;
}

export interface NodeResult {
  index: number;
  type: ScentNodeType;
  outcome: EncounterOutcome;
  points: number;
}

export interface CollectedEvent {
  kind: "collected";
  nodeIndex: number;
  nodeType: ScentNodeType;
  outcome: EncounterOutcome;
  points: number;
}

export interface EncounterStartedEvent {
  kind: "encounterStarted";
  nodeIndex: number;
  nodeType: ScentNodeType;
  position: THREE.Vector3;
}

export type SequenceEvent = CollectedEvent | EncounterStartedEvent;

/**
 * Pure state machine for a level's scent-node sequence. No graphics, no audio,
 * no input — those are wired up by the level and the Game on top of the
 * events this emits. ScentSequence is the single source of truth for:
 *
 *   - Per-node configuration (position, type, points)
 *   - Per-node state (collected flag, recorded outcome)
 *   - Whether an encounter is currently running
 *   - Which node is "active" (the first uncollected one)
 *   - When the sequence is complete (every node collected)
 *
 * Everything visible to the player or the HUD must be derived from this — no
 * parallel arrays of "activity results" that could drift.
 */
export class ScentSequence {
  private readonly configs: ScentNodeConfig[];
  private readonly collectedFlags: boolean[];
  private readonly outcomes: (EncounterOutcome | null)[];
  private encounterRunning = false;

  constructor(configs: ScentNodeConfig[]) {
    this.configs = configs.map((c) => ({
      position: c.position.clone(),
      type: c.type,
      points: c.points,
    }));
    this.collectedFlags = configs.map(() => false);
    this.outcomes = configs.map(() => null);
  }

  get total(): number {
    return this.configs.length;
  }

  get collectedCount(): number {
    let n = 0;
    for (const f of this.collectedFlags) if (f) n++;
    return n;
  }

  get isComplete(): boolean {
    return this.collectedCount === this.total;
  }

  get isEncounterRunning(): boolean {
    return this.encounterRunning;
  }

  /** First uncollected node index, or null if every node is collected. */
  getActiveIndex(): number | null {
    for (let i = 0; i < this.collectedFlags.length; i++) {
      if (!this.collectedFlags[i]) return i;
    }
    return null;
  }

  getActive(): ActiveNode | null {
    const idx = this.getActiveIndex();
    if (idx === null) return null;
    return {
      index: idx,
      position: this.configs[idx].position,
      type: this.configs[idx].type,
    };
  }

  /**
   * Per-frame tick. Returns an event if proximity to the active node triggers
   * something this frame, otherwise null. A `collected` event means the node
   * was finalized immediately (collect-type). An `encounterStarted` event
   * means the active node demands an external encounter (chase/stealth/
   * defense) — the caller must drive that encounter and call
   * `resolveEncounter(outcome)` when it ends.
   */
  tick(playerPosition: THREE.Vector3, reachRadius: number): SequenceEvent | null {
    if (this.encounterRunning) return null;
    const active = this.getActive();
    if (!active) return null;

    const dx = active.position.x - playerPosition.x;
    if (Math.abs(dx) > reachRadius) return null;

    if (active.type === "collect") {
      this.markCollected(active.index, "win");
      return {
        kind: "collected",
        nodeIndex: active.index,
        nodeType: "collect",
        outcome: "win",
        points: this.configs[active.index].points,
      };
    }

    this.encounterRunning = true;
    return {
      kind: "encounterStarted",
      nodeIndex: active.index,
      nodeType: active.type,
      position: active.position.clone(),
    };
  }

  /**
   * Caller signals an encounter has ended (chase caught the prey, defense QTE
   * completed, etc). Marks the active node collected with the given outcome
   * and clears the encounter flag. Returns the `collected` event so the
   * caller can record it (refill tracking, etc.).
   */
  resolveEncounter(outcome: EncounterOutcome): SequenceEvent | null {
    if (!this.encounterRunning) return null;
    const idx = this.getActiveIndex();
    if (idx === null) return null;
    this.markCollected(idx, outcome);
    this.encounterRunning = false;
    const cfg = this.configs[idx];
    return {
      kind: "collected",
      nodeIndex: idx,
      nodeType: cfg.type,
      outcome,
      points: outcome === "win" ? cfg.points : 0,
    };
  }

  /**
   * Snapshot of every collected node's result. Used by the score summary.
   * Skips nodes that haven't been collected yet — that's intentional: a level
   * that ends in fail should show only what was actually completed.
   */
  getResults(): NodeResult[] {
    const out: NodeResult[] = [];
    for (let i = 0; i < this.configs.length; i++) {
      if (this.collectedFlags[i] && this.outcomes[i]) {
        const outcome = this.outcomes[i]!;
        out.push({
          index: i,
          type: this.configs[i].type,
          outcome,
          points: outcome === "win" ? this.configs[i].points : 0,
        });
      }
    }
    return out;
  }

  totalPointsEarned(): number {
    let sum = 0;
    for (const r of this.getResults()) sum += r.points;
    return sum;
  }

  /** Iterate node configs (for the level to build visuals against). */
  forEachNode(fn: (cfg: ScentNodeConfig, index: number) => void) {
    this.configs.forEach((c, i) => fn(c, i));
  }

  private markCollected(idx: number, outcome: EncounterOutcome) {
    if (this.collectedFlags[idx]) return;
    this.collectedFlags[idx] = true;
    this.outcomes[idx] = outcome;
  }
}

/**
 * In-code self-test. Simulates a player walking through a level matching L1's
 * node layout and asserts every state transition matches the spec. Called
 * once on boot in dev mode from main.ts. Throws on failure — the dev server
 * will surface the trace in the console.
 */
export function runScentSequenceSelfTest() {
  const trace: string[] = [];
  const log = (msg: string) => {
    trace.push(msg);
    console.log("[selftest] " + msg);
  };
  function fail(msg: string): never {
    const full = `[selftest] FAIL: ${msg}\n  trace:\n    ${trace.join("\n    ")}`;
    console.error(full);
    throw new Error(full);
  }
  function assert(cond: unknown, msg: string): asserts cond {
    if (!cond) fail(msg);
  }

  const seq = new ScentSequence([
    { position: new THREE.Vector3(12, 0.4, 0), type: "collect", points: 100 },
    { position: new THREE.Vector3(28, 0.4, 0), type: "chase", points: 250 },
    { position: new THREE.Vector3(46, 0.4, 0), type: "collect", points: 100 },
  ]);
  const REACH = 1.5;
  log("created sequence with 3 nodes (collect@12, chase@28, collect@46)");

  // Initial state — snapshot getters into locals so TS narrowing doesn't
  // assume they're frozen across method calls that mutate internal state.
  let count = seq.collectedCount;
  let activeIdx = seq.getActiveIndex();
  assert(seq.total === 3, "total should be 3");
  assert(count === 0, "initial collectedCount=0");
  assert(activeIdx === 0, "initial activeIndex=0");
  assert(!seq.isComplete, "initial !isComplete");
  assert(!seq.isEncounterRunning, "initial !encounter");
  log(`initial: collected=0/3 active=#0 (collect@12)`);

  // Walk player position from 0 to 50 in 0.25u steps. Record any tick events.
  // Collect at x=12 with radius 1.5 -> trigger when player.x >= 10.5
  // Chase at x=28 with radius 1.5 -> trigger when player.x >= 26.5
  // After chase resolution (simulated win), node 2 (collect@46) becomes
  // active. The simulated player at this point is at ~30; we then move them
  // forward to 50 to make sure the proximity check doesn't trip for node 2
  // while still far away, then verify that walking through node 2 fires.

  let px = 0;
  const step = 0.25;
  let collectsSeen = 0;
  let encountersSeen = 0;
  let chaseTriggerX: number | null = null;

  // Phase 1: walk from 0 to 30 — should hit node 0 then trigger chase encounter on node 1.
  while (px < 30) {
    px += step;
    const e = seq.tick(new THREE.Vector3(px, 0, 0), REACH);
    if (e) {
      log(
        `@x=${px.toFixed(2)}: ${e.kind} node=${e.nodeIndex} type=${e.nodeType}${
          e.kind === "collected" ? ` outcome=${e.outcome} +${e.points}` : ""
        }`,
      );
      if (e.kind === "collected") collectsSeen++;
      else {
        encountersSeen++;
        chaseTriggerX = px;
      }
    }
  }
  count = seq.collectedCount;
  activeIdx = seq.getActiveIndex();
  assert(collectsSeen === 1, `phase1: expected 1 collect, got ${collectsSeen}`);
  assert(encountersSeen === 1, `phase1: expected 1 encounter start, got ${encountersSeen}`);
  assert(count === 1, `after node 0: collectedCount=1 (got ${count})`);
  assert(activeIdx === 1, `after node 0: activeIndex=1 (got ${activeIdx})`);
  assert(seq.isEncounterRunning, "encounter should be running");
  assert(
    chaseTriggerX !== null && Math.abs(chaseTriggerX - 26.75) < 0.5,
    `chase should trigger near x=26.5 (got ${chaseTriggerX})`,
  );

  // Phase 2: while encounter is running, further ticks must do nothing.
  for (let x = 30; x < 50; x += step) {
    const e = seq.tick(new THREE.Vector3(x, 0, 0), REACH);
    if (e) fail(`phase2: tick during encounter should not fire, got ${JSON.stringify(e)}`);
  }
  count = seq.collectedCount;
  assert(count === 1, `phase2: encounter running, collectedCount unchanged (got ${count})`);

  // Phase 3: simulate chase win.
  const resolveEv = seq.resolveEncounter("win");
  assert(resolveEv !== null, "resolveEncounter should return an event");
  assert(resolveEv!.kind === "collected", "resolve event kind=collected");
  if (resolveEv!.kind !== "collected") fail("unreachable");
  assert(resolveEv.nodeIndex === 1, "resolve event nodeIndex=1");
  assert(resolveEv.outcome === "win", "resolve event outcome=win");
  assert(resolveEv.points === 250, "resolve event points=250");
  log(`resolved chase: outcome=win +${resolveEv.points}`);
  count = seq.collectedCount;
  activeIdx = seq.getActiveIndex();
  assert(count === 2, `after chase: collectedCount=2 (got ${count})`);
  assert(activeIdx === 2, `after chase: activeIndex=2 (got ${activeIdx})`);
  assert(!seq.isEncounterRunning, "encounter cleared");
  assert(!seq.isComplete, "not yet complete (only 2/3)");

  // Phase 4: simulate player walking back left to x=46.
  let pxBack = 50;
  let phase4Collects = 0;
  while (pxBack > 40) {
    pxBack -= step;
    const e = seq.tick(new THREE.Vector3(pxBack, 0, 0), REACH);
    if (e) {
      log(`@x=${pxBack.toFixed(2)}: ${e.kind} node=${e.nodeIndex} +${e.kind === "collected" ? e.points : 0}`);
      if (e.kind === "collected") phase4Collects++;
    }
  }
  count = seq.collectedCount;
  activeIdx = seq.getActiveIndex();
  assert(phase4Collects === 1, `phase4: expected 1 collect for node 2, got ${phase4Collects}`);
  assert(count === 3, `after node 2: collectedCount=3 (got ${count})`);
  assert(activeIdx === null, `all collected: activeIndex=null (got ${activeIdx})`);
  assert(seq.isComplete, "isComplete=true");

  // Phase 5: post-complete ticks must be no-ops.
  const e5 = seq.tick(new THREE.Vector3(46, 0, 0), REACH);
  assert(e5 === null, "post-complete tick should be null");

  // Phase 6: getResults() must match what happened.
  const results = seq.getResults();
  assert(results.length === 3, `results length=3 (got ${results.length})`);
  assert(results[0].index === 0 && results[0].type === "collect" && results[0].outcome === "win" && results[0].points === 100, "result[0]");
  assert(results[1].index === 1 && results[1].type === "chase" && results[1].outcome === "win" && results[1].points === 250, "result[1]");
  assert(results[2].index === 2 && results[2].type === "collect" && results[2].outcome === "win" && results[2].points === 100, "result[2]");
  assert(seq.totalPointsEarned() === 450, `total points should be 450 (got ${seq.totalPointsEarned()})`);

  // Phase 7: lose path. Create a fresh sequence, walk into chase, resolve as lose.
  const lossSeq = new ScentSequence([
    { position: new THREE.Vector3(12, 0.4, 0), type: "collect", points: 100 },
    { position: new THREE.Vector3(28, 0.4, 0), type: "chase", points: 250 },
  ]);
  for (let x = 0; x < 30; x += step) {
    lossSeq.tick(new THREE.Vector3(x, 0, 0), REACH);
  }
  assert(lossSeq.isEncounterRunning, "loss-seq encounter running");
  const loseEv = lossSeq.resolveEncounter("lose");
  assert(loseEv !== null && loseEv.kind === "collected", "lose event kind=collected");
  if (!loseEv || loseEv.kind !== "collected") fail("unreachable");
  assert(loseEv.outcome === "lose" && loseEv.points === 0, "lose event has 0 points");
  assert(lossSeq.isComplete, "loss-seq complete (lose still advances)");
  const lossResults = lossSeq.getResults();
  assert(lossResults[1].outcome === "lose" && lossResults[1].points === 0, "lose result recorded");
  log("lose path verified: outcome=lose, points=0, still advances");

  console.log(
    `[selftest] PASS — scent sequence matches spec. Sequence: 0/3 -> reach node 0 -> 1/3 -> reach node 1 -> chase starts -> chase wins -> 2/3 -> reach node 2 -> 3/3 -> complete.`,
  );
}
