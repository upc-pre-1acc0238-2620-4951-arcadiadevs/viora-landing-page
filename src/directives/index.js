/**
 * Directive registry — declarative behaviours bound through data attributes.
 *
 * A directive is `{ selector, mount(element) }`. `mount` may return a cleanup
 * function. Every directive runs inside a gsap.matchMedia context scoped to
 * `motionOk`, so tweens, ScrollTriggers and SplitTexts are reverted
 * automatically when the user switches to reduced motion or on destroy.
 */
import { gsap } from '@/core/gsap.js';
import { media } from '@/config/breakpoints.js';
import { qsa } from '@/utils/dom.js';
import { parallax } from './parallax.js';
import { reveal } from './reveal.js';
import { split } from './split.js';

const registry = [reveal, split, parallax];

export function mountDirectives(root = document) {
  const mm = gsap.matchMedia();

  mm.add(media.motionOk, () => {
    const cleanups = registry.flatMap(({ selector, mount }) =>
      qsa(selector, root).map((element) => mount(element)),
    );
    return () => cleanups.forEach((cleanup) => cleanup?.());
  });

  return () => mm.revert();
}
