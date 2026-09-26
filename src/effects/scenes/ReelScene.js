import {
  LinearFilter,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  Vector2,
  Vector3,
  VideoTexture,
} from 'three';
import { WebGLStage } from '../webgl/WebGLStage.js';

const vertexShader = /* glsl */ `
  uniform vec2 uViewport;
  uniform vec2 uCenter;
  uniform vec2 uSize;
  uniform float uBend;
  varying vec2 vUv;
  varying float vShade;

  void main() {
    vUv = uv;
    vec2 n = position.xy * 2.0;
    vec2 p = position.xy * uSize;
    float span = max(uSize.x, uSize.y);

    // A sheet caught mid-flight: it swings on Y, sags through its middle and
    // twists along the diagonal, then relaxes flat as uBend returns to 0.
    float z = uBend * span * (
      -0.2 * n.x
      - 0.16 * (1.0 - n.x * n.x)
      + 0.1 * n.x * n.y
    );
    p.x += uBend * n.y * uSize.y * 0.12;
    p.y += uBend * (1.0 - n.x * n.x) * uSize.y * 0.05;

    float focal = uViewport.y * 1.6;
    vec2 screen = uCenter + p * (focal / (focal - z));
    vShade = clamp(-z / span, -0.5, 0.5);
    gl_Position = vec4(screen / (uViewport * 0.5), 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec2 uSize;
  uniform vec2 uCover;
  uniform float uRadius;
  uniform float uBezel;
  uniform float uTint;
  uniform float uDim;
  uniform vec3 uDark;
  uniform vec3 uLight;
  uniform vec3 uDock;
  varying vec2 vUv;
  varying float vShade;

  float roundedBox(vec2 p, vec2 halfSize, float radius) {
    vec2 q = abs(p) - halfSize + radius;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
  }

  void main() {
    vec2 p = (vUv - 0.5) * uSize;
    float outer = roundedBox(p, uSize * 0.5, uRadius);
    float aa = max(fwidth(outer), 0.75);
    float shape = 1.0 - smoothstep(-aa, aa, outer);

    vec2 innerHalf = max(uSize * 0.5 - uBezel, vec2(1.0));
    float inner = roundedBox(p, innerHalf, max(uRadius - uBezel * 0.6, 0.0));
    float media = 1.0 - smoothstep(-aa, aa, inner);

    vec2 uv = (p / (innerHalf * 2.0)) * uCover + 0.5;
    vec3 color = texture2D(uMap, uv).rgb;
    float luma = dot(color, vec3(0.299, 0.587, 0.114));
    vec3 duotone = mix(uDark, uLight, smoothstep(0.04, 0.92, luma));
    color = mix(color, duotone, uTint);
    color *= 1.0 - uDim;

    // Glass bezel: a bright rim outside, a dark lip where it meets the media.
    // Both fade out with the bezel so the full-bleed edge stays clean.
    float glass = smoothstep(0.0, 2.0, uBezel);
    vec3 dock = uDock;
    dock += (1.0 - smoothstep(0.0, 2.2, -outer)) * 0.22 * glass;
    dock -= (1.0 - smoothstep(0.0, 3.0, inner)) * step(0.0, inner) * 0.28 * glass;

    vec3 finalColor = mix(dock, color, media);
    finalColor *= 1.0 - vShade * 0.35;
    gl_FragColor = vec4(finalColor, shape);
  }
`;

const hex = (value) => {
  const n = Number.parseInt(value.slice(1), 16);
  return new Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

/**
 * The intro reel drawn as a bendable sheet. Sections/intro/Intro.js owns the
 * motion and writes the screen's box, radius, bezel, tint, dim and bend into
 * `state`; this scene only mirrors it so the DOM screen stays the fallback.
 */
export default class ReelScene extends WebGLStage {
  constructor(container, { video, state }) {
    super(container);
    this.video = video;
    this.state = state;
    this.build();
    this.resize();
  }

  build() {
    this.renderer.setClearColor(0x000000, 0);

    this.texture = new VideoTexture(this.video);
    this.texture.minFilter = LinearFilter;
    this.texture.magFilter = LinearFilter;
    this.texture.generateMipmaps = false;

    this.uniforms = {
      uMap: { value: this.texture },
      uViewport: { value: new Vector2(1, 1) },
      uCenter: { value: new Vector2() },
      uSize: { value: new Vector2(1, 1) },
      uCover: { value: new Vector2(1, 1) },
      uRadius: { value: 0 },
      uBezel: { value: 0 },
      uBend: { value: 0 },
      uTint: { value: 0 },
      uDim: { value: 0 },
      uDark: { value: hex('#1f2c26') },
      uLight: { value: hex('#e4ecd9') },
      uDock: { value: hex('#bcb8b2') },
    };
    this.mesh = new Mesh(
      new PlaneGeometry(1, 1, 48, 24),
      new ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader,
        fragmentShader,
        transparent: true,
        depthTest: false,
      }),
    );
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);

    this.ready = new Promise((resolve) => {
      if (this.video.readyState >= 2) resolve();
      else this.video.addEventListener('loadeddata', () => resolve(), { once: true });
    });
  }

  onResize(width, height) {
    this.uniforms?.uViewport.value.set(width, height);
  }

  update() {
    if (!this.uniforms) return;
    const { x, y, width, height, radius, bezel, bend, tint, dim } = this.state;
    const { uViewport, uCenter, uSize, uCover } = this.uniforms;
    uSize.value.set(width, height);
    uCenter.value.set(
      x + width / 2 - uViewport.value.x / 2,
      uViewport.value.y / 2 - y - height / 2,
    );
    this.uniforms.uRadius.value = radius;
    this.uniforms.uBezel.value = bezel;
    this.uniforms.uBend.value = bend;
    this.uniforms.uTint.value = tint;
    this.uniforms.uDim.value = dim;

    // object-fit: cover for the media inside the bezel.
    const mediaAspect = (this.video.videoWidth || 16) / (this.video.videoHeight || 9);
    const boxAspect = Math.max(width - bezel * 2, 1) / Math.max(height - bezel * 2, 1);
    if (boxAspect > mediaAspect) uCover.value.set(1, mediaAspect / boxAspect);
    else uCover.value.set(boxAspect / mediaAspect, 1);
  }

  destroy() {
    super.destroy();
    this.texture.dispose();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
