# M4 — Roster: Progress Report

Target tag: `v0.4-m4`
Goal: a **playable 4-dino demo** — 4 dinosaurs, 4 biomes, mission select, per-dino
saves. Not a perfect one. Blockers logged here; work proceeds with fallbacks.

---

## GLB verification (pre-flight)

| Intended | File | Mesh | Animations | Verdict |
|---|---|---|---|---|
| Eoraptor | `player_eoraptor.glb` | Velociraptor | 6 (Idle, Run, Walk, Attack, Jump, Death) | ✅ used as-is |
| Deinonychus | `player_deinonychus.glb` | `Cube.002` | **0** | ❌ broken placeholder |
| T-Rex | `player_trex.glb` (copied from `rival_trex.glb`) | Trex | 6 | ✅ used as-is |
| Spinosaurus | `player_spinosaurus.glb` | 596 submeshes, 4.8 MB | **0** | ⚠️ used with caveats |

**Decisions (per the brief's fallback rule):**

- **Deinonychus → Velociraptor fallback.** `player_deinonychus.glb` is a single
  `Cube.002` mesh with no animations — a broken/placeholder export, unusable as a
  distinct animated dinosaur. Per "fall back to Velociraptor for any broken
  bipedal," its `modelPath` points at `/models/player_eoraptor.glb`. The
  Deinonychus *identity* (stats, Sickle Strike power, jungle biome) is intact;
  only the mesh is shared. Swapping in a real Deinonychus GLB later is a
  one-line `modelPath` change. **Deferred: source a real Deinonychus mesh (M5).**

- **Spinosaurus → real mesh, no animations, perf-watch.** `player_spinosaurus.glb`
  is a valid but heavy model (596 submeshes / 4.8 MB, 0 animation tracks). Kept it
  because the Spinosaurus silhouette is core to the River Ambush water-emergence
  identity. The Dinosaur loader now synthesises a held-pose idle (root Y sine bob)
  when a model has no animation clips (per CLAUDE.md's missing-idle guidance).
  **Deferred / watch items (M5):**
  - **Perf:** 596 meshes ≈ 596 draw calls + 4.8 MB download is a real risk on the
    Chromebook-tier floor. Needs mesh-merge / decimation. If it collapses in
    playtest, fall back to the T-Rex mesh (one-line `modelPath` change).
  - **Animation:** no run/walk cycle — it slides while moving. Source an animated
    Spinosaurus or rig the existing mesh in M5.

---

## Chunk log

### Chunk 1 — dinosaur data model ✅
`src/data/dinosaurs.ts` is the single source of truth (`DinoDef` per dino, hold-to-
activate `AnimalPower` config, stats from CLAUDE.md). 4 dinos shipped; other 4
commented. Legacy `EORAPTOR`/`trackingDuration` shims retained for Game.ts.

### Chunk 2 — per-dino animal powers ✅
`PowerSystem` generalised to be config-driven from `AnimalPower` with effect hooks
(`setSpeedMult`, `onActivate/Deactivate`, `canActivate`, `onActivateRejected`,
`onActiveTick`, `onRelease`). All four powers built and HUD-registered; the M3
input audit (works in chase, breaks stealth, locked in defense) applies to all via
the shared Game gate. Per-power tint + Apex-Roar shockwave ring + NEEDS WATER
tooltip added to the HUD. Sickle Strike boosts chase catch radius (instant catch);
River Ambush gated on `Level.isWater()` + teleports to the next node on release.

**Deferred / deviations (chunk 2):**
- **Rival combat effects have no targets yet.** Apex Roar's rival push-back/stun
  and Sickle Strike's rival stun only matter against free-roam rivals — but rivals
  currently exist only inside the defense QTE, where powers are locked. The roar
  ships as shockwave-ring + screen-shake + tint (visual); the knock-back lands when
  free-roam rivals exist (M5+). Logged, not a blocker.
- **Sickle after-image trail** is approximated by a yellow surge tint; a true
  sickle-shaped after-image is deferred to the M6 particle pass.
- **River Ambush** is only exercisable once chunk 4 adds water tiles to the swamp
  level; until then X reports "NEEDS WATER". Shockwave ring is a screen-space
  approximation (centred), not world-anchored to the player.
- Only Eoraptor is reachable in-game until Mission Select (chunk 5); the other
  powers are verified by build + the chunk-7 self-test until then.

### Chunk 3 — biome system ✅
`src/data/biomes.ts` (4 `BiomeConfig`s: triassic, jungle, plains, swamp) +
`src/levels/biomeMeshes.ts` (shared procedural generators incl. new `trees` /
`swamp_trees`) + `src/levels/Biome.ts` (`buildBiomeWorld` → ground, water tiles,
scattered props, parallax, `isWater`). `Scene.applyBiome()` sets the sky-gradient
CanvasTexture, fog, and ambient light. L1 refactored to build its world from the
Triassic config; Game calls `applyBiome`.

**Deferred / deviations (chunk 3):**
- Water "ripple" is a cheap opacity pulse, not a shader (perf floor). Swamp water
  tile x-ranges live in the biome config and the chunk-4 Spinosaurus level is
  designed around them.
- Sky gradient is a screen-space CanvasTexture background (cheap), not a domed sky.
- Ground-prop colours are derived from each biome's parallax palette (brightened),
  keeping the brief's `ground.propMeshes: string[]` schema intact.

### Chunk 4 — 4 levels, one per dino ✅
`src/data/levels.ts` (4 `LevelConfig`s) + `src/levels/buildLevel.ts` (generic
builder, replaces the hardcoded `createLevel1`; `L1_Eoraptor.ts` deleted). Game is
now dino-driven: `new Game(canvas, dinoId)` looks up `DINOS[id]` + `LEVELS[id]`,
applies the biome, loads the dino model (`modelPath`/`modelScale`), and wires
stats/power/mission-id from data. Each mission has a distinct 6-node sequence and 2
secrets:
- M1 Eoraptor/Triassic — collect, chase, collect, stealth, defense, collect.
- M2 Deinonychus/Jungle — chase-heavy (double chase).
- M3 T-Rex/Plains — defense-heavy (double defense).
- M4 Spinosaurus/Swamp — collect nodes sit on water tiles for River Ambush.

**Deferred / deviations (chunk 4):**
- **Prey/rival species reused, not per-biome.** All chases/stealth use the
  Parasaurolophus prey and all defenses use the T-Rex rival, across every biome.
  Biome-specific species (swamp aquatic prey, jungle raptor rival, swamp
  Carcharodontosaurus rival) are deferred — they need procedural meshes or
  sourcing (M5). Every mechanic is fully playable in every biome; only the
  creature skins repeat. The T-Rex mission has a T-Rex rival (same species, two
  roles) as a consequence.
- Only Eoraptor is launched until Mission Select (chunk 5) passes a `dinoId`;
  the other three level configs are exercised by the chunk-7 simulation self-test.

### Chunk 5 — Mission Select screen ✅
New app flow: title card → Mission Select → play → (score summary) → back to select.
`main.ts` now owns the Game lifecycle (creates `new Game(canvas, dinoId)` on
select, disposes on return); `App.tsx` is a 3-screen state machine
(title/select/playing). `MissionSelect.tsx` renders 4 cards (name, era+region,
stat bars, power name+desc, completion %, points, SELECT). Lock rule: Eoraptor
open; each next unlocks at ≥50% of the previous mission. Score Summary MISSIONS
button returns to select; RESTART relaunches the same dino. A per-mission intro
card (driven by gameState) replays on each launch.

**Deferred / deviations (chunk 5):**
- **Card art** is the biome sky-gradient panel + the dino's name, not a rendered
  model preview. Live per-card mini-scenes / build-time PNGs deferred (M6) for
  the perf floor.
- Each mission swaps in a fresh `<canvas>` (a WebGL canvas only yields one
  context, so the element can't be safely reused across Game instances).

### Chunk 6 — per-dino save data (v2) ✅
Save schema bumped to **version 2**: `DinoSave` gains `rank` and
`fossilProgrammePercent`. The store was already `dinos`-keyed, so v1→v2 is
additive. `readRaw()` now **migrates** a detected v1 save in place (ports all
existing per-dino progress — e.g. Eoraptor's missions/points — defaults the new
fields, persists once) rather than discarding it on the version bump. Added an
exported pure `migrateSave()` for the chunk-7 self-test. Game reads the dino's
saved `rank` at mission start. Mission Select already reads per-dino completion
for its lock/percent display (chunk 5).

**Deferred (chunk 6):** rank-up logic and the Fossil Discovery Programme that
*write* `rank` / `fossilProgrammePercent` are M5 — the fields exist and persist
but stay at their defaults for now.
