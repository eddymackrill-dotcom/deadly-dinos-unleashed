import * as THREE from "three";
import { HiddenSecret } from "../entities/HiddenSecret";
import { useGameState } from "../state/gameState";
import { SCORE } from "../data/scoring";

export interface SecretConfig {
  id: string;
  position: THREE.Vector3;
}

const PICKUP_RADIUS = 1.6; // 3D distance — generous so a jump-through still hits

/**
 * Manages a level's hidden secret pickups. Drives the per-frame proximity
 * check, awards predator points to the running mission state, fires a popup,
 * and tracks which IDs were claimed during the run.
 *
 * Persistence of found IDs is handled by Save.commitMissionResult at mission
 * end (the level passes `getClaimedIds()` in).
 */
export class HiddenSecretsSystem {
  private secrets: HiddenSecret[] = [];
  private claimedIds = new Set<string>();
  readonly total: number;

  constructor(
    private cb: { scene: THREE.Object3D },
    configs: SecretConfig[],
    alreadyFoundIds: ReadonlySet<string> | string[],
  ) {
    this.total = configs.length;
    const skip = new Set(
      Array.isArray(alreadyFoundIds) ? alreadyFoundIds : Array.from(alreadyFoundIds),
    );
    for (const cfg of configs) {
      if (skip.has(cfg.id)) {
        // Already found in a prior run — don't respawn.
        this.claimedIds.add(cfg.id);
        continue;
      }
      const secret = new HiddenSecret(cfg.id, cfg.position);
      this.secrets.push(secret);
      this.cb.scene.add(secret.root);
    }
    useGameState.getState().setHiddenSecretsProgress(this.claimedIds.size, this.total);
  }

  update(dt: number, playerPosition: THREE.Vector3) {
    for (const secret of this.secrets) {
      secret.update(dt);
      if (this.claimedIds.has(secret.id)) continue;
      if (secret.distanceTo(playerPosition) <= PICKUP_RADIUS) {
        this.claim(secret);
      }
    }
  }

  private claim(secret: HiddenSecret) {
    if (this.claimedIds.has(secret.id)) return;
    this.claimedIds.add(secret.id);

    // Flat value, every time — a secret is always worth exactly SCORE.hiddenSecret.
    const points = SCORE.hiddenSecret;

    useGameState.getState().addSecretPoints(points);
    useGameState.getState().setHiddenSecretsProgress(this.claimedIds.size, this.total);
    useGameState.getState().pushRewardPopup(`+${points} PREDATOR POINTS`);

    secret.playClaim(() => {
      this.cb.scene.remove(secret.root);
      secret.dispose();
    });
  }

  getClaimedIds(): string[] {
    return Array.from(this.claimedIds);
  }

  get claimedCount(): number {
    return this.claimedIds.size;
  }

  dispose() {
    for (const secret of this.secrets) {
      this.cb.scene.remove(secret.root);
      secret.dispose();
    }
    this.secrets = [];
  }
}
