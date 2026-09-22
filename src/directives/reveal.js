/**
 * data-reveal="up|fade"   Fades an element in when it enters the viewport.
 * data-reveal-delay="0.2" Optional delay in seconds.
 */
import { gsap } from '@/core/gsap.js';
import { duration, scroll } from '@/config/motion.js';
import { dataNumber } from '@/utils/dom.js';

const offsets = { up: 40, fade: 0 };

export const reveal = {
  selector: '[data-reveal]',

  mount(element) {
    const y = offsets[element.dataset.reveal] ?? offsets.up;

    gsap.fromTo(
      element,
      { autoAlpha: 0, y },
      {
        autoAlpha: 1,
        y: 0,
        duration: duration.reveal,
        delay: dataNumber(element, 'revealDelay', 0),
        scrollTrigger: { trigger: element, start: scroll.revealStart, once: true },
      },
    );
  },
};
