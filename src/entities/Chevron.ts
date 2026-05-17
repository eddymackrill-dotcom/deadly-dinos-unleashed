import * as THREE from "three";

const HEIGHT_ABOVE_PLAYER = 1.9;
const TRIANGLE_HALF_WIDTH = 0.28;
const TRIANGLE_HEIGHT = 0.38;
const SCREEN_EDGE_PAD = 0.06; // fraction of half-width to keep clear of edges

/**
 * Floating arrow above the player that points toward a target X position.
 * The arrow lives in screen-space-clamped world coordinates: when the target
 * is off-screen, the arrow rests at the visible edge in the target's
 * direction.
 */
export class Chevron {
  readonly root = new THREE.Group();
  private mesh: THREE.Mesh;
  private material: THREE.MeshBasicMaterial;
  private targetX: number | null = null;
  private pulse = 0;

  constructor() {
    const shape = new THREE.Shape();
    shape.moveTo(0, TRIANGLE_HEIGHT * 0.5);
    shape.lineTo(-TRIANGLE_HALF_WIDTH, -TRIANGLE_HEIGHT * 0.5);
    shape.lineTo(TRIANGLE_HALF_WIDTH, -TRIANGLE_HEIGHT * 0.5);
    shape.closePath();
    const geom = new THREE.ShapeGeometry(shape);
    this.material = new THREE.MeshBasicMaterial({
      color: 0xff7be0,
      transparent: true,
      opacity: 0.92,
      depthTest: false,
      fog: false,
    });
    this.mesh = new THREE.Mesh(geom, this.material);
    this.mesh.renderOrder = 50;
    this.root.add(this.mesh);
    this.root.visible = false;
  }

  setTargetX(x: number | null) {
    this.targetX = x;
    this.root.visible = x !== null;
  }

  /**
   * Update arrow position and rotation.
   * @param playerX  current player world X
   * @param playerY  current player world Y (used for vertical anchor)
   * @param camera   active perspective camera (for screen-edge clamp)
   * @param dt       delta time (for pulse animation)
   */
  update(playerX: number, playerY: number, camera: THREE.PerspectiveCamera, dt: number) {
    if (this.targetX === null) return;

    const dx = this.targetX - playerX;
    const dir = Math.sign(dx) || 1;

    // Half-width of the world plane at the action plane (z=0) for the current camera.
    const distance = Math.abs(camera.position.z);
    const vFov = (camera.fov * Math.PI) / 180;
    const halfHeight = Math.tan(vFov * 0.5) * distance;
    const halfWidth = halfHeight * camera.aspect;
    const screenEdgeX = camera.position.x + dir * halfWidth * (1 - SCREEN_EDGE_PAD);

    const targetOnScreen = Math.abs(this.targetX - camera.position.x) < halfWidth * (1 - SCREEN_EDGE_PAD);
    const anchorX = targetOnScreen ? playerX : screenEdgeX;
    const anchorY = targetOnScreen ? playerY + HEIGHT_ABOVE_PLAYER : camera.position.y;

    this.root.position.set(anchorX, anchorY, 0.1);

    // Rotate so the apex (originally +Y) points toward the target horizontally.
    // For an in-plane arrow this is z-axis rotation: angle between +Y and direction (targetX - anchorX).
    const ax = this.targetX - anchorX;
    const ay = 0; // arrow only ever swings left-right in 2.5D
    const angle = Math.atan2(ax, ay === 0 ? 0.0001 : ay) - 0; // (atan2(dx, dy) with dy~0 -> ±π/2)
    this.mesh.rotation.z = -angle;

    // Subtle pulse to draw attention.
    this.pulse += dt * 3.2;
    const s = 1 + Math.sin(this.pulse) * 0.08;
    this.mesh.scale.set(s, s, 1);
    this.material.opacity = 0.78 + Math.sin(this.pulse) * 0.15;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
