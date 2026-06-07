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
