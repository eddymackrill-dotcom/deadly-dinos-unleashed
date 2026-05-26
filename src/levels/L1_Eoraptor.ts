import * as THREE from "three";
import type { Level } from "./Level";
import { ParallaxBackground } from "./ParallaxBackground";
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

const LEDGE_X = 85;
const LEDGE_Y = 1.0;
const LEDGE_HALF_WIDTH = 1.6;

const SECRET_CONFIGS: SecretConfig[] = [
  // Easy: on the main path between chase@28 and collect@46.
  {
    id: "l1_secret_ground_37",
    position: new THREE.Vector3(37, 0.4, 0),
    pointsRange: [100, 300],
  },
  // Hard: atop the raised ledge near defense@80, requires a jump.
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

  // A few rocks on top to suggest "ledge with secret loot".
  for (let i = 0; i < 3; i++) {
    const r = 0.18 + (i % 2 === 0 ? 0.05 : 0.02);
    const rockGeom = new THREE.DodecahedronGeometry(r, 0);
    const rockMat = new THREE.MeshLambertMaterial({ color: 0xa37046, flatShading: true });
    const rock = new THREE.Mesh(rockGeom, rockMat);
    rock.position.set(
      -LEDGE_HALF_WIDTH * 0.6 + i * 0.6,
      LEDGE_Y + r * 0.5,
      (i % 2 === 0 ? -0.2 : 0.25),
    );
    rock.rotation.set(i, i * 1.6, i * 0.4);
    group.add(rock);
  }

  return group;
}

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeMountainTile(width: number, peakHeight: number, color: number, seed: number, segments = 14): THREE.Mesh {
  const rng = mulberry32(seed);
  const shape = new THREE.Shape();
  const halfW = width / 2;
  shape.moveTo(-halfW, 0);
  for (let i = 0; i <= segments; i++) {
    const x = -halfW + (i / segments) * width;
    const h = peakHeight * (0.4 + rng() * 0.6);
    shape.lineTo(x, h);
  }
  shape.lineTo(halfW, 0);
  shape.closePath();
  const geom = new THREE.ShapeGeometry(shape);
  const mat = new THREE.MeshBasicMaterial({ color, fog: true });
  return new THREE.Mesh(geom, mat);
}

function makeHillsTile(width: number, peakHeight: number, color: number, seed: number, segments = 28): THREE.Mesh {
  const rng = mulberry32(seed);
  const shape = new THREE.Shape();
  const halfW = width / 2;
  shape.moveTo(-halfW, 0);
  for (let i = 0; i <= segments; i++) {
    const x = -halfW + (i / segments) * width;
    const wave = Math.sin((i / segments) * Math.PI * 3.2) * 0.4 + 0.55;
    const h = peakHeight * (wave + (rng() - 0.5) * 0.25);
    shape.lineTo(x, h);
  }
  shape.lineTo(halfW, 0);
  shape.closePath();
  const geom = new THREE.ShapeGeometry(shape);
  const mat = new THREE.MeshLambertMaterial({ color, flatShading: true });
  return new THREE.Mesh(geom, mat);
}

function makeRockCluster(width: number, color: number, seed: number): THREE.Group {
  const rng = mulberry32(seed);
  const group = new THREE.Group();
  const count = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < count; i++) {
    const size = 0.4 + rng() * 0.7;
    const geom = new THREE.DodecahedronGeometry(size, 0);
    const mat = new THREE.MeshLambertMaterial({ color, flatShading: true });
    const m = new THREE.Mesh(geom, mat);
    m.position.x = -width / 2 + rng() * width;
    m.position.y = size * 0.5;
    m.rotation.set(rng() * 6.28, rng() * 6.28, rng() * 6.28);
    group.add(m);
  }
  return group;
}

