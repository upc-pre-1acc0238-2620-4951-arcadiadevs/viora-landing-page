/**
 * Olive oil bottle for the closing CTA (santionispirits.com's drink
 * selection). Everything is procedural and shaded by hand so it stays light:
 * - glass: fluted lathe, fresnel edge and two fake studio softboxes;
 * - oil: an inner lathe cut by a world-space plane that a damped spring tilts
 *   with the bottle's motion (slow and heavy — it is oil, not liqueur); its
 *   back faces draw the surface;
 * - label: a canvas texture wrapped on a band, one per segment;
 * - cap: ribbed metal with a gold ring.
 * The section drives it through `preview`, `swap`, `setEntry` and `nudge`.
 */
import {
  BackSide,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  FrontSide,
  Group,
  LatheGeometry,
  Mesh,
  ShaderMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
} from 'three';
import { gsap } from '@/core/gsap.js';
import { WebGLStage } from '../webgl/WebGLStage.js';

const TAU = Math.PI * 2;

/** Half-profile of the bottle, bottom to lip: [radius, y]. */
const GLASS = [
  [0, -1.95],
  [0.36, -1.95],
  [0.42, -1.92],
  [0.44, -1.84],
  [0.44, 0.42],
  [0.43, 0.56],
  [0.38, 0.74],
  [0.28, 0.9],
  [0.18, 1.02],
  [0.145, 1.12],
  [0.14, 1.52],
  [0.165, 1.55],
  [0.165, 1.64],
  [0.12, 1.66],
];
/** The oil's vessel: the inside of the glass. */
const INSIDE = [
  [0, -1.87],
  [0.36, -1.87],
  [0.405, -1.8],
  [0.405, 0.42],
  [0.395, 0.55],
  [0.35, 0.72],
  [0.25, 0.88],
  [0.15, 1.0],
  [0.108, 1.12],
  [0.105, 1.5],
];
/** Oil level, in the bottle's own space: just into the shoulder. */
const FILL = 0.58;

/** Per segment: oil deep / bright / surface colours, and the label's inks. */
export const SEGMENTS = [
  {
    deep: '#4f5d0a',
    bright: '#b9c53a',
    surface: '#d8dd6a',
    paper: '#f3efe4',
    band: '#2e4a3a',
    ink: '#f3efe4',
    accent: '#e8b923',
  },
  {
    deep: '#8a4d07',
    bright: '#f0b62b',
    surface: '#f7d77a',
    paper: '#f3efe4',
    band: '#1f2c26',
    ink: '#f3efe4',
    accent: '#e8b923',
  },
];

const lathe = (points, segments = 96) =>
  new LatheGeometry(
    points.map(([r, y]) => new Vector2(r, y)),
    segments,
  );

/* Shared GLSL: a studio environment made of two tall softboxes and a floor. */
const STUDIO = /* glsl */ `
  float softbox(vec3 r, float azimuth, float width) {
    float a = atan(r.z, r.x);
    float d = abs(mod(a - azimuth + 3.14159, 6.28318) - 3.14159);
    return smoothstep(width, width * 0.35, d) * smoothstep(-0.6, 0.2, r.y) * smoothstep(1.0, 0.55, r.y);
  }
  float studio(vec3 r) {
    return softbox(r, 2.35, 0.34) * 1.0 + softbox(r, 0.55, 0.22) * 0.7 + smoothstep(0.6, 1.0, r.y) * 0.25;
  }
`;

const glassVertex = /* glsl */ `
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying vec3 vLocal;
  void main() {
    vLocal = position;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const glassFragment = /* glsl */ `
  uniform vec3 uTint;
  uniform float uBack;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying vec3 vLocal;
  ${STUDIO}
  void main() {
    vec3 n = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
    // Flutes on the body: bend the normal around the bottle.
    float body = smoothstep(-1.8, -1.7, vLocal.y) * smoothstep(0.5, 0.35, vLocal.y);
    float angle = atan(vLocal.z, vLocal.x);
    vec3 around = normalize(vec3(-sin(angle), 0.0, cos(angle)));
    n = normalize(n + around * sin(angle * 36.0) * 0.22 * body);
    vec3 view = normalize(cameraPosition - vWorld);
    float facing = clamp(dot(n, view), 0.0, 1.0);
    float fresnel = pow(1.0 - facing, 3.0);
    vec3 r = reflect(-view, n);
    float light = studio(r);
    float alpha = mix(0.05, 0.55, fresnel) + light * 0.55;
    vec3 color = uTint + light * 1.1 + fresnel * 0.25;
    gl_FragColor = vec4(color, alpha * uBack);
  }
