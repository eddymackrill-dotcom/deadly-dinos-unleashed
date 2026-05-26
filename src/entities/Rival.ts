import * as THREE from "three";
import gsap from "gsap";

/**
 * Procedural placeholder rival predator: a darker, beefier box-and-head shape
 * deliberately distinct from the prey Parasaurolophus. Faces the player on
 * spawn and plays a recoil tween on a correct QTE hit / stagger tween on miss.
 */
export class Rival {
  readonly root = new THREE.Group();
  readonly position = new THREE.Vector3();

  private body: THREE.Mesh;
  private head: THREE.Mesh;
  private tail: THREE.Mesh;
  private materials: THREE.MeshLambertMaterial[] = [];

  constructor() {
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x7a2828, flatShading: true });
    const headMat = new THREE.MeshLambertMaterial({ color: 0x8e3030, flatShading: true });
    const tailMat = new THREE.MeshLambertMaterial({ color: 0x5d1c1c, flatShading: true });
    this.materials.push(bodyMat, headMat, tailMat);

    const bodyGeom = new THREE.BoxGeometry(1.6, 0.9, 0.7);
    this.body = new THREE.Mesh(bodyGeom, bodyMat);
    this.body.position.y = 0.55;

    const headGeom = new THREE.BoxGeometry(0.7, 0.6, 0.5);
    this.head = new THREE.Mesh(headGeom, headMat);
    this.head.position.set(-0.9, 0.85, 0);

    const tailGeom = new THREE.ConeGeometry(0.35, 1.4, 5);
    this.tail = new THREE.Mesh(tailGeom, tailMat);
    this.tail.position.set(1.3, 0.6, 0);
    this.tail.rotation.z = Math.PI / 2;

    this.root.add(this.body, this.head, this.tail);
  }

  setPosition(x: number, y: number, z: number) {
    this.position.set(x, y, z);
    this.root.position.copy(this.position);
  }

  /** Face left (-1) or right (+1) toward the player. */
  setFacing(facing: 1 | -1) {
    this.root.rotation.y = facing === 1 ? Math.PI : 0;
  }

  playRecoil(direction: 1 | -1) {
    gsap.killTweensOf(this.root.position);
    const start = this.position.x;
    gsap
      .timeline()
      .to(this.root.position, {
        x: start + direction * 0.35,
        duration: 0.08,
        ease: "power2.out",
      })
      .to(this.root.position, {
        x: start,
        duration: 0.2,
        ease: "back.out(2)",
      });
  }

  playLunge(direction: 1 | -1) {
    gsap.killTweensOf(this.root.position);
    const start = this.position.x;
    gsap
      .timeline()
      .to(this.root.position, {
        x: start - direction * 0.5,
        duration: 0.09,
        ease: "power2.out",
      })
      .to(this.root.position, {
        x: start,
        duration: 0.25,
        ease: "power1.in",
      });
  }

  dispose() {
    this.body.geometry.dispose();
    this.head.geometry.dispose();
    this.tail.geometry.dispose();
    for (const m of this.materials) m.dispose();
  }
}
