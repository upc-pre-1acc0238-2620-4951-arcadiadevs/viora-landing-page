import { media } from '@/config/breakpoints.js';
import { gsap, ScrollTrigger } from '@/core/gsap.js';

/** Wave between the cream title and the forest band, in its 1440 × 160 box. */
function wavePath(t) {
  const amplitude = 42 * (1 - 0.45 * t);
  const phase = Math.PI * (0.35 + 1.1 * t);
  const points = Array.from({ length: 33 }, (_, i) => {
    const x = (1440 * i) / 32;
    const y = 88 + amplitude * Math.sin((2 * Math.PI * x) / 1700 + phase) - 30 * t;
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  return `M${points.join('L')}V160H0Z`;
}

/**
 * Modules (crency.agency): the forest band rises on a wave under the title
 * and the lead card spins once around its vertical axis as it drops from
 * just below the title into the row; the other cards rise from beneath.
 * The lead is the centre card, or the first one when the cards stack.
 */
export const modules = {
  selector: '[data-modules]',
  mount(element) {
    const motion = gsap.matchMedia();
    motion.add(media.motionOk, () => {
      const head = element.querySelector('.modules__head');
      const body = element.querySelector('.modules__body');
      const list = element.querySelector('[data-modules-cards]');
      const cards = [...list.querySelectorAll('[data-modules-card]')];
      const wave = element.querySelector('[data-modules-wave]');
      const stacked = () => getComputedStyle(list).flexDirection === 'column';

      const setWave = (t) => wave.setAttribute('d', wavePath(t));
      const waveTrigger = ScrollTrigger.create({
        trigger: body,
        start: 'top bottom',
        end: 'top 20%',
        onUpdate: (self) => setWave(self.progress),
        onRefresh: (self) => setWave(self.progress),
      });

      let timeline;
      const build = () => {
        timeline?.scrollTrigger?.kill();
        timeline?.revert();
        const lead = cards[stacked() ? 0 : 1];
        const others = cards.filter((card) => card !== lead);
        // Offsets ignore transforms, so the start is measured from the resting layout.
        const drop = () =>
          -(
            body.offsetTop +
            list.offsetTop +
            lead.offsetTop -
            (head.offsetTop + head.offsetHeight)
          ) +
          window.innerHeight * 0.04;
        timeline = gsap
          .timeline({
            defaults: { ease: 'none' },
            scrollTrigger: {
              trigger: list,
              start: 'top bottom',
              end: stacked() ? 'top 12%' : 'top 22%',
              scrub: 0.8,
              invalidateOnRefresh: true,
            },
          })
          .fromTo(lead, { y: drop }, { y: 0, ease: 'power1.in', duration: 1 }, 0)
          .fromTo(
            lead,
            { rotationY: 0, transformPerspective: 1600 },
            { rotationY: 360, ease: 'power2.inOut', duration: 0.9 },
            0.05,
          )
          .to(lead, { rotation: -7, duration: 0.35, ease: 'sine.inOut' }, 0.15)
          .to(lead, { rotation: 3, duration: 0.3, ease: 'sine.inOut' }, 0.5)
          .to(lead, { rotation: 0, duration: 0.2, ease: 'sine.out' }, 0.8)
          .fromTo(
            others,
            { y: () => window.innerHeight * 0.3, rotation: (index) => (index ? 5 : -5) },
            { y: 0, rotation: 0, ease: 'power3.out', duration: 0.6 },
            0.4,
          );
      };
      build();
      const layout = window.matchMedia('(width < 840px)');
      const rebuild = () => {
        build();
        ScrollTrigger.refresh();
      };
      layout.addEventListener('change', rebuild);

      return () => {
        layout.removeEventListener('change', rebuild);
        waveTrigger.kill();
        timeline?.scrollTrigger?.kill();
        timeline?.revert();
      };
    });

    // Card actions open their case in the notebook below.
    const openCase = (event) => {
      const link = event.target.closest('[data-case-link]');
      if (!link) return;
      document.dispatchEvent(
        new CustomEvent('cases:open', { detail: { index: Number(link.dataset.caseLink) } }),
      );
    };
    element.addEventListener('click', openCase);

    return () => {
      motion.revert();
      element.removeEventListener('click', openCase);
    };
  },
};
