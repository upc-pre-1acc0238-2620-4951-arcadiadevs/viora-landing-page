import { media } from '@/config/breakpoints.js';
import { mountGlass } from '@/components/glass/glass.js';
import { gsap, SplitText } from '@/core/gsap.js';
import { startScroll, stopScroll } from '@/core/scroll.js';
import { I18N_BEFORE_CHANGE, I18N_CHANGE } from '@/i18n/index.js';

const SVG = 'http://www.w3.org/2000/svg';
/** How far the trophy rises at the top of a cheer, in source pixels. */
const LIFT = 20;
/** The dip before the lift: arms bend a little to heave the cup up. */
const DIP = -8;
/** Height of the band that stretches under it (source rows 480 → 800). */
const BAND = 320;
/** Where the confetti leaves the cup, in the drawing's 1536 × 1024 space. */
const MOUTH = [752, 70];
const PIECES = 16;
const INKS = ['#fff', '#e8b923', '#fff', '#2e4a3a'];

const star = (size) =>
  `M0 ${-size}L${size * 0.3} ${-size * 0.3}L${size} ${-size * 0.25}L${size * 0.45} ${size * 0.2}L${size * 0.62} ${size}L0 ${size * 0.55}L${-size * 0.62} ${size}L${-size * 0.45} ${size * 0.2}L${-size} ${-size * 0.25}L${-size * 0.3} ${-size * 0.3}Z`;

/** One confetti piece: a star, a round seed or a ribbon, in the drawing's ink. */
const piece = (index) => {
  const kind = index % 3;
  const node = document.createElementNS(SVG, kind === 1 ? 'circle' : 'path');
  node.classList.add('about__confetti');
  node.setAttribute('fill', INKS[index % INKS.length]);
  if (kind === 0) node.setAttribute('d', star(16 + (index % 4) * 3));
  else if (kind === 1) node.setAttribute('r', String(8 + (index % 3) * 2));
  else node.setAttribute('d', 'M-16 -6Q0 -14 16 -6L16 4Q0 -4 -16 4Z');
  node.style.opacity = '0';
  return node;
};

/**
 * About us. The quote rises line by line; the team lifts the trophy on a loop
 * (the drawing is cut in three bands: the top lifts, the middle stretches to
 * follow, so the arms really reach up) while stars twinkle, action lines flick
 * and confetti pops. Paragraphs light up word by word with the scroll, and
 * member rows fill from the side the pointer enters (doubleplay.studio).
 */
