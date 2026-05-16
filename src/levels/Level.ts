import type * as THREE from "three";

export interface Level {
  readonly root: THREE.Object3D;
  update(dt: number, cameraX: number): void;
  dispose(): void;
}
