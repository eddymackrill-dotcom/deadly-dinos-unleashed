import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { GlitchShader } from "../shaders/glitch";

export class PostProcess {
  private composer: EffectComposer;
  readonly glitchPass: ShaderPass;
  private resizeHandler: () => void;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.glitchPass = new ShaderPass(GlitchShader);
    this.composer.addPass(this.glitchPass);
    this.composer.addPass(new OutputPass());
    this.setSize(window.innerWidth, window.innerHeight);

    this.resizeHandler = () => this.setSize(window.innerWidth, window.innerHeight);
    window.addEventListener("resize", this.resizeHandler);
  }

  setSize(w: number, h: number) {
    this.composer.setSize(w, h);
    this.composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  render() {
    this.composer.render();
  }

  get glitchIntensity(): { value: number } {
    return this.glitchPass.uniforms["uIntensity"];
  }

  dispose() {
    window.removeEventListener("resize", this.resizeHandler);
    this.composer.dispose();
  }
}
