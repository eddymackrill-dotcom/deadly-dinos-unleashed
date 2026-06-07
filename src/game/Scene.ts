import * as THREE from "three";
import type { BiomeConfig } from "../data/biomes";

function hexToInt(hex: string): number {
  return parseInt(hex.replace("#", ""), 16);
}

/** Vertical two-stop gradient as a CanvasTexture for scene.background. */
function makeSkyGradient([top, bottom]: [string, string]): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Scene {
  readonly scene: THREE.Scene;
  readonly renderer: THREE.WebGLRenderer;
  readonly sunLight: THREE.DirectionalLight;
  private ambient: THREE.AmbientLight;
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

    this.ambient = new THREE.AmbientLight(0xffd2a8, 0.65);
    this.scene.add(this.ambient);

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

  /** Apply a biome's sky gradient, fog, and ambient light to the scene. */
  applyBiome(biome: BiomeConfig) {
    const prev = this.scene.background;
    this.scene.background = makeSkyGradient(biome.skyGradient);
    if (prev instanceof THREE.Texture) prev.dispose();
    this.scene.fog = new THREE.Fog(hexToInt(biome.fogColor), biome.fogNear, biome.fogFar);
    this.ambient.color.set(hexToInt(biome.ambientLight.color));
    this.ambient.intensity = biome.ambientLight.intensity;
  }

  dispose() {
    window.removeEventListener("resize", this.resizeHandler);
    this.renderer.dispose();
  }
}
