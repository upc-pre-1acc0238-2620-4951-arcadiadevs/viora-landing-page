import { media } from '@/config/breakpoints.js';
import { gsap, ScrollTrigger, SplitText } from '@/core/gsap.js';
import { I18N_BEFORE_CHANGE, I18N_CHANGE } from '@/i18n/index.js';
import { supportsAlphaVideo } from '@/utils/alphaVideo.js';
import { lerp } from '@/utils/math.js';
import { animateCanvas } from './art/canvas.js';
import { drawField } from './art/field.js';
import { drawGrowers } from './art/growers.js';
import { drawManagers } from './art/managers.js';
import { drawSwing } from './art/swing.js';

/** Each card's illustration, and the moment it shows without motion. */
const ARTS = {
  growers: [drawGrowers, 5.6],
  swing: [drawSwing, 1.2],
  managers: [drawManagers, 2.4],
  field: [drawField, 3.5],
};

/** The two windows once lined up, on the 1440 × 900 Figma frame (57:3358). */
const WINDOW = { top: 150, height: 500, width: 395, left: 318, right: 727 };
/** How far each window starts off the line, up or down. */
const DRIFT = 120;
/** Pinned scroll, in viewport heights. */
const PIN = 5.2;

const mix = (from, to, amount) => ({
  x: lerp(from.x, to.x, amount),
  y: lerp(from.y, to.y, amount),
  w: lerp(from.w, to.w, amount),
  h: lerp(from.h, to.h, amount),
});

/**
 * Who it's for (era-residence.com → oryzo.ai). Two windows on one picture of
 * a grower and a manager line up and close into one, which opens to full
 * bleed with the title rising inside it. Then the picture shrinks into the
 * grower's portrait slot and his cards rise in; a sweep brings the manager's
 * row. Cards carry looping canvas illustrations that only run while shown.
 */
