import * as THREE from "three";

/**
 * Procedural placeholder prey: a small two-tone box that hops as it runs.
 * Final art (per-biome critters) is deferred — roster sourcing is post-M2.
 */
export class PreyAnimal {
  readonly root = new THREE.Group();
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  private body: THREE.Mesh;
  private head: THREE.Mesh;
  private hopTimer = 0;

  constructor(color = 0xddc285) {
    const bodyGeom = new THREE.BoxGeometry(0.8, 0.5, 0.45);
    const bodyMat = new THREE.MeshLambertMaterial({ color, flatShading: true });
    this.body = new THREE.Mesh(bodyGeom, bodyMat);
    this.body.position.y = 0.3;

    const headGeom = new THREE.BoxGeometry(0.35, 0.35, 0.35);
    const headMat = new THREE.MeshLambertMaterial({
      color: new THREE.Color(color).multiplyScalar(1.1),
      flatShading: true,
    });
    this.head = new THREE.Mesh(headGeom, headMat);
    this.head.position.set(0.45, 0.55, 0);

    this.root.add(this.body);
    this.root.add(this.head);
  }

  setPosition(x: number, y: number, z: number) {
    this.position.set(x, y, z);
    this.root.position.copy(this.position);
  }

  setRunSpeed(vx: number) {
    this.velocity.x = vx;
  }

  update(dt: number) {
    this.position.x += this.velocity.x * dt;
    this.root.position.x = this.position.x;
    this.root.position.z = this.position.z;

    if (Math.abs(this.velocity.x) > 0.1) {
      this.hopTimer += dt;
      const hop = Math.abs(Math.sin(this.hopTimer * 14)) * 0.18;
      this.root.position.y = this.position.y + hop;
      this.root.rotation.y = this.velocity.x >= 0 ? 0 : Math.PI;
    } else {
      this.root.position.y = this.position.y;
    }
  }

  dispose() {
    this.body.geometry.dispose();
    (this.body.material as THREE.Material).dispose();
    this.head.geometry.dispose();
    (this.head.material as THREE.Material).dispose();
  }
}
