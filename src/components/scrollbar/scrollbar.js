/**
 * Minimal scrollbar (pensatori-irrazionali.com): a short track centred on the
 * right edge, measured from the reference (4 × 176 px, 48 px thumb).
 *
 * - Shows while the page scrolls and fades out once it rests.
 * - Shows when a mouse comes near the right edge, or hovers or holds it.
 * - The thumb widens on hover and grows a little more while held; dragging it
 *   scrubs the page, a click on the track glides there.
 * - Its ink follows the background beneath it (`data-nav-tone`).
 *
 * Decorative for assistive tech (aria-hidden): keyboard and native scrolling
 * are untouched; the browser's own bar is hidden in base/global.css.
 */
import { media } from '@/config/breakpoints.js';
import { gsap, ScrollTrigger } from '@/core/gsap.js';
import { scrollTo } from '@/core/scroll.js';
import { toneAt, toneZones } from '@/core/tone.js';

/** Milliseconds the bar lingers after the page stops. */
const LINGER = 1100;
/** Pixels from the right edge that wake the bar for a mouse. */
const EDGE = 64;

export const scrollbar = {
  selector: '[data-scrollbar]',
  mount(element) {
    const track = element.querySelector('[data-scrollbar-track]');
    const thumb = element.querySelector('[data-scrollbar-thumb]');
    const fine = window.matchMedia(media.finePointer);
    const root = document.documentElement;
    let max = 1;
    let travel = 0;
    let lastScroll = -1;
    let lastMove = -Infinity;
    let near = false;
    let hover = false;
    let drag = null;
    let visible = false;

    const measure = () => {
      max = Math.max(root.scrollHeight - window.innerHeight, 1);
      travel = track.offsetHeight - thumb.offsetHeight;
      lastScroll = -1;
    };
    measure();
    ScrollTrigger.addEventListener('refresh', measure);
    window.addEventListener('resize', measure);

    const zones = toneZones(element);
    const setVisible = (on) => {
      if (on === visible) return;
      visible = on;
      element.classList.toggle('is-visible', on);
    };

    const tick = () => {
      const y = window.scrollY;
      const now = performance.now();
      if (y !== lastScroll) {
        // The first frame is the page settling, not someone scrolling.
        if (lastScroll >= 0) lastMove = now;
        lastScroll = y;
        const offset = Math.min(Math.max(y / max, 0), 1) * travel;
        thumb.style.transform = `translate3d(0, ${offset.toFixed(2)}px, 0)`;
        const box = thumb.getBoundingClientRect();
        const tone = toneAt(zones, box.top + box.height / 2);
        if (tone && element.dataset.tone !== tone) element.dataset.tone = tone;
      }
      setVisible(Boolean(drag) || hover || near || now - lastMove < LINGER);
    };
    gsap.ticker.add(tick);

    // ── Pointer ─────────────────────────────────────────
    const onMove = (event) => {
      near =
        fine.matches && event.pointerType === 'mouse' && window.innerWidth - event.clientX < EDGE;
    };
    const onLeaveWindow = () => (near = false);
    const onEnter = () => (hover = true);
    const onLeave = () => (hover = false);

    const onDown = (event) => {
      if (event.button > 0) return;
      event.preventDefault();
      if (event.target !== thumb) {
        // A click on the track glides the page there, thumb centred on the click.
        const box = track.getBoundingClientRect();
        const at = (event.clientY - box.top - thumb.offsetHeight / 2) / travel;
        scrollTo(Math.min(Math.max(at, 0), 1) * max, { duration: 1.2 });
        return;
      }
      drag = { y: event.clientY, scroll: window.scrollY, id: event.pointerId };
      thumb.setPointerCapture(event.pointerId);
      element.classList.add('is-held');
      root.classList.add('is-scrubbing');
    };
    const onDrag = (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      const target = drag.scroll + ((event.clientY - drag.y) / travel) * max;
      scrollTo(Math.min(Math.max(target, 0), max), { immediate: true });
    };
    const onUp = (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      drag = null;
      element.classList.remove('is-held');
      root.classList.remove('is-scrubbing');
      lastMove = performance.now();
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeaveWindow);
    element.addEventListener('pointerenter', onEnter);
    element.addEventListener('pointerleave', onLeave);
    element.addEventListener('pointerdown', onDown);
    thumb.addEventListener('pointermove', onDrag);
    thumb.addEventListener('pointerup', onUp);
    thumb.addEventListener('pointercancel', onUp);

    return () => {
      gsap.ticker.remove(tick);
      ScrollTrigger.removeEventListener('refresh', measure);
      window.removeEventListener('resize', measure);
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeaveWindow);
      element.removeEventListener('pointerenter', onEnter);
      element.removeEventListener('pointerleave', onLeave);
      element.removeEventListener('pointerdown', onDown);
      thumb.removeEventListener('pointermove', onDrag);
      thumb.removeEventListener('pointerup', onUp);
      thumb.removeEventListener('pointercancel', onUp);
      root.classList.remove('is-scrubbing');
    };
  },
};