`;

const oilVertex = /* glsl */ `
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying vec3 vLocal;
  void main() {
    vLocal = position;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const oilFragment = /* glsl */ `
  uniform vec3 uDeep;
  uniform vec3 uBright;
  uniform vec3 uSurface;
  uniform vec3 uFillPoint;
  uniform vec2 uWobble;
  uniform float uTime;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying vec3 vLocal;
  ${STUDIO}
  void main() {
    // The surface: a world-space plane through the fill point, tilted by the slosh.
    vec3 plane = normalize(vec3(uWobble.x, 1.0, uWobble.y));
    float ripple = sin(vWorld.x * 9.0 + uTime * 1.6) * sin(vWorld.z * 7.0 - uTime * 1.2) * 0.012;
    if (dot(vWorld - uFillPoint, plane) > ripple) discard;

    vec3 view = normalize(cameraPosition - vWorld);
    if (!gl_FrontFacing) {
      // Looking at the inside of the far wall above the level = the oil's top.
      float glint = pow(max(dot(reflect(-view, plane), normalize(vec3(-0.5, 0.8, 0.4))), 0.0), 24.0);
      gl_FragColor = vec4(uSurface + glint * 0.6, 0.96);
      return;
    }
    vec3 n = normalize(vNormal);
    float facing = clamp(dot(n, view), 0.0, 1.0);
    // Thin at the rim, thick in the middle: light passes through the edges.
    float thickness = facing;
    float depth = smoothstep(-1.9, 0.6, vLocal.y);
    vec3 color = mix(uBright, uDeep, thickness * 0.85);
    color = mix(color * 0.78, color, depth);
    // Backlight glow and a slow internal shimmer, like light through oil.
    float shimmer = sin(vLocal.y * 6.0 + uTime * 0.7 + atan(vLocal.z, vLocal.x) * 2.0) * 0.5 + 0.5;
    color += uBright * (1.0 - thickness) * 0.55 + uBright * shimmer * 0.06;
    color += studio(reflect(-view, n)) * 0.35;
    gl_FragColor = vec4(color, 0.94);
  }
`;

const capFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uRing;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying vec3 vLocal;
  ${STUDIO}
  void main() {
    vec3 n = normalize(vNormal);
    float angle = atan(vLocal.z, vLocal.x);
    vec3 around = normalize(vec3(-sin(angle), 0.0, cos(angle)));
    float knurl = step(1.62, vLocal.y) * step(vLocal.y, 1.93);
    n = normalize(n + around * sin(angle * 90.0) * 0.35 * knurl);
    vec3 view = normalize(cameraPosition - vWorld);
    float ring = step(1.545, vLocal.y) * step(vLocal.y, 1.6);
    vec3 base = mix(uColor, uRing, ring);
    float diffuse = 0.55 + 0.45 * max(dot(n, normalize(vec3(-0.6, 0.7, 0.8))), 0.0);
    vec3 color = base * diffuse + studio(reflect(-view, n)) * mix(0.35, 0.9, ring);
    gl_FragColor = vec4(color, 1.0);
  }
`;

const labelFragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform sampler2D uNext;
  uniform float uSwap;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorld;
  void main() {
    if (!gl_FrontFacing) {
      gl_FragColor = vec4(0.82, 0.8, 0.74, 1.0);
      return;
    }
    vec4 ink = mix(texture2D(uMap, vUv), texture2D(uNext, vUv), uSwap);
    vec3 view = normalize(cameraPosition - vWorld);
    vec3 n = normalize(vNormal);
    float diffuse = 0.82 + 0.3 * max(dot(n, normalize(vec3(-0.5, 0.4, 0.9))), 0.0);
    float edge = pow(1.0 - clamp(dot(n, view), 0.0, 1.0), 2.0);
    gl_FragColor = vec4(ink.rgb * diffuse * (1.0 - edge * 0.35), 1.0);
    #include <colorspace_fragment>
  }
`;

const labelVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

/** Draws one label (canvas → texture). `text` holds the translated lines. */
export function paintLabel(canvas, look, text, mark) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  ctx.fillStyle = look.paper;
  ctx.fillRect(0, 0, w, h);
  // The band carries the brand; thin rules frame it, like a pharmacy label.
  ctx.fillStyle = look.band;
  ctx.fillRect(0, h * 0.2, w, h * 0.6);
  ctx.strokeStyle = look.accent;
  ctx.lineWidth = 4;
  for (const y of [0.24, 0.76]) {
    ctx.beginPath();
    ctx.moveTo(0, h * y);
    ctx.lineTo(w, h * y);
    ctx.stroke();
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = look.ink;
  ctx.font = `${h * 0.3}px "The Foriene Serif", Georgia, serif`;
  ctx.fillText('Viora', w / 2, h * 0.47);
  ctx.font = `600 ${h * 0.055}px Axiforma, sans-serif`;
  ctx.fillStyle = look.accent;
  ctx.fillText(text.kind.toUpperCase(), w / 2, h * 0.67);
  ctx.fillStyle = look.band;
  ctx.font = `500 ${h * 0.05}px Axiforma, sans-serif`;
  ctx.fillText(text.top.toUpperCase(), w / 2, h * 0.1);
  ctx.fillText(text.bottom.toUpperCase(), w / 2, h * 0.9);
  if (mark) {
    const size = h * 0.14;
    for (const x of [w * 0.28, w * 0.72])
      ctx.drawImage(mark, x - size, h * 0.45 - size * 0.6, size * 2, size * 1.2);
  }
  // Side panel: a small batch box, readable as the bottle turns.
  ctx.fillStyle = look.band;
  ctx.font = `500 ${h * 0.04}px Axiforma, sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText(text.batch.toUpperCase(), w * 0.03, h * 0.1);
  ctx.textAlign = 'right';
  ctx.fillText('500 ML', w * 0.97, h * 0.1);
}

export default class BottleScene extends WebGLStage {
  constructor(container) {
    super(container, { fov: 30 });
  }

  setup() {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));

    this.bottle = new Group();
    this.scene.add(this.bottle);

    this.state = {
      spin: 0, // turntable + swaps (radians)
      tilt: 0, // lean while dragged or swapping
      shift: 0, // sideways offset while dragged
      entry: 0, // 0 below the stage → 1 in place
      drag: 0, // −1…1 while the pointer pulls the bottle
    };
    this.from = 0;
    this.to = 0;
    this.drift = 0;

    // Slosh: a damped spring per axis, driven by the bottle's accelerations.
    this.wobble = new Vector2();
    this.wobbleSpeed = new Vector2();
    this.previous = { x: 0, tilt: 0, y: 0 };
    this.velocity = { x: 0, tilt: 0, y: 0 };
    this.kick = 0;

    const glassBack = new ShaderMaterial({
      vertexShader: glassVertex,
      fragmentShader: glassFragment,
      uniforms: { uTint: { value: new Color('#dfe7d6') }, uBack: { value: 0.55 } },
      transparent: true,
      depthWrite: false,
      side: BackSide,
    });
    const glassFront = glassBack.clone();
    glassFront.side = FrontSide;
    glassFront.uniforms.uBack.value = 1;

    this.oil = new ShaderMaterial({
      vertexShader: oilVertex,
      fragmentShader: oilFragment,
      uniforms: {
        uDeep: { value: new Color(SEGMENTS[0].deep) },
        uBright: { value: new Color(SEGMENTS[0].bright) },
        uSurface: { value: new Color(SEGMENTS[0].surface) },
        uFillPoint: { value: new Vector3() },
        uWobble: { value: this.wobble },
        uTime: { value: 0 },
      },
      transparent: true,
      side: DoubleSide,
    });

    const glassGeometry = lathe(GLASS, 128);
    const back = new Mesh(glassGeometry, glassBack);
    const oil = new Mesh(lathe(INSIDE, 96), this.oil);
    const front = new Mesh(glassGeometry, glassFront);
    back.renderOrder = 1;
    oil.renderOrder = 2;
    front.renderOrder = 4;

    // Cap: knurled metal over the lip, with a gold ring at its skirt.
    this.cap = new Mesh(
      lathe(
        [
          [0, 1.95],
          [0.17, 1.95],
          [0.195, 1.93],
          [0.2, 1.62],
          [0.215, 1.6],
          [0.215, 1.545],
          [0.19, 1.54],
        ],
        96,
      ),
      new ShaderMaterial({
        vertexShader: glassVertex,
        fragmentShader: capFragment,
        uniforms: {
          uColor: { value: new Color('#23302a') },
          uRing: { value: new Color('#c9a23a') },
        },
      }),
    );
    this.cap.renderOrder = 5;

    // Label: 200° of the body, facing the camera at rest.
    this.labelCanvases = [0, 1].map(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 2048;
      canvas.height = 700;
      return canvas;
    });
    this.labelTextures = this.labelCanvases.map((canvas) => {
      const texture = new CanvasTexture(canvas);
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = 8;
      return texture;
    });
    this.label = new Mesh(
      // Centred on +z (theta 0), so the brand faces the camera at rest.
      new CylinderGeometry(0.447, 0.447, 0.86, 96, 1, true, -Math.PI * 0.55, Math.PI * 1.1),
      new ShaderMaterial({
        vertexShader: labelVertex,
        fragmentShader: labelFragment,
        uniforms: {
          uMap: { value: this.labelTextures[0] },
          uNext: { value: this.labelTextures[1] },
          uSwap: { value: 0 },
        },
        side: DoubleSide,
      }),
    );
    this.label.position.y = -0.62;
    this.label.renderOrder = 3;

    this.bottle.add(back, oil, this.label, front, this.cap);
    this.fillPoint = new Vector3();
    this.dirty = true;
  }

  /** Paints both labels; call again after a language change. */
  paint(texts, mark) {
    this.labelCanvases.forEach((canvas, i) => paintLabel(canvas, SEGMENTS[i], texts[i], mark));
    this.labelTextures.forEach((texture) => (texture.needsUpdate = true));
    this.dirty = true;
  }

  onResize(width, height) {
    // Fit the 3.9-unit bottle to ~70% of the height (or the width on tall screens),
    // sitting a touch high so the foot row stays clear.
    const fit = 3.9 / 0.7 / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    const narrow = Math.max(1, (0.42 * height) / width);
    this.camera.position.set(0, -0.5, fit * narrow ** 0.5);
    this.dirty = true;
  }

  /** Dragging: `amount` in −1…1, before the swap is decided. */
  preview(amount) {
    gsap.to(this.state, { drag: amount, duration: 0.45, ease: 'power3.out', overwrite: 'auto' });
  }

  /** Turns the bottle over to segment `index`, spinning towards `direction`. */
  swap(index, direction = 1) {
    gsap.to(this.state, { drag: 0, duration: 0.6, ease: 'power3.out', overwrite: 'auto' });
    const blend = this.oil.uniforms;
    const from = SEGMENTS[this.to];
    const to = SEGMENTS[index];
    const colors = { k: 0 };
    const a = {
      deep: new Color(from.deep),
      bright: new Color(from.bright),
      surface: new Color(from.surface),
    };
    const b = {
      deep: new Color(to.deep),
      bright: new Color(to.bright),
      surface: new Color(to.surface),
    };
    this.label.material.uniforms.uMap.value = this.labelTextures[this.to];
    this.label.material.uniforms.uNext.value = this.labelTextures[index];
    this.label.material.uniforms.uSwap.value = 0;
    this.to = index;
    const timeline = gsap.timeline();
    timeline
      .to(this.state, {
        spin: Math.round(this.state.spin / TAU) * TAU + direction * TAU,
        duration: 1.5,
        ease: 'power3.inOut',
      })
      .to(
        this.state,
        { tilt: -direction * 0.5, shift: direction * 0.4, duration: 0.55, ease: 'power2.out' },
        0,
      )
      .to(this.state, { tilt: 0, shift: 0, duration: 0.95, ease: 'back.out(1.6)' }, 0.55)
      // The label turns while its back faces the camera.
      .to(this.label.material.uniforms.uSwap, { value: 1, duration: 0.2, ease: 'none' }, 0.65)
      .to(
        colors,
        {
          k: 1,
          duration: 0.8,
          ease: 'power1.inOut',
          onUpdate: () => {
            blend.uDeep.value.copy(a.deep).lerp(b.deep, colors.k);
            blend.uBright.value.copy(a.bright).lerp(b.bright, colors.k);
            blend.uSurface.value.copy(a.surface).lerp(b.surface, colors.k);
          },
        },
        0.35,
      );
    this.kick = direction;
    return timeline;
  }

  /** 0 → 1 as the section scrolls in: the bottle rises into place. */
  setEntry(value) {
    this.state.entry = value;
    this.dirty = true;
  }

  /** Jumps straight to a segment (reduced motion, language change). */
  show(index) {
    const look = SEGMENTS[index];
    this.to = index;
    this.oil.uniforms.uDeep.value.set(look.deep);
    this.oil.uniforms.uBright.value.set(look.bright);
    this.oil.uniforms.uSurface.value.set(look.surface);
    this.label.material.uniforms.uMap.value = this.labelTextures[index];
    this.label.material.uniforms.uSwap.value = 0;
    this.dirty = true;
  }

  /** Scroll speed and the like: a push to the oil. */
  nudge(amount) {
    this.wobbleSpeed.y += amount;
  }

  update(time, delta) {
    const dt = Math.min(delta, 1 / 30);
    const { state } = this;
    // A slow sway rather than a full turn: the label keeps facing out.
    this.drift = Math.sin(time * 0.45) * 0.42;

    const rise = 1 - state.entry;
    const y = -rise * 4.2 + Math.sin(time * 0.9) * 0.04;
    const shift = state.shift + state.drag * 0.55;
    const tilt = state.tilt - state.drag * 0.42;
    this.bottle.position.set(shift, y, 0);
    this.bottle.rotation.set(0, state.spin + this.drift + state.drag * 0.9, tilt + rise * 0.35);
    this.bottle.updateMatrixWorld();

    // Accelerations push the oil; the spring brings it back, slowly — oil is heavy.
    const vx = (shift - this.previous.x) / dt;
    const vt = (tilt - this.previous.tilt) / dt;
    const vy = (y - this.previous.y) / dt;
    const ax = (vx - this.velocity.x) / dt;
    const at = (vt - this.velocity.tilt) / dt;
    const ay = (vy - this.velocity.y) / dt;
    this.previous = { x: shift, tilt, y };
    this.velocity = { x: vx, tilt: vt, y: vy };
    const force = new Vector2(
      -ax * 0.02 + at * 0.018 + this.kick * 0.9,
      Math.sin(time * 0.6) * 0.02 - ay * 0.004,
    );
    this.kick = 0;
    const stiffness = 26;
    const damping = 2.6;
    this.wobbleSpeed.x += (force.x - this.wobble.x * stiffness - this.wobbleSpeed.x * damping) * dt;
    this.wobbleSpeed.y += (force.y - this.wobble.y * stiffness - this.wobbleSpeed.y * damping) * dt;
    this.wobble.x = Math.max(-0.7, Math.min(0.7, this.wobble.x + this.wobbleSpeed.x * dt));
    this.wobble.y = Math.max(-0.7, Math.min(0.7, this.wobble.y + this.wobbleSpeed.y * dt));

    this.fillPoint.set(0, FILL, 0);
    this.bottle.localToWorld(this.fillPoint);
    this.oil.uniforms.uFillPoint.value.copy(this.fillPoint);
    this.oil.uniforms.uTime.value = time;
  }

  /** Reduced motion: no loop, but still one correct frame whenever it changes. */
  tick(time, deltaMs) {
    if (!this.isVisible || document.hidden) return;
    if (this.reducedMotion.matches) {
      if (!this.dirty) return;
      this.state.entry = 1;
      this.update(0, 1 / 60);
      this.render();
      this.dirty = false;
      return;
    }
    this.update(time, deltaMs / 1000);
    this.render();
  }
}
