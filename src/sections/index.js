/**
 * Section registry — one controller per landing section, in page order.
 * Each section lives in its own folder: src/sections/<name>/<Name>.js
 * and exports `{ selector, mount(element) }`.
 */
import { mountAll } from '@/utils/mount.js';
import { hero } from './hero/Hero.js';
import { intro } from './intro/Intro.js';

const registry = [hero, intro];

export const mountSections = (root = document) => mountAll(registry, root);
