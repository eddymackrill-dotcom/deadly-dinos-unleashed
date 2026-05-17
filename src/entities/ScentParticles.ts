import * as THREE from "three";

const PARTICLE_COUNT = 30;
const LIFE_MIN = 1.4;
const LIFE_MAX = 2.2;
const RISE_SPEED_MIN = 0.6;
const RISE_SPEED_MAX = 1.1;
const SINE_AMPLITUDE = 0.35;
const SINE_FREQ_MIN = 1.6;
const SINE_FREQ_MAX = 2.4;
const EMIT_RADIUS = 0.25;
const PARTICLE_SIZE = 0.42;
const COLOR_A = new THREE.Color(0xa45cf2);
const COLOR_B = new THREE.Color(0xff6ae0);

function makeSpriteTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.45, "rgba(255,255,255,0.55)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

interface Particle {
  age: number;
  life: number;
  baseX: number;
  baseZ: number;
  y: number;
  riseSpeed: number;
  sineFreq: number;
  sinePhase: number;
  color: THREE.Color;
}

/** Soft, additive purple/magenta scent puff drifting upward with sine-wave horizontal motion. */
export class ScentParticles {
  readonly root = new THREE.Group();
  private mesh: THREE.InstancedMesh;
  private texture: THREE.Texture;
  private material: THREE.MeshBasicMaterial;
  private dummy = new THREE.Object3D();
  private particles: Particle[] = [];
  private active = true;

  constructor() {
    this.texture = makeSpriteTexture();
    const geom = new THREE.PlaneGeometry(PARTICLE_SIZE, PARTICLE_SIZE);
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      color: 0xffffff,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    this.mesh = new THREE.InstancedMesh(geom, this.material, PARTICLE_COUNT);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(PARTICLE_COUNT * 3),
      3,
    );
    this.mesh.frustumCulled = false;
    this.root.add(this.mesh);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p: Particle = {
        age: 0,
        life: 0,
        baseX: 0,
        baseZ: 0,
        y: 0,
        riseSpeed: 0,
        sineFreq: 0,
        sinePhase: 0,
        color: new THREE.Color(),
      };
      this.respawn(p, true);
      this.particles.push(p);
    }
  }

  setActive(v: boolean) {
    this.active = v;
    this.mesh.visible = v;
  }

  setPosition(x: number, y: number, z: number) {
    this.root.position.set(x, y, z);
  }

  private respawn(p: Particle, stagger: boolean) {
    const angle = Math.random() * Math.PI * 2;
    p.baseX = Math.cos(angle) * EMIT_RADIUS * Math.random();
    p.baseZ = Math.sin(angle) * EMIT_RADIUS * Math.random();
    p.y = 0;
    p.riseSpeed = RISE_SPEED_MIN + Math.random() * (RISE_SPEED_MAX - RISE_SPEED_MIN);
    p.sineFreq = SINE_FREQ_MIN + Math.random() * (SINE_FREQ_MAX - SINE_FREQ_MIN);
    p.sinePhase = Math.random() * Math.PI * 2;
    p.life = LIFE_MIN + Math.random() * (LIFE_MAX - LIFE_MIN);
    p.age = stagger ? Math.random() * p.life : 0;
    p.color.copy(COLOR_A).lerp(COLOR_B, Math.random());
  }

  update(dt: number, cameraQuaternion: THREE.Quaternion) {
    if (!this.active) return;
    const colorAttr = this.mesh.instanceColor!;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.age += dt;
      if (p.age >= p.life) this.respawn(p, false);

      p.y += p.riseSpeed * dt;
      const xOffset = Math.sin(p.age * p.sineFreq + p.sinePhase) * SINE_AMPLITUDE;

      this.dummy.position.set(p.baseX + xOffset, p.y, p.baseZ);
      this.dummy.quaternion.copy(cameraQuaternion);

      const t = p.age / p.life;
      const fade = Math.sin(Math.PI * t);
      const scale = 0.7 + 0.6 * fade;
      this.dummy.scale.setScalar(scale);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);

      const intensity = fade;
      colorAttr.setXYZ(i, p.color.r * intensity, p.color.g * intensity, p.color.b * intensity);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    colorAttr.needsUpdate = true;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }
}
