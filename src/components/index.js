/**
 * Component registry — reusable UI pieces shared across sections and pages
 * (header, menu, video player...). Each component lives in its own folder:
 * src/components/<name>/<Name>.js and exports `{ selector, mount(element) }`.
 */
import { mountAll } from '@/utils/mount.js';

const registry = [
  // header,
];

export const mountComponents = (root = document) => mountAll(registry, root);
