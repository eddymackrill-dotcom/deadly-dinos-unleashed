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

## Chunk 2 — Scent node sequence + chevron

Pending.

## Chunk 3 — Tracking bar HUD

Pending.

## Chunk 4 — Chase mechanic

Pending.

## Chunk 5 — Score summary screen

Pending.

## Chunk 6 — localStorage save system

Pending.
