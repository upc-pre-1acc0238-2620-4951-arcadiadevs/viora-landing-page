/**
 * Smooth scroll (Lenis) driven by the GSAP ticker and synced with ScrollTrigger.
 * Disabled when the user prefers reduced motion — native scroll is used instead.
 */
import Lenis from 'lenis';
import { gsap, ScrollTrigger } from '@/core/gsap.js';
import { media } from '@/config/breakpoints.js';
import { scroll as scrollConfig } from '@/config/motion.js';

let lenis = null;

const raf = (time) => lenis?.raf(time * 1000);

export function initSmoothScroll() {
  if (lenis || window.matchMedia(media.reducedMotion).matches) return lenis;

  lenis = new Lenis({
    lerp: scrollConfig.lerp,
    wheelMultiplier: scrollConfig.wheelMultiplier,
    anchors: { offset: 0 },
  });

  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(raf);
  gsap.ticker.lagSmoothing(0);

  return lenis;
}

export function destroySmoothScroll() {
  if (!lenis) return;
  gsap.ticker.remove(raf);
  lenis.destroy();
  lenis = null;
}

export function scrollTo(target, options = {}) {
  if (lenis) {
    lenis.scrollTo(target, options);
    return;
  }
  const element = typeof target === 'string' ? document.querySelector(target) : target;
  element?.scrollIntoView?.({ behavior: 'auto' });
}

export const stopScroll = () => lenis?.stop();
export const startScroll = () => lenis?.start();
