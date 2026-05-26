import * as THREE from "three";
import { Rival } from "../entities/Rival";
import type { ArrowDir, Input } from "../game/Input";
import { useGameState } from "../state/gameState";

const ROUNDS = 4;
const BASE_REACTION_MS = 700;
const TOUGHNESS_REACTION_FACTOR = 50; // +50ms per toughness point
const INTER_ROUND_DELAY_MS = 280;
const RIVAL_SPAWN_AHEAD_X = 3.2;
const FLASH_DURATION_MS = 900;
const STAGGER_TINT_DURATION = 0.25;

export type DefenseResult = "win" | "partial" | "lose";

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

type Phase = "idle" | "prompting" | "intermission" | "resolving";

const ALL_ARROWS: ArrowDir[] = ["up", "down", "left", "right"];

/**
 * 3–5 round arrow-QTE defense. Each round picks a random arrow and shows it
 * for `reactionWindowMs`. Pressing the matching arrow within the window =
 * correct (rival recoils). Anything else (miss key or timeout) = miss (player
 * stagger). All-correct → win; ≥1 miss → partial; all miss → lose.
 */
export class DefenseSystem {
  private phase: Phase = "idle";
  private rival: Rival | null = null;
  private round = 0;
  private prompt: ArrowDir | null = null;
  private promptStart = 0;
  private deadline = 0;
  private hits = 0;
  private misses = 0;
  private intermissionUntil = 0;
  private resolveUntil = 0;
  private result: DefenseResult | null = null;
  private playerFacing: 1 | -1 = 1;
  private staggerTintUntil = 0;
  private reactionWindowMs = BASE_REACTION_MS;

  constructor(private cb: DefenseCallbacks) {}

  get isActive(): boolean {
    return this.phase !== "idle";
  }

  start(nodeX: number, playerFacing: 1 | -1) {
    if (this.phase !== "idle") return;
    this.playerFacing = playerFacing;
    this.round = 0;
    this.hits = 0;
    this.misses = 0;
    this.result = null;
    this.reactionWindowMs =
      BASE_REACTION_MS + this.cb.toughnessStat * TOUGHNESS_REACTION_FACTOR;

    this.rival = new Rival();
    const rivalX = nodeX + playerFacing * RIVAL_SPAWN_AHEAD_X;
    this.rival.setPosition(rivalX, 0, 0);
    this.rival.setFacing(playerFacing === 1 ? -1 : 1);
    this.cb.scene.add(this.rival.root);

    this.cb.setChevronOverride(rivalX);
    this.cb.setPlayerInputLocked(true);

    useGameState.getState().startDefense(ROUNDS);
    this.beginNextRound();
  }

  private beginNextRound() {
    if (this.round >= ROUNDS) {
      this.finishEncounter();
      return;
    }
    this.prompt = ALL_ARROWS[Math.floor(Math.random() * ALL_ARROWS.length)];
    this.promptStart = performance.now();
    this.deadline = this.promptStart + this.reactionWindowMs;
    this.phase = "prompting";
    useGameState.getState().setDefensePrompt({
      arrow: this.prompt,
      round: this.round + 1,
      total: ROUNDS,
      deadline: this.deadline,
    });
    // Consume any stale arrow presses from before the prompt began.
    for (const a of ALL_ARROWS) this.cb.input.consumeArrowPress(a);
  }

  update(_dt: number) {
    if (this.phase === "idle") return;

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

    // Prompting: poll arrow presses + timeout.
    if (this.prompt) {
      let pressedAny: ArrowDir | null = null;
      for (const a of ALL_ARROWS) {
        if (this.cb.input.arrowPressedAt(a) > this.promptStart) {
          pressedAny = a;
          this.cb.input.consumeArrowPress(a);
          break;
        }
      }
      if (pressedAny) {
        if (pressedAny === this.prompt) this.onHit();
        else this.onMiss();
        return;
      }
      if (performance.now() >= this.deadline) {
        this.onMiss();
      }
    }
  }

  private onHit() {
    this.hits += 1;
    if (this.rival) this.rival.playRecoil(this.playerFacing);
    useGameState.getState().setDefensePrompt(null);
    this.prompt = null;
    this.phase = "intermission";
    this.intermissionUntil = performance.now() + INTER_ROUND_DELAY_MS;
  }

  private onMiss() {
    this.misses += 1;
    if (this.rival) this.rival.playLunge(this.playerFacing);
    this.cb.onCameraShake(0.14, 0.08);
    this.cb.setPlayerTint(new THREE.Color(0xff5566), 0.5, 1);
    this.staggerTintUntil = performance.now() + STAGGER_TINT_DURATION * 1000;
    useGameState.getState().setDefensePrompt(null);
    this.prompt = null;
    this.phase = "intermission";
    this.intermissionUntil = performance.now() + INTER_ROUND_DELAY_MS;
  }

  private finishEncounter() {
    let result: DefenseResult;
    if (this.misses === 0) result = "win";
    else if (this.hits === 0) result = "lose";
    else result = "partial";

    this.result = result;
    const flashUntil = performance.now() + FLASH_DURATION_MS;
    this.resolveUntil = flashUntil;
    this.phase = "resolving";
    useGameState.getState().endDefense(result, this.hits, this.misses, flashUntil);

    if (result !== "lose") this.cb.onGlitchSting();
  }

  /** Points multiplier for partial outcome based on hit ratio. */
  partialPointsRatio(): number {
    return this.hits / ROUNDS;
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
    this.onResolved?.(result, this.hits, this.misses);
    this.result = null;
  }

  onResolved:
    | ((result: DefenseResult, hits: number, misses: number) => void)
    | null = null;
}
