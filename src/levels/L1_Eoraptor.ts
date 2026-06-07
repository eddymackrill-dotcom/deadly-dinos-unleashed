import * as THREE from "three";
import type { Level } from "./Level";
import { buildBiomeWorld } from "./Biome";
import { getBiome } from "../data/biomes";
import { ScentSequence, type ScentNodeConfig } from "./ScentSequence";
import { ScentNode } from "../entities/ScentNode";
import { Chevron } from "../entities/Chevron";
import type { SecretConfig } from "../systems/HiddenSecretsSystem";

const NODE_CONFIGS: ScentNodeConfig[] = [
  { position: new THREE.Vector3(12, 0.4, 0), type: "collect", points: 100 },
  { position: new THREE.Vector3(28, 0.4, 0), type: "chase", points: 250 },
  { position: new THREE.Vector3(46, 0.4, 0), type: "collect", points: 100 },
  { position: new THREE.Vector3(62, 0.4, 0), type: "stealth", points: 300 },
  { position: new THREE.Vector3(80, 0.4, 0), type: "defense", points: 300 },
  { position: new THREE.Vector3(95, 0.4, 0), type: "collect", points: 100 },
];

// Sits between defense@80 and collect@95. Kept clear of the defense node so
// the rival T-Rex (spawns ~x=83.4) doesn't visually overlap the ledge box.
const LEDGE_X = 90;
const LEDGE_Y = 1.0;
const LEDGE_HALF_WIDTH = 1.6;

const SECRET_CONFIGS: SecretConfig[] = [
  // Easy: on the main path between chase@28 and collect@46.
  {
    id: "l1_secret_ground_37",
    position: new THREE.Vector3(37, 0.4, 0),
    pointsRange: [100, 300],
  },
  // Hard: atop the raised ledge after defense@80, requires a jump. (Id keeps
  // its original suffix so existing save progress isn't orphaned.)
  {
    id: "l1_secret_ledge_85",
    position: new THREE.Vector3(LEDGE_X, LEDGE_Y + 0.35, 0),
    pointsRange: [200, 500],
  },
];

function makeLedge(): THREE.Group {
  const group = new THREE.Group();
  group.position.set(LEDGE_X, 0, 0);
  const baseGeom = new THREE.BoxGeometry(LEDGE_HALF_WIDTH * 2, LEDGE_Y, 1.6);
  const baseMat = new THREE.MeshLambertMaterial({ color: 0x8a5635, flatShading: true });
  const base = new THREE.Mesh(baseGeom, baseMat);
  base.position.y = LEDGE_Y / 2;
  group.add(base);

  for (let i = 0; i < 3; i++) {
    const r = 0.18 + (i % 2 === 0 ? 0.05 : 0.02);
    const rockGeom = new THREE.DodecahedronGeometry(r, 0);
    const rockMat = new THREE.MeshLambertMaterial({ color: 0xa37046, flatShading: true });
    const rock = new THREE.Mesh(rockGeom, rockMat);
    rock.position.set(-LEDGE_HALF_WIDTH * 0.6 + i * 0.6, LEDGE_Y + r * 0.5, i % 2 === 0 ? -0.2 : 0.25);
    rock.rotation.set(i, i * 1.6, i * 0.4);
    group.add(rock);
  }
  return group;
}

export function createLevel1(): Level {
  const root = new THREE.Group();
  root.name = "Level1_Eoraptor";

  const world = buildBiomeWorld(getBiome("triassic_argentina"));
  root.add(world.root);

  const ledge = makeLedge();
  root.add(ledge);

  const sequence = new ScentSequence(NODE_CONFIGS);
  const nodes: ScentNode[] = NODE_CONFIGS.map((cfg) => {
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
    secrets: SECRET_CONFIGS,
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
