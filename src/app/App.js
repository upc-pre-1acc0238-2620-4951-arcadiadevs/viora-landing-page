/**
 * Application lifecycle: boots every layer in dependency order and tears it
 * down symmetrically (used by Vite HMR).
 *
 * The preloader covers the page while fonts, Hero artwork and the WebGL scene
 * load; scroll-driven directives mount once it starts revealing the page so
 * their entrances play in view instead of behind the curtain.
 */
import { mountComponents } from '@/components/index.js';
import { mountPreloader } from '@/components/preloader/preloader.js';
import { ScrollTrigger } from '@/core/gsap.js';
import { INTRO_REVEAL, whenIntro } from '@/core/intro.js';
import { destroySmoothScroll, initSmoothScroll } from '@/core/scroll.js';
import { initSound } from '@/core/sound.js';
import { mountDirectives } from '@/directives/index.js';
import { mountEffects } from '@/effects/index.js';
import { initI18n } from '@/i18n/index.js';
import { mountSections } from '@/sections/index.js';

export class App {
  #cleanups = [];
  #alive = false;

  async init() {
    this.#alive = true;
    initI18n();
    initSmoothScroll();

    this.#cleanups.push(initSound(), mountComponents(), mountSections());

    // Effects start loading right away; the preloader waits for their textures.
    const effects = document.fonts.ready.then(() => mountEffects());
    this.#cleanups.push(mountPreloader({ ready: [effects.then((cleanup) => cleanup.ready)] }));

    // Text splitting and layout-based triggers need final font metrics.
    await Promise.all([document.fonts.ready, whenIntro(INTRO_REVEAL)]);
    if (!this.#alive) return;
    this.#cleanups.push(mountDirectives());
    ScrollTrigger.refresh();

    const destroyEffects = await effects;
    if (this.#alive) this.#cleanups.push(destroyEffects);
    else destroyEffects();
  }

  destroy() {
    this.#alive = false;
    this.#cleanups.reverse().forEach((cleanup) => cleanup?.());
    this.#cleanups = [];
    destroySmoothScroll();
  }
}
