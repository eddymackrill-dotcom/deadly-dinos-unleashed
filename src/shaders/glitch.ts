import type { IUniform } from "three";

export interface GlitchShaderDef {
  uniforms: { tDiffuse: IUniform<null>; uIntensity: IUniform<number> };
  vertexShader: string;
  fragmentShader: string;
}

export const GlitchShader: GlitchShaderDef = {
  uniforms: {
    tDiffuse: { value: null },
    uIntensity: { value: 0.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uIntensity;
    varying vec2 vUv;

    void main() {
      vec2 center = vec2(0.5);
      vec2 dir = vUv - center;
      float r = texture2D(tDiffuse, vUv + dir * uIntensity).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - dir * uIntensity).b;
      gl_FragColor = vec4(r, g, b, 1.0);
    }
  `,
};
