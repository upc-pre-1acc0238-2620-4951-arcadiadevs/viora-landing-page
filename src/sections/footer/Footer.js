import { media } from '@/config/breakpoints.js';
import { gsap } from '@/core/gsap.js';
import { I18N_CHANGE, t } from '@/i18n/index.js';
import { ACT, chapterAt, createTapestry, H, LOOP, W } from './tapestry.js';

/** The tapestry advances in stop-motion: stitched frames, a few a second. */
const FPS = 12;
/** Still frame per chapter, for reduced motion and chapter jumps while paused. */
const STILLS = [6.4, 15, 23.4, 31];

/**
 * Footer. A cross-stitch storyboard (tapestry.js) plays one season in a Tacna
 * grove through the arches, chapter by chapter; the strip below names each
 * chapter and lets people jump or pause. The panel unrolls stitch row by
 * stitch row when it arrives; the closing call and the links rise after it.
 */
export const footer = {
  selector: '[data-footer]',
  mount(element) {
    const loom = element.querySelector('[data-footer-loom]');
    const canvas = element.querySelector('[data-footer-canvas]');
    const caption = element.querySelector('[data-footer-caption]');
    const number = element.querySelector('[data-footer-number]');
    const fields = {
      Months: element.querySelector('[data-footer-months]'),
      Title: element.querySelector('[data-footer-title]'),
      Copy: element.querySelector('[data-footer-copy]'),
    };
    const ticks = [...element.querySelectorAll('[data-footer-chapter]')];
    const pause = element.querySelector('[data-footer-pause]');
    const progress = element.querySelector('[data-footer-progress]');
    const title = element.querySelector('[data-footer-title-reveal]');
    const reduced = window.matchMedia(media.reducedMotion);
    const cleanups = [];

    let draw = null;
    let clock = 0;
    let chapter = -1;
    let paused = false;
    let visible = false;
    let started = false;
    let since = 0;

    // ── Whole-number stitches: crisp at any width ───────
    const fit = () => {
      const cell = Math.max(2, Math.ceil(loom.clientWidth / W));
      element.style.setProperty('--cell', `${cell}px`);
    };
    const sizer = new ResizeObserver(fit);
    sizer.observe(loom);
    cleanups.push(() => sizer.disconnect());

    // ── Chapters ────────────────────────────────────────
    const setChapter = (index, animate = true) => {
      if (index === chapter) return;
      chapter = index;
      number.textContent = String(index + 1).padStart(2, '0');
      Object.entries(fields).forEach(([name, node]) => {
        const key = `footer.chapter${index + 1}${name}`;
        node.dataset.i18n = key;
        node.textContent = t(key);
      });
      ticks.forEach((tick, i) =>
        i === index
          ? tick.setAttribute('aria-current', 'step')
          : tick.removeAttribute('aria-current'),
      );
      if (animate && !reduced.matches) {
        gsap.fromTo(
          caption.children,
          { yPercent: 50, autoAlpha: 0 },
          {
            yPercent: 0,
            autoAlpha: 1,
            duration: 0.7,
            stagger: 0.06,
            ease: 'expo.out',
            overwrite: true,
          },
        );
      }
    };

    const paint = (time) => {
      draw?.(time);
      progress.style.setProperty('--season', String((time % LOOP) / LOOP));
      setChapter(chapterAt(time));
    };

    const still = () => reduced.matches || paused;
    const tick = (_time, deltaMs) => {
      if (!draw || !visible || document.hidden || still()) return;
      clock += deltaMs / 1000;
      since += deltaMs / 1000;
      if (since < 1 / FPS) return;
      since = 0;
      paint(clock);
    };
    gsap.ticker.add(tick);
    cleanups.push(() => gsap.ticker.remove(tick));

    const jump = (index) => {
      clock = still() ? STILLS[index] : index * ACT + 0.01;
      paint(still() ? STILLS[index] : clock);
    };
    ticks.forEach((button, index) => {
      const go = () => jump(index);
      button.addEventListener('click', go);
      cleanups.push(() => button.removeEventListener('click', go));
    });

    const setPaused = (value) => {
      paused = value;
      pause.setAttribute('aria-pressed', String(paused));
      pause.setAttribute('aria-label', t(paused ? 'footer.play' : 'footer.pause'));
    };
    const toggle = () => setPaused(!paused);
    pause.addEventListener('click', toggle);
    cleanups.push(() => pause.removeEventListener('click', toggle));

    const showStill = () => {
      if (reduced.matches && draw) {
        clock = STILLS[3];
        paint(clock);
      }
    };
    reduced.addEventListener('change', showStill);
    cleanups.push(() => reduced.removeEventListener('change', showStill));

    // ── Arrival: load the loom, then unroll it row by row ──
    const near = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || draw) return;
        draw = createTapestry(canvas);
        paint(reduced.matches ? STILLS[3] : 0);
      },
      { rootMargin: '100% 0px' },
    );
    near.observe(loom);
    const sight = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (!visible || started || !draw) return;
        started = true;
        if (reduced.matches) return;
        clock = 0;
        paint(0);
        // 29 steps: the rows of stitches appearing, four at a time.
        gsap.fromTo(
          loom,
          { clipPath: 'inset(0 0 100% 0)' },
          { clipPath: 'inset(0 0 0% 0)', duration: 1.6, ease: `steps(${H / 4})` },
        );
      },
      { threshold: 0.25 },
    );
    sight.observe(loom);
    cleanups.push(() => {
      near.disconnect();
      sight.disconnect();
    });

    // ── The closing call and links (end of page: observer, not scroll) ──
    const lines = () => {
      const parts = title.innerHTML.split(/<br\s*\/?>/i);
      title.innerHTML = parts
        .map((part) => `<span class="footer__line"><span>${part.trim()}</span></span>`)
        .join('');
      return [...title.querySelectorAll('.footer__line > span')];
    };
    const motion = gsap.matchMedia();
    const reveals = () =>
      motion.add(media.motionOk, () => {
        const items = [...element.querySelectorAll('[data-footer-reveal]')];
        const rules = [...element.querySelectorAll('[data-footer-rule]')];
        const heads = lines();
        gsap.set(heads, { yPercent: 110, display: 'inline-block' });
        gsap.set(items, { y: 22, autoAlpha: 0 });
        gsap.set(rules, { scaleX: 0 });
        const watch = new IntersectionObserver(
          (entries) =>
            entries.forEach(({ target, isIntersecting }) => {
              if (!isIntersecting) return;
              watch.unobserve(target);
              if (target === title) {
                gsap.to(heads, { yPercent: 0, duration: 1.2, stagger: 0.12, ease: 'expo.out' });
              } else if (rules.includes(target)) {
                gsap.to(target, { scaleX: 1, duration: 1.4, ease: 'expo.inOut' });
              } else {
                const group = [...target.parentElement.children].indexOf(target);
                gsap.to(target, {
                  y: 0,
                  autoAlpha: 1,
                  duration: 0.9,
                  delay: group * 0.06,
                  ease: 'expo.out',
                });
              }
            }),
          { rootMargin: '0px 0px -8% 0px' },
        );
        [title, ...items, ...rules].forEach((node) => watch.observe(node));
        return () => {
          watch.disconnect();
          gsap.set([...heads, ...items, ...rules], { clearProps: 'all' });
        };
      });
    reveals();
    cleanups.push(() => motion.revert());

    // ── Language: rebuild the title lines, retitle the chapter ──
    const relabel = () => {
      const current = chapter;
      chapter = -1;
      setChapter(Math.max(current, 0), false);
      setPaused(paused);
      motion.revert();
      reveals();
    };
    document.addEventListener(I18N_CHANGE, relabel);
    cleanups.push(() => document.removeEventListener(I18N_CHANGE, relabel));

    setChapter(0, false);
    return () => cleanups.forEach((cleanup) => cleanup());
  },
};
