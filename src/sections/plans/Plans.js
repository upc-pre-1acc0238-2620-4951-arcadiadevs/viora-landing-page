import { media } from '@/config/breakpoints.js';
import { gsap, ScrollTrigger } from '@/core/gsap.js';
import { I18N_CHANGE } from '@/i18n/index.js';

/** Scroll per plan, in viewports (crency: ~300px hold, ~550px slide on 900). */
const HOLD = 0.33;
const SLIDE = 0.6;
/** Badge colour and label ink per plan. */
const STAR = [
  ['#e8b923', '#1f2c26'],
  ['#2e4a3a', '#f9f6f1'],
  ['#e9a284', '#1f2c26'],
];
/** Fired on the section with `{ index }` whenever another plan takes the windows. */
export const PLANS_SLIDE = 'plans:slide';

/**
 * Plans (crency.agency/services). Three windows — plan, app preview, how it
 * works — stick in the middle of the screen while their contents slide up one
 * plan at a time, in step. The badge turns with the scroll and takes each
 * plan's colour; each process curve draws itself as its plan arrives.
 */
export const plans = {
  selector: '[data-plans]',
  mount(element) {
    const rail = element.querySelector('[data-plans-rail]');
    const tracks = [...element.querySelectorAll('[data-plans-track]')];
    const column = rail.firstElementChild;
    const star = element.querySelector('[data-plans-star]');
    const starShape = star.querySelector('svg');
    const steps = [...element.querySelectorAll('.plans__steps')];
    const curves = steps.map((slide) => slide.querySelector('[data-plans-curve]'));
    const dots = steps.map((slide) => [...slide.querySelectorAll('.plans__dot')]);
    const count = tracks[0].children.length;

    let index = -1;
    const announce = (next) => {
      if (next === index) return;
      index = next;
      element.dispatchEvent(new CustomEvent(PLANS_SLIDE, { detail: { index } }));
    };

    const motion = gsap.matchMedia();
    motion.add({ ok: media.motionOk, compact: media.compact }, (context) => {
      const { ok, compact } = context.conditions;
      if (!ok || compact) return undefined;
      element.classList.add('plans--rail');

      // Where the windows stick (below the navbar, see plans.css), and when they let go.
      const top = () => parseFloat(getComputedStyle(column).top);
      const draw = (k) => [
        curves[k],
        { '--draw': 1 },
        { '--draw': 0, duration: SLIDE, ease: 'power1.inOut' },
      ];
      const pop = (k) => [
        dots[k],
        { '--pop': 0 },
        { '--pop': 1, duration: 0.25, stagger: 0.12, ease: 'back.out(3)' },
      ];

      // The first plan's curve draws as the windows arrive.
      gsap.fromTo(
        curves[0],
        { '--draw': 1 },
        {
          '--draw': 0,
          ease: 'none',
          scrollTrigger: {
            trigger: rail,
            start: 'top 85%',
            end: () => `top ${top()}px`,
            scrub: true,
          },
        },
      );
      gsap.fromTo(
        dots[0],
        { '--pop': 0 },
        {
          '--pop': 1,
          stagger: 0.12,
          ease: 'back.out(3)',
          scrollTrigger: {
            trigger: rail,
            start: 'top 30%',
            toggleActions: 'play none none reverse',
          },
        },
      );

      const timeline = gsap.timeline({
        defaults: { ease: 'power2.inOut' },
        scrollTrigger: {
          trigger: rail,
          start: () => `top ${top()}px`,
          end: () => `bottom ${top() + column.offsetHeight}px`,
          scrub: true,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            const at = self.progress * timeline.duration() - HOLD;
            announce(Math.min(count - 1, Math.max(0, Math.round(at / (SLIDE + HOLD)))));
          },
        },
      });
      // Scroll winds the badge on top of its slow idle spin (CSS `rotate`).
      timeline.to(
        starShape,
        { rotation: 240, duration: HOLD * count + SLIDE * (count - 1), ease: 'none' },
        0,
      );
      for (let k = 1; k < count; k += 1) {
        const at = HOLD * k + SLIDE * (k - 1);
        timeline
          .to(tracks, { yPercent: -100 * k, duration: SLIDE }, at)
          .fromTo(
            star,
            { color: STAR[k - 1][0], '--star-ink': STAR[k - 1][1] },
            {
              color: STAR[k][0],
              '--star-ink': STAR[k][1],
              duration: SLIDE,
              immediateRender: false,
            },
            at,
          )
          .fromTo(...draw(k), at + SLIDE * 0.35)
          .fromTo(...pop(k), at + SLIDE * 0.9);
      }
      announce(0);

      return () => {
        element.classList.remove('plans--rail');
        gsap.set([...tracks, star, starShape, ...curves, ...dots.flat()], { clearProps: 'all' });
        announce(-1);
      };
    });

    const refit = () => ScrollTrigger.refresh();
    document.addEventListener(I18N_CHANGE, refit);

    return () => {
      motion.revert();
      document.removeEventListener(I18N_CHANGE, refit);
    };
  },
};
