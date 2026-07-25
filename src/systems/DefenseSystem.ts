import * as THREE from "three";
import { Rival } from "../entities/Rival";
import type { ArrowDir, Input } from "../game/Input";
import { useGameState, type DefenseRoundResult } from "../state/gameState";

const ROUNDS = 3; // Layer 3: down from 4.
const BASE_REACTION_MS = 1500; // Layer 3: generous base, up from 700.
const TOUGHNESS_REACTION_FACTOR = 50; // +50ms per toughness point.
const GRACE_MS = 200; // Layer 3: late-hit window after the deadline.
const INTER_ROUND_DELAY_MS = 320; // feedback flash lives here.
const INSTRUCTION_MS = 1300; // first-encounter banner+instructions beat.
const COUNTDOWN_STEP_MS = 600; // 3 steps ≈ 1.8s "3... 2... 1..." countdown.
const RIVAL_SPAWN_AHEAD_X = 3.4;
const FLASH_DURATION_MS = 900;
const STAGGER_TINT_DURATION = 0.25;

export type DefenseResult = "win" | "partial" | "lose";

/**
 * Pure helper: decide outcome from full-hit / total counts (no late hits).
 * Retained for the existing self-test and simple call sites.
 */
export function defenseOutcomeFor(hits: number, total: number): DefenseResult {
  if (total <= 0) return "lose";
  if (hits === total) return "win";
  if (hits === 0) return "lose";
  return "partial";
}

/** Late hits count as half a point. */
export function defenseScore(results: DefenseRoundResult[]): number {
  return results.reduce(
    (s, r) => s + (r === "hit" ? 1 : r === "late" ? 0.5 : 0),
    0,
  );
}

/**
 * Pure helper: outcome from scored round results. All full hits → win, no
 * credit at all → lose, anything in between (including all-late) → partial.
 */
export function defenseOutcomeFromResults(
  results: DefenseRoundResult[],
  total: number,
): DefenseResult {
  if (total <= 0) return "lose";
  const score = defenseScore(results);
  if (score >= total) return "win";
  if (score <= 0) return "lose";
  return "partial";
}

export interface DefenseCallbacks {
  scene: THREE.Object3D;
  input: Input;
  setChevronOverride: (x: number | null) => void;
  setPlayerInputLocked: (locked: boolean) => void;
  setPlayerTint: (color: THREE.Color | null, mix: number, opacity: number) => void;
  onCameraShake: (mag: number, dur: number) => void;
  onGlitchSting: () => void;
  /** Higher toughness → larger reaction window. */
  toughnessStat: number;
}

type Phase = "idle" | "intro" | "prompting" | "intermission" | "resolving";

const ALL_ARROWS: ArrowDir[] = ["up", "down", "left", "right"];

/**
 * Defense QTE, rebuilt for clarity and fairness (DESIGN.md §5):
 *
 *  - Layer 1: on trigger the world freezes (input locked) and a "DEFEND!"
 *    banner + 3-2-1 countdown play before any arrow appears. The first
 *    encounter of a session also shows the instruction line.
 *  - Layer 3: 3 rounds, a generous 1500ms base window (+toughness), and a
 *    200ms post-deadline grace where a correct press still counts as a
 *    half-point "late" hit instead of a full miss.
 *
 * All-full-hits → win; some credit → partial; none → lose. The hit ratio decides
 * the outcome only — the award itself is flat (see data/scoring.ts).
 */
export class DefenseSystem {
  private phase: Phase = "idle";
  private rival: Rival | null = null;
  private round = 0;
  private prompt: ArrowDir | null = null;
  private promptStart = 0;
  private deadline = 0;
  private graceDeadline = 0;
  private roundResults: DefenseRoundResult[] = [];
  private intermissionUntil = 0;
  private resolveUntil = 0;
  private result: DefenseResult | null = null;
  private playerFacing: 1 | -1 = 1;
  private staggerTintUntil = 0;
  private reactionWindowMs = BASE_REACTION_MS;

  // Intro (Layer 1) timing.
  private introStart = 0;
  private countdownStart = 0;
  private firstEncounterDone = false; // session-scoped via the single instance.
  private lastCountdownPushed: number | "unset" | null = "unset";

  constructor(private cb: DefenseCallbacks) {}

  get isActive(): boolean {
    return this.phase !== "idle";
  }

  start(nodeX: number, playerFacing: 1 | -1) {
    if (this.phase !== "idle") return;
    this.playerFacing = playerFacing;
    this.round = 0;
    this.roundResults = [];
    this.result = null;
    this.reactionWindowMs =
      BASE_REACTION_MS + this.cb.toughnessStat * TOUGHNESS_REACTION_FACTOR;

    this.rival = new Rival();
    const rivalX = nodeX + playerFacing * RIVAL_SPAWN_AHEAD_X;
    this.rival.setPosition(rivalX, 0, 0);
    // Rival looks back toward the player (opposite the player's facing).
    this.rival.setFacing(playerFacing === 1 ? -1 : 1);
    this.cb.scene.add(this.rival.root);

    this.cb.setChevronOverride(rivalX);
    this.cb.setPlayerInputLocked(true);

    const showInstructions = !this.firstEncounterDone;
    useGameState.getState().startDefense(ROUNDS, showInstructions);

    // Enter the intro: banner + countdown before the first prompt.
    this.phase = "intro";
    this.introStart = performance.now();
    this.countdownStart = this.introStart + (showInstructions ? INSTRUCTION_MS : 0);
    this.lastCountdownPushed = "unset";
    // Consume any stale arrow presses queued before the encounter.
    for (const a of ALL_ARROWS) this.cb.input.consumeArrowPress(a);
  }

