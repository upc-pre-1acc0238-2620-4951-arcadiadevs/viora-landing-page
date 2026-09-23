import { mountGlass } from '@/components/glass/glass.js';
import { media } from '@/config/breakpoints.js';
import { gsap, ScrollTrigger, SplitText } from '@/core/gsap.js';
import { startScroll, stopScroll } from '@/core/scroll.js';
import { I18N_BEFORE_CHANGE, I18N_CHANGE } from '@/i18n/index.js';
import { clamp, lerp } from '@/utils/math.js';

/** Pinned-reel choreography, as fractions of the pinned scroll. */
const EXPAND = [0.1, 0.5];
const ABOUT = [0.46, 0.8];

const flightEase = gsap.parseEase('power2.inOut');
const expandEase = gsap.parseEase('power3.inOut');
const range = (value, [start, end]) => clamp((value - start) / (end - start), 0, 1);
const smooth = (value) => value * value * (3 - 2 * value);
const mix = (a, b, t) => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  width: lerp(a.width, b.width, t),
  height: lerp(a.height, b.height, t),
});

/**
 * Intro (Lusion-style): the headline slides in from the side, the copy lights
 * up word by word, then the dock leaves the layout, bends through the air to
 * the centre ("Play reel") and finally grows to full bleed (Double Play) with
 * the About content over it.
 *
 * The screen is a fixed box interpolated between three live rects — the lead's
 * dock slot, a centred box inside the sticky stage and the stage itself — so
 * it is always glued to the layout at both ends of the flight. ReelScene
 * mirrors it in WebGL for the bend; the DOM screen is the fallback.
 */