function makeFernCluster(width: number, color: number, seed: number): THREE.Group {
  const rng = mulberry32(seed);
  const group = new THREE.Group();
  const count = 1 + Math.floor(rng() * 2);
  for (let i = 0; i < count; i++) {
    const frondCount = 6 + Math.floor(rng() * 3);
    const fern = new THREE.Group();
    for (let j = 0; j < frondCount; j++) {
      const len = 0.7 + rng() * 0.6;
      const geom = new THREE.PlaneGeometry(0.22, len);
      const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, fog: false });
      const f = new THREE.Mesh(geom, mat);
      const angle = (j / frondCount) * Math.PI - Math.PI / 2 + (rng() - 0.5) * 0.25;
      f.position.y = len / 2;
      f.rotation.z = angle;
      fern.add(f);
    }
    fern.position.x = -width / 2 + rng() * width;
    group.add(fern);
  }
  return group;
}

function addGroundDecorations(parent: THREE.Object3D, halfRange: number, seed = 7) {
  const rng = mulberry32(seed);
  for (let x = -halfRange; x < halfRange; x += 2 + rng() * 3) {
    const offsetZ = (rng() - 0.5) * 1.6;
    if (rng() < 0.45) {
      const rock = makeRockCluster(1.4, 0xa37046, Math.floor(rng() * 1e6));
      rock.position.set(x, 0, offsetZ);
      rock.scale.setScalar(0.55 + rng() * 0.4);
      parent.add(rock);
    } else {
      const fern = makeFernCluster(1.4, 0x4f6a32, Math.floor(rng() * 1e6));
      fern.position.set(x, 0, offsetZ);
      fern.scale.setScalar(0.6 + rng() * 0.3);
      parent.add(fern);
    }
  }
}

function disposeTree(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material;
    if (mat) {
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat.dispose();
    }
  });
}

export function createLevel1(): Level {
  const root = new THREE.Group();
  root.name = "Level1_Eoraptor";

  const groundGeom = new THREE.PlaneGeometry(400, 30);
  const groundMat = new THREE.MeshLambertMaterial({ color: 0xb37a48, flatShading: true });
  const ground = new THREE.Mesh(groundGeom, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.name = "ground";
  root.add(ground);

  addGroundDecorations(root, 60);

  const ledge = makeLedge();
  root.add(ledge);

  const parallax = new ParallaxBackground([
    {
      parallaxFactor: 0.2,
      z: -32,
      tileWidth: 80,
      numTiles: 3,
      build: () => makeMountainTile(80, 16, 0x6b3f24, 31),
    },
    {
      parallaxFactor: 0.5,
      z: -18,
      tileWidth: 60,
      numTiles: 3,
      build: () => makeHillsTile(60, 7, 0x8a5a35, 17),
    },
    {
      parallaxFactor: 0.8,
      z: -6,
      tileWidth: 18,
      numTiles: 5,
      build: () => makeRockCluster(18, 0xb88060, 23),
    },
    {
      parallaxFactor: 1.2,
      z: 4,
      tileWidth: 14,
      numTiles: 5,
      build: () => makeFernCluster(14, 0x1e1208, 41),
    },
  ]);
  root.add(parallax.root);

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
    for (let i = 0; i < nodes.length; i++) {
      nodes[i].setVisible(i === activeIdx);
    }
  }
  refreshNodeVisuals();

  return {
    root,
    sequence,
    secrets: SECRET_CONFIGS,
    update({ dt, camera, playerPosition }) {
      parallax.update(camera.position.x);

      // Refresh which node emits particles based on current active index. Cheap;
      // no state of its own — the visuals follow the canonical sequence state.
      refreshNodeVisuals();

      for (const n of nodes) n.update(dt, camera.quaternion);

      const targetX =
        chevronOverrideX !== null
          ? chevronOverrideX
          : sequence.getActive()?.position.x ?? null;
      chevron.setTargetX(targetX);
      if (targetX !== null) {
        chevron.update(playerPosition.x, playerPosition.y, camera, dt);
      }
    },
    setChevronTargetOverride(x) {
      chevronOverrideX = x;
    },
    dispose() {
      for (const n of nodes) n.dispose();
      chevron.dispose();
      disposeTree(root);
    },
  };
}
