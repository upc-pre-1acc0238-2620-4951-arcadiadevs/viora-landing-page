/**
 * Application lifecycle: boots every layer in dependency order and tears it
 * down symmetrically (used by Vite HMR).
 */
import { mountComponents } from '@/components/index.js';
import { ScrollTrigger } from '@/core/gsap.js';
import { destroySmoothScroll, initSmoothScroll } from '@/core/scroll.js';
import { mountDirectives } from '@/directives/index.js';
import { mountEffects } from '@/effects/index.js';
import { initI18n } from '@/i18n/index.js';
import { mountSections } from '@/sections/index.js';

export class App {
  #cleanups = [];

  async init() {
    initI18n();
    initSmoothScroll();

    this.#cleanups.push(mountComponents(), mountSections());

    // Text splitting and layout-based triggers need final font metrics.
    await document.fonts.ready;
    this.#cleanups.push(mountDirectives(), await mountEffects());

    ScrollTrigger.refresh();
  }

  destroy() {
    this.#cleanups.reverse().forEach((cleanup) => cleanup?.());
    this.#cleanups = [];
    destroySmoothScroll();
  }
}
