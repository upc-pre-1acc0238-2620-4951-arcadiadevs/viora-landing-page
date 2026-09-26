import { media } from '@/config/breakpoints.js';
import { gsap, ScrollTrigger } from '@/core/gsap.js';
import { I18N_CHANGE } from '@/i18n/index.js';
import { supportsAlphaVideo } from '@/utils/alphaVideo.js';
import { clamp } from '@/utils/math.js';

/** Degrees a branch leans at full scroll speed, swinging from its anchor. */
const LEAN = 2.2;

/**
 * Tacna (era-residence.com): the context, the new campaign and the season
 * slide past on one pinned rail while looping olive branches hang from the
 * corners and lean into the scroll like wind. The season line draws itself
 * with an olive riding it, lighting each stage of the calendar as it passes.
 */
export const tacna = {
  selector: '[data-tacna]',
  mount(element) {
    const reduced = window.matchMedia(media.reducedMotion);
    const track = element.querySelector('[data-tacna-track]');
    const panels = [...element.querySelectorAll('[data-tacna-panel]')];
    const [, campaign, season] = panels;
    const cleanups = [];

    // ── Branches: looping clips that only play while on screen ──
    const branches = [...element.querySelectorAll('[data-tacna-branch]')];
    const clips = branches.map((branch) => branch.querySelector('video'));
    const playable = supportsAlphaVideo();
    const shown = new Set();
    const play = (branch) => {
      const video = clips[branches.indexOf(branch)];
      if (!playable || reduced.matches) return;
      if (!video.src) video.src = video.dataset.src;
      video.play().catch(() => {});
    };
    const stop = (branch) => clips[branches.indexOf(branch)].pause();
    const sight = new IntersectionObserver(
      (entries) =>
        entries.forEach(({ target, isIntersecting }) => {
          if (isIntersecting) {
            shown.add(target);
            play(target);
          } else {
            shown.delete(target);
            stop(target);
          }
        }),
      { rootMargin: '0px 10%' },
    );
    branches.forEach((branch) => sight.observe(branch));
    const replay = () =>
      branches.forEach((branch) => (shown.has(branch) ? play(branch) : stop(branch)));
    reduced.addEventListener('change', replay);
    cleanups.push(() => {
      sight.disconnect();
      reduced.removeEventListener('change', replay);
      clips.forEach((video) => video.pause());
    });

    // Scroll speed leans the branches like a gust; it settles back on its own.
    const lean = branches.map((branch) => gsap.quickSetter(branch, 'rotation', 'deg'));
    // Hanging branches trail their tips back; the one growing up from the seam bows forward.
    const bow = branches.map((branch) => (branch.matches('.tacna__branch--seam') ? 1 : -1));
    let wind = 0;
    let windTarget = 0;
    const tick = () => {
      windTarget *= 0.9;
      wind += (windTarget - wind) * 0.08;
      if (Math.abs(wind) < 0.002 && Math.abs(windTarget) < 0.002) {
        wind = windTarget = 0;
        gsap.ticker.remove(tick);
      }
      branches.forEach(
        (branch, index) => shown.has(branch) && lean[index](bow[index] * wind * LEAN),
      );
    };
    const blow = (velocity) => {
      if (reduced.matches) return;
      windTarget = clamp(velocity / 2500, -1, 1);
      gsap.ticker.add(tick);
    };
    cleanups.push(() => gsap.ticker.remove(tick));

    // ── Numbers count up the first time they show ───────
    const counters = [...element.querySelectorAll('[data-tacna-count]')];
    let counting = [];
    const count = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        count.disconnect();
        if (reduced.matches) return;
        counting = counters.map((counter) => {
          const text = counter.textContent.trim();
          const match = text.match(/\d+/);
          if (!match) return null;
          const state = { value: 0 };
          const render = () =>
            (counter.textContent = text.replace(match[0], String(Math.round(state.value))));
          render();
          return gsap.to(state, {
            value: Number(match[0]),
            duration: 2,
            ease: 'power3.out',
            onUpdate: render,
          });
        });
      },
      { threshold: 0.6 },
    );
    count.observe(element.querySelector('.tacna__stats'));
    const settle = () => counting.forEach((tween) => tween?.progress(1).kill());
    document.addEventListener(I18N_CHANGE, settle);
    cleanups.push(() => {
      count.disconnect();
      settle();
      document.removeEventListener(I18N_CHANGE, settle);
    });

    // ── Season line: drawn by an olive, stage by stage ──
    const path = season.querySelector('[data-tacna-line-path]');
    const timeline = season.querySelector('.tacna__timeline');
    const traveller = season.querySelector('[data-tacna-traveller]');
    const steps = [...season.querySelectorAll('[data-tacna-step]')];
    const marks = steps.map((step) => Number(step.style.getPropertyValue('--x')));
    const box = path.ownerSVGElement.viewBox.baseVal;
    const length = path.getTotalLength();
    const playSeason = (progress) => {
      path.style.setProperty('--draw', String(1 - progress));
      const point = path.getPointAtLength(length * progress);
      gsap.set(traveller, {
        xPercent: -50,
        yPercent: -50,
        x: (point.x / box.width) * timeline.clientWidth,
        y: (point.y / box.height) * timeline.clientHeight,
        opacity: progress > 0.002 ? 1 : 0,
      });
      steps.forEach((step, index) =>
        step.classList.toggle('is-reached', progress >= marks[index] - 0.015),
      );
    };

    // ── Scroll scenes ───────────────────────────────────
    const motion = gsap.matchMedia();
    motion.add({ ok: media.motionOk, compact: media.compact }, (context) => {
      const { ok, compact } = context.conditions;
      if (!ok) {
        playSeason(1);
        return undefined;
      }
      element.classList.add('tacna--season');

      if (compact) {
        ScrollTrigger.create({
          trigger: timeline,
          start: 'top 90%',
          end: 'bottom bottom',
          scrub: 0.6,
          onUpdate: (self) => playSeason(self.progress),
          onRefresh: (self) => playSeason(self.progress),
        });
        return () => element.classList.remove('tacna--season');
      }

      element.classList.add('tacna--rail');
      const distance = () => track.scrollWidth - window.innerWidth;
      const slide = gsap.to(track, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: element,
          start: 'top top',
          end: () => `+=${distance()}`,
          pin: true,
          scrub: true,
          invalidateOnRefresh: true,
          onUpdate: (self) => blow(self.getVelocity()),
        },
      });
      const across = (trigger, vars, start = 'left right', end = 'right left') => ({
        ...vars,
        ease: 'none',
        scrollTrigger: { containerAnimation: slide, trigger, start, end, scrub: true },
      });

      // Campaign: the headline lines drift apart over the illustration.
      campaign.querySelectorAll('[data-tacna-line]').forEach((line) => {
        const drift = Number(line.dataset.tacnaLine) * window.innerWidth * 0.06;
        gsap.fromTo(line, { x: drift }, across(campaign, { x: -drift }));
      });
      gsap.fromTo(
        campaign.querySelector('[data-tacna-picture] img'),
        { xPercent: -6, scale: 1.12 },
        across(campaign, { xPercent: 6, scale: 1.12 }),
      );
      const ring = campaign.querySelector('.tacna__plans-ring');
      gsap.fromTo(ring, { '--ring': 1 }, across(campaign, { '--ring': 0 }, 'left 70%', 'left 10%'));

      // Season: the wish rises in, then the olive travels the calendar.
      gsap.from(
        season.querySelectorAll('.tacna__wish > *'),
        across(season, { yPercent: 60, opacity: 0, stagger: 0.12 }, 'left 90%', 'left 25%'),
      );
      const ride = { value: 0 };
      gsap.to(
        ride,
        across(
          season,
          { value: 1, onUpdate: () => playSeason(ride.value) },
          'left 45%',
          'right right',
        ),
      );
      playSeason(0);

      return () => {
        element.classList.remove('tacna--rail', 'tacna--season');
        gsap.set(track, { clearProps: 'transform' });
      };
    });
    cleanups.push(() => motion.revert());

    const refit = () => ScrollTrigger.refresh();
    document.addEventListener(I18N_CHANGE, refit);
    cleanups.push(() => document.removeEventListener(I18N_CHANGE, refit));

    return () => cleanups.forEach((cleanup) => cleanup());
  },
};
