# HUD Polish Backlog

Deferred UI/UX cleanup for a single cohesive HUD pass (target: **M6 — Polish**).
Nothing here is a bug — the HUD works; these are clarity/readability items.
**Audience floor: a 7-year-old (CBBC, ~7–11).** If a label needs explaining,
it needs reworking.

Do **not** fix these piecemeal — batch them into one pass so the wording,
iconography, and visual language stay consistent across the whole HUD.

---

## 1. Scent counter label is unclear

`SCENT n / total` (in `src/ui/App.tsx` → `TrackingBar`) doesn't read as
"progress through the trail." Players don't intuit what the fraction counts.

Options to evaluate (pick one in the pass, don't ship all three):
- **`TRAIL 1/6`** — reframe around "the trail" with a clearer progress concept.
- **`1/6 SCENT FOUND`** — completed-not-remaining framing (what you've done,
  not what's left).
- **Pip indicators** — 6 dots that fill as nodes are collected, replacing the
  fraction text entirely. Most glanceable; likely best for the age floor.

## 2. Review all HUD text labels for first-encounter clarity

Audit every HUD label a first-time young player meets and reword anything that
prompts "what does that mean?". Treat as one batch for tone/wording consistency.
Known labels and where they live (all in `src/ui/App.tsx` unless noted):

- **`TRACKING`** bar (`TrackingBar`) — does a 7-year-old know this is "follow
  the smell before it fades"?
- **`CHASE`** timer (`ChaseTimerBar`) — fine conceptually; confirm the timer's
  meaning reads (run out = prey escapes).
- **`STEALTH`** + 👁/🌿 eye/leaf icons (`StealthBar`), `EXPOSED` / `HIDDEN`
  states — is "EXPOSED" clear? Icon-only might beat the word.
- **Defense banner** `DEFEND!` + "Press the arrow keys as they appear"
  (`DefenseOverlay`) — instruction line currently first-encounter only;
  confirm that's enough teaching.
- **Result flashes** (`ChaseResultFlash`): CAUGHT!/ESCAPED!, POUNCED!/SPOTTED!,
  DEFENDED!/OVERPOWERED!, HELD GROUND, STEALTH BROKEN — verbs are
  encounter-appropriate (done), but sanity-check vocabulary for the age floor
  (e.g. "OVERPOWERED" / "REPELLED"-class words).
- **Power radial** `DASH` / `ACTIVE · HOLD` / `COOLDOWN` (`PowerIcon`) — does
  "COOLDOWN" read, or is a clock/recharge icon clearer?
- **Hidden secrets pill** `x/N HIDDEN` (`HiddenSecretsCounter`).

### Cross-cutting notes for the pass
- Prefer icon + short word over jargon where space allows.
- Keep one consistent voice across all labels (imperative? noun? verb?).
- Consider a brief first-run tooltip/callout per mechanic instead of relying on
  the label alone.
