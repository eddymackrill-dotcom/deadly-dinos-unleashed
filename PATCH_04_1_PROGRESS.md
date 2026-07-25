# Patch v0.4.1 — post-M4 playtest fixes

Session 1. Three bugs, one design rebuild, one economy simplification, shipped as
a patch on top of `v0.4-m4`.

| Chunk | Scope | Status |
|---|---|---|
| 1 | Spinosaurus rebuild — fish-catching, model orientation, Jaw Snap | ✅ |
| 2 | Catch animation overhaul (shared across all encounters) | ⏳ |
| 3 | BBC-style flat point economy + TRAIL HUD label | ⏳ |
| 4 | Tests, progress report, `v0.4.1-fixes` tag | ⏳ |

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

### Known asset gaps (not blockers)

- Spinosaurus GLB has no animation clips (above). A rigged replacement is a
  roster-sourcing decision deferred past M2 in CLAUDE.md — flagging it here so it
  lands in that pass.
- `player_deinonychus.glb` is still a broken placeholder (1 mesh named `Cube.002`,
  0 clips); Deinonychus continues to reuse the Velociraptor mesh, as in M4.
