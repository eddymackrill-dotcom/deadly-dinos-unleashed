# M1 Feel Report

Self-test against the M1 Feel Criteria in CLAUDE.md. Status legend:

- **PASS (code)** — implemented and verifiable from constants/code; behaviour follows the spec by construction
- **MANUAL** — implemented; correctness depends on playtesting / visual judgement
- **DEFERRED** — not implemented in M1 (out of scope for the four commit chunks)

The "current value" column quotes the live constant from the source so the report stays grounded; if a value drifts, this file should be updated.

---

## Movement feel

| Criterion | Status | Where | Notes |
|---|---|---|---|
| Top speed in 0.18–0.22s, curved (not linear, not instant) | **PASS (code)** | `Dinosaur.ts` `ACCEL_RATE = 15` | Exponential approach: `1 − e^(−15·0.2) ≈ 0.95`, so 95% of top speed in 0.2s. Curve is naturally concave (fast early, slow tail). |
| Decel faster than accel, ~0.12s to zero | **PASS (code)** | `Dinosaur.ts` `DECEL_RATE = 25` | `1 − e^(−25·0.12) ≈ 0.95` → 95% decay in 0.12s. Applied when target speed is lower than current or direction is reversing. |
| Direction reversal 0.1s skid before opposite accel | **PASS (code)** | `Dinosaur.setMoveInput` + `skidTimer`; `REVERSE_SKID_DURATION = 0.1` | On opposing-direction input while moving, `targetVx` forced to 0 for 0.1s; opposite-direction accel only kicks in after skid ends. **MANUAL:** verify skid feels deliberate, not laggy. |
| Idle → run blend over 100ms | **PASS (code)** | `Dinosaur.ts` `ANIM_BLEND_RATE = 30` | 95% blend in ~0.1s. `runWeight` lerps to `speed/MAX_SPEED` and drives `idleAction`/`runAction` weights each frame. |

---

## Jump feel

