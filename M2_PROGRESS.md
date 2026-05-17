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

## Chunk 4 — Chase mechanic ✅

- `src/entities/PreyAnimal.ts` — procedural two-tone box with a small
  head and a sin-driven hop while running. (The brief explicitly says
  procedural placeholder; roster sourcing is deferred to post-M2.)
- `src/systems/ChaseSystem.ts` — manages active chase state via a
  callbacks bag (scene, chevron override, camera shake, FOV pulse,
  glitch sting, input lock). On start: spawns prey 6 units ahead in the
  player's facing direction, runs at `5.0 * 0.9 = 4.5 u/s`, widens FOV
  25° → 28°, starts a 6s timer, retargets the chevron. On catch
  (overlap ≤ 1.1u): camera shake (mag 0.18, 100ms), chromatic-aberration
  catch-sting, input lock, CAUGHT! flash. On timer expiry: ESCAPED
  fade; tracking continues without refill (per spec).
- `Camera` gained `shake(magnitude, duration)` (decaying random offset
  layered onto the smoothed follow) and `setFOV` / `resetFOV` (GSAP
  tween of `camera.fov` + `updateProjectionMatrix()`).
- `Game` now orchestrates activity flow:
  - Proximity check (≤3u from active node) moved out of `L1` into
    `Game.handleScentProgress`.
  - `collect` tag → `completeActivity(true)` (refill + advance).
  - `chase` tag → `chase.start()`; on resolve, `completeActivity(win)`
    — only `win` triggers a tracking refill (lose: bar continues to
    drain into the next node, per spec).
  - Input locked during the catch-sting flash (~900ms) so the player
    can't run off mid-still-frame.
- `Level` interface gained `collectActive()` and
  `setChevronTargetOverride(x)` so the level keeps owning its visual
  state while the orchestrator drives sequencing.
- `gameState` adds `chaseActive` / `chasePercent` / `chaseResult` /
  `chaseResultFlashUntil`. HUD adds:
  - Chase timer bar at top-center, gold→rose gradient.
  - `CAUGHT!` / `ESCAPED` full-screen flash card with chromatic-glitch
    text shadow, auto-clears via `chaseResultFlashUntil`.
- `GameFX.catchSting()` is a faster, stronger glitch spike (peak 0.012)
  separate from the title sting.

### Self-test

- `npx tsc -b` — clean.
- `npx vite build` — clean.
- **MANUAL:** walk into the chase node at x=28. Verify FOV widens, prey
  spawns ahead and runs forward at ~90% player speed, timer bar fills
  and drains, CAUGHT! flash + shake on overlap, ESCAPED if you stop
  chasing.

## Chunk 5 — Score summary screen ✅

- `src/ui/ScoreSummary.tsx` — DESIGN.md §8 layout, full overlay:
  - Rank shield (custom SVG with linear-gradient fill).
  - Dino name + era/region subtitle.
  - 160px circular arc gauge showing completion% (purple→magenta
    gradient stroke; `success / total` activities).
  - 4 stat bars (SPEED/TOUGH/POWER/SENSES) tinted distinctly,
    `value/STAT_MAX` (CLAUDE.md scale 1..12).
  - Activity checklist with ✓/× icons and per-activity points
    (collect = 100, chase win = 250, fail = 0).
  - PREDATOR POINTS total + MISSIONS / RESTART buttons.
- `gameState` extended with `dinoStats`, `rank`, `activityResults`,
  `predatorPointsEarned`, `recordActivity(...)`. `setDino` now takes
  stats and rank too.
- `Game.completeActivity` records each activity result with the points
  helper before advancing.
- The simple `MissionFailCard` / `MissionCompleteCard` placeholders are
  replaced by `ScoreSummary`. Buttons reload the page for now —
  Missions/title scene is post-M2.

### Self-test

- `npx tsc -b` — clean.
- `npx vite build` — clean.
- **MANUAL:** finish the level (or stand still until the bar empties)
  and verify the summary appears with stats, completion %, and the
  activity list. Buttons reload.

### Known limitation

The Missions button reloads the same level — no mission select screen
exists yet (M4+). Acceptable: the user's brief explicitly says only one
level for M2. Restart works correctly via reload.

## Chunk 6 — localStorage save system

Pending.
