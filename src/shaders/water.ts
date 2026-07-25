import * as THREE from "three";

/**
 * Cheap animated river surface: two crossed sine ripples tinting between a deep
 * and a highlight teal, plus a brighter specular streak band. No textures, no
 * extra passes, one draw call per water tile — this has to survive the
 * Chromebook-tier perf floor in CLAUDE.md, so it deliberately stays a handful
 * of ALU ops per fragment.
 */
const vertexShader = /* glsl */ `
  varying vec3 vWorldPos;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uDeepColor;
  uniform vec3 uHighlightColor;
  uniform float uOpacity;
  varying vec3 vWorldPos;

  void main() {
    float ripple =
      sin(vWorldPos.x * 1.3 + uTime * 1.4) * 0.5 +
      sin(vWorldPos.z * 2.1 - uTime * 0.9) * 0.5;
    float t = 0.5 + 0.25 * ripple;
    vec3 color = mix(uDeepColor, uHighlightColor, t);

    // Narrow glint band where the two waves crest together.
    float glint = smoothstep(0.82, 1.0, 0.5 + 0.5 * ripple);
    color += glint * 0.18;

    gl_FragColor = vec4(color, uOpacity);
  }
`;

export interface WaterMaterial extends THREE.ShaderMaterial {
  uniforms: {
    uTime: { value: number };
    uDeepColor: { value: THREE.Color };
    uHighlightColor: { value: THREE.Color };
    uOpacity: { value: number };
  };
}

export function createWaterMaterial(color: THREE.ColorRepresentation): WaterMaterial {
  const deep = new THREE.Color(color);
  const highlight = deep.clone().lerp(new THREE.Color(0xffffff), 0.35);
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDeepColor: { value: deep },
      uHighlightColor: { value: highlight },
      uOpacity: { value: 0.85 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
  }) as WaterMaterial;
}
