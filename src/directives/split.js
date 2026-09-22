/**
 * data-split="lines|words|chars"  Masked text reveal on scroll.
 * Re-splits automatically on resize/font load (SplitText autoSplit).
 */
import { gsap, SplitText } from '@/core/gsap.js';
import { duration, scroll, stagger } from '@/config/motion.js';

const types = new Set(['lines', 'words', 'chars']);

export const split = {
  selector: '[data-split]',

  mount(element) {
    const type = types.has(element.dataset.split) ? element.dataset.split : 'lines';

    gsap.set(element, { visibility: 'visible' });

    SplitText.create(element, {
      type,
      mask: type,
      autoSplit: true,
      onSplit: (self) =>
        gsap.from(self[type], {
          yPercent: 110,
          duration: duration.reveal,
          stagger: type === 'chars' ? stagger.tight : stagger.base,
          scrollTrigger: { trigger: element, start: scroll.revealStart, once: true },
        }),
    });
  },
};
