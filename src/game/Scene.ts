import * as THREE from "three";

export class Scene {
  readonly scene: THREE.Scene;
  readonly renderer: THREE.WebGLRenderer;
  private resizeHandler: () => void;

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a0f08);
    this.scene.fog = new THREE.Fog(0x1a0f08, 25, 80);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.addLights();
    this.addGround();

    this.resizeHandler = this.onResize.bind(this);
    window.addEventListener("resize", this.resizeHandler);
  }

  private addLights() {
    const ambient = new THREE.AmbientLight(0xffd2a8, 0.55);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfff1c8, 1.1);
    sun.position.set(8, 14, 6);
    this.scene.add(sun);

    const rim = new THREE.DirectionalLight(0x6a4a2a, 0.35);
    rim.position.set(-6, 4, -8);
    this.scene.add(rim);
  }

  private addGround() {
    const geometry = new THREE.PlaneGeometry(200, 20, 1, 1);
    const material = new THREE.MeshStandardMaterial({
      color: 0xb37a48,
      roughness: 0.95,
      metalness: 0,
      flatShading: true,
    });
    const ground = new THREE.Mesh(geometry, material);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.name = "ground";
    this.scene.add(ground);
  }

  private onResize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  dispose() {
    window.removeEventListener("resize", this.resizeHandler);
    this.renderer.dispose();
  }
}
