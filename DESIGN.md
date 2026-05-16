# DESIGN.md — Mechanic Specifications

Detailed specs for each gameplay system. Companion to CLAUDE.md.

---

## 1. Side-Scroll Camera

**Type:** Perspective camera, near-orthographic FOV (~25°), positioned at fixed Z distance from action plane.

**Behaviour:**
- Follows player on X axis with smoothing (lerp factor ~0.08)
- Lookahead: shifts ~2 units in the direction of player movement
- Y axis: lerps slowly toward player's Y (handles jumps without snapping)
- Z axis: locked
- Slight FOV pulse when Animal Power activates (24° → 22° over 200ms)

**Why perspective not pure ortho:** subtle depth on parallax layers, helps the low-poly meshes read as 3D.

---

## 2. Scent Tracking

**Visual:** Purple/magenta GPU particles, drifting upward with sine-wave horizontal motion. ~30 particles per active scent point. Soft additive blending.

**Logic:**
- Level defines a sequence of `ScentNode` positions
- Only the *next* node is active; particles emit from it
- A floating chevron arrow above the dino points toward the active node (clamps to screen edges if off-screen)
- Reaching within ~3 units of the node:
  - Triggers the next activity (chase / stealth / defense / collect)
  - Refills tracking bar to 100%
  - Advances to the next node

**Tracking bar:**
- Drains at rate `1 / trackingDuration` per second
- `trackingDuration` = `baseDuration * (1 + sensesStat * 0.05)`
- "More Time" power card multiplies by 1.5
- Empty bar = mission fail → score summary with what was completed

---

## 3. Chase Mechanic

**Trigger:** Reaching a scent node tagged `chase`.

**Setup:**
- Prey animal spawns ahead, runs at `preySpeed = playerSpeed * 0.9`
- Camera widens slightly (FOV 25° → 28°)
- Timer bar appears at top centre (chase-specific, separate from tracking)
- Chevron points at prey

**Win condition:** Player overlaps prey hitbox before chase timer expires.
**Lose condition:** Timer expires → prey escapes off-screen → activity skipped, no points awarded, tracking continues to next node.

**Feel notes:** Camera shake on catch (small, 100ms). Prey does a tumble animation, screen flash, fade to brief still-frame "CAUGHT!" with chromatic aberration glitch.

---

## 4. Stealth Mechanic

**Trigger:** Scent node tagged `stealth`.

**Setup:**
- Prey is stationary or slow-grazing ahead
- Bushes scattered along the path (visual: low-poly leafy clusters)
- Stealth bar appears (eye icon, yellow fill)

**Logic:**
- Stealth bar drains while player is in the open
- Drain rate scales inversely with `sensesStat` (higher senses = slower drain)
- Hiding in a bush: bar refills at 2× drain rate
- Movement allowed in bushes but slowed (50% speed)
- Reach prey while bar > 0 = caught
- Bar empties = prey spooked → runs off → activity failed

**Visual cue:** Player mesh tints slightly cyan while detection is active. Bush makes player ~80% transparent.

---

## 5. Defense Mechanic

**Trigger:** Scent node tagged `defense`, or random rival encounter on patrol.

**Setup:**
- Rival predator (different species, semi-transparent overlay matching the BBC art style) appears
- 3–5 round QTE: arrow prompt appears on screen, player must press matching arrow within ~700ms window
- Each correct: rival recoils. Each miss: player takes a "stagger" hit (no health system — just visual feedback and reduced score)

**Scoring:**
- All correct = full points + small predator-points bonus
- ≥1 miss = partial points
- All miss = activity failed

**Reaction window** scales with `togughnessStat` (higher = more lenient window).

---

## 6. Hidden Secrets

**Placement:** Each level has 1–3 hidden alcoves off the main path — usually requiring a jump to a high ledge or entering a side cave.

**Visual:** A small glowing pile of objects (bones, fossils, plant matter, glinting stones) on the ground.

**Interaction:** Walk over it. Triggers a brief reward popup:
- Conservation card (Fossil Programme)
- Animal style unlock
- Predator point bundle (100–500)

**Tracking:** Counted as `0/N Hidden Secret` on the mission select screen — exactly like the BBC original.

---

## 7. Animal Power (X key)

**Activation:** Press X. No hold required. Triggers a timed effect specific to the dinosaur.

**Cooldown:** 8 seconds default, scales with `powerStat`.

**Per-dino effects:**

| Dino | Effect | Duration |
|---|---|---|
| Eoraptor | +60% move speed | 3s |
| Herrerasaurus | Next jump 2× distance | until jump |
| Deinonychus | Sickle strike: break breakable obstacles, stun rivals | instant |
| Tarbosaurus | Bone crush: stun rival for 2× normal | 2s |
| Albertosaurus | Pack howl: slow nearby prey 50% | 4s |
| T-Rex | Apex roar: clear all rivals from screen, screen-wide shockwave | instant |
| Carcharodontosaurus | Sustained slash: hold X for continuous damage to rivals | 3s max |
| Spinosaurus | River ambush: if near water, emerge instantly at any scent node | instant |

**Visual:** Activation triggers a brief chromatic aberration burst + screen tint specific to dino (red for T-Rex, blue for Spinosaurus etc.).

---

## 8. Score Summary

End-of-level overlay. Mirrors BBC's screen:

- Rank shield with current rank number
- Dino name
- 4 stat bars (Speed/Toughness/Power/Senses)
- Mission completion % (big arc gauge)
- Checklist of activities with predator point values
- Equipped power card display
- Buttons: **Restart** | **Missions**

Activities can be left incomplete and returned to later. Stored in localStorage per dino.

---

## 9. Conservation → Fossil Discovery Programme

**Reskinned mechanic** to fit dinosaurs:

- Each dino has a "Fossil Programme" tracker (0–100%)
- Slotting a conservation card (renamed: **Discovery Card**) advances it
- Card types: *Excavation*, *Lab Analysis*, *Public Education*, *Museum Funding*
- Completing 100% rewards a big predator point bundle + unlocks a "legendary fossil" style for that dino

This keeps the educational hook (teaching kids about real palaeontology, fossil hunting, scientific method) without forcing modern conservation messaging onto extinct animals.

---

## 10. Audio Design

**Music:** One ambient track per biome, looping. Cretaceous gets heavier percussion than Triassic.

**SFX (per dino):**
- Idle breath/grunt
- Footstep (varies on surface: dirt, rock, water)
- Vocalisation (used for Animal Power and end-of-chase catch)
- Jump
- Land

**UI SFX:** Card flip, button click, chromatic glitch sting (used on title cards and Animal Power).

**Spatial:** Howler.js spatial panning on prey/rival sounds — left-right based on screen X position.

---

## 11. Accessibility

- Remappable keys (config screen)
- Subtitle option for any voice-over
- High-contrast mode (boosts chevron and UI bars)
- Reduced motion (disables chromatic aberration, screen shake, FOV pulse)
- Hold-vs-tap option for jump (some players prefer hold-to-jump-higher)

---

## 12. Out of Scope (v1)

- Multiplayer / leaderboards
- Procedural levels
- Mobile touch controls (handle later, after desktop feels right)
- Achievements system
- Localisation (English only for v1)