export const segments = {
  selector: '[data-segments]',
  mount(element) {
    const stage = element.querySelector('[data-segments-stage]');
    const windows = [...element.querySelectorAll('[data-segments-window]')];
    const faces = [...element.querySelectorAll('[data-segments-face]')];
    const rows = [...element.querySelectorAll('[data-segments-row]')];
    const cards = rows.map((row) => [...row.querySelectorAll('[data-segments-card]')]);
    const slot = rows[0].querySelector('[data-segments-slot]');
    const title = element.querySelector('[data-segments-title]');
    const scrim = element.querySelector('[data-segments-scrim]');
    const branches = [...element.querySelectorAll('[data-segments-branch]')];
    const cleanups = [];

    // ── Card illustrations ──────────────────────────────
    const arts = rows.map((row) =>
      [...row.querySelectorAll('[data-segments-art]')].map((canvas) => {
        const [draw, still] = ARTS[canvas.dataset.segmentsArt];
        return animateCanvas(canvas, draw, { still });
      }),
    );
    const showRow = (index) =>
      arts.forEach((row, i) => row.forEach((art) => art.setActive(index === null || i === index)));
    cleanups.push(() => arts.flat().forEach((art) => art.destroy()));

    // ── Olive branches: play only while the scene is on screen ──
    const clips = branches.map((branch) => branch.querySelector('video'));
    const playable = supportsAlphaVideo();
    const sight = new IntersectionObserver(([entry]) =>
      clips.forEach((video) => {
        if (!entry.isIntersecting || !playable || !element.classList.contains('segments--rail')) {
          video.pause();
          return;
        }
        if (!video.src) video.src = video.dataset.src;
        video.play().catch(() => {});
      }),
    );
    sight.observe(stage);
    cleanups.push(() => {
      sight.disconnect();
      clips.forEach((video) => video.pause());
    });

    const setup = () => {
      const motion = gsap.matchMedia();
      motion.add({ ok: media.motionOk, compact: media.compact }, (context) => {
        const { ok, compact } = context.conditions;
        if (!ok) {
          showRow(null);
          return undefined;
        }
        if (compact) {
          showRow(null);
          rows.forEach((row, index) =>
            gsap.from(cards[index], {
              yPercent: 18,
              autoAlpha: 0,
              duration: 0.9,
              stagger: 0.12,
              ease: 'power3.out',
              scrollTrigger: { trigger: row, start: 'top 80%', once: true },
            }),
          );
          return undefined;
        }

        element.classList.add('segments--rail');
        const [pairA, pairB] = windows;
        const split = SplitText.create(title, {
          type: 'chars',
          mask: 'chars',
          charsClass: 'segments__char',
        });
        const state = { align: 0, close: 0, grow: 0, collapse: 0 };
        let W = 0;
        let H = 0;
        let u = 1;
        let ox = 0;
        let oy = 0;
        let portrait = { x: 0, y: 0, w: 0, h: 0 };

        const measure = () => {
          const box = stage.getBoundingClientRect();
          W = box.width;
          H = box.height;
          u = Math.min(W / 1440, H / 900);
          ox = (W - 1440 * u) / 2;
          oy = (H - 900 * u) / 2;
          const place = slot.getBoundingClientRect();
          portrait = {
            x: place.left - box.left,
            y: place.top - box.top,
            w: place.width,
            h: place.height,
          };
          gsap.set(faces, {
            left: portrait.x,
            top: portrait.y,
            width: portrait.w,
            height: portrait.h,
          });
        };
        const frame = (x, y, w, h) => ({ x: ox + x * u, y: oy + y * u, w: w * u, h: h * u });
        const cut = (target, r) => {
          target.style.clipPath = `inset(${r.y}px ${W - r.x - r.w}px ${H - r.y - r.h}px ${r.x}px)`;
        };

        const render = () => {
          const { align, close, grow, collapse } = state;
          if (close < 1) {
            // Two halves: offset up and down, lining up, then closing the gap.
            const drift = DRIFT * (1 - align);
            const gap = ((WINDOW.right - WINDOW.left - WINDOW.width) / 2) * close;
            cut(pairA, frame(WINDOW.left, WINDOW.top + drift, WINDOW.width + gap, WINDOW.height));
            cut(
              pairB,
              frame(WINDOW.right - gap, WINDOW.top - drift, WINDOW.width + gap, WINDOW.height),
            );
            return;
          }
          // One picture: out to full bleed, then down into the portrait slot.
          pairB.style.clipPath = 'inset(50%)';
          const joined = frame(
            WINDOW.left,
            WINDOW.top,
            WINDOW.right + WINDOW.width - WINDOW.left,
            WINDOW.height,
          );
          cut(pairA, mix(mix(joined, { x: 0, y: 0, w: W, h: H }, grow), portrait, collapse));
        };

        // The branches rise into the corners as the section scrolls in.
        gsap.fromTo(
          branches,
          { yPercent: 35 },
          {
            yPercent: 0,
            ease: 'none',
            scrollTrigger: { trigger: element, start: 'top bottom', end: 'top top', scrub: true },
          },
        );

        const timeline = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: element,
            start: 'top top',
            end: () => `+=${window.innerHeight * PIN}`,
            pin: true,
            scrub: true,
            invalidateOnRefresh: true,
            onRefresh: () => {
              measure();
              render();
            },
          },
        });
        timeline
          // Once the stage is pinned: the windows line up, then close the gap.
          .to(state, { align: 1, duration: 0.7, ease: 'power1.inOut' })
          .to(state, { close: 1, duration: 0.4, ease: 'power1.inOut' })
          .addLabel('grow')
          .to(state, { grow: 1, duration: 1.2, ease: 'power2.inOut' }, 'grow')
          .fromTo(title, { scale: 0.8 }, { scale: 1, duration: 1.2, ease: 'power1.out' }, 'grow')
          .fromTo(scrim, { opacity: 0 }, { opacity: 1, duration: 0.7 }, 'grow+=0.35')
          .fromTo(
            split.chars,
            { yPercent: 115 },
            { yPercent: 0, duration: 0.55, stagger: 0.035, ease: 'power3.out' },
            'grow+=0.45',
          )
          .to(
            branches[0],
            { xPercent: -50, yPercent: 40, rotation: -12, duration: 1.1, ease: 'power2.in' },
            'grow',
          )
          .to(
            branches[1],
            { xPercent: 50, yPercent: 40, rotation: 12, duration: 1.1, ease: 'power2.in' },
            'grow',
          )
          .addLabel('collapse', '+=0.5')
          .to(state, { collapse: 1, duration: 1.2, ease: 'power2.inOut' }, 'collapse')
          .to(
            split.chars,
            { yPercent: -115, duration: 0.45, stagger: 0.02, ease: 'power2.in' },
            'collapse',
          )
          .to(scrim, { opacity: 0, duration: 0.5 }, 'collapse')
          .fromTo(
            faces[0],
            { opacity: 1, clipPath: 'inset(100% 0% 0% 0%)' },
            { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.7, ease: 'power2.inOut' },
            'collapse+=0.5',
          )
          .fromTo(
            cards[0],
            { yPercent: 40, autoAlpha: 0 },
            { yPercent: 0, autoAlpha: 1, duration: 0.6, stagger: 0.14, ease: 'power3.out' },
            'collapse+=0.65',
          )
          .addLabel('swap', '+=0.7')
          .fromTo(
            faces[1],
            { opacity: 1, clipPath: 'inset(100% 0% 0% 0%)' },
            { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.9, ease: 'power2.inOut' },
            'swap',
          )
          .fromTo(
            faces[0],
            { scale: 1 },
            { scale: 1.08, duration: 0.9, ease: 'power2.inOut' },
            'swap',
          )
          .to(
            cards[0],
            { yPercent: -30, autoAlpha: 0, duration: 0.5, stagger: 0.08, ease: 'power2.in' },
            'swap',
          )
          .fromTo(
            cards[1],
            { yPercent: 40, autoAlpha: 0 },
            { yPercent: 0, autoAlpha: 1, duration: 0.6, stagger: 0.14, ease: 'power3.out' },
            'swap+=0.4',
          )
          .to({}, { duration: 0.6 });

        // Only the row on screen animates its cards.
        const { collapse: collapseAt, swap: swapAt } = timeline.labels;
        const pick = () => {
          const time = timeline.time();
          showRow(time >= swapAt + 0.4 ? 1 : time >= collapseAt + 0.5 ? 0 : -1);
        };
        timeline.eventCallback('onUpdate', () => {
          render();
          pick();
        });

        measure();
        render();
        pick();

        return () => {
          element.classList.remove('segments--rail');
          windows.forEach((target) => (target.style.clipPath = ''));
          gsap.set(faces, { clearProps: 'all' });
          showRow(null);
        };
      });
      return motion;
    };

    let motion = setup();
    const release = () => motion.revert();
    const rebuild = () => {
      motion = setup();
      ScrollTrigger.refresh();
    };
    document.addEventListener(I18N_BEFORE_CHANGE, release);
    document.addEventListener(I18N_CHANGE, rebuild);
    cleanups.push(() => {
      document.removeEventListener(I18N_BEFORE_CHANGE, release);
      document.removeEventListener(I18N_CHANGE, rebuild);
      motion.revert();
    });

    return () => cleanups.forEach((cleanup) => cleanup());
  },
};