export const intro = {
  selector: '[data-intro]',
  mount(element) {
    const destroyGlass = mountGlass(element);
    const video = element.querySelector('[data-intro-video]');
    const dialog = element.querySelector('[data-intro-dialog]');
    const player = dialog.querySelector('[data-intro-player]');

    // ── Reel dialog ───────────────────────────────────────
    let opener;
    const open = (event) => {
      const button = event.target.closest('[data-intro-open]');
      if (!button) return;
      opener = button;
      dialog.showModal();
      stopScroll();
      player.currentTime = 0;
      player.play().catch(() => {});
    };
    const close = () => dialog.close();
    const closed = () => {
      player.pause();
      startScroll();
      opener?.focus({ preventScroll: true });
    };
    const backdrop = (event) => event.target === dialog && close();
    const closeButton = dialog.querySelector('[data-intro-close]');
    element.addEventListener('click', open);
    closeButton.addEventListener('click', close);
    dialog.addEventListener('click', backdrop);
    dialog.addEventListener('close', closed);

    const motion = gsap.matchMedia();
    motion.add(media.motionOk, () => {
      element.classList.add('intro--motion');
      const cleanups = [];
      const slot = element.querySelector('[data-intro-slot]');
      const reel = element.querySelector('[data-intro-reel]');
      const stage = element.querySelector('[data-intro-stage]');
      const screen = element.querySelector('[data-intro-screen]');
      const play = element.querySelector('[data-intro-play]');
      const words = [...play.querySelectorAll('[data-intro-word]')];
      const about = element.querySelector('[data-intro-about]');
      const compact = window.matchMedia(media.compact);

      // Marquee rows (compact stage): one authored item, cloned to fill the loop.
      const clones = [...element.querySelectorAll('[data-intro-marquee]')].flatMap((track) => {
        const item = track.firstElementChild;
        return Array.from({ length: 11 }, () => track.appendChild(item.cloneNode(true)));
      });
      cleanups.push(() => clones.forEach((clone) => clone.remove()));

      // ── Headline: line one slides out to its indent, line two drifts back ──
      // Compact layouts are left-aligned (Lusion mobile), so both lines just drift.
      const [first, second] = element.querySelectorAll('[data-intro-line]');
      const indent = () => {
        if (compact.matches) return -window.innerWidth * 0.1;
        const text = document.createRange();
        text.selectNodeContents(first);
        return -(first.clientWidth - text.getBoundingClientRect().width);
      };
      gsap.fromTo(
        first,
        { x: indent },
        {
          x: 0,
          ease: 'none',
          scrollTrigger: {
            trigger: first,
            start: 'top bottom',
            end: 'top 25%',
            scrub: 0.6,
            invalidateOnRefresh: true,
          },
        },
      );
      gsap.fromTo(
        second,
        { x: () => window.innerWidth * (compact.matches ? 0.1 : 0.12) },
        {
          x: 0,
          ease: 'none',
          scrollTrigger: {
            trigger: second,
            start: 'top bottom',
            end: 'top 30%',
            scrub: 0.6,
            invalidateOnRefresh: true,
          },
        },
      );

      // ── Copy: words light up as it scrolls in ──
      const copy = element.querySelector('[data-intro-words]');
      const splitCopy = () =>
        SplitText.create(copy, {
          type: 'words',
          autoSplit: true,
          onSplit: (self) =>
            gsap.fromTo(
              self.words,
              { opacity: 0.16 },
              {
                opacity: 1,
                ease: 'none',
                stagger: 0.08,
                scrollTrigger: { trigger: copy, start: 'top 88%', end: 'top 42%', scrub: true },
              },
            ),
        });
      let split = splitCopy();
      const beforeLocale = () => split.revert();
      const afterLocale = () => {
        split = splitCopy();
        ScrollTrigger.refresh();
      };
      document.addEventListener(I18N_BEFORE_CHANGE, beforeLocale);
      document.addEventListener(I18N_CHANGE, afterLocale);
      cleanups.push(() => {
        document.removeEventListener(I18N_BEFORE_CHANGE, beforeLocale);
        document.removeEventListener(I18N_CHANGE, afterLocale);
        split.revert();
      });

      // ── About: built once, scrubbed by the pinned progress ──
      const aboutTimeline = gsap
        .timeline({ paused: true, defaults: { ease: 'power3.out', duration: 1 } })
        .fromTo(
          about.querySelector('[data-intro-rule]'),
          { scaleX: 0 },
          { scaleX: 1, ease: 'power3.inOut', duration: 1.4 },
        )
        .fromTo(
          about.querySelectorAll('[data-intro-reveal]'),
          { autoAlpha: 0, y: 28 },
          { autoAlpha: 1, y: 0, stagger: 0.14 },
          0.25,
        )
        .fromTo(
          about.querySelectorAll('[data-intro-shape]'),
          { autoAlpha: 0, scale: 0.6, rotate: -12 },
          { autoAlpha: 1, scale: 1, rotate: 0, stagger: 0.07, ease: 'back.out(1.8)' },
          0.45,
        );
      cleanups.push(() => aboutTimeline.revert());

      const setPlay = {
        opacity: gsap.quickSetter(play, 'opacity'),
        first: gsap.quickSetter(words[0], 'x', 'px'),
        last: gsap.quickSetter(words[1], 'x', 'px'),
      };

      // ── Scroll progress: flight (slot → centre) and the pinned reel ──
      const progress = { flight: 0, reel: 0 };
      const triggers = [
        ScrollTrigger.create({
          trigger: slot,
          start: 'top 78%',
          endTrigger: stage,
          end: 'top top',
          onUpdate: (self) => (progress.flight = self.progress),
          onRefresh: (self) => (progress.flight = self.progress),
        }),
        ScrollTrigger.create({
          trigger: reel,
          start: 'top top',
          end: 'bottom bottom',
          onUpdate: (self) => (progress.reel = self.progress),
          onRefresh: (self) => (progress.reel = self.progress),
        }),
        ScrollTrigger.create({
          trigger: element,
          start: 'top bottom',
          end: 'bottom top',
          onToggle: (self) => {
            element.classList.toggle('intro--live', self.isActive);
            if (self.isActive) video.play().catch(() => {});
            else video.pause();
          },
        }),
      ];
      cleanups.push(() => triggers.forEach((trigger) => trigger.kill()));

      // Shared with ReelScene.
      const state = { x: 0, y: 0, width: 0, height: 0, radius: 0, bezel: 0 };
      Object.assign(state, { bend: 0, tint: 1, dim: 0 });
      const current = { flight: 0, reel: 0, direction: 1, bend: 0 };
      let lastAbout = -1;

      const centreBox = (bounds) => {
        const width = Math.min(bounds.width * 0.637, bounds.height * 0.583 * (917 / 453));
        const height = width / (917 / 453);
        return {
          x: bounds.x + (bounds.width - width) / 2,
          y: bounds.y + (bounds.height - height) / 2,
          width,
          height,
        };
      };

      // Compact: a card between the marquee rows — portrait on phones and
      // tablets, widescreen under the navbar on landscape phones.
      const cardBox = (bounds) => {
        const portrait = bounds.height > bounds.width;
        const aspect = portrait ? 4 / 5 : 16 / 9;
        const short = bounds.height <= 500;
        const top = portrait ? 150 : short ? 76 : 130;
        const bottom = portrait ? 150 : short ? 20 : 110;
        let width = bounds.width - 2 * Math.max(16, bounds.width * 0.04);
        let height = width / aspect;
        const room = bounds.height - top - bottom;
        if (height > room) {
          height = room;
          width = height * aspect;
        }
        return {
          x: bounds.x + (bounds.width - width) / 2,
          y: bounds.y + top + (room - height) / 2,
          width,
          height,
        };
      };

      const tick = (_time, deltaMs) => {
        if (!element.classList.contains('intro--live')) return;
        const dt = Math.min(deltaMs / 1000, 0.1);
        // Lenis already smooths the page; a short follow keeps the sheet weighty.
        const follow = 1 - Math.exp(-dt * 9);
        const previous = current.flight;
        current.flight += (progress.flight - current.flight) * follow;
        current.reel += (progress.reel - current.reel) * follow;
        const velocity = (current.flight - previous) / Math.max(dt, 1e-3);
        if (Math.abs(velocity) > 0.02) current.direction = Math.sign(velocity);

        // Compact skips the flight: the card is already waiting in the stage.
        const isCompact = compact.matches;
        const flight = isCompact ? 1 : flightEase(current.flight);
        const grow = expandEase(range(current.reel, EXPAND));
        const stageBox = stage.getBoundingClientRect();
        const centre = isCompact ? cardBox(stageBox) : centreBox(stageBox);
        const slotBox = isCompact ? centre : slot.getBoundingClientRect();
        // Bleeds 2px past the stage so the sheet's antialiased rim never shows.
        const bleed = 2 * grow;
        const box = mix(mix(slotBox, centre, flight), stageBox, grow);
        Object.assign(box, {
          x: box.x - bleed,
          y: box.y - bleed,
          width: box.width + bleed * 2,
          height: box.height + bleed * 2,
        });

        const dockRadius = isCompact ? 24 : Math.min(38, Math.max(24, stageBox.width * 0.0264));
        const bezel =
          Math.max(6, lerp(slotBox.width * 0.0207, centre.width * 0.0207, flight)) * (1 - grow);
        const bendTarget =
          Math.sin(Math.PI * current.flight) *
          current.direction *
          (0.55 + Math.min(Math.abs(velocity) * 0.6, 0.45));
        current.bend += (bendTarget - current.bend) * (1 - Math.exp(-dt * 6));

        Object.assign(state, box, {
          radius: dockRadius * (1 - grow),
          bezel,
          bend: isCompact ? 0 : current.bend * (1 - grow),
          tint: isCompact ? 0 : 1 - smooth(range(current.flight, [0.35, 0.95])),
          dim: 0.43 * smooth(range(current.reel, [EXPAND[0] + 0.15, EXPAND[1]])),
        });

        screen.style.transform = `translate3d(${box.x}px, ${box.y}px, 0)`;
        screen.style.width = `${box.width}px`;
        screen.style.height = `${box.height}px`;
        screen.style.setProperty('--radius', `${state.radius}px`);
        screen.style.setProperty('--bezel', `${bezel}px`);
        screen.style.setProperty('--dim', state.dim / 0.43);

        // "Play ▶ Reel" gathers as the sheet lands and parts as it grows.
        const arrive = isCompact ? 1 : smooth(range(current.flight, [0.72, 1]));
        const leave = smooth(range(current.reel, [EXPAND[0], EXPAND[0] + 0.16]));
        const playAlpha = arrive * (1 - leave);
        if (isCompact) {
          stage.style.setProperty('--card-top', `${centre.y - stageBox.y}px`);
          stage.style.setProperty('--card-bottom', `${centre.y + centre.height - stageBox.y}px`);
          stage.style.setProperty('--marquee-alpha', 1 - leave);
        }
        const spread = (1 - arrive) * stageBox.width * 0.14 + grow * stageBox.width * 0.1;
        setPlay.opacity(playAlpha);
        setPlay.first(-spread);
        setPlay.last(spread);
        play.style.visibility = playAlpha > 0.02 ? 'visible' : 'hidden';
        play.inert = playAlpha < 0.5;

        const aboutProgress = range(current.reel, ABOUT);
        if (Math.abs(aboutProgress - lastAbout) > 1e-4) {
          aboutTimeline.progress(aboutProgress);
          about.inert = aboutProgress < 0.6;
          lastAbout = aboutProgress;
        }
      };
      gsap.ticker.add(tick);
      cleanups.push(() => gsap.ticker.remove(tick));

      // ── WebGL sheet, loaded as the section approaches ──
      let scene;
      let alive = true;
      const canvas = element.querySelector('[data-intro-canvas]');
      const loader = ScrollTrigger.create({
        trigger: element,
        start: 'top bottom+=100%',
        once: true,
        onEnter: async () => {
          try {
            const { default: ReelScene } = await import('@/effects/scenes/ReelScene.js');
            if (!alive) return;
            scene = new ReelScene(canvas, { video, state });
            await scene.ready;
            if (alive) element.classList.add('intro--gl');
          } catch (error) {
            console.warn('Reel effect unavailable; using the DOM reel.', error);
          }
        },
      });
      cleanups.push(() => {
        alive = false;
        loader.kill();
        scene?.destroy();
        element.classList.remove('intro--gl');
      });

      return () => {
        cleanups.reverse().forEach((cleanup) => cleanup());
        video.pause();
        element.classList.remove('intro--motion', 'intro--live');
        gsap.set([screen, play, ...words], { clearProps: 'all' });
        screen.removeAttribute('style');
        stage.removeAttribute('style');
        play.inert = false;
        about.inert = false;
      };
    });

    return () => {
      motion.revert();
      destroyGlass();
      element.removeEventListener('click', open);
      closeButton.removeEventListener('click', close);
      dialog.removeEventListener('click', backdrop);
      dialog.removeEventListener('close', closed);
      if (dialog.open) dialog.close();
    };
  },
};
