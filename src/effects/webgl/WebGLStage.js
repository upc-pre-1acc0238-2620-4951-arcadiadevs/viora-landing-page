/**
 * Base class for Three.js effects. Handles renderer setup, DPR capping,
 * responsive sizing, off-screen pausing and teardown. Subclasses implement
 * `setup()` and `update(time, delta)`.
 */
import { PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { gsap } from '@/core/gsap.js';

const MAX_PIXEL_RATIO = 2;

export class WebGLStage {
  constructor(container, { fov = 35, near = 0.1, far = 100 } = {}) {
    this.container = container;
    this.isVisible = false;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    this.renderer = new WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    this.container.append(this.renderer.domElement);

    this.scene = new Scene();
    this.camera = new PerspectiveCamera(fov, 1, near, far);
    this.camera.position.z = 5;

    this.tick = this.tick.bind(this);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.visibilityObserver = new IntersectionObserver(([entry]) => {
      this.isVisible = entry.isIntersecting;
    });

    this.setup();
    this.resize();
    this.resizeObserver.observe(this.container);
    this.visibilityObserver.observe(this.container);
    gsap.ticker.add(this.tick);
  }

  /** Build meshes, materials and uniforms. */
  setup() {}

  /** Per-frame logic. `time` and `delta` are in seconds. */
  update(_time, _delta) {}

  resize() {
    const { clientWidth: width, clientHeight: height } = this.container;
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.onResize(width, height);
  }

  onResize(_width, _height) {}

  tick(time, deltaMs) {
    if (!this.isVisible || document.hidden || this.reducedMotion.matches) return;
    this.update(time, deltaMs / 1000);
    this.render();
  }

  /** Draws a frame; override for multi-pass pipelines. */
  render() {
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    gsap.ticker.remove(this.tick);
    this.resizeObserver.disconnect();
    this.visibilityObserver.disconnect();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
