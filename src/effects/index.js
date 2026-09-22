/**
 * Effects registry — heavy visual effects (WebGL/Three.js) loaded on demand.
 *
 * Markup: <div data-effect="effect-name"></div>
 * Each loader resolves to a module whose default export is a class extending
 * WebGLStage. Three.js is only downloaded when a page actually uses an effect.
 */
import { media } from '@/config/breakpoints.js';
import { qsa } from '@/utils/dom.js';

const loaders = {
  // 'hero-distortion': () => import('./scenes/HeroDistortion.js'),
};

export async function mountEffects(root = document) {
  if (window.matchMedia(media.reducedMotion).matches) return () => {};

  const instances = await Promise.all(
    qsa('[data-effect]', root).map(async (container) => {
      const load = loaders[container.dataset.effect];
      if (!load) return null;
      const { default: Effect } = await load();
      return new Effect(container);
    }),
  );

  return () => instances.forEach((instance) => instance?.destroy());
}
