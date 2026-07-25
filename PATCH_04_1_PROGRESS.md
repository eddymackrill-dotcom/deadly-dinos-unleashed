# Patch v0.4.1 — post-M4 playtest fixes

Session 1. Three bugs, one design rebuild, one economy simplification, shipped as
a patch on top of `v0.4-m4`.

| Chunk | Scope | Status |
|---|---|---|
| 1 | Spinosaurus rebuild — fish-catching, model orientation, Jaw Snap | ✅ |
| 2 | Catch animation overhaul (shared across all encounters) | ✅ |
| 3 | BBC-style flat point economy + TRAIL HUD label | ✅ |
| 4 | Tests, progress report, `v0.4.1-fixes` tag | ✅ |

---

## Chunk 1 — Spinosaurus rebuild

### The model, and what was actually wrong with it

`public/models/player_spinosaurus.glb` was inspected directly (GLB JSON chunk +
a headless three.js parse) before touching any code. Findings:

- **596 meshes, 596 nodes, 0 skins, 0 animation clips, 4.8 MB.** It is a static
  sculpt, not a rigged character. Every other player model in the project
  (`player_eoraptor.glb` = Velociraptor, `player_trex.glb`, and the
  `prey_parasaurolophus.glb`) is a Quaternius rig with six clips
  (`Attack / Death / Idle / Jump / Run / Walk`). This one has none — hence
  "renders as a static image" in the playtest. **Logged as a known asset gap,
  not fixable in code.**
- **The orientation bug was real and measurable.** `Dinosaur.load()` hardcoded
  `model.rotation.y = π/2`, which is correct for the Quaternius rigs (they model
  forward on −Z) but wrong for this sculpt. A PCA of 26k sampled vertices puts
  the animal's snout→tail axis at **−52.75° in XZ** (eigenvalue ratio 9.8, so
  the axis is unambiguous); binning along that axis identifies the thin,
  elevated end as the tail and the low, narrow, high-density end as the
  snout. Applying the old +90° left it facing the camera.

### What shipped

- **Orientation fixed properly, not by eyeballing a 180° flip.** `DinoDef` gained
  an optional `modelRotationY`; Spinosaurus uses `-0.9207` rad (the measured
  −52.75°), everything else keeps the π/2 default. The dino now faces +X like the
  rest of the roster.
- **Swim/wade animation synthesised programmatically**, per CLAUDE.md's
  "don't block on missing animations" guidance. With no rig and no morph targets,
  bone manipulation isn't available, so `Dinosaur.update()` drives a two-band
  Y-bob (idle 2 Hz + stride 9 Hz scaled by speed) and a yaw sway (3.4 Hz + 7 Hz
  by speed) on the model root. Reads as a body-roll wade rather than a statue.
- **River.** The swamp biome's three scattered puddles were replaced with one
  continuous band, `[30, 70]` — the middle third of the ~100-unit level, per
  spec. Rendered with a new cheap fragment shader (`src/shaders/water.ts`): two
  crossed sine ripples between a deep and a highlight teal, plus a glint band.
  No textures, no extra passes, one draw call per tile — deliberate, given the
  Chromebook-tier perf floor in CLAUDE.md.
