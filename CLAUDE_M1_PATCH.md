# CLAUDE.md — M1 Readiness Patch

Append the following sections to `CLAUDE.md` before kicking off Milestone M1.
Each block notes where it slots in.

---

## INSERT: after the "MVP — What 'Done' Means for v0.1" section

### M1 Feel Criteria (testable)

"Art and feel first" is the M1 priority. The nine MVP bullets are deliverables;
these are the criteria the deliverables have to meet. Claude Code should
self-test against each before declaring M1 done. If a criterion can't be
verified automatically, log a manual-check note in the M1 completion report.

**Movement feel**
- Eoraptor reaches top speed in **0.18–0.22s** from standstill (accel curve, not linear ramp, not instant)
- Stopping deceleration is **faster than acceleration** (~0.12s to zero) — feels responsive, not floaty
- Direction reversal triggers a brief skid (~0.1s) before opposite-direction accel begins
- Idle → run transition blends over 100ms, not a hard cut

**Jump feel**
- Jump arc peak has **~50ms of near-zero vertical velocity** (hangtime — the difference between a good platformer and a bad one)
- Squash on takeoff: scale Y to 0.85, X to 1.15, over 80ms, ease-out
- Stretch at apex: scale Y to 1.1, X to 0.95
- Land impact: squash to Y 0.8, X 1.2, recover over 150ms
- Coyote time: **80ms** grace period after leaving a ledge where jump still triggers
- Jump buffer: **100ms** — pressing space just before landing still triggers next jump

**Camera feel**
- Camera lags player position by **~0.15s** (lerp factor 0.08 at 60fps approximates this)
- Lookahead offset of **2 units** in movement direction, applied with its own slower lerp (factor 0.04)
- Y-axis smoothing **slower than X** (factor 0.05) — jumps don't yank the camera
- No camera movement at all during ±0.5 unit player jitter (deadzone)

**Parallax**
- **Minimum 3 background layers** moving at distinctly different rates: 0.2x, 0.5x, 0.8x player speed
- Foreground occlusion layer at 1.2x player speed (slightly faster than camera) — sells depth
- All layers wrap seamlessly (no visible seams when scrolling)

**Audio sync**
- Footsteps fire on **actual foot-plant animation frame**, not a fixed timer — use an animation event or named frame range
- Footstep audio has **2–3 sample variants** played in random rotation (no machine-gun repetition)
- Footstep volume scales with movement speed (silent when walking slowly, full at sprint)

**Visual identity**
- Chromatic aberration post-process is **wired into the render pipeline from M1**, not retrofitted later. Default intensity 0.0 (off). Title-card uses it at intensity 0.003 with a brief 200ms spike to 0.008.
- Dust particle puffs on each footstep (small, brief, ground-coloured)
- Title card "Mission 1: Eoraptor — Argentina, 230 million years ago" fades in over 600ms with the glitch sting

If a criterion is met → tick. If not met → log it in `M1_FEEL_REPORT.md` with
what was tried and what's outstanding. Don't quietly skip.

---

## INSERT: replace the "Asset Sources" section with this expanded version

### Asset Pipeline

**M1 decision: use placeholder-quality assets, upgrade in M6.** The reason: the
movement, camera, particle, and post-process feel will be iterated dozens of
times during M1–M3. Doing that against a final-quality model wastes work that
gets thrown away. Final art replacement is its own milestone.

#### Eoraptor (M1)

- **Source:** Quaternius "Ultimate Dinosaurs Pack" (CC0)
  - URL: `https://quaternius.com/packs/ultimatedinosaurs.html`
  - If Eoraptor isn't in that pack, substitute the smallest available bipedal theropod (Compsognathus, Procompsognathus). Rename to Eoraptor in code.
- **File location:** `public/models/eoraptor.glb`
- **Expected animations:** `idle`, `run`. If the GLB only has one animation track, generate a held-pose idle programmatically (subtle Y-position sine wave on the root bone).
- **Scale:** Eoraptor was ~1m long. In-world target height ~0.8 units. Apply scale in the loader, don't bake it.
- **Materials:** Strip any imported PBR materials — replace with `MeshToonMaterial` or a simple flat-shaded `MeshLambertMaterial` to match the BBC low-poly look. No textures on the dino itself; rely on vertex colours where present.

#### Environment (M1)

