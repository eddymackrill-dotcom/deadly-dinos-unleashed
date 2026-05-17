# Deadly Dinos Unleashed

A 2.5D side-scrolling action-adventure game inspired by BBC's *Deadly Mission Unleashed*, where players control prehistoric predators across themed missions. Sophisticated low-poly 3D visuals on a side-scrolling plane.

---

## Project Vision

A faithful clone of BBC's Deadly Mission Unleashed with dinosaurs replacing modern animals. Same mechanics (scent tracking, chase, stealth, defense, hidden secrets), same meta-progression (stats, ranks, animal styles, power cards, conservation cards), reskinned for a prehistoric world.

**Aesthetic:** Low-poly 3D models rendered side-on with parallax depth. Vivid, slightly stylised palette — Triassic dust, Jurassic green, Cretaceous swamp. Chromatic-aberration glitch effect on UI overlays (matches the BBC game's "deadly" visual identity).

**Priority order:** Art and feel **first**, mechanics second. The opening 30 seconds of Level 1 should feel polished and atmospheric before any deeper systems are wired in.

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Build | Vite + TypeScript | Fast HMR, type safety |
| Rendering | Three.js | Low-poly 3D, custom shaders for the stylised look |
| Physics | Rapier (WASM) | Fast, deterministic, good for platformers |
| Audio | Howler.js | Spatial audio, sprite sheets, easy ducking |
| UI | React + Tailwind (overlay layer) | HUD, menus, dialogs — DOM is fine for these |
| Animation | GSAP | UI transitions, camera tweens |
| State | Zustand | Lightweight, works well outside React for game state |
| Assets | GLTF / GLB | Standard for Three.js; sourceable from Quaternius / Kenney |

**Rationale:** The BBC original is clearly a side-scrolling camera looking at 3D low-poly meshes. Pure 2D (Phaser/Pixi) would lose that depth. Pure 3D without a side-scroll constraint would be too much scope. Three.js + an orthographic-ish camera locked to the X axis gives the right feel.

---

## Project Structure

```
deadly-dinos/
├── public/
│   ├── models/          # GLB dinosaur and environment meshes
│   ├── audio/           # SFX and music
│   └── textures/        # Bark, leaves, rock, scent particles
├── src/
│   ├── main.ts          # Entry point, bootstrap
│   ├── game/
│   │   ├── Game.ts          # Top-level game loop
│   │   ├── Scene.ts         # Three.js scene wrapper
│   │   ├── Camera.ts        # Side-scroll camera with smoothing + lookahead
│   │   ├── Physics.ts       # Rapier world wrapper
│   │   └── Input.ts         # Keyboard input mapping
│   ├── entities/
│   │   ├── Dinosaur.ts      # Base player class
│   │   ├── PreyAnimal.ts    # Chase target
│   │   ├── Rival.ts         # Defense encounter
│   │   └── ScentMarker.ts   # Trail particle
│   ├── levels/
│   │   ├── Level.ts         # Base level loader
│   │   ├── L1_Eoraptor.ts   # ... one per dinosaur
│   │   └── ...
│   ├── systems/
│   │   ├── TrackingBar.ts   # Timer mechanic
│   │   ├── StealthSystem.ts # Bush hiding
│   │   ├── DefenseSystem.ts # QTE arrow prompts
│   │   ├── ScoreSystem.ts   # Mission %, predator points
│   │   └── PowerCards.ts    # Animal power activation (X key)
│   ├── progression/
│   │   ├── DinoStats.ts     # Speed / Toughness / Power / Senses
│   │   ├── Ranks.ts         # Rank-up logic
│   │   ├── Styles.ts        # Cosmetic skins
│   │   └── Conservation.ts  # Conservation programme tracking
│   ├── ui/
│   │   ├── App.tsx          # React UI root
│   │   ├── HUD.tsx          # Tracking bar, power, score
│   │   ├── HowToPlay.tsx    # Tutorial carousel
│   │   ├── MissionSelect.tsx
│   │   └── ScoreSummary.tsx
│   ├── shaders/
│   │   ├── glitch.glsl      # Chromatic aberration for UI/cutscenes
│   │   ├── scent.glsl       # Particle scent markers
│   │   └── toon.glsl        # Stylised dinosaur shading
│   └── data/
│       ├── dinosaurs.ts     # All 8 dino definitions
│       └── levels.ts        # Level configs (missions, prey, biome)
├── CLAUDE.md            # This file
├── DESIGN.md            # Detailed mechanic specs
└── package.json
```

---

## The 8 Dinosaurs

Stats roughly mirror the BBC game's 4-axis system (each 1–12). Roster spans real palaeontology — Triassic small predators through Cretaceous apex giants.

| # | Dinosaur | Era | Region | Speed | Toughness | Power | Senses | Animal Power |
|---|---|---|---|---|---|---|---|---|
| 1 | **Eoraptor** | Late Triassic | Argentina | 6 | 3 | 2 | 5 | **Quick Dash** — short speed burst |
| 2 | **Herrerasaurus** | Late Triassic | Argentina | 7 | 4 | 4 | 6 | **Lunge** — long forward leap |
| 3 | **Deinonychus** | Early Cretaceous | N. America | 9 | 4 | 5 | 7 | **Sickle Strike** — claw attack, breaks obstacles |
| 4 | **Tarbosaurus** | Late Cretaceous | Mongolia | 5 | 8 | 8 | 7 | **Bone-Crush Bite** — stuns rivals |
| 5 | **Albertosaurus** | Late Cretaceous | Canada | 7 | 7 | 8 | 8 | **Pack Howl** — slows prey |
| 6 | **T-Rex** | Late Cretaceous | N. America | 6 | 11 | 12 | 9 | **Apex Roar** — full screen shockwave |
| 7 | **Carcharodontosaurus** | Mid Cretaceous | N. Africa | 7 | 9 | 11 | 7 | **Shark-Tooth Slash** — sustained damage |
| 8 | **Spinosaurus** | Mid Cretaceous | N. Africa | 8 (swim) | 10 | 11 | 8 | **River Ambush** — emerge from water, instant catch |

Each dino unlocks at the end of the previous level. Each has its own biome, prey species, and rival encounter (see `data/levels.ts`).

---

## Core Mechanics (faithful clone of BBC original)

1. **Scent tracking** — purple scent particles lead to activities. Tracking bar drains over time; reaching the next marker refills it.
2. **Chase** — direction arrow + timer. Catch the prey before timer runs out.
3. **Stealth** — sneak meter drains in open ground, refills in bushes. Approach prey without it emptying.
4. **Defense** — QTE: correct arrow key when prompted, fend off rival predator.
5. **Hidden Secrets** — explorable side paths reward conservation cards / style skins.
6. **Animal Power (X key)** — temporary boost specific to each dino. Cooldown-based, not held.
7. **Mission scoring** — % complete, return any time for 100%.

Controls: Arrow keys (move), Space (jump/action), X (animal power), Esc (pause).

---

## Meta Progression

- **Rank up:** Every completed mission grants XP; ranks 1–10 per dinosaur, each adding stat points.
- **Predator Points:** Earned from missions, spent on cards.
- **Power Cards:** Equip 1 per mission (e.g. *More Time*, *Bigger Jump*, *Good Reflexes*).
- **Conservation Cards:** Slot into the prehistoric "conservation programme" — reskinned as **Fossil Discovery Programme** (educational, ties dinos to real palaeontology rather than modern conservation).
- **Animal Styles:** Cosmetic skins per dino (e.g. juvenile, melanistic, breeding plumage). Unlocked via hidden secrets.
- **Collections:** Fact cards covering real palaeontology — each card shows a fact about anatomy, fossil sites, contemporaries.

---

## MVP — What "Done" Means for v0.1

Per your priority (art and feel first), MVP is **the first 30 seconds of Level 1, polished**:

1. ✅ Vite + Three.js + Rapier scaffolded and running
2. ✅ Eoraptor GLB model imported, idle + run animations cycling
3. ✅ Triassic biome: parallax background (3 layers), ground plane, scattered low-poly rocks/ferns
4. ✅ Side-scroll camera with smoothing and slight lookahead
5. ✅ Arrow keys move Eoraptor; space jumps with squash-stretch
6. ✅ Scent particles drifting from a marker; player can move toward it
7. ✅ HUD overlay showing tracking bar (purely visual at this stage)
8. ✅ Title card → "Mission 1: Eoraptor — Argentina, 230 million years ago" with the BBC-style chromatic aberration glitch
9. ✅ Ambient Triassic audio loop + footstep SFX

**Not in MVP:** chase mechanic, stealth, defense, score screen, other dinosaurs, meta-progression UI. Those come after the feel is right.

---

## M1 Feel Criteria (testable)

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

## Milestone Plan

| Milestone | Scope | Estimate |
|---|---|---|
| **M0 — Scaffold** | Vite/TS/Three/Rapier/React boot, empty scene renders | Day 1 |
| **M1 — Feel** (MVP) | Above 9-point list; one polished dinosaur in one polished biome | Days 2–5 |
| **M2 — Loop** | Scent → chase → catch → score. End-of-level summary. | Week 2 |
| **M3 — Variety** | All 5 mechanics (scent, chase, stealth, defense, secrets) | Week 3 |
| **M4 — Roster** | All 8 dinosaurs playable with unique powers | Week 4 |
| **M5 — Meta** | Ranks, cards, styles, collections, fossil programme | Week 5 |
| **M6 — Polish** | Audio pass, particle pass, UI animation, accessibility | Week 6 |

---

## Asset Pipeline

**M1 decision: use placeholder-quality assets, upgrade in M6.** The reason: the
movement, camera, particle, and post-process feel will be iterated dozens of
times during M1–M3. Doing that against a final-quality model wastes work that
gets thrown away. Final art replacement is its own milestone.

### Eoraptor (M1)

- **Source:** Quaternius "Ultimate Dinosaurs Pack" (CC0)
  - URL: `https://quaternius.com/packs/ultimatedinosaurs.html`
  - If Eoraptor isn't in that pack, substitute the smallest available bipedal theropod (Compsognathus, Procompsognathus). Rename to Eoraptor in code.
- **File location:** `public/models/eoraptor.glb`
- **Expected animations:** `idle`, `run`. If the GLB only has one animation track, generate a held-pose idle programmatically (subtle Y-position sine wave on the root bone).
- **Scale:** Eoraptor was ~1m long. In-world target height ~0.8 units. Apply scale in the loader, don't bake it.
- **Materials:** Strip any imported PBR materials — replace with `MeshToonMaterial` or a simple flat-shaded `MeshLambertMaterial` to match the BBC low-poly look. No textures on the dino itself; rely on vertex colours where present.

### Environment (M1)

- **Source:** Kenney "Nature Kit" (CC0) — `https://kenney.nl/assets/nature-kit`
- **Pieces needed for M1 Triassic biome:**
  - 3–4 fern/cycad meshes (foreground scatter)
  - 2–3 rock cluster meshes (midground)
  - 1 distant cliff/mountain silhouette mesh (background layer)
  - Ground plane: flat for M1, displacement comes in M2
- **File location:** `public/models/env/triassic/*.glb`
- **Palette:** dusty oranges, muted greens, ochre sky. Reference: late Triassic was hot, semi-arid. Not the lush jungle of the BBC tiger level.

### Audio (M1)

- **Source:** Freesound.org (CC0 only — filter by license) + Pixabay Music
- **Files needed:**
  - `public/audio/ambient/triassic_loop.ogg` — ~60s loop, wind + distant insects, no music yet
  - `public/audio/sfx/footstep_dirt_01.ogg` through `_03.ogg` — small, dry impacts
  - `public/audio/sfx/jump.ogg`, `land.ogg`
  - `public/audio/sfx/glitch_sting.ogg` — short, ~200ms, used for title card
- **Format:** OGG Vorbis at 96kbps for SFX, 128kbps for ambient. Howler handles fallbacks if needed.

### Fonts

- **Display:** Bangers (Google Fonts) — graffiti-style, matches BBC's "Deadly" identity
- **UI:** Inter (Google Fonts) — clean, readable for HUD numbers and menus
- Load via `@fontsource/bangers` and `@fontsource/inter` (npm packages) to avoid render-blocking external requests

---

## Particles & Post-Processing (wire up in M1)

### Particle library: `three.quarks`

- **Install:** `npm install three.quarks`
- **Why:** actively maintained, GPU-accelerated, designed for Three.js, supports the additive blending and sine-wave drift specified in DESIGN.md §2
- **M1 use:** scent marker particles (purple/magenta, drifting up with sine-x motion), footstep dust puffs
- **Alternative considered:** custom `InstancedMesh` shader — more control but more work; revisit only if `three.quarks` performance bottlenecks

### Post-processing pipeline

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

## Confirmed Decisions

Confirmed before M2 (2026-05-17):

1. **Educational layer:** Real palaeontology — the **Fossil Discovery Programme** replaces the conservation system as already specced. Fact cards cover anatomy, fossil sites, contemporaries. No modern-conservation framing.
2. **Target audience:** Same as BBC (CBBC, ~7–11). Bloodless catches — tackle animation only, no kill shown. Mechanics, palette, and copy should respect this floor.
3. **Platform:** Web only for v1. Desktop packaging (Electron / Tauri) is deferred until after v1 ships. No platform-specific code paths in v1.
4. **Save system:** LocalStorage. Per-dino mission progress (completion %, hidden secrets found), predator points, unlocked styles, fossil programme %. No accounts, no cloud sync in v1.
5. **Eoraptor substitute:** Velociraptor placeholder (already in `public/models/eoraptor.glb`) is confirmed for now. Full-roster sourcing decision (Quaternius vs. Sketchfab CC-BY vs. mixed) is deferred until after M2.
6. **Post-process performance budget:** Chromebook-tier integrated GPU is the floor. Default-on post-process passes are limited to chromatic aberration. Bloom and film grain ship **disabled by default**, toggleable in accessibility settings.

---

## Getting Started (for Claude Code)

```bash
# from project root, once scaffolded
npm create vite@latest . -- --template react-ts
npm install three @types/three @react-three/fiber @react-three/drei
npm install @dimforge/rapier3d-compat
npm install howler @types/howler gsap zustand
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

npm run dev
```

First Claude Code prompt to use after scaffolding:

> Read CLAUDE.md and DESIGN.md, including the M1 Feel Criteria and Asset Pipeline sections. Implement Milestone M1: import the Eoraptor GLB from `public/models/eoraptor.glb`, render it in the Triassic biome with 3-layer parallax, wire up the EffectComposer with the chromatic aberration ShaderPass (default off), implement the title card sting, and tune the movement / jump / camera against the Feel Criteria. Produce `M1_FEEL_REPORT.md` documenting which criteria pass and which need manual review. Do not start chase, stealth, or any other mechanic — M1 is movement and atmosphere only.
