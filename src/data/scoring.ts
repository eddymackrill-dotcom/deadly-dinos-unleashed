import type { ScentNodeType } from "../levels/ScentSequence";

/**
 * BBC-style flat point economy. Every activity is worth a fixed, round number
 * the player can predict before they attempt it — no stat scaling, no random
 * bundles, no fractions. Stat bonuses belong in gameplay (reaction windows,
 * tracking duration, drain rates), never in the score.
 *
 * This is the single source of truth: level configs, the defense partial award,
 * hidden secrets and the mission bonus all read from here.
 */
export const SCORE = {
  /** Walk-over scent node. */
  collect: 100,
  /** Chase catch. Miss = 0. */
  chase: 200,
  /** Stealth pounce. Spotted = 0. */
  stealth: 200,
  /** Defense with all three arrows correct. */
  defense: 200,
  /** Defense with partial credit (1–2 of 3). All missed = 0. */
  defensePartial: 100,
  /** Per fish caught during a Spinosaurus fishing encounter. */
  fishPerFish: 100,
  /** Fish needed to complete a fishing node — so the node is worth 200. */
  fishNeeded: 2,
  /** Hidden secret pickup — flat, never a random bundle. */
  hiddenSecret: 500,
  /** Awarded only when every activity in the mission was completed successfully. */
  missionCompleteBonus: 500,
} as const;

/**
 * Mission-complete bonus: flat, and only when every activity in the mission was
 * completed successfully. A partial or a missed node forfeits it entirely.
 */
export function missionBonusPoints(
  results: ReadonlyArray<{ outcome: string }>,
  totalNodes: number,
): number {
  if (totalNodes === 0 || results.length !== totalNodes) return 0;
  return results.every((r) => r.outcome === "win") ? SCORE.missionCompleteBonus : 0;
}

/** Full value of a scent node of the given type. */
export function nodePoints(type: ScentNodeType): number {
  switch (type) {
    case "collect":
      return SCORE.collect;
    case "chase":
      return SCORE.chase;
    case "stealth":
      return SCORE.stealth;
    case "defense":
      return SCORE.defense;
    case "fish":
      return SCORE.fishPerFish * SCORE.fishNeeded;
  }
}
