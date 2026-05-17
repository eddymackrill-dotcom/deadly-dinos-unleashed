import type * as THREE from "three";

export type ScentNodeTag = "collect" | "chase" | "stealth" | "defense";

export interface LevelUpdateContext {
  dt: number;
  camera: THREE.PerspectiveCamera;
  playerPosition: THREE.Vector3;
}

export interface ActiveScentInfo {
  index: number;
  position: THREE.Vector3;
  tag: ScentNodeTag;
}

export interface Level {
  readonly root: THREE.Object3D;
  update(ctx: LevelUpdateContext): void;
  /** Returns the next-uncollected scent node, or null when the sequence is complete. */
  getActiveScent(): ActiveScentInfo | null;
  /** Total scent nodes in the level. */
  getScentTotal(): number;
  /** Number of scent nodes already collected. */
  getScentCollected(): number;
  dispose(): void;
}
