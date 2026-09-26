import { media } from '@/config/breakpoints.js';
import { gsap, ScrollTrigger } from '@/core/gsap.js';
import { I18N_BEFORE_CHANGE, I18N_CHANGE } from '@/i18n/index.js';
import { clamp, lerp } from '@/utils/math.js';

/** Pinned choreography, as fractions of the pinned scroll. */
const SCATTER = [0.08, 0.22];
const SETTLE = [0.22, 0.34];
const LINES = [
  [0.34, 0.47],
  [0.46, 0.59],
  [0.58, 0.71],
  [0.7, 0.83],
];

/** Shape → its line, row lift, tilt, constellation spot (fractions of the
 * stage from its centre) and the nudge (in shape widths) it keeps along its
 * line until the words close in on it. */
const BIRDS = {
  olive: { line: 0, lift: 0, tilt: -8, spot: [-0.22, 0.05], nudge: 0.55 },
  thinning: { line: 2, lift: 0, tilt: 7, spot: [0.07, -0.23], nudge: 0.6 },
  yield: { line: 3, lift: 0, tilt: 0, spot: [-0.03, 0.22], nudge: 0.45 },
  chill: { line: 1, lift: 0.14, tilt: 11, spot: [0.2, 0.08], nudge: -0.5 },
  balance: { line: 3, lift: 0.42, tilt: -5, spot: [-0.11, -0.13], nudge: -0.55 },
};

const range = (value, [start, end]) => clamp((value - start) / (end - start), 0, 1);
const smooth = (value) => value * value * (3 - 2 * value);
const inOut = gsap.parseEase('power3.inOut');
const out = gsap.parseEase('power3.out');
const fallEase = gsap.parseEase('power2.inOut');
const square = ({ left, top, width, height }) => ({ x: left, y: top, size: (width + height) / 2 });
const mix = (a, b, t) => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  size: lerp(a.size, b.size, t),
});

/** Wraps the words before the first slot and after the last one, so each half
 * of a line can slide in from its own side. Returns an undo. */
function splitHalves(line) {
  // The spaces beside a slot stay outside the halves: inline-blocks drop them.
  [...line.childNodes].forEach((node) => {
    if (node.nodeType !== Node.TEXT_NODE) return;
    const trailing = node.data.length - node.data.trimEnd().length;
    if (trailing && node.data.trim()) node.splitText(node.data.length - trailing);
    const leading = node.data.length - node.data.trimStart().length;
    if (leading && node.data.trim()) node.splitText(leading);
  });
  const nodes = [...line.childNodes].filter(
    (node) => node.nodeType !== Node.TEXT_NODE || node.data.trim(),
  );
  const slots = nodes.filter((node) => node.classList?.contains('features__slot'));
  const first = nodes.indexOf(slots[0]);
  const last = nodes.indexOf(slots.at(-1));
  const wrap = (group, side) => {
    const half = document.createElement('span');
    half.className = `features__half features__half--${side}`;
    group[0]?.before(half);
    half.append(...group);
    return half;
  };
  const start = wrap(slots.length ? nodes.slice(0, first) : nodes, 'start');
  const end = wrap(slots.length ? nodes.slice(last + 1) : [], 'end');
  return {
    start,
    end,
    undo: () => [start, end].forEach((half) => half.replaceWith(...half.childNodes)),
  };
}

/**
 * Features statement (crency.agency): the five shapes of the intro's About
 * take colour and fall with the page, gather in a row and scatter. They then
 * settle on their own lines just beside their slots, and each line closes in
 * on them — the words before a shape slide in from the left, the words after
 * it from the right — while the shape eases the last few pixels into place.
 *
 * The flock is fixed and interpolated between live rects — the About shapes,
 * a row and a constellation in the sticky stage, and the text slots — so it
 * stays glued to the layout at both ends and while the stage scrolls away.
 */
