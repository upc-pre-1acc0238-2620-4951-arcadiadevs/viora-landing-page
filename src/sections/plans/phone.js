import { media } from '@/config/breakpoints.js';
import { gsap } from '@/core/gsap.js';
import { PLANS_SLIDE } from './Plans.js';

/**
 * Example app screens for the plans (placeholders until the real mockups).
 * Each screen loops a small demo while it is the one on show: the hectare
 * stepper prices the plan, the licence counters fill, the code types itself
 * in and redeems. Self-contained on purpose — to swap in real screenshots,
 * replace the `[data-plans-screen]` markup and drop this module from the
 * sections registry; Plans.js does not depend on it.
 */

const PRICE_PER_HECTARE = 55;
const CODE = 'VIO-7K4Q-29';

const demos = {
  grower(screen) {
    const hectares = screen.querySelector('[data-pp-hectares]');
    const total = screen.querySelector('[data-pp-total]');
    const fill = screen.querySelector('[data-pp-fill]');
    const plus = screen.querySelector('[data-pp-plus]');
    const items = screen.querySelectorAll('[data-pp-item]');
    const pay = screen.querySelector('[data-pp-press]');
    const state = { ha: 6 };
    const render = () => {
      const ha = Math.round(state.ha);
      hectares.textContent = String(ha);
      total.textContent = String(ha * PRICE_PER_HECTARE);
      fill.style.setProperty('--fill', String(ha / 27));
    };
    const timeline = gsap.timeline({ repeat: -1, repeatDelay: 1.4, onStart: render });
    timeline
      .set(state, { ha: 6, onComplete: render })
      .from(items, { x: -10, opacity: 0.25, duration: 0.5, stagger: 0.12, ease: 'power2.out' }, 0.1)
      .to(state, { ha: 12, duration: 1.6, ease: 'steps(6)', onUpdate: render }, 0.4)
      .fromTo(
        plus,
        { scale: 1 },
        { scale: 0.82, duration: 0.13, repeat: 11, yoyo: true, ease: 'power1.inOut' },
        0.4,
      )
      .fromTo(
        total.parentElement,
        { scale: 1 },
        { scale: 1.06, duration: 0.18, yoyo: true, repeat: 1 },
        2.05,
      )
      .fromTo(
        pay,
        { scale: 1 },
        { scale: 0.95, duration: 0.14, yoyo: true, repeat: 1, ease: 'power1.inOut' },
        2.7,
      )
      .to({}, { duration: 0.8 });
    return timeline;
  },

  coop(screen) {
    const counters = [...screen.querySelectorAll('[data-pp-count]')];
    const fills = screen.querySelectorAll('[data-pp-fill]');
    const chips = screen.querySelectorAll('[data-pp-item]');
    const values = counters.map((counter) => ({ value: 0, to: Number(counter.dataset.ppCount) }));
    const render = () =>
      counters.forEach((counter, i) => (counter.textContent = String(Math.round(values[i].value))));
    const timeline = gsap.timeline({ repeat: -1, repeatDelay: 1.6 });
    timeline
      .set(values, { value: 0, onComplete: render })
      .fromTo(
        fills,
        { scaleX: 0 },
        { scaleX: 1, duration: 1.2, stagger: 0.15, ease: 'power3.out' },
        0.1,
      )
      .to(
        values,
        {
          value: (i) => values[i].to,
          duration: 1.3,
          stagger: 0.15,
          ease: 'power3.out',
          onUpdate: render,
        },
        0.1,
      )
      .from(
        chips,
        {
          scale: 0.6,
          opacity: 0,
          duration: 0.45,
          stagger: 0.12,
          ease: 'back.out(2.4)',
          transformOrigin: '0 50%',
        },
        0.6,
      )
      .to({}, { duration: 1 });
    return timeline;
  },

  code(screen) {
    const code = screen.querySelector('[data-pp-code]');
    const redeem = screen.querySelector('[data-pp-press]');
    const success = screen.querySelector('[data-pp-success]');
    const tick = screen.querySelector('[data-pp-tick]');
    const typed = { chars: 0 };
    const render = () => (code.textContent = CODE.slice(0, Math.round(typed.chars)));
    const timeline = gsap.timeline({ repeat: -1, repeatDelay: 1.6 });
    timeline
      .set(typed, { chars: 0, onComplete: render })
      .set(success, { autoAlpha: 0, y: 16 })
      .set(tick, { strokeDashoffset: 1 })
      .to(
        typed,
        { chars: CODE.length, duration: 1.4, ease: `steps(${CODE.length})`, onUpdate: render },
        0.3,
      )
      .fromTo(
        redeem,
        { scale: 1 },
        { scale: 0.95, duration: 0.14, yoyo: true, repeat: 1, ease: 'power1.inOut' },
        2,
      )
      .to(success, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power3.out' }, 2.35)
      .to(tick, { strokeDashoffset: 0, duration: 0.45, ease: 'power2.out' }, 2.6)
      .to({}, { duration: 1 });
    return timeline;
  },
};

export const plansPhone = {
  selector: '[data-plans-phone]',
  mount(element) {
    const section = element.closest('[data-plans]');
    const screens = [...element.querySelectorAll('[data-plans-screen]')];
    const reduced = window.matchMedia(media.reducedMotion);
    let timelines = [];
    let active = -1;
    const shown = new Set();

    const sync = () => {
      const rail = section.classList.contains('plans--rail');
      timelines.forEach((timeline, i) => {
        const on = rail ? i === active && shown.size > 0 : shown.has(screens[i]);
        if (on && timeline.paused()) timeline.restart();
        if (!on && !timeline.paused()) timeline.pause().progress(1);
      });
    };

    const build = () => {
      timelines.forEach((timeline) => timeline.progress(1).kill());
      timelines = reduced.matches
        ? []
        : screens.map((screen) => demos[screen.dataset.plansScreen](screen).pause().progress(1));
      sync();
    };

    const onSlide = (event) => {
      active = event.detail.index;
      sync();
    };
    const sight = new IntersectionObserver((entries) => {
      entries.forEach(({ target, isIntersecting }) =>
        isIntersecting ? shown.add(target) : shown.delete(target),
      );
      sync();
    });
    screens.forEach((screen) => sight.observe(screen));
    section.addEventListener(PLANS_SLIDE, onSlide);
    reduced.addEventListener('change', build);
    build();

    return () => {
      sight.disconnect();
      section.removeEventListener(PLANS_SLIDE, onSlide);
      reduced.removeEventListener('change', build);
      timelines.forEach((timeline) => timeline.progress(1).kill());
    };
  },
};
