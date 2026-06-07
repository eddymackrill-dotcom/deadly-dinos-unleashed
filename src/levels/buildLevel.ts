import * as THREE from "three";
import type { Level } from "./Level";
import { buildBiomeWorld } from "./Biome";
import { getBiome } from "../data/biomes";
import { ScentSequence } from "./ScentSequence";
import { ScentNode } from "../entities/ScentNode";
import { Chevron } from "../entities/Chevron";
import type { LedgeConfig, LevelConfig } from "../data/levels";

function makeLedge(cfg: LedgeConfig): THREE.Group {
  const group = new THREE.Group();
  group.position.set(cfg.x, 0, 0);
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(cfg.halfWidth * 2, cfg.y, 1.6),
    new THREE.MeshLambertMaterial({ color: 0x8a5635, flatShading: true }),
  );
  base.position.y = cfg.y / 2;
  group.add(base);
  for (let i = 0; i < 3; i++) {
    const r = 0.18 + (i % 2 === 0 ? 0.05 : 0.02);
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(r, 0),
      new THREE.MeshLambertMaterial({ color: 0xa37046, flatShading: true }),
    );
    rock.position.set(-cfg.halfWidth * 0.6 + i * 0.6, cfg.y + r * 0.5, i % 2 === 0 ? -0.2 : 0.25);
    rock.rotation.set(i, i * 1.6, i * 0.4);
    group.add(rock);
  }
  return group;
}

/**
 * Generic level builder — assembles a Level from a LevelConfig: the biome world,
 * any ledges, the scent sequence + node particle emitters, and the chevron.
 * Replaces the old hardcoded createLevel1; every mission flows through here.
 */
export function buildLevel(config: LevelConfig): Level {
  const root = new THREE.Group();
  root.name = config.id;

  const world = buildBiomeWorld(getBiome(config.biomeId));
  root.add(world.root);

  for (const ledge of config.ledges ?? []) root.add(makeLedge(ledge));

  const sequence = new ScentSequence(config.nodes);
  const nodes: ScentNode[] = config.nodes.map((cfg) => {
    const n = new ScentNode(cfg.position);
    root.add(n.particles.root);
    return n;
  });

  const chevron = new Chevron();
  root.add(chevron.root);
  let chevronOverrideX: number | null = null;

  function refreshNodeVisuals() {
    const activeIdx = sequence.getActiveIndex();
    for (let i = 0; i < nodes.length; i++) nodes[i].setVisible(i === activeIdx);
  }
  refreshNodeVisuals();

  return {
    root,
    sequence,
    secrets: config.secrets,
    update({ dt, camera, playerPosition }) {
      world.update(camera.position.x, dt);
      refreshNodeVisuals();
      for (const n of nodes) n.update(dt, camera.quaternion);

      const targetX =
        chevronOverrideX !== null
          ? chevronOverrideX
          : sequence.getActive()?.position.x ?? null;
      chevron.setTargetX(targetX);
      if (targetX !== null) chevron.update(playerPosition.x, playerPosition.y, camera, dt);
    },
    setChevronTargetOverride(x) {
      chevronOverrideX = x;
    },
    isWater: (x) => world.isWater(x),
    dispose() {
      for (const n of nodes) n.dispose();
      chevron.dispose();
      world.dispose();
    },
  };
}
