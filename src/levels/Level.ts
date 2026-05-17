import type * as THREE from "three";
import type { ScentSequence } from "./ScentSequence";

export interface LevelUpdateContext {
  dt: number;
  camera: THREE.PerspectiveCamera;
  playerPosition: THREE.Vector3;
}

export interface Level {
  readonly root: THREE.Object3D;
  /** Single source of truth for scent progress. */
  readonly sequence: ScentSequence;
  update(ctx: LevelUpdateContext): void;
  /**
   * Override the chevron's target X (e.g. point at chase prey instead of the
   * active scent node). Pass null to restore default (chevron tracks the
   * sequence's active node).
   */
  setChevronTargetOverride(x: number | null): void;
  dispose(): void;
}
