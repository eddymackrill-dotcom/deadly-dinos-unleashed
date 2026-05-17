import type * as THREE from "three";

export interface LevelUpdateContext {
  dt: number;
  cameraX: number;
  cameraQuaternion: THREE.Quaternion;
}

export interface Level {
  readonly root: THREE.Object3D;
  update(ctx: LevelUpdateContext): void;
  dispose(): void;
}