| Criterion | Status | Where | Notes |
|---|---|---|---|
| ~50ms hangtime near zero vertical velocity at apex | **MANUAL** | `Dinosaur.update` gravity branch; `HANGTIME_GRAVITY_MULT = 0.35`, `HANGTIME_VY_THRESHOLD = 1.5` | Not a hard timer — emerges from gravity reduction (×0.35) while `|vy| < 1.5`. Tuned to produce ≈50ms of slow apex on a jumpVelocity=8, gravity=−22 arc, but feel needs playtest confirmation. Easy to swap to a hard 50ms timer if it doesn't read. |
| Takeoff squash: Y 0.85, X 1.15, 80ms ease-out | **PASS (code)** | `Dinosaur.playTakeoffSquash` | GSAP timeline: `{x:1.15, y:0.85, z:1.15, duration:0.08, ease:"power2.out"}` then back to 1 over 0.18s. |
| Apex stretch: Y 1.1, X 0.95 | **PASS (code)** | `Dinosaur.playApexStretch` | Triggered when `vy` crosses 0 while rising. Duration 80ms (spec doesn't pin this); recovers over 100ms. |
| Land impact: Y 0.8, X 1.2, recover 150ms | **PASS (code)** | `Dinosaur.playLandSquash` | 50ms squash to (1.2, 0.8, 1.2), 150ms recovery via `back.out(1.5)` ease. |
| Coyote time 80ms | **PASS (code)** | `Dinosaur.canJumpNow`; `COYOTE_TIME = 0.08` | `timeSinceGrounded` tracks airborne time; jump allowed if ≤ 80ms even after leaving ground. |
| Jump buffer 100ms | **PASS (code)** | `Game.loop` + `Input.jumpPressedAt`; `JUMP_BUFFER_MS = 100` | Last jump press timestamp persists for 100ms; each frame, if buffer is fresh and player can jump, jump triggers and press is consumed. |

---

## Camera feel

| Criterion | Status | Where | Notes |
|---|---|---|---|
| Camera lags player by ~0.15s (lerp 0.08 at 60fps) | **PASS (code)** | `Camera.update` + `lerpFactor` | Uses framerate-independent factor `1 − (1 − 0.08)^(dt·60)`, so 0.08 holds at 60fps and remains time-correct at other rates. |
| Lookahead 2 units in movement direction, lerp 0.04 | **PASS (code)** | `Camera.update`, `lookaheadUnits = 2`, `lookaheadSmoothing = 0.04` | Lookahead scales with `|velocityX| / 3` clamped to 1, so it ramps up at full speed and disappears at standstill. Smoothed independently of player tracking. |
| Y-axis smoothing slower than X (factor 0.05) | **PASS (code)** | `Camera.update`, `ySmoothing = 0.05` | Y lerp factor 0.05 < X factor 0.08. Jumps will not yank the camera. |
| Deadzone ±0.5 unit | **PASS (code)** | `Camera.update` deadzone branch | Camera only moves if `|desiredX − cameraX| > 0.5`; moves the overshoot beyond the deadzone edge. |

---

## Parallax

| Criterion | Status | Where | Notes |
|---|---|---|---|
| Minimum 3 background layers at 0.2x, 0.5x, 0.8x player speed | **PASS (code)** | `L1_Eoraptor.ts` parallax configs | Mountains 0.2x, hills 0.5x, rock clusters 0.8x. `parallaxFactor` is screen-velocity-relative-to-camera (matches CLAUDE.md wording). |
| Foreground occlusion layer at 1.2x player speed | **PASS (code)** | `L1_Eoraptor.ts` ferns layer, `parallaxFactor: 1.2` | Negative follow factor (`1 − 1.2 = −0.2`) puts the foreground at z=+4 so it occludes the player at z=0. |
| All layers wrap seamlessly | **MANUAL** | `ParallaxBackground.ts` tile-recycling | Each layer has 3–5 procedurally identical tile clones, recycled around the camera. Tiles share the same procedural shape (same RNG seed), so adjacent tile edges geometrically match. **MANUAL:** verify visually that no seams flicker, particularly on the rock and fern layers where shapes have detail. |

---

## Audio sync

| Criterion | Status | Where | Notes |
|---|---|---|---|
| Footsteps on foot-plant animation frame, not fixed timer | **DEFERRED** | — | No audio system in M1. Asset files (`triassic_loop.ogg`, `footstep_dirt_01–03.ogg`, etc., listed in CLAUDE.md Asset Pipeline) need sourcing before this can be wired. |
| 2–3 footstep sample variants in random rotation | **DEFERRED** | — | Same. Howler is installed but not initialised. |
| Footstep volume scales with movement speed | **DEFERRED** | — | Same. |

---

## Visual identity

| Criterion | Status | Where | Notes |
|---|---|---|---|
| Chromatic aberration wired into the render pipeline from M1; default intensity 0.0 | **PASS (code)** | `PostProcess.ts`, `shaders/glitch.ts` | Full `EffectComposer` chain: `RenderPass` → `ShaderPass(GlitchShader)` → `OutputPass`. `uIntensity` default 0.0. Game now renders via `composer.render()` instead of `renderer.render()`. |
| Title-card glitch: intensity 0.003 with a 200ms spike to 0.008 | **PASS (code)** | `Game.ts` `GameFX.titleSting()` | GSAP timeline: 0 → 0.008 (100ms ease-out) → 0.003 (100ms ease-in) → hold 2.4s → 0 (400ms). Total spike ≈ 200ms as specified; trailing fade-out is graceful rather than abrupt. |
| Dust particle puffs on each footstep | **DEFERRED** | — | Particle system (three.quarks per CLAUDE.md) not introduced in M1. Dust puffs come with the audio integration (they share a "foot plant event"). |
| Title card "Mission 1: Eoraptor — Argentina, 230 million years ago" fades in over 600ms with glitch sting | **PASS (code)** | `ui/App.tsx` `TitleCard` | GSAP `fromTo` opacity+scale over 0.6s, holds 2.0s, fades out 0.6s. Glitch sting fires from `main.ts` at mount via the `onTitleStart` callback. Bangers font loaded via `@fontsource/bangers` (no render-blocking external request). |

---

## Items outside the M1 four-commit cadence

Captured here so they don't get forgotten — none of these are required for M1 per the user's brief, but they are listed in the broader MVP/Feel Criteria:

| Item | Source | Plan |
|---|---|---|
| Scent particles drifting from a marker | MVP §6 | M2 (part of the scent → chase loop). |
| HUD tracking bar (visual only) | MVP §7 | M2 alongside the scent system. |
| Ambient Triassic audio loop + footstep SFX | MVP §9 / Feel Criteria | Needs CC0 asset sourcing first; then a small Howler `SoundManager` and a foot-plant event on the run animation. |
| Footstep dust puffs | Feel Criteria | Shares trigger with footstep SFX; do both together. |
| `three.quarks` integration | CLAUDE.md Particles section | Pulled in when the first particle effect lands (scent or dust). |

---

## Known placeholder / known caveats

1. **Asset placeholders.** The "Eoraptor" is the Quaternius Velociraptor mesh; environment (cliffs, hills, rocks, ferns) is procedural ShapeGeometry/Dodecahedron/Plane primitives, not Kenney Nature Kit GLBs. CLAUDE.md explicitly approves placeholder quality during M1; final asset replacement is M6.
2. **Parallax tiles are identical clones.** Each layer's tiles share one procedural mesh so adjacent edges match perfectly. Trade-off: a slight pattern repetition on the rock/fern layers. Per-tile variation with edge-match constraint is deferred to a later pass.
3. **Hangtime is gravity-shaped, not a hard timer.** If the 50ms target reads as too short or too long after playtest, swap `HANGTIME_GRAVITY_MULT` (or replace with a 50ms `velocity.y = 0` clamp at the apex).
4. **Single bundle is 844 KB.** Vite warns about chunk size; comes from Three.js + GSAP + React being in one chunk. Acceptable for M1; revisit splitting in M6.
5. **`tsbuildinfo` cache.** Generated by `tsc -b` during `npm run build`. Now gitignored; not an issue going forward.

---

## How to verify manually

1. `npm run dev` → open `http://localhost:5173/`.
2. **Title card** should fade in over ~0.6s with a brief chromatic colour-split flash on the scene; hold ~2s; fade out over ~0.6s.
3. **Arrow keys / A-D** to move. Hold a direction: dino should reach top speed in ~0.2s with a noticeable curve. Release: comes to a stop quickly (~0.12s). Press the opposite direction while moving: dino should skid briefly before reversing.
4. **Space** to jump. Expect: takeoff flatten, stretched midair pose at apex, flat landing impact, recover. Try pressing space just before landing — next jump should fire immediately (jump buffer). Try running off a virtual ledge (no terrain in M1, but: in the air briefly after the apex, pressing jump should *not* re-trigger because timer exceeds coyote window).
5. **Camera** should trail the dino with a small lag; lookahead nudges forward when running; standing still keeps the camera stationary within a small deadzone.
6. **Parallax** layers should scroll at distinctly different rates; foreground ferns occlude the player; mountains barely shift.
