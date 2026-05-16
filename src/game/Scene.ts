import * as THREE from "three";

export class Scene {
  readonly scene: THREE.Scene;
  readonly renderer: THREE.WebGLRenderer;
  readonly sunLight: THREE.DirectionalLight;
  private resizeHandler: () => void;

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xd4a373);
    this.scene.fog = new THREE.Fog(0xd4a373, 22, 70);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    const ambient = new THREE.AmbientLight(0xffd2a8, 0.65);
    this.scene.add(ambient);

    this.sunLight = new THREE.DirectionalLight(0xfff1c8, 1.25);
    this.sunLight.position.set(8, 14, 6);
    this.scene.add(this.sunLight);

    const rim = new THREE.DirectionalLight(0x7a4a2a, 0.45);
    rim.position.set(-6, 4, -8);
    this.scene.add(rim);

    this.resizeHandler = this.onResize.bind(this);
    window.addEventListener("resize", this.resizeHandler);
  }

  private onResize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  dispose() {
    window.removeEventListener("resize", this.resizeHandler);
    this.renderer.dispose();
  }
}
