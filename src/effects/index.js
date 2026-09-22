/**
 * Effects registry — heavy visual effects (WebGL/Three.js) loaded on demand.
 *
 * Markup: <div data-effect="effect-name"></div>
 * Each loader resolves to a module whose default export is a class extending
 * WebGLStage. Three.js is only downloaded when a page actually uses an effect.
 *
 * The returned cleanup carries `ready`: a promise that settles once every
 * scene has its textures on the GPU (the preloader waits for it).
 */
import { media } from '@/config/breakpoints.js';
import { qsa } from '@/utils/dom.js';

const loaders = {
  'hero-scene': () => import('./scenes/HeroScene.js'),
};

export async function mountEffects(root = document) {
  if (window.matchMedia(media.reducedMotion).matches) {
    return Object.assign(() => {}, { ready: Promise.resolve() });
  }

  const instances = await Promise.all(
    qsa('[data-effect]', root).map(async (container) => {
      const load = loaders[container.dataset.effect];
      if (!load) return null;
      try {
        const { default: Effect } = await load();
        return new Effect(container);
      } catch (error) {
        // The original artwork remains visible if WebGL is unavailable.
        console.warn('Visual effect unavailable; using static artwork.', error);
        return null;
      }
    }),
  );

  const cleanup = () => instances.forEach((instance) => instance?.destroy());
  return Object.assign(cleanup, {
    ready: Promise.allSettled(instances.map((instance) => instance?.ready)),
  });
}
