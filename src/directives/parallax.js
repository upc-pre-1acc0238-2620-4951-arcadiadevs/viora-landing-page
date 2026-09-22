/**
 * data-parallax="0.2"  Scroll-linked vertical drift. Positive values move slower
 * than the page (background feel), negative values move faster.
 */
import { gsap } from '@/core/gsap.js';
import { ease } from '@/config/motion.js';
import { dataNumber } from '@/utils/dom.js';

export const parallax = {
  selector: '[data-parallax]',

  mount(element) {
    const speed = dataNumber(element, 'parallax', 0.2);

    gsap.fromTo(
      element,
      { yPercent: -speed * 50 },
      {
        yPercent: speed * 50,
        ease: ease.none,
        scrollTrigger: {
          trigger: element.parentElement ?? element,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      },
    );
  },
};
