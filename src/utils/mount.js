import { qsa } from '@/utils/dom.js';

/**
 * Mounts every module of a registry on its matching elements.
 * A module is `{ selector, mount(element) }`; `mount` may return a cleanup.
 * Returns a single cleanup that unmounts everything.
 */
export function mountAll(registry, root = document) {
  const cleanups = registry.flatMap(({ selector, mount }) =>
    qsa(selector, root).map((element) => mount(element)),
  );
  return () => cleanups.forEach((cleanup) => cleanup?.());
}
