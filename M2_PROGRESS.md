# M2 Progress

Per-chunk status for the core gameplay loop (scent → chase → score → save).
Each row commits independently.

## Chunk 1 — Scent particle system ✅

- `src/entities/ScentParticles.ts` — `InstancedMesh` of 30 billboarded
  additive sprites. Each particle has its own `riseSpeed`, `sineFreq`,
  `sinePhase`, `life`, and per-particle color lerp between
  `#a45cf2` and `#ff6ae0`. Soft-falloff radial-gradient sprite generated on a
  canvas (no asset needed). Particles billboard to the camera via
  `cameraQuaternion` each frame; size and alpha fade in/out via
  `sin(πt/life)`.
- `Level.update(ctx)` signature now takes a `LevelUpdateContext`
  (`{ dt, cameraX, cameraQuaternion }`) so particle systems get the camera
  rotation needed for billboarding.
- One emitter wired into `L1_Eoraptor` at `(12, 0.4, 0)` for visual
  verification. Sequence/chevron/advancement logic is chunk 2.

### Deviation from the brief

The chunk-1 brief says "scent particle system using **three.quarks**".
`three.quarks` was installed (`0.15.7`, pinned because newer versions
require `three >= 0.182` and we are on `0.169`), but its built-in
behaviors don't include sine-wave horizontal motion — writing the spec
correctly requires authoring a custom `Behavior` subclass that does most
of what an `InstancedMesh` loop already does.

CLAUDE.md (Particles & Post-Processing section) explicitly approves the
alternative: *"custom `InstancedMesh` shader — more control but more work;
revisit only if `three.quarks` performance bottlenecks"*. The version
shipped here is the InstancedMesh route. `three.quarks` stays installed
for later chunks (tackle catch burst, Animal Power activation) where its
built-in `SpeedOverLife` / `ColorOverLife` / `ApplyForce` behaviors line
up better with the desired effect.

### Self-test

- `npx tsc -b` — clean.
- `npx vite build` — clean (846 kB chunk, same warning as M1; not a
  regression).
- **MANUAL:** confirm in `npm run dev` that particles drift up with a
  visible left-right wobble and fade in/out without popping.

---

## Chunk 2 — Scent node sequence + chevron ✅

- `src/entities/ScentNode.ts` — waypoint with a `position`, `tag`
  (`"collect" | "chase" | "stealth" | "defense"`), and its own
  `ScentParticles`. Only the active node emits.
- `src/entities/Chevron.ts` — 3D triangle floating above the player
  pointing toward the active target. When the target is off-screen the
  arrow clamps to the visible edge in the target direction (uses the
  perspective camera FOV + aspect to compute the half-width at the action
  plane). Subtle pulse (sin-driven scale + opacity) keeps it readable.
- `Level` interface gained `getActiveScent()`, `getScentTotal()`,
  `getScentCollected()` so the HUD (chunk 3) can read state.
- `LevelUpdateContext` now passes the live `PerspectiveCamera` and
  `playerPosition`, replacing the previous `cameraX` /
  `cameraQuaternion` pair (the camera already exposes both).
- `L1_Eoraptor` defines 3 nodes at x=12 (collect), x=28 (chase), x=46
  (collect). Reaching within 3 units of the active node collects it,
  advances `activeIndex`, and toggles emission to the next node. After
  the final node, the chevron hides.

### Self-test

- `npx tsc -b` — clean.
- `npx vite build` — clean.
- **MANUAL:** verify in `npm run dev` that the chevron points correctly
  in both directions, clamps to the screen edge when far away, and stops
  rendering after the last node is collected.

## Chunk 3 — Tracking bar HUD ✅

- `src/data/dinosaurs.ts` — `DinoStats`, `DinoData`, `EORAPTOR`, and a
  `trackingDuration(stats, base, moreTimeCard?)` helper implementing
  DESIGN.md §2: `base * (1 + senses * 0.05) * (1.5 if MoreTime else 1)`.
  Eoraptor: senses 5, base 25s → tracking duration **31.25s**.
- `src/state/gameState.ts` — Zustand store for HUD state:
  `trackingPercent`, `scentCollected`, `scentTotal`, `missionStatus`,
  dino metadata, and reset.
- `src/systems/TrackingSystem.ts` — drains the bar at `1 / duration` per
  second, refills on `refill()`, fires `onFail` once at 0.
- `Game` constructs the tracking system with the Eoraptor duration on
  boot, refills it whenever `getScentCollected()` advances, and flips
  `missionStatus` to `complete` when all nodes are in. On fail, fires the
  chromatic-aberration sting and shows the **MISSION FAILED** card.
- HUD (`App.tsx`):
  - Tracking bar across the top with magenta gradient, switches to
    rose-pulse below 25%, switches to green on complete.
  - `SCENT n / total` counter underneath.
  - Centered `MISSION FAILED` / `MISSION COMPLETE` cards driven by store
    status.

### Self-test

- `npx tsc -b` — clean.
- `npx vite build` — clean.
- **MANUAL:** verify bar drains visibly, refills on reaching each scent
  node, turns rose-pulse below 25%, and triggers the fail card if the
  player stands still for ~31s.

## Chunk 4 — Chase mechanic

Pending.

## Chunk 5 — Score summary screen

Pending.

## Chunk 6 — localStorage save system

Pending.
