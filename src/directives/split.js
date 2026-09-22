/**
 * data-split="lines|words|chars"  Masked text reveal on scroll.
 * Re-splits automatically on resize/font load (SplitText autoSplit) and
 * rebuilds around language changes so translated text is split correctly.
 */
import { gsap, SplitText } from '@/core/gsap.js';
import { duration, scroll, stagger } from '@/config/motion.js';
import { I18N_BEFORE_CHANGE, I18N_CHANGE } from '@/i18n/index.js';

const types = new Set(['lines', 'words', 'chars']);

export const split = {
  selector: '[data-split]',

  mount(element) {
    const type = types.has(element.dataset.split) ? element.dataset.split : 'lines';
    let hasPlayed = false;

    gsap.set(element, { visibility: 'visible' });

    const create = () =>
      SplitText.create(element, {
        type,
        mask: type,
        autoSplit: true,
        onSplit: (self) => {
          if (hasPlayed) return undefined;
          return gsap.from(self[type], {
            yPercent: 110,
            duration: duration.reveal,
            stagger: type === 'chars' ? stagger.tight : stagger.base,
            scrollTrigger: {
              trigger: element,
              start: scroll.revealStart,
              once: true,
              onEnter: () => (hasPlayed = true),
            },
          });
        },
      });

    let instance = create();
    const onBeforeChange = () => instance.revert();
    const onChange = () => (instance = create());

    document.addEventListener(I18N_BEFORE_CHANGE, onBeforeChange);
    document.addEventListener(I18N_CHANGE, onChange);

    return () => {
      document.removeEventListener(I18N_BEFORE_CHANGE, onBeforeChange);
      document.removeEventListener(I18N_CHANGE, onChange);
      instance.revert();
    };
  },
};