  private updateIntro() {
    const now = performance.now();
    const showInstructions = !this.firstEncounterDone;

    if (now < this.countdownStart) {
      // Instruction beat (first encounter only) — banner up, no number yet.
      this.pushIntro(showInstructions, null);
      return;
    }

    const stepIdx = Math.floor((now - this.countdownStart) / COUNTDOWN_STEP_MS);
    if (stepIdx >= 3) {
      // Countdown finished — begin the QTE.
      this.firstEncounterDone = true;
      useGameState.getState().setDefenseIntro(null);
      this.phase = "prompting";
      this.round = 0;
      this.beginNextRound();
      return;
    }
    this.pushIntro(showInstructions, 3 - stepIdx); // 3, 2, 1
  }

  private pushIntro(showInstructions: boolean, countdown: number | null) {
    if (this.lastCountdownPushed === countdown) return;
    this.lastCountdownPushed = countdown;
    useGameState.getState().setDefenseIntro({ showInstructions, countdown });
  }

  private beginNextRound() {
    if (this.round >= ROUNDS) {
      this.finishEncounter();
      return;
    }
    this.prompt = ALL_ARROWS[Math.floor(Math.random() * ALL_ARROWS.length)];
    this.promptStart = performance.now();
    this.deadline = this.promptStart + this.reactionWindowMs;
    this.graceDeadline = this.deadline + GRACE_MS;
    this.phase = "prompting";
    const state = useGameState.getState();
    state.setDefenseFeedback(null);
    state.setDefensePrompt({
      arrow: this.prompt,
      round: this.round + 1,
      total: ROUNDS,
      startedAt: this.promptStart,
      deadline: this.deadline,
      graceDeadline: this.graceDeadline,
      windowMs: this.reactionWindowMs,
    });
    // Consume any stale arrow presses from before the prompt began.
    for (const a of ALL_ARROWS) this.cb.input.consumeArrowPress(a);
  }

  update(dt: number) {
    if (this.phase === "idle") return;
    this.rival?.update(dt);

    if (this.phase === "intro") {
      this.updateIntro();
      return;
    }

    if (this.phase === "intermission") {
      if (performance.now() >= this.intermissionUntil) {
        this.round += 1;
        this.beginNextRound();
      }
      return;
    }

    if (this.phase === "resolving") {
      if (this.staggerTintUntil > 0 && performance.now() >= this.staggerTintUntil) {
        this.cb.setPlayerTint(null, 0, 1);
        this.staggerTintUntil = 0;
      }
      if (performance.now() >= this.resolveUntil && this.result !== null) {
        this.finalize(this.result);
      }
      return;
    }

    // Prompting: poll arrow presses + timeout (with grace window).
    if (this.prompt) {
      let pressedAny: ArrowDir | null = null;
      for (const a of ALL_ARROWS) {
        if (this.cb.input.arrowPressedAt(a) > this.promptStart) {
          pressedAny = a;
          this.cb.input.consumeArrowPress(a);
          break;
        }
      }
      const now = performance.now();
      if (pressedAny) {
        if (pressedAny === this.prompt) {
          // Correct arrow: full hit inside the window, late hit inside grace.
          this.onResolveRound(now <= this.deadline ? "hit" : "late");
        } else {
          this.onResolveRound("miss"); // wrong arrow
        }
        return;
      }
      if (now >= this.graceDeadline) {
        this.onResolveRound("miss"); // timeout past the grace window
      }
    }
  }

  private onResolveRound(result: DefenseRoundResult) {
    this.roundResults.push(result);
    const state = useGameState.getState();
    state.pushDefenseRoundResult(result);
    state.setDefenseFeedback({
      arrow: this.prompt as ArrowDir,
      result,
      at: performance.now(),
    });

    if (result === "miss") {
      if (this.rival) this.rival.playLunge(this.playerFacing);
      this.cb.onCameraShake(0.14, 0.08);
      this.cb.setPlayerTint(new THREE.Color(0xff5566), 0.5, 1);
      this.staggerTintUntil = performance.now() + STAGGER_TINT_DURATION * 1000;
    } else {
      // hit or late — rival flinches back.
      if (this.rival) this.rival.playRecoil(this.playerFacing);
    }

    state.setDefensePrompt(null);
    this.prompt = null;
    this.phase = "intermission";
    this.intermissionUntil = performance.now() + INTER_ROUND_DELAY_MS;
  }

  private finishEncounter() {
    const result = defenseOutcomeFromResults(this.roundResults, ROUNDS);
    this.result = result;
    const flashUntil = performance.now() + FLASH_DURATION_MS;
    this.resolveUntil = flashUntil;
    this.phase = "resolving";
    useGameState.getState().endDefense(result, flashUntil);

    if (result !== "lose") this.cb.onGlitchSting();
  }

  private finalize(result: DefenseResult) {
    if (this.rival) {
      this.cb.scene.remove(this.rival.root);
      this.rival.dispose();
      this.rival = null;
    }
    this.cb.setChevronOverride(null);
    this.cb.setPlayerInputLocked(false);
    this.cb.setPlayerTint(null, 0, 1);
    this.staggerTintUntil = 0;
    this.phase = "idle";
    this.onResolved?.(result);
    this.result = null;
  }

  onResolved: ((result: DefenseResult) => void) | null = null;
}