export const about = {
  selector: '[data-about]',
  mount(element) {
    const reduced = window.matchMedia(media.reducedMotion);
    const cheer = element.querySelector('[data-about-cheer]');
    const top = element.querySelector('[data-about-top]');
    const band = element.querySelector('[data-about-band]');
    const gleam = element.querySelector('[data-about-gleam]');
    const lift = element.querySelector('[data-about-lift]');
    const pops = [...element.querySelectorAll('[data-about-pop]')];
    const twinklers = [...element.querySelectorAll('[data-about-twinkle]')];
    const flicks = [...element.querySelectorAll('[data-about-flick]')];
    const confettiLayer = element.querySelector('[data-about-confetti]');
    const members = [...element.querySelectorAll('[data-about-member]')];
    const cleanups = [];

    cleanups.push(mountGlass(element.querySelector('[data-about-film]')));

    // ── Team video: the intro reel stands in until the real one lands ──
    const watch = element.querySelector('[data-about-watch]');
    const dialog = element.querySelector('[data-about-dialog]');
    const player = dialog.querySelector('[data-about-player]');
    const openVideo = () => {
      dialog.showModal();
      stopScroll();
      player.currentTime = 0;
      player.play().catch(() => {});
    };
    const closeVideo = () => dialog.close();
    const closedVideo = () => {
      player.pause();
      startScroll();
      watch.focus({ preventScroll: true });
    };
    const backdrop = (event) => event.target === dialog && closeVideo();
    const closeButton = dialog.querySelector('[data-about-close]');
    watch.addEventListener('click', openVideo);
    closeButton.addEventListener('click', closeVideo);
    dialog.addEventListener('click', backdrop);
    dialog.addEventListener('close', closedVideo);
    cleanups.push(() => {
      watch.removeEventListener('click', openVideo);
      closeButton.removeEventListener('click', closeVideo);
      dialog.removeEventListener('click', backdrop);
      dialog.removeEventListener('close', closedVideo);
    });

    // ── Member rows: cream wipes in on hover (fine pointer) or tap (coarse/touch) ──
    const fine = window.matchMedia(media.finePointer);
    let activeRow = null;

    const deactivate = (row) => {
      if (!row) return;
      row.style.setProperty('--wipe', '100% 0 0 0');
      row.classList.remove('is-over', 'is-active');
      if (activeRow === row) activeRow = null;
    };

    const activate = (row, startEdge = '100% 0 0 0') => {
      if (activeRow && activeRow !== row) {
        deactivate(activeRow);
      }
      row.style.transition = 'none';
      row.style.setProperty('--wipe', startEdge);
      row.offsetHeight; // commit the start edge before wiping in
      row.style.transition = '';
      row.style.setProperty('--wipe', '0 0 0 0');
      row.classList.add('is-over', 'is-active');
      activeRow = row;
    };

    members.forEach((row) => {
      const side = (event) => {
        const box = row.getBoundingClientRect();
        return event.clientY < box.top + box.height / 2 ? '0 0 100% 0' : '100% 0 0 0';
      };
      const enter = (event) => {
        if (!fine.matches) return;
        activate(row, side(event));
      };
      const leave = (event) => {
        if (!fine.matches) return;
        row.style.setProperty('--wipe', side(event));
        row.classList.remove('is-over', 'is-active');
        if (activeRow === row) activeRow = null;
      };
      const tap = (event) => {
        if (fine.matches) return;
        if (activeRow === row) {
          deactivate(row);
        } else {
          activate(row, side(event));
        }
      };
      row.addEventListener('pointerenter', enter);
      row.addEventListener('pointerleave', leave);
      row.addEventListener('click', tap);
      cleanups.push(() => {
        row.removeEventListener('pointerenter', enter);
        row.removeEventListener('pointerleave', leave);
        row.removeEventListener('click', tap);
      });
    });

    const outside = (event) => {
      if (fine.matches || !activeRow) return;
      if (!event.target.closest('[data-about-member]')) {
        deactivate(activeRow);
      }
    };
    document.addEventListener('click', outside);
    cleanups.push(() => document.removeEventListener('click', outside));

    // ── The cheer: lift, flick, shine, confetti ─────────
    const state = { lift: 0 };
    const k = () => top.offsetWidth / 1536;
    const setLift = () => {
      const up = state.lift * k();
      top.style.transform = `translate3d(0, ${-up}px, 0)`;
      band.style.transform = `scaleY(${1 + state.lift / BAND})`;
      lift.setAttribute('transform', `translate(0 ${-state.lift})`);
    };
    const confetti = Array.from({ length: PIECES }, (_, index) => {
      const node = piece(index);
      confettiLayer.append(node);
      return node;
    });
    const burst = () => {
      const timeline = gsap.timeline();
      confetti.forEach((node, index) => {
        const spread = (index / (PIECES - 1) - 0.5) * 2;
        const angle = -Math.PI / 2 + spread * 1.15 + gsap.utils.random(-0.15, 0.15);
        const speed = gsap.utils.random(230, 380);
        const dx = Math.cos(angle) * speed;
        const dy = Math.sin(angle) * speed;
        timeline.fromTo(
          node,
          { x: MOUTH[0], y: MOUTH[1], rotation: 0, scale: 0.4, opacity: 1 },
          {
            keyframes: {
              x: [MOUTH[0], MOUTH[0] + dx * 0.7, MOUTH[0] + dx],
              y: [MOUTH[1], MOUTH[1] + dy * 0.8, MOUTH[1] + dy + 170],
              scale: [0.4, 1, 0.9],
              opacity: [1, 1, 0],
              easeEach: 'sine.out',
            },
            rotation: gsap.utils.random(-260, 260),
            duration: gsap.utils.random(1.3, 1.8),
            ease: 'power1.out',
          },
          index * 0.012,
        );
      });
      return timeline;
    };

    const buildCheer = () => {
      const timeline = gsap.timeline({ repeat: -1, repeatDelay: 0.6, paused: true });
      timeline
        .to(state, { lift: DIP, duration: 0.35, ease: 'power2.inOut', onUpdate: setLift })
        .to(state, { lift: LIFT, duration: 0.5, ease: 'back.out(2.4)', onUpdate: setLift })
        .fromTo(
          flicks,
          { strokeDashoffset: 1 },
          { strokeDashoffset: 0, duration: 0.22, stagger: 0.05, ease: 'power2.out' },
          0.47,
        )
        .to(flicks, { strokeDashoffset: -1, duration: 0.3, stagger: 0.05, ease: 'power2.in' }, 1.05)
        .add(burst, 0.65)
        .fromTo(
          gleam,
          { '--shine': -0.3 },
          { '--shine': 1.3, duration: 1, ease: 'power2.inOut' },
          0.6,
        )
        .fromTo(
          pops,
          { scale: 1, rotation: 0 },
          {
            keyframes: { scale: [1, 1.35, 1], rotation: [0, 14, 0] },
            duration: 0.7,
            stagger: 0.08,
            ease: 'power2.out',
            transformOrigin: '50% 50%',
          },
          0.55,
        )
        .to(state, { lift: LIFT * 0.55, duration: 0.5, ease: 'sine.inOut', onUpdate: setLift }, 1.5)
        .to(
          state,
          { lift: LIFT * 0.85, duration: 0.45, ease: 'sine.inOut', onUpdate: setLift },
          2.0,
        )
        .to(state, { lift: 0, duration: 0.8, ease: 'power2.inOut', onUpdate: setLift }, 2.55);
      return timeline;
    };

    // The stars twinkle on their own clocks, between cheers too.
    const twinkles = twinklers.map((node, index) =>
      gsap.to(node, {
        rotation: index % 2 ? -10 : 10,
        scale: 0.88,
        duration: 1.4 + index * 0.3,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inOut',
        transformOrigin: '50% 50%',
        paused: true,
      }),
    );
    const halos = gsap.to(element.querySelectorAll('.about__halo'), {
      opacity: 0.45,
      duration: 1.2,
      stagger: 0.4,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
      paused: true,
    });

    const cheerLoop = buildCheer();
    let seen = false;
    const sight = new IntersectionObserver(([entry]) => {
      const on = entry.isIntersecting && !reduced.matches;
      [cheerLoop, halos, ...twinkles].forEach((tween) => (on ? tween.play() : tween.pause()));
      if (entry.isIntersecting && !seen && !reduced.matches) {
        seen = true;
        gsap.from(cheer, { yPercent: 14, autoAlpha: 0, duration: 1.3, ease: 'expo.out' });
      }
    });
    sight.observe(cheer);
    cleanups.push(() => {
      sight.disconnect();
      [cheerLoop, halos, ...twinkles].forEach((tween) => tween.kill());
      state.lift = 0;
      setLift();
    });

    // ── Text: masked rises and word-by-word light up ────
    const motion = gsap.matchMedia();
    const texts = () => {
      motion.add(media.motionOk, () => {
        const reveal = (targets, trigger, vars = {}) =>
          gsap.from(targets, {
            yPercent: 110,
            duration: 1.2,
            stagger: 0.1,
            ease: 'expo.out',
            ...vars,
            scrollTrigger: { trigger, start: 'top 85%', once: true },
          });

        // Quote lines rise inside their masks; each line's letters follow.
        const lines = [...element.querySelectorAll('[data-about-line]')];
        const quote = SplitText.create(lines, { type: 'chars' });
        const opening = gsap.timeline({
          scrollTrigger: { trigger: lines[0], start: 'top 85%', once: true },
        });
        lines.forEach((line, index) => {
          const chars = quote.chars.filter((char) => line.contains(char));
          opening.from(
            chars,
            { yPercent: 115, rotation: 6, duration: 1.1, stagger: 0.025, ease: 'expo.out' },
            index * 0.14,
          );
        });

        // Intro bar: the rule draws, the ring closes, the items rise.
        const rule = element.querySelector('[data-about-rule]');
        const bar = element.querySelectorAll('[data-about-bar]');
        const ring = element.querySelector('[data-about-ring]');
        gsap
          .timeline({ scrollTrigger: { trigger: rule, start: 'top 90%', once: true } })
          .from(rule, { scaleX: 0, duration: 1.4, ease: 'expo.inOut' })
          .from(bar, { y: 24, autoAlpha: 0, duration: 0.9, stagger: 0.08, ease: 'expo.out' }, 0.4)
          .fromTo(ring, { '--draw': 1 }, { '--draw': 0, duration: 1.1, ease: 'power2.inOut' }, 0.6);

        // Paragraphs light up word by word with the scroll.
        const splits = [...element.querySelectorAll('[data-about-idea]')].map((paragraph) => {
          const split = SplitText.create(paragraph, { type: 'words', wordsClass: 'about__word' });
          // The last one sits at the page's end, where the scroll can't carry it
          // through, so it plays on its own once it shows.
          const play = paragraph.dataset.aboutIdea === 'play';
          gsap.fromTo(
            split.words,
            { '--lit': 0.16 },
            {
              '--lit': 1,
              stagger: play ? 0.035 : 0.1,
              duration: 0.5,
              ease: play ? 'power1.out' : 'none',
              scrollTrigger: play
                ? { trigger: paragraph, start: 'top 80%', once: true }
                : { trigger: paragraph, start: 'top 85%', end: 'bottom 70%', scrub: true },
            },
          );
          return split;
        });

        // Members: dividers draw across, names rise.
        members.forEach((row) => {
          gsap.from(row.querySelectorAll('.about__role, .about__arrow'), {
            y: 16,
            autoAlpha: 0,
            duration: 0.9,
            ease: 'expo.out',
            scrollTrigger: { trigger: row, start: 'top 90%', once: true },
          });
          gsap.from(row.querySelector('.about__name-text'), {
            yPercent: 60,
            autoAlpha: 0,
            duration: 1.2,
            ease: 'expo.out',
            scrollTrigger: { trigger: row, start: 'top 90%', once: true },
          });
        });

        // Video: the poster settles, the slogan rises, the button follows.
        const film = element.querySelector('[data-about-film]');
        gsap.fromTo(
          element.querySelector('[data-about-poster]'),
          { scale: 1.18 },
          {
            scale: 1,
            ease: 'none',
            scrollTrigger: { trigger: film, start: 'top bottom', end: 'bottom top', scrub: true },
          },
        );
        const slogan = SplitText.create(element.querySelectorAll('[data-about-slogan]'), {
          type: 'words',
        });
        reveal(slogan.words, film, { stagger: 0.12 });
        gsap.from(element.querySelector('[data-about-watch]'), {
          y: 24,
          autoAlpha: 0,
          duration: 1,
          delay: 0.5,
          ease: 'expo.out',
          scrollTrigger: { trigger: film, start: 'top 70%', once: true },
        });

        // The marks close the page, past where scroll triggers can reach: they
        // rise as soon as they are on screen.
        const marks = element.querySelector('[data-about-marks]');
        gsap.set(marks, { y: 30, autoAlpha: 0 });
        const markSight = new IntersectionObserver(([entry]) => {
          if (!entry.isIntersecting) return;
          markSight.disconnect();
          gsap.to(marks, { y: 0, autoAlpha: 1, duration: 1.1, ease: 'expo.out' });
        });
        markSight.observe(marks);

        return () => {
          markSight.disconnect();
          gsap.set(marks, { clearProps: 'all' });
          quote.revert();
          slogan.revert();
          splits.forEach((split) => split.revert());
        };
      });
    };
    texts();

    const release = () => motion.revert();
    const rebuild = () => texts();
    document.addEventListener(I18N_BEFORE_CHANGE, release);
    document.addEventListener(I18N_CHANGE, rebuild);
    cleanups.push(() => {
      motion.revert();
      document.removeEventListener(I18N_BEFORE_CHANGE, release);
      document.removeEventListener(I18N_CHANGE, rebuild);
    });

    return () => cleanups.forEach((cleanup) => cleanup?.());
  },
};
