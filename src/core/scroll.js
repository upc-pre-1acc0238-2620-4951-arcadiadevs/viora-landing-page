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

/**
 * In-page anchors scroll smoothly and move focus to their target (a11y).
 * Hashes that point to a <dialog> are left to the browser so the dialog
 * component can react to `hashchange`.
 */
function onAnchorClick(event) {
  const link = event.target.closest('a[href^="#"]');
  const target = link && document.getElementById(link.hash.slice(1));
  if (!target || target instanceof HTMLDialogElement) return;

  event.preventDefault();
  lenis.scrollTo(target);
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
}

export function initSmoothScroll() {
  if (lenis || window.matchMedia(media.reducedMotion).matches) return lenis;

  lenis = new Lenis({
    lerp: scrollConfig.lerp,
    wheelMultiplier: scrollConfig.wheelMultiplier,
  });

  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(raf);
  gsap.ticker.lagSmoothing(0);
  document.addEventListener('click', onAnchorClick);

  return lenis;
}

export function destroySmoothScroll() {
  if (!lenis) return;
  document.removeEventListener('click', onAnchorClick);
  gsap.ticker.remove(raf);
  lenis.destroy();
  lenis = null;
}

export function scrollTo(target, options = {}) {
  if (lenis) {
    lenis.scrollTo(target, options);
    return;
  }
  if (typeof target === 'number') {
    window.scrollTo({ top: target, behavior: 'auto' });
    return;
  }
  const element = typeof target === 'string' ? document.querySelector(target) : target;
  element?.scrollIntoView?.({ behavior: 'auto' });
}

export const stopScroll = () => lenis?.stop();
export const startScroll = () => lenis?.start();