export const features = {
  selector: '[data-features]',
  mount(element) {
    const motion = gsap.matchMedia();
    motion.add(media.motionOk, () => {
      element.classList.add('features--motion');
      const stage = element.querySelector('[data-features-stage]');
      const lineTexts = [...element.querySelectorAll('[data-features-line]')];
      const intro = document.querySelector('[data-intro]');
      const birds = Object.keys(BIRDS).map((key, index) => ({
        key,
        index,
        ...BIRDS[key],
        element: element.querySelector(`[data-features-bird="${key}"]`),
        colour: element.querySelector(`[data-features-bird="${key}"] .features__bird-color`),
        source: document.querySelector(`[data-intro-shape="${key}"]`),
        slot: null,
      }));

      // Halves and slots are rebuilt whenever the locale rewrites the lines.
      let lines = [];
      const build = () => {
        lines = lineTexts.map((text) => {
          const halves = splitHalves(text);
          return {
            ...halves,
            startX: gsap.quickSetter(halves.start, 'x', 'px'),
            endX: gsap.quickSetter(halves.end, 'x', 'px'),
          };
        });
        birds.forEach((bird) => {
          bird.slot = element.querySelector(`.features__slot[data-shape="${bird.key}"]`);
        });
      };
      const teardown = () => lines.forEach(({ undo }) => undo());
      build();
      document.addEventListener(I18N_BEFORE_CHANGE, teardown);
      document.addEventListener(I18N_CHANGE, build);

      const progress = { fall: 0, pin: 0 };
      const setSources = (hidden) =>
        birds.forEach(({ source }) => source && (source.style.visibility = hidden ? 'hidden' : ''));
      const triggers = [
        ScrollTrigger.create({
          trigger: intro ?? element,
          start: intro ? 'bottom bottom' : 'top bottom',
          endTrigger: stage,
          end: 'top top',
          onUpdate: (self) => (progress.fall = self.progress),
          onRefresh: (self) => (progress.fall = self.progress),
        }),
        ScrollTrigger.create({
          trigger: element,
          start: 'top top',
          end: 'bottom bottom',
          onUpdate: (self) => (progress.pin = self.progress),
          onRefresh: (self) => (progress.pin = self.progress),
        }),
        ScrollTrigger.create({
          trigger: intro ?? element,
          start: intro ? 'bottom bottom' : 'top bottom',
          endTrigger: element,
          end: 'bottom top',
          onToggle: (self) => {
            element.classList.toggle('features--live', self.isActive);
            setSources(self.isActive);
          },
        }),
      ];

      const current = { fall: 0, pin: 0 };
      const tick = (time, deltaMs) => {
        const follow = 1 - Math.exp(-Math.min(deltaMs / 1000, 0.1) * 9);
        current.fall += (progress.fall - current.fall) * follow;
        current.pin += (progress.pin - current.pin) * follow;

        const bounds = stage.getBoundingClientRect();
        const travel = bounds.width * 0.28;
        const arrivals = LINES.map((window) => out(range(current.pin, window)));
        lines.forEach((line, index) => {
          const arrive = arrivals[index];
          const opacity = smooth(Math.min(arrive * 1.6, 1));
          line.startX(-(1 - arrive) * travel);
          line.endX((1 - arrive) * travel);
          line.start.style.opacity = opacity;
          line.end.style.opacity = opacity;
        });
        if (!element.classList.contains('features--live')) return;

        const centre = { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
        const slotSize = birds[0].slot?.getBoundingClientRect().width || 66;
        // The row reads as a set of app icons: larger than the type, never wider than the stage.
        const rowSize = Math.min(slotSize * 1.5, (bounds.width - 32) / 6.4);
        const gap = rowSize * 0.35;
        const rowStart = centre.x - (birds.length * rowSize + (birds.length - 1) * gap) / 2;
        const spread = { x: Math.min(bounds.width, 1100), y: Math.min(bounds.height, 820) };
        const scatter = inOut(range(current.pin, SCATTER));
        const settle = inOut(range(current.pin, SETTLE));
        const colour = smooth(range(current.fall, [0.08, 0.6]));

        birds.forEach((bird) => {
          const { index } = bird;
          const source = bird.source
            ? square(bird.source.getBoundingClientRect())
            : { x: centre.x, y: bounds.bottom, size: rowSize };
          const row = {
            x: rowStart + index * (rowSize + gap),
            y: centre.y - rowSize / 2 + bird.lift * rowSize,
            size: rowSize,
          };
          const spot = {
            x: centre.x + bird.spot[0] * spread.x - rowSize * 0.45,
            y: centre.y + bird.spot[1] * spread.y - rowSize * 0.45,
            size: rowSize * 0.9,
          };
          const slot = bird.slot ? square(bird.slot.getBoundingClientRect()) : spot;
          // Beside its slot on its own line; the nudge closes as the words arrive.
          const arrive = arrivals[bird.line];
          const beside = { ...slot, x: slot.x + bird.nudge * slot.size * (1 - arrive) };
          // Staggered drop, so the flock falls like a handful rather than a block.
          const fall = fallEase(range(current.fall, [index * 0.06, 0.72 + index * 0.06]));

          let box = mix(source, row, fall);
          box = mix(box, spot, scatter);
          box = mix(box, beside, settle);
          const loose = scatter * (1 - settle);
          const drift = Math.sin(time * 1.4 + index * 1.7) * 5 * loose;

          bird.element.style.transform = `translate3d(${box.x}px, ${box.y + drift}px, 0) rotate(${bird.tilt * loose}deg)`;
          bird.element.style.width = `${box.size}px`;
          bird.element.style.height = `${box.size}px`;
          bird.colour.style.opacity = colour;
        });
      };
      gsap.ticker.add(tick);

      return () => {
        gsap.ticker.remove(tick);
        triggers.forEach((trigger) => trigger.kill());
        document.removeEventListener(I18N_BEFORE_CHANGE, teardown);
        document.removeEventListener(I18N_CHANGE, build);
        teardown();
        setSources(false);
        element.classList.remove('features--motion', 'features--live');
        birds.forEach(({ element: bird, colour }) => {
          bird.removeAttribute('style');
          colour.removeAttribute('style');
        });
      };
    });
    return () => motion.revert();
  },
};
