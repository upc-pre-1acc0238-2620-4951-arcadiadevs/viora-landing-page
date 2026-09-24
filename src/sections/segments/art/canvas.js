import { media } from '@/config/breakpoints.js';
import { gsap } from '@/core/gsap.js';
import { clamp } from '@/utils/math.js';

/** Every illustration draws in a 300 × 300 box (the Figma "Shape Set" slot). */
export const BOX = 300;

export const palette = Object.freeze({
  forest: '#2e4a3a',
  forestDeep: '#1f2c26',
  harvest: '#e8b923',
  terracotta: '#c15a2e',
  clay: '#8f3d1c',
  cream: '#f3f0ea',
  paper: '#fbf8f2',
  olive: '#9aa84a',
  ink: '#1b1916',
});

/** Progress of `t` through the window [start, end], clamped to 0–1. */
export const span = (t, start, end) => clamp((t - start) / (end - start), 0, 1);

export const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
export const easeOut = (x) => 1 - (1 - x) ** 3;
export const easeOutBack = (x) => 1 + 2.4 * (x - 1) ** 3 + 1.4 * (x - 1) ** 2;

export const roundRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
};

/**
 * A closed polar outline: `radius(angle)` gives the edge for each angle.
 * Sampled finely enough that the lobes stay round at 2× DPR.
 */
export const polar = (ctx, cx, cy, radius, rotation = 0, steps = 180) => {
  ctx.beginPath();
  for (let i = 0; i <= steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2;
    const r = radius(angle);
    const x = cx + Math.cos(angle + rotation) * r;
    const y = cy + Math.sin(angle + rotation) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
};

/**
 * Drives one looping canvas illustration. It renders only while the canvas
 * is on screen AND its card is active (rows swap on the pinned stage), keeps
 * its own clock so a paused loop resumes where it stopped, caps DPR at 2 and
 * redraws a single still frame under reduced motion.
 *
 * `draw(ctx, seconds)` paints the 300-unit box; `still` is the moment shown
 * without motion.
 */
export function animateCanvas(canvas, draw, { still = 2 } = {}) {
  const ctx = canvas.getContext('2d');
  const reduced = window.matchMedia(media.reducedMotion);
  let clock = 0;
  let scale = 1;
  let onScreen = false;
  let active = true;
  let running = false;

  const paint = () => {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, BOX, BOX);
    draw(ctx, reduced.matches ? still : clock);
  };

  const resize = () => {
    const size = canvas.clientWidth;
    if (!size) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixels = Math.round(size * dpr);
    if (canvas.width !== pixels || canvas.height !== pixels) {
      canvas.width = pixels;
      canvas.height = pixels;
    }
    scale = pixels / BOX;
    paint();
  };

  const tick = (_time, deltaMs) => {
    clock += Math.min(deltaMs, 50) / 1000;
    paint();
  };

  const sync = () => {
    const should = onScreen && active && !reduced.matches;
    if (should === running) return;
    running = should;
    if (running) gsap.ticker.add(tick);
    else {
      gsap.ticker.remove(tick);
      paint();
    }
  };

  const sizer = new ResizeObserver(resize);
  sizer.observe(canvas);
  const sight = new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    sync();
  });
  sight.observe(canvas);
  reduced.addEventListener('change', sync);

  return {
    setActive(value) {
      active = value;
      sync();
    },
    destroy() {
      gsap.ticker.remove(tick);
      sizer.disconnect();
      sight.disconnect();
      reduced.removeEventListener('change', sync);
    },
  };
}
