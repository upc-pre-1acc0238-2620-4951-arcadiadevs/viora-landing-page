import {
  Color,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Texture,
  Vector2,
  WebGLRenderTarget,
} from 'three';
import { gsap } from '@/core/gsap.js';
import { INTRO_REVEAL, whenIntro } from '@/core/intro.js';
import { getPreference, PREFERENCES_CHANGE } from '@/core/preferences.js';
import { FluidSimulation } from '../webgl/FluidSimulation.js';
import { WebGLStage } from '../webgl/WebGLStage.js';
import { createDragonflies } from './dragonflies.js';

/** Artwork registration in fractions of the 1536 × 1024 canvas; mirrors hero.css. */
const LAYERS = {
  backing: { order: 0 },
  contours: { order: 1 },
  ground: { order: 2 },
  olives: { order: 3, left: 0.189, top: 0.097, size: 0.81 },
  grower: { order: 5, left: 0.365, top: 0.195, size: 0.6 },
};
// Dragonflies cross in front of the olive boughs, behind the grower.
const FLIGHT_ORDER = 4;
const STRENGTH = 0.022;

const compositeShader = {
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D uScene;
    uniform sampler2D uVelocity;
    uniform vec2 uTexel;
    uniform float uStrength;
    uniform float uShift;
    varying vec2 vUv;
    void main() {
      vec2 velocity = texture2D(uVelocity, vUv).xy * uTexel;
      vec2 offset = velocity * uStrength;
      float amount = clamp(length(offset) * 18.0, 0.0, 1.0);
      vec2 shift = offset * uShift;
      vec2 uv = vUv - offset;
      vec3 color = vec3(
        texture2D(uScene, uv - shift).r,
        texture2D(uScene, uv).g,
        texture2D(uScene, uv + shift).b
      );
      // A faint sheen along the moving front, as light catches bent paper.
      color += amount * amount * 0.035;
      gl_FragColor = vec4(color, 1.0);
    }
  `,
};

/** Hero artwork composited in WebGL so a pointer-driven fluid can bend the
 * whole illustration (paper, contours, foliage, grower and dragonflies).
 * The DOM layers stay as the static and reduced-motion fallback; their GSAP
 * parallax transforms are mirrored here so both paths share one motion source.
 */
export default class HeroScene extends WebGLStage {
  setup() {
    this.camera = new OrthographicCamera(-768, 768, 512, -512, 0.1, 2000);
    this.camera.position.z = 1000;
    this.disposed = false;
    this.planes = [];
    this.scale = 1;
    this.hero = this.container.closest('[data-hero]');
    this.scene.background = new Color('#343328');

    this.target = new WebGLRenderTarget(1, 1, { depthBuffer: false });
    this.fluid = new FluidSimulation(this.renderer);
    this.post = new Scene();
    this.postCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.composite = new ShaderMaterial({
      ...compositeShader,
      uniforms: {
        uScene: { value: this.target.texture },
        uVelocity: { value: this.fluid.texture },
        uTexel: { value: this.fluid.texel },
        uStrength: { value: getPreference('distortion') ? STRENGTH : 0 },
        uShift: { value: 0.12 },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.post.add(new Mesh(new PlaneGeometry(2, 2), this.composite));

    // Listen on window: the fixed navbar floats over the Hero but is not inside it.
    this.pointer = null;
    this.onPointerMove = this.onPointerMove.bind(this);
    window.addEventListener('pointermove', this.onPointerMove, { passive: true });

    // Settings switch: fade the displacement out/in instead of cutting it.
    this.onPreference = ({ detail }) => {
      if (detail.key !== 'distortion') return;
      gsap.to(this.composite.uniforms.uStrength, {
        value: detail.value ? STRENGTH : 0,
        duration: 0.8,
        ease: 'power2.out',
      });
    };
    document.addEventListener(PREFERENCES_CHANGE, this.onPreference);

    this.ready = Promise.all([
      this.createLayers(),
      createDragonflies(this.scene, { renderOrder: FLIGHT_ORDER }).then((flies) => {
        this.flies = flies;
      }),
    ])
      .then(() => {
        if (this.disposed) return;
        this.hero.classList.add('hero--live');
        // The sweep brushes the art while the preloader's window expands.
        whenIntro(INTRO_REVEAL).then(() => !this.disposed && this.intro());
      })
      .catch((error) => {
        this.hero.classList.remove('hero--live');
        console.warn('Hero scene unavailable; using static artwork.', error);
      });

    this.contextLost = (event) => {
      event.preventDefault();
      this.hero.classList.remove('hero--live');
    };
    this.contextRestored = () => {
      if (!this.disposed) this.hero.classList.add('hero--live');
    };
    this.renderer.domElement.addEventListener('webglcontextlost', this.contextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.contextRestored);
  }

  /** Reuses the already-decoded DOM images as textures: no second download. */
  async createLayers() {
    const images = [...this.hero.querySelectorAll('.hero__layer')];
    // `decode()` can stall in background tabs; the GPU upload decodes anyway.
    await Promise.all(
      images.map(
        (image) =>
          image.complete ||
          new Promise((resolve, reject) => {
            image.addEventListener('load', resolve, { once: true });
            image.addEventListener('error', reject, { once: true });
          }),
      ),
    );
    if (this.disposed) return;
    images.forEach((image) => {
      const name = image.src.match(/\/([a-z]+)\.webp$/)?.[1];
      const spec = LAYERS[name];
      if (!spec) return;
      const size = spec.size ?? 1;
      const width = 1536 * size;
      const height = 1024 * size;
      const texture = new Texture(image);
      texture.needsUpdate = true;
      texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      const mesh = new Mesh(
        new PlaneGeometry(width, height),
        new MeshBasicMaterial({
          map: texture,
          transparent: true,
          depthTest: false,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      const x = (spec.left ?? 0) * 1536 + width / 2 - 768;
      const y = 512 - (spec.top ?? 0) * 1024 - height / 2;
      mesh.position.set(x, y, 0);
      mesh.renderOrder = spec.order;
      this.scene.add(mesh);
      this.planes.push({ mesh, texture, image, x, y });
    });
  }

  /** One slow sweep across the scene so the effect announces itself. */
  intro() {
    const sweep = { x: 0.08 };
    let last = sweep.x;
    gsap.to(sweep, {
      x: 0.92,
      duration: 2.4,
      delay: 0.6,
      ease: 'power2.inOut',
      onUpdate: () => {
        if (!getPreference('distortion')) return;
        const y = 0.34 + Math.sin(sweep.x * Math.PI * 1.6) * 0.12;
        this.fluid.splat(sweep.x, y, (sweep.x - last) * 0.55, 0.0015, 5200);
        last = sweep.x;
      },
    });
  }

  onPointerMove(event) {
    const hero = this.hero.getBoundingClientRect();
    const inside =
      event.clientX >= hero.left &&
      event.clientX <= hero.right &&
      event.clientY >= hero.top &&
      event.clientY <= hero.bottom;
    if (!inside || !getPreference('distortion')) {
      this.pointer = null;
      return;
    }
    const bounds = this.container.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = 1 - (event.clientY - bounds.top) / bounds.height;
    if (this.pointer) {
      const dx = x - this.pointer.x;
      const dy = y - this.pointer.y;
      if (dx || dy) this.fluid.splat(x, y, dx, dy);
    }
    this.pointer = new Vector2(x, y);
  }

  onResize(width, height) {
    // Matches the cover crop and 1.035 overscan of the original-pixel DOM planes.
    const scale = Math.max(width / 1536, height / 1024) * 1.035;
    const offset = window.matchMedia('(max-width: 600px)').matches
      ? (1536 - width / scale) * 0.22
      : 0;
    this.scale = scale;
    this.camera.left = -width / scale / 2 + offset;
    this.camera.right = width / scale / 2 + offset;
    this.camera.top = height / scale / 2;
    this.camera.bottom = -height / scale / 2;
    this.camera.updateProjectionMatrix();

    const size = this.renderer.getDrawingBufferSize(new Vector2());
    this.target.setSize(size.x, size.y);
    this.fluid.setSize(width, height);
  }

  update(_time, delta) {
    this.flies?.update(delta);
    // DOM parallax offsets are screen pixels; convert to artwork units.
    this.planes.forEach(({ mesh, image, x, y }) => {
      mesh.position.x = x + gsap.getProperty(image, 'x') / this.scale;
      mesh.position.y = y - gsap.getProperty(image, 'y') / this.scale;
    });
    this.fluid.step(delta);
  }

  render() {
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    this.composite.uniforms.uVelocity.value = this.fluid.texture;
    this.renderer.render(this.post, this.postCamera);
  }

  destroy() {
    this.disposed = true;
    this.hero.classList.remove('hero--live');
    window.removeEventListener('pointermove', this.onPointerMove);
    document.removeEventListener(PREFERENCES_CHANGE, this.onPreference);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.contextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.contextRestored);
    this.flies?.dispose();
    this.planes.forEach(({ mesh, texture }) => {
      mesh.geometry.dispose();
      mesh.material.dispose();
      texture.dispose();
    });
    this.composite.dispose();
    this.post.children[0].geometry.dispose();
    this.fluid.dispose();
    this.target.dispose();
    super.destroy();
  }
}