- **Source:** Kenney "Nature Kit" (CC0) — `https://kenney.nl/assets/nature-kit`
- **Pieces needed for M1 Triassic biome:**
  - 3–4 fern/cycad meshes (foreground scatter)
  - 2–3 rock cluster meshes (midground)
  - 1 distant cliff/mountain silhouette mesh (background layer)
  - Ground plane: flat for M1, displacement comes in M2
- **File location:** `public/models/env/triassic/*.glb`
- **Palette:** dusty oranges, muted greens, ochre sky. Reference: late Triassic was hot, semi-arid. Not the lush jungle of the BBC tiger level.

#### Audio (M1)

- **Source:** Freesound.org (CC0 only — filter by license) + Pixabay Music
- **Files needed:**
  - `public/audio/ambient/triassic_loop.ogg` — ~60s loop, wind + distant insects, no music yet
  - `public/audio/sfx/footstep_dirt_01.ogg` through `_03.ogg` — small, dry impacts
  - `public/audio/sfx/jump.ogg`, `land.ogg`
  - `public/audio/sfx/glitch_sting.ogg` — short, ~200ms, used for title card
- **Format:** OGG Vorbis at 96kbps for SFX, 128kbps for ambient. Howler handles fallbacks if needed.

#### Fonts

- **Display:** Bangers (Google Fonts) — graffiti-style, matches BBC's "Deadly" identity
- **UI:** Inter (Google Fonts) — clean, readable for HUD numbers and menus
- Load via `@fontsource/bangers` and `@fontsource/inter` (npm packages) to avoid render-blocking external requests

---

## INSERT: new section before "Open Questions for the Builder"

### Particles & Post-Processing (wire up in M1)

#### Particle library: `three.quarks`

- **Install:** `npm install three.quarks`
- **Why:** actively maintained, GPU-accelerated, designed for Three.js, supports the additive blending and sine-wave drift specified in DESIGN.md §2
- **M1 use:** scent marker particles (purple/magenta, drifting up with sine-x motion), footstep dust puffs
- **Alternative considered:** custom `InstancedMesh` shader — more control but more work; revisit only if `three.quarks` performance bottlenecks

#### Post-processing pipeline

**Set up the full `EffectComposer` chain in M1, even if only one pass is active.** Retrofitting post-processing into an existing renderer tends to break shadows, transparency sorting, and tone mapping. Doing it once, early, is cheap.

**M1 chain:**
1. `RenderPass` (always on)
2. `ShaderPass` with custom chromatic aberration shader (`src/shaders/glitch.glsl`)
   - Uniform `uIntensity` (default 0.0)
   - Animatable from JS via GSAP for title-card sting
3. `OutputPass` (handles tone mapping, sRGB conversion)

**Later milestones will add:**
- M2: subtle vignette
- M3: bloom for scent markers and Animal Power activation
- M6: optional film grain (toggleable in accessibility settings)

**Reference implementation:** Three.js examples have a `webgl_postprocessing_rgb_halftone.html` that shows the EffectComposer pattern. Don't copy verbatim — adapt to the project's TS structure.

---

## INSERT: append to "Open Questions for the Builder"

5. **Eoraptor substitute:** if Quaternius pack doesn't include Eoraptor specifically, is it OK to use a similar small theropod renamed in code, or should we source a dedicated Eoraptor GLB from Sketchfab (CC-BY, requires attribution in credits)?
6. **Post-process performance budget:** chromatic aberration is cheap; bloom and grain are not. Target hardware floor — Chromebook-tier integrated GPU, or assume a dedicated GPU? Affects which passes ship enabled by default.

---

## INSERT: revise the "First Claude Code prompt" at the end

Replace the M0 prompt with the M1 prompt now that M0 is done:

> Read CLAUDE.md and DESIGN.md, including the M1 Feel Criteria and Asset Pipeline sections. Implement Milestone M1: import the Eoraptor GLB from `public/models/eoraptor.glb`, render it in the Triassic biome with 3-layer parallax, wire up the EffectComposer with the chromatic aberration ShaderPass (default off), implement the title card sting, and tune the movement / jump / camera against the Feel Criteria. Produce `M1_FEEL_REPORT.md` documenting which criteria pass and which need manual review. Do not start chase, stealth, or any other mechanic — M1 is movement and atmosphere only.