- **Wading.** In water the player sits 40% submerged (eased, so entering the
  river doesn't pop), moves **+30%**, and drags a pooled ring-particle bow wake
  (`WakeTrail`). Submersion is a pure function of position each frame, so it
  can't get stuck on.
- **Fish** (`src/entities/Fish.ts`): procedural silver/blue elongated body with
  tail and dorsal fins, sine-wave swim (yaw wag + bob), cruising at 0.5× the
  player's wade speed. Fish sit *at* the surface by design — anything below y=0
  is occluded by the ground plane from the side-scroll camera, so a fish
  swimming "under" the water would simply be invisible.
- **Fishing encounter** (`src/systems/FishingSystem.ts`): 4 fish, catch any 2,
  20-second encounter timer. Hold X to Jaw Snap — the catch hitbox extends 2
  units ahead of the snout for 300 ms and resolves on the frame the jaws close.
  Miss (or blunder into a fish without snapping) and it darts away and respawns
  elsewhere in the river after 2 s. Same contract as `ChaseSystem`: the system
  owns visuals and timing, `onResolved` hands the outcome to the scent sequence.
- **Animal power renamed** `river_ambush` → `jaw_snap` ("Jaw Snap"). The old
  power's water-gate, transparency and teleport-on-release are gone.
- **L4 layout rebuilt** — no chase nodes: `collect@12`, `stealth@22` (reeds),
  `fish@38`, `fish@52`, `fish@66` (all inside the river), `defense@84`
  (rival on the far bank). Secrets and the ledge moved off the water.
- HUD gained a FISHING bar (timer, `CAUGHT n OF 2`, "HOLD X TO SNAP"), a
  `SNAPPED!` / `SLIPPED AWAY!` result verb, and the power icon now shows the
  active dino's power name instead of a hardcoded "DASH".

### Deviations from spec

- Spec said the fish encounter replaces "chase" scent nodes; it also asked for
  1–2 collect nodes. The level ships **3 fish, 1 collect, 1 stealth, 1 defense**
  (6 total) because the stealth and defense nodes need dry land and the river
  eats the middle third.
- Spec left the fish encounter's failure state open. Added a **20 s encounter
  timer** so a node can actually be lost, matching how chase and stealth resolve
  rather than leaving the player to bleed out the tracking bar.
- Defense on this level reuses the existing T-Rex rival (`rival_trex.glb`); no
  aquatic rival placeholder was authored.

---

## Chunk 2 — Catch animation overhaul

One choreography, `src/systems/CatchFX.ts`, now runs for every catch. Chase,
stealth and fishing all hand their prey to it and only differ in the word that
appears. Defense keeps its own flow, as specified — it has no prey to tackle.

Timeline from contact (all constants exported as `CATCH_TIMING`, asserted by the
self-test):

| t | What happens |
|---|---|
| 0 ms | player control frozen · player lunges +0.5 u forward · prey nudged, toppled, squashed (Y×0.7 / X×1.15) · camera shake 0.2 for 150 ms · FOV punch −2° · aberration spike to 0.015 for 250 ms |
| 200 ms | the word appears — `CAUGHT!` / `POUNCED!` / `SNAPPED!` |
| 800 ms | control released · prey begins a 400 ms fade |
| 1200 ms | prey despawns, the node resolves, points award |

- **Attack clips are used where the rig has them.** Eoraptor (Velociraptor mesh)
  and T-Rex both carry an `Attack` clip; those play over the locomotion blend,
  time-scaled to the lunge, and the procedural 15° nose-down tilt is skipped.
  Deinonychus inherits the Velociraptor clip. Spinosaurus has no clips at all,
  so it always gets the tilt.
- Stage transitions are driven from the game loop, not gsap callbacks, so a
  ticker hitch can't strand the player frozen. `Game.dispose()` force-finishes
  the sequence.
- Bloodless throughout, per CLAUDE.md's CBBC floor: the prey is knocked over and
  lies still, then fades. No kill, no blood, no death animation (the GLB has a
  `Death` clip — deliberately unused).

### Deviations from spec

- The prey topples about **Z, not X**. Side-on, an X-axis roll tips the animal
  away from the camera and foreshortens it into nothing; a Z topple is the one
  that reads as "bowled over". Same 90°, same 250 ms.
- The catch FX now own the input lock and the win-path camera/glitch work, so
  `onCameraShake` / `onGlitchSting` were removed from the chase and stealth
  callback interfaces rather than left dangling.

---

## Chunk 3 — Flat point economy

`src/data/scoring.ts` is now the only place a point value is written down.
Level configs build their nodes through `nodePoints(type)`, so a node can't
drift from the economy by hand-editing.

| Activity | Award |
|---|---|
| Collect scent node | 100 |
| Chase catch | 200 (miss 0) |
| Stealth pounce | 200 (spotted 0) |
| Fish catch | 100 per fish, 2 needed = 200 |
| Defense, all 3 correct | 200 |
| Defense, partial (1–2 of 3) | 100 |
| Defense, all missed | 0 |
| Hidden secret | 500 flat |
| Mission bonus (100% of activities) | 500 |

Removed on the way through:

- The `pointsRange` random bundle on hidden secrets — `SecretConfig` no longer
  has the field at all, so there's nowhere for a random award to come back from.
- Stat-scaled defense scoring. `DefenseSystem.partialPointsRatio()` is deleted;
  the hit ratio still decides win/partial/lose, it just doesn't scale the award.
  Toughness keeps its gameplay effect (a wider reaction window), senses keeps
  its (tracking duration, stealth drain) — neither touches the score.
- Hand-authored per-node point values in `levels.ts`.

The score summary now shows a breakdown — activities, hidden secrets
(`n × 500`), mission bonus, then TOTAL — and the headline number is that total,
which matches what gets committed to the save. Previously the headline showed
activity points only while the save recorded activities + secrets.

HUD: `SCENT 3 / 6` → **`TRAIL: 3 OF 6`**, spelled out so it reads as progress
along a trail rather than a score. The power icon's hardcoded "DASH" label now
shows the active dino's power name.

---

## Chunk 4 — Tests

`npm test` passes: 33 assertions groups across four suites, `tsc --noEmit` clean,
`vite build` clean. New suite `src/levels/PatchSelfTest.ts`, wired into
`scripts/run-selftest.mjs` alongside the M3/M4 suites:

- **Fishing end-to-end** — start the encounter, assert 4 fish spawn inside the
  river and the HUD arms for 2; snap a fish and assert the catch registers and
  the HUD follows; snap a second and assert the encounter resolves as a win,
  runs the catch choreography exactly once, publishes the `fish` result source
  (so the verb is `SNAPPED!`), then advances the node and clears the scene.
- **Miss and respawn** — a snap into empty water catches nothing, spooks the
  fish within range, and the shoal is back in the river 2 s later.
- **Timeout** — 20 s without a catch loses the node and plays no choreography.
- **Jaw hitbox** — `inSnapHitbox` is direction-aware: 1.5 u ahead hits, 2.5 u
  ahead misses, behind the snout misses, and flipping the facing reverses it.
- **Catch timings** — every `CATCH_TIMING` constant asserted against the spec,
  plus a live `CatchFX` driven frame by frame: locked and lunging at 0 ms, no
  word yet, word on the 200 ms beat, still frozen at 760 ms, unlocked on the
  800 ms mark mid-fade, despawned at 1200 ms.
- **Point economy** — each activity's fixed value, every value a round hundred,
  each of the four missions' clean-run totals (900 / 1000 / 1000 / 1100) and
  their 500 bonus, a defense partial awarding exactly 100, a miss awarding 0,
  and both forfeiting the bonus.

Two behaviour changes fell out of writing these:

- **The jaw hitbox is now live for the whole 300 ms window**, not just evaluated
  on the closing frame. The spec says "if a fish is in the hitbox *during* the
  snap"; the closing-frame version forced the player to lead a moving target to
  an exact frame, which is far too demanding for a 7–11 audience. A window that
  closes empty is still a miss.
- **The snap window is driven by `dt`, not `performance.now()`**, so it's
  frame-consistent and steppable in the test.
- `import gsap from "gsap"` → `import { gsap } from "gsap"` across the four
  files that use it: under Node ESM the default import resolves to a namespace
  object whose methods aren't callable, which broke the headless test. Same
  object in the browser build.

---

## Known asset gaps (not blockers)

- Spinosaurus GLB has no animation clips (above). A rigged replacement is a
  roster-sourcing decision deferred past M2 in CLAUDE.md — flagging it here so it
  lands in that pass.
- `player_deinonychus.glb` is still a broken placeholder (1 mesh named `Cube.002`,
  0 clips); Deinonychus continues to reuse the Velociraptor mesh, as in M4.
- Audio remains blocked on file sourcing, so none of the new moments (splash,
  jaw snap, tackle impact) have sound yet. The choreography has obvious hooks
  for it when the files land.

---

## Needs a human playtest

Nothing here can be verified without eyes on it:

1. **Spinosaurus faces right and reads as a Spinosaurus.** The rotation is
   derived from vertex data rather than guessed, but the sculpt is a diorama
   pose — worth confirming it doesn't look like it's lying down.
2. **The wading waterline.** The submerged 40% is hidden by the ground plane
   from the side-scroll camera; if the camera angle drifts in a later milestone
   the dino's legs could reappear "inside" the river.
3. **Jaw Snap timing feel** — 300 ms and 2 units are the spec's numbers, and the
   hitbox is generous now, but only play will say whether catching two fish is
   too easy or still fiddly.
4. **Whether the 800 ms catch freeze is too long** when it happens six times a
   mission.

---

## Deferred (explicitly not in this patch)

Full HUD polish pass (Session 2), additional dinosaurs (Session 3), M5
meta-progression (Session 4), audio (blocked on sourcing).
