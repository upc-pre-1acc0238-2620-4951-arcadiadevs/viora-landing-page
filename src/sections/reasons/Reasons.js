import { media } from '@/config/breakpoints.js';
import { gsap, ScrollTrigger } from '@/core/gsap.js';
import { animateCanvas } from '@/effects/art/canvas.js';
import { I18N_CHANGE } from '@/i18n/index.js';
import { clamp } from '@/utils/math.js';
import { drawCoop } from './art/coop.js';
import { drawField } from './art/field.js';
import { drawScience } from './art/science.js';
import { H, W } from './art/stage.js';
import { drawWindow } from './art/window.js';

const ARTS = {
  science: [drawScience, 2.4],
  window: [drawWindow, 2.2],
  field: [drawField, 4.4],
  coop: [drawCoop, 1.1],
};

/*
 * Measured on incredibles.dev (1440 × 900, card 438 × 554): each card rides
 * one viewport of scroll. These are its curves sampled every eighth of it —
 * how much of the 90° tilt is left, and how much of the drop.
 */
const TILT = [1, 0.99365, 0.94858, 0.82698, 0.58789, 0.28521, 0.10522, 0.02341, 0.00098, 0];
const DROP = [
  1, 0.99674, 0.97363, 0.9114, 0.78906, 0.58911, 0.33496, 0.16307, 0.0625, 0.01538, 0.00098, 0,
];
/** Reference card height; every distance below is in its pixels. */
const CARD = 554;
const PERSPECTIVE = 400;
const START_Y = 1004;
const START_Z = 750;
/** Landed cards shrink by this much per viewport, down to 1 − 0.125 per card above. */
const SHRINK = 0.1406;
const LANDED = 0.889;
/** Exit: cards lift on a quadratic, the ones underneath starting first. */
const LIFT = 292;
const LIFT_START = 3.5;
const LIFT_STAGGER = 0.14;
/** Pinned scroll, in viewports: four cards, then the lift-off. */
const LENGTH = 5.2;

const sample = (curve, position) => {
  const index = clamp(position * 8, 0, curve.length - 1);
  const low = Math.floor(index);
  const high = Math.min(low + 1, curve.length - 1);
  return curve[low] + (curve[high] - curve[low]) * (index - low);
};

/**
 * Plans lead-in (incredibles.dev). The heading holds in the middle while four
 * cards flip up from behind the viewer onto one stack; those underneath
 * shrink and dim, then the stack lifts away. One scrubbed value (viewports
 * scrolled since the pin) drives every transform.
 */
export const reasons = {
  selector: '[data-reasons]',
  mount(element) {
    const deck = element.querySelector('[data-reasons-deck]');
    const cards = [...element.querySelectorAll('[data-reasons-card]')];
    const shades = cards.map((card) => card.querySelector('[data-reasons-shade]'));
    const title = element.querySelector('[data-reasons-title]');
    const copy = element.querySelector('[data-reasons-copy]');
    const header = element.querySelector('[data-reasons-header]');
    const last = cards.length - 1;
    const cleanups = [];

    const arts = cards.map((card) => {
      const canvas = card.querySelector('[data-reasons-art]');
      const [draw, still] = ARTS[canvas.dataset.reasonsArt];
      return animateCanvas(canvas, draw, { still, width: W, height: H });
    });
    const animate = (front) =>
      arts.forEach((art, index) => art.setActive(front === null || index === front));
    cleanups.push(() => arts.forEach((art) => art.destroy()));

    const motion = gsap.matchMedia();
    motion.add(media.motionOk, () => {
      element.classList.add('reasons--deck');
      let k = 1;

      const measure = () => {
        k = cards[0].offsetHeight / CARD;
        deck.style.perspective = `${PERSPECTIVE * k}px`;
      };

      const render = (v) => {
        let front = null;
        cards.forEach((card, i) => {
          const p = v - i;
          if (p <= 0) {
            card.style.visibility = 'hidden';
            return;
          }
          card.style.visibility = 'visible';
          const tilt = sample(TILT, p);
          const drop = sample(DROP, p);
          const floor = 1 - 0.125 * (last - i);
          const scale = Math.max(floor, 1 - SHRINK * Math.max(0, p - LANDED));
          const lift = LIFT * Math.max(0, v - (LIFT_START + LIFT_STAGGER * i)) ** 2;
          const y = (START_Y * drop - lift) * k;
          const z = START_Z * tilt * k;
          card.style.transform = `translate3d(0, ${y}px, ${z}px) rotateX(${90 * tilt}deg) scale(${scale})`;

          // Each card that lands on this one adds 0.1 of shade.
          let shade = 0;
          for (let j = i + 1; j <= last; j += 1) shade += clamp((v - j - 0.34) / 0.44, 0, 1);
          shades[i].style.opacity = String(shade * 0.1);
          if (p > 0.3) front = i;
        });
        animate(front);

        // Heading: the copy clears for the first card, the title eases back.
        copy.style.opacity = String(1 - clamp((v - 0.25) / 0.35, 0, 1));
        const exit = clamp((v - 4.3) / 0.9, 0, 1);
        gsap.set(title, { scale: 1 - 0.14 * clamp(v / 3.6, 0, 1) - 0.28 * exit });
        header.style.opacity = String(1 - exit);
        deck.style.opacity = String(1 - clamp((v - 4.6) / 0.6, 0, 1));
      };

      const trigger = ScrollTrigger.create({
        trigger: element,
        start: 'top top',
        end: () => `+=${window.innerHeight * LENGTH}`,
        pin: true,
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: (self) => render(self.progress * LENGTH),
        onRefresh: (self) => {
          measure();
          render(self.progress * LENGTH);
        },
      });
      measure();
      render(trigger.progress * LENGTH);

      return () => {
        element.classList.remove('reasons--deck');
        deck.style.perspective = '';
        deck.style.opacity = '';
        header.style.opacity = '';
        copy.style.opacity = '';
        gsap.set([...cards, title], { clearProps: 'transform' });
        cards.forEach((card, i) => {
          card.style.visibility = '';
          shades[i].style.opacity = '';
        });
        animate(null);
      };
    });
    cleanups.push(() => motion.revert());

    const refit = () => ScrollTrigger.refresh();
    document.addEventListener(I18N_CHANGE, refit);
    cleanups.push(() => document.removeEventListener(I18N_CHANGE, refit));

    return () => cleanups.forEach((cleanup) => cleanup());
  },
};
