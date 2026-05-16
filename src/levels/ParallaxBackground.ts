import * as THREE from "three";

export interface ParallaxLayerConfig {
  /** Screen-velocity factor: 0.2 = barely moves, 1.0 = scrolls with world, >1.0 = scrolls faster than world (foreground). */
  parallaxFactor: number;
  z: number;
  tileWidth: number;
  numTiles: number;
  build: () => THREE.Object3D;
}

class ParallaxLayer {
  private group = new THREE.Group();
  private tiles: THREE.Object3D[] = [];
  private followFactor: number;

  constructor(private cfg: ParallaxLayerConfig, parent: THREE.Object3D) {
    this.followFactor = 1 - cfg.parallaxFactor;
    for (let i = 0; i < cfg.numTiles; i++) {
      const tile = cfg.build();
      tile.position.z = cfg.z;
      this.tiles.push(tile);
      this.group.add(tile);
    }
    parent.add(this.group);
  }

  update(cameraX: number) {
    this.group.position.x = cameraX * this.followFactor;
    const localTarget = cameraX - this.group.position.x;
    const centerIdx = Math.round(localTarget / this.cfg.tileWidth);
    const offsetStart = -Math.floor(this.tiles.length / 2);
    for (let i = 0; i < this.tiles.length; i++) {
      this.tiles[i].position.x = (centerIdx + offsetStart + i) * this.cfg.tileWidth;
    }
  }
}

export class ParallaxBackground {
  readonly root = new THREE.Group();
  private layers: ParallaxLayer[] = [];

  constructor(configs: ParallaxLayerConfig[]) {
    for (const cfg of configs) {
      this.layers.push(new ParallaxLayer(cfg, this.root));
    }
  }

  update(cameraX: number) {
    for (const layer of this.layers) layer.update(cameraX);
  }
}
