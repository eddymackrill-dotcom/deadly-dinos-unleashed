# M3 — Loop Variety: Progress Report

Tag: `v0.3-m3`
Date: 2026-05-26
Tests: `npm run test` PASS (scent sequence + four M3 mechanic suites)
Build: `npm run build` clean (901 KB JS / 253 KB gzipped)

---

## Goal of M3

Bring the remaining four core BBC mechanics online so Level 1 demonstrates the full loop: scent → chase → stealth → defense → secrets → animal power.

---

## What ships

### 1. Stealth (`src/systems/StealthSystem.ts`, `src/entities/Bush.ts`)

- Bar drains in the open at `1 / (6s × (1 + 0.12 × sensesStat))`.
  At Eoraptor's `senses = 5`, that's ~9.6 s to empty.
- Hiding in a bush refills at 2× drain rate (~4.8 s to full) and slows
  player movement to 50% via a stealth speed channel.
- Bush entity is procedural (4 icosahedron blobs + ~6 plane fronds).
- Player tints cyan while detection is active; drops to 25% opacity in a
  bush. Tint capture is lazy and reversible — base colours are cached on
  first call, restored on `setTint(null)`.
- Win on reach (catch radius 1.8); lose on empty bar (prey spooks and bolts).
- HUD: yellow STEALTH bar with EXPOSED/HIDDEN label, top-centre.

### 2. Defense QTE (`src/systems/DefenseSystem.ts`, `src/entities/Rival.ts`)

- 4-round arrow QTE. Base reaction window 700 ms + 50 ms per toughnessStat
  point.
- Rival is a procedural dark-red box-and-head mesh, deliberately distinct
  from the prey. Recoil tween on hit, lunge tween on miss.
- Miss feedback: red player tint (0.25 s) + camera shake (no health
  system — visual only).
- Outcome: all-correct → win; ≥1 miss → partial (points proportional to
  hit ratio); all-miss → lose.
- HUD: centre-screen DEFEND overlay with arrow glyph, round dots, and
  reaction timer bar.

### 3. Hidden Secrets (`src/systems/HiddenSecretsSystem.ts`, `src/entities/HiddenSecret.ts`)

- Procedural glowing pile: dodecahedron chunks in dusty-bone palette plus
  a warm point light; gentle bob and slow rotation.
- 3D proximity pickup (radius 1.6 u) so jump-through-apex hits the
  ledge-top secret naturally.
- Random reward in the configured `[min, max]` predator-points range, paid
  immediately into a running `secretBonusPoints` total and shown as a
  centred "+N PREDATOR POINTS" popup that floats up and fades over 1.8 s.
- Persistence: `MissionSave.foundSecretIds: string[]`. Already-found IDs
  skip respawn on replay. `commitMissionResult` merges new IDs into the
  set at mission end.
- HUD: top-right "x/N HIDDEN" pill.

### 4. Quick Dash power (`src/systems/PowerSystem.ts`)

- X key activation. Adds a +60% speed multiplier on the dash channel for
  3 s, then locks into cooldown for 8 s × `(1 − 0.05 × powerStat)`,
  minimum 4 s. Eoraptor (power = 2) → 7.2 s cooldown.
- Cooldown only starts after the effect ends, per spec.
- Speed is now composed: `player.setSpeedMultiplier(stealthMult × dashMult)`
  in Game's main loop so stealth bush slow and dash boost can coexist.
- FX: chromatic-aberration burst (0.012 intensity spike for ~200 ms) plus
  a red radial screen tint via `PowerBurstTint`.
- HUD: SVG radial top-right under the secrets pill. Green ring + pulse
  when ready, red while active, amber draining during cooldown.

### Level extension (`src/levels/L1_Eoraptor.ts`)

- Scent sequence (6 nodes total):
  `collect@12 → chase@28 → collect@46 → stealth@62 → defense@80 → collect@95`
- 2 hidden secrets:
  - `l1_secret_ground_37`  — easy, on the main path between chase@28 and
    collect@46.
  - `l1_secret_ledge_85`   — on a raised rock ledge near defense@80,
    reached at the apex of a jump.
- New `makeLedge()` adds a low-poly rock platform (1.0 u tall, 3.2 u wide)
  plus a couple of decorative rocks on top.

### State-machine extension (`src/levels/ScentSequence.ts`)

- `EncounterOutcome` now `"win" | "lose" | "partial"`.
- `resolveEncounter(outcome, pointsOverride?)` — partial outcomes carry
  an explicit points value; results store per-node points rather than
  re-deriving from config so partial scores are preserved on snapshot.
- New `getActivePoints()` helper exposes the active node's configured
  points without leaking the configs array.
- Same single-source-of-truth pattern as chase: stealth, defense, and
  partial all flow through one `markCollected` path.

### Self-test (`scripts/run-selftest.mjs`, `src/levels/M3SelfTest.ts`)

- Existing `runScentSequenceSelfTest` gains a phase 8 that walks through
  a stealth + defense sequence with a partial outcome.
- New `runM3SelfTests` covers each new mechanic's pure logic:
  stealth bar drain/refill timings, defense outcome thresholds, hidden
  secret claim/dedup/persist behaviour, power lifecycle.
- Output verifies the cooldown is exactly 7.2 s for Eoraptor.

---

## Deferred / deviations

- **Ledge has no platform collision.** The ledge-top secret is collected
  via 3D proximity mid-jump rather than by landing on it. Full one-way
  platform physics in `Dinosaur.update()` (AABB lists, only-from-above
  contacts, walk-off detection) is straightforward but not on the
  critical path for M3's visual feel and would have grown this milestone
  further. Tracking issue for M4-or-M5.
- **No partial-result label for stealth.** Stealth is binary
  win/lose by design (bar > 0 vs. drained). The `ChaseResultFlash`
  component renders "HELD GROUND" only for defense partials; stealth
  results still use CAUGHT! / ESCAPED.
- **Defense rival is procedural placeholder.** Final-art rival meshes
  per biome were always M6 polish; the red box-and-head reads as
  "another predator" without confusion.
- **Animal Power FX is minimal.** Glitch burst + radial red tint are
  in; no per-dino activation SFX, no slow-mo, no particle trail. Each
  is a paragraph of work for M6 audio/particle passes.
- **No score-summary entries for the new node types yet.** The
  ScoreSummary component still mostly speaks chase-language; partial
  outcomes propagate through the sequence and store but aren't yet
  styled differently in the summary list. Cosmetic — M5/M6.

---

## Sequencing for M4

The M3 systems are intentionally per-channel and stateless about which
dinosaur is in play. M4 ("roster") will plug different `PowerSystem`
behaviours per dino, swap the Eoraptor model + biome assets, and
parameterise the level configs. None of that requires touching the
state machine or HUD — they read from gameState and `dinoStats`
already.
