/**
 * Section registry — one controller per landing section, in page order.
 * Each section lives in its own folder: src/sections/<name>/<Name>.js
 * and exports `{ selector, mount(element) }`.
 */
import { mountAll } from '@/utils/mount.js';
import { hero } from './hero/Hero.js';
import { cases } from './cases/Cases.js';
import { features } from './features/Features.js';
import { intro } from './intro/Intro.js';
import { modules } from './modules/Modules.js';
import { sky } from './sky/Sky.js';
import { tacna } from './tacna/Tacna.js';

const registry = [hero, intro, features, modules, cases, tacna, sky];

export const mountSections = (root = document) => mountAll(registry, root);
