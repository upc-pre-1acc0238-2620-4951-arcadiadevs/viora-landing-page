import { media } from '@/config/breakpoints.js';
import { gsap, ScrollTrigger } from '@/core/gsap.js';
import { I18N_CHANGE, t } from '@/i18n/index.js';

/** Segment key prefixes in the `bottle.*` locale block. */
const KEYS = ['grower', 'coop'];
/** Pixels of drag that commit a swap. */
const COMMIT = 90;
/** Pixels of drag for the full preview lean. */
const RANGE = 320;

/** santionispirits.com's per-frame lerp, normalised to the real frame time. */
const follow = (alpha, frames) => 1 - (1 - alpha) ** frames;

/**
 * Closing CTA (santionispirits.com). A WebGL olive oil bottle per segment
 * stands in front of a huge headline. Drag it (or pick a tab) and it turns
 * over to the other segment: the oil changes colour and sloshes, the label
 * swaps, the headline letters scatter and regroup and the room recolours.
 * Three.js only loads once the section is close.
 */
export const bottle = {
  selector: '[data-bottle]',
  mount(element) {
    const stage = element.querySelector('[data-bottle-stage]');
    const holder = element.querySelector('[data-bottle-canvas]');
    const title = element.querySelector('[data-bottle-title]');
    const lines = [...element.querySelectorAll('[data-bottle-line]')];
    const swaps = [...element.querySelectorAll('[data-bottle-swap]')];
    const tabs = [...element.querySelectorAll('[data-bottle-tab]')];
    const cursor = element.querySelector('[data-bottle-cursor]');
    const reduced = window.matchMedia(media.reducedMotion);
    const fine = window.matchMedia(media.finePointer);
    const cleanups = [];
    let segment = 0;
    let scene = null;
    let busy = false;

    // ── Headline letters ────────────────────────────────
    let chars = [];
    const splitLines = () => {
      title.setAttribute('aria-label', lines.map((line) => line.textContent.trim()).join(' '));
      chars = lines.map((line) => {
        const text = line.textContent;
        line.replaceChildren(
          ...[...text].map((letter) => {
            const span = document.createElement('span');
            span.className = 'bottle__char';
            span.setAttribute('aria-hidden', 'true');
            span.textContent = letter === ' ' ? ' ' : letter;
            return span;
          }),
        );
        return [...line.children];
      });
    };
    const scatter = (amount) =>
      chars.forEach((row) => {
        const middle = (row.length - 1) / 2;
        row.forEach((char, i) => {
          const spread = (i - middle) / Math.max(middle, 1);
          gsap.to(char, {
            x: amount * (spread * 90 + 140),
            opacity: 1 - Math.min(Math.abs(amount) * 1.2, 0.85),
            duration: 0.45,
            ease: 'power3.out',
            overwrite: 'auto',
          });
        });
      });

    const label = (index) => ({
      kind: t(`bottle.${KEYS[index]}Kind`),
      top: t('bottle.labelTop'),
      bottom: t('bottle.labelBottom'),
      batch: `${t(`bottle.${KEYS[index]}Batch`)} · ${t(`bottle.${KEYS[index]}Harvest`)}`,
    });

    // Rewrites every per-segment string for `index` (the i18n keys follow it).
    const setTexts = (index) => {
      lines.forEach((line) => {
        const key = `bottle.${KEYS[index]}Line${line.dataset.bottleLine}`;
        line.dataset.i18n = key;
        line.textContent = t(key);
      });
      swaps.forEach((node) => {
        const key = `bottle.${KEYS[index]}${node.dataset.bottleSwap}`;
        node.dataset.i18n = key;
        node.textContent = t(key);
      });
      splitLines();
      inkCopy();
    };

    const select = (index) => {
      element.dataset.segment = String(index);
      tabs.forEach((tab, i) => tab.setAttribute('aria-selected', String(i === index)));
      inkCopy();
    };

    // ── Swap ────────────────────────────────────────────
    const go = (index, direction = index > segment ? 1 : -1) => {
      if (index === segment || busy) return;
      segment = index;
      select(index);
      if (reduced.matches || !scene) {
        setTexts(index);
        scene?.show(index);
        return;
      }
      busy = true;
      scene.swap(index, direction);
      // Letters fly off with the turn, the new ones regroup from the other side.
      const out = gsap.timeline({
        onComplete: () => {
          setTexts(index);
          chars.flat().forEach((char) => gsap.set(char, { x: -direction * 260, opacity: 0 }));
          chars.forEach((row, r) =>
            gsap.to(row, {
              x: 0,
              opacity: 1,
              duration: 1,
              stagger: { each: 0.025, from: direction > 0 ? 'start' : 'end' },
              delay: r * 0.06,
              ease: 'expo.out',
              onComplete: () => (busy = false),
            }),
          );
        },
      });
      chars.forEach((row, r) => {
        const middle = (row.length - 1) / 2;
        out.to(
          row,
          {
            x: (i) => direction * (((i - middle) / Math.max(middle, 1)) * 160 + 320),
            opacity: 0,
            duration: 0.55,
            stagger: { each: 0.015, from: direction > 0 ? 'end' : 'start' },
            ease: 'power2.in',
            overwrite: 'auto',
          },
          r * 0.04,
        );
      });
    };
    tabs.forEach((tab, i) => {
      const pick = () => go(i);
      tab.addEventListener('click', pick);
      cleanups.push(() => tab.removeEventListener('click', pick));
    });

    // ── Cursor (santionispirits.com) ────────────────────
    // A disc hangs off the grab hand, half a disc down and towards the centre.
    // It trails the pointer and stretches along its smoothed speed (squash and
    // stretch); inside it, a clone of the stage copy is counter-transformed so
    // it stays put, which reads as the disc inking the letters it covers.
    const disc = cursor.querySelector('[data-bottle-cursor-disc]');
    const ink = cursor.querySelector('[data-bottle-cursor-ink]');
    const icon = cursor.querySelector('[data-bottle-cursor-icon]');
    const wide = window.matchMedia(media.desktop);
    const client = { x: 0, y: 0 };
    const last = { x: 0, y: 0 };
    const speed = { x: 0, y: 0 };
    const at = { x: 0, y: 0 };
    const badge = { scale: 0 };
    let size = 0;
    let angle = 0;
    let over = false;
    let ghosts = [];

    function inkCopy() {
      ghosts = [];
      if (!fine.matches || !wide.matches) {
        ink.replaceChildren();
        return;
      }
      const parts = stage.querySelectorAll(
        ':scope > :is(.bottle__title, .bottle__store, .bottle__foot)',
      );
      ink.replaceChildren(
        ...[...parts].map((part) => {
          const copy = part.cloneNode(true);
          // Hooks off, so neither i18n nor the section ever reach the clone.
          [copy, ...copy.querySelectorAll('*')].forEach((node) => {
            [...node.attributes]
              .filter(({ name }) => name === 'id' || name.startsWith('data-'))
              .forEach(({ name }) => node.removeAttribute(name));
          });
          return copy;
        }),
      );
      // The letters scatter through inline styles: mirrored every frame.
      const copies = ink.querySelectorAll('.bottle__char');
      ghosts = [...title.querySelectorAll('.bottle__char')].map((char, i) => [char, copies[i]]);
    }

    const measure = () => {
      size = disc.offsetWidth;
      ink.style.width = `${stage.offsetWidth}px`;
      ink.style.height = `${stage.offsetHeight}px`;
    };
    const resized = new ResizeObserver(measure);
    resized.observe(stage);
    const refit = () => {
      measure();
      inkCopy();
    };
    wide.addEventListener('change', refit);
    fine.addEventListener('change', refit);

    const draw = (_time, deltaMs) => {
      const frames = Math.min(deltaMs, 100) / (1000 / 60) || 1;
      // Speed in px per 60 fps frame, eased like the reference's uVelocity.
      const ease = follow(0.1, frames);
      speed.x += ((client.x - last.x) / frames - speed.x) * ease;
      speed.y += ((client.y - last.y) / frames - speed.y) * ease;
      last.x = client.x;
      last.y = client.y;
      const hidden = !over && badge.scale < 0.001;
      cursor.style.visibility = hidden ? 'hidden' : '';
      if (hidden) return;

      const box = stage.getBoundingClientRect();
      const x = client.x - box.left;
      const y = client.y - box.top;
      const side = x > box.width / 2 ? 1 : -1;
      const glide = follow(0.2, frames);
      at.x += (x - (side * size) / 2 - at.x) * glide;
      at.y += (y + size / 2 - at.y) * glide;
      // The arrow points out towards the pointer's side.
      angle += ((side > 0 ? 0 : 180) - angle) * ease;

      // Stretch along the motion, pinch 10 % across it: M = R · diag · Rᵀ.
      const stretch = Math.min(Math.hypot(speed.x, speed.y) * 0.03, 1);
      const heading = Math.atan2(speed.y, speed.x);
      const cos = Math.cos(heading);
      const sin = Math.sin(heading);
      const along = 1 + stretch;
      const across = 1 - stretch * 0.1;
      const a = along * cos * cos + across * sin * sin;
      const b = (along - across) * cos * sin;
      const d = along * sin * sin + across * cos * cos;
      const det = a * d - b * b;
      const scale = Math.max(badge.scale, 0.01);

      cursor.style.transform = `translate(${at.x}px, ${at.y}px) scale(${scale})`;
      disc.style.transform = `matrix(${a}, ${b}, ${b}, ${d}, 0, 0)`;
      // The inverse of all of the above, so the inked copy never moves.
      ink.style.transform =
        `translate(${size / 2}px, ${size / 2}px) ` +
        `matrix(${d / det}, ${-b / det}, ${-b / det}, ${a / det}, 0, 0) ` +
        `scale(${1 / scale}) translate(${-at.x}px, ${-at.y}px)`;
      icon.style.transform = `rotate(${angle}deg)`;
      ghosts.forEach(([from, to]) => {
        to.style.transform = from.style.transform;
        to.style.opacity = from.style.opacity;
      });
    };
    gsap.ticker.add(draw);

    const showCursor = (on) => {
      if (on === over) return;
      over = on;
      if (on && badge.scale < 0.001) {
        // Appear at the pointer rather than fly in from the last spot.
        const box = stage.getBoundingClientRect();
        const x = client.x - box.left;
        const side = x > box.width / 2 ? 1 : -1;
        at.x = x - (side * size) / 2;
        at.y = client.y - box.top + size / 2;
        angle = side > 0 ? 0 : 180;
      }
      gsap.to(badge, {
        scale: on ? 1 : 0,
        duration: on ? 0.6 : 0.3,
        ease: 'power2.out',
        overwrite: 'auto',
      });
    };

    // ── Drag ────────────────────────────────────────────
    let start = null;
    let dx = 0;
    // The whole stage is the handle; its buttons and links stay clickable.
    const interactive = (event) => event.target.closest('a, button');
    const down = (event) => {
      if (busy || event.button > 0 || interactive(event)) return;
      start = { x: event.clientX, y: event.clientY, id: event.pointerId };
      dx = 0;
    };
    const move = (event) => {
      const box = stage.getBoundingClientRect();
      const inside =
        event.clientX >= box.left &&
        event.clientX <= box.right &&
        event.clientY >= box.top &&
        event.clientY <= box.bottom;
      if (event.pointerType === 'mouse') {
        // The bottle keeps turning the way the mouse last went (the reference).
        const step = event.clientX - client.x;
        if (Math.abs(step) > 0.01) scene?.steer(Math.sign(step));
        // Resting pointer: the bottle follows it to its side.
        if (inside) scene?.hover(((event.clientX - box.left) / box.width) * 2 - 1);
      }
      client.x = event.clientX;
      client.y = event.clientY;
      if (fine.matches) showCursor(inside && !interactive(event));
      if (!start || event.pointerId !== start.id) return;
      dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (!element.classList.contains('is-dragging')) {
        // Only a horizontal pull is a drag; vertical is the page scrolling.
        if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
        element.classList.add('is-dragging');
        stage.setPointerCapture?.(event.pointerId);
      }
      const amount = Math.max(-1, Math.min(1, dx / RANGE));
      scene?.preview(amount);
      scatter(amount * 0.6);
    };
    const up = () => {
      if (!start) return;
      const dragged = element.classList.contains('is-dragging');
      start = null;
      element.classList.remove('is-dragging');
      if (!dragged) return;
      if (Math.abs(dx) > COMMIT) {
        go(1 - segment, dx > 0 ? 1 : -1);
      } else {
        scene?.preview(0);
        scatter(0);
      }
    };
    const leave = () => {
      showCursor(false);
      scene?.hover(0);
    };
    stage.addEventListener('pointerdown', down);
    stage.addEventListener('pointerleave', leave);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    cleanups.push(() => {
      gsap.ticker.remove(draw);
      resized.disconnect();
      wide.removeEventListener('change', refit);
      fine.removeEventListener('change', refit);
      stage.removeEventListener('pointerdown', down);
      stage.removeEventListener('pointerleave', leave);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    });

    // ── The scene, loaded when the section gets close ───
    const loadMark = () =>
      new Promise((resolve) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => resolve(null);
        image.src = '/assets/logos/viora-isotipo-green.svg';
      });
    const paint = async () => {
      if (!scene) return;
      await document.fonts.load('64px "The Foriene Serif"').catch(() => {});
      scene.paint([label(0), label(1)], await loadMark());
    };

    let entry = null;
    const near = new IntersectionObserver(
      async ([hit]) => {
        if (!hit.isIntersecting) return;
        near.disconnect();
        try {
          const { default: BottleScene } = await import('@/effects/scenes/BottleScene.js');
          scene = new BottleScene(holder);
          scene.show(segment);
          await paint();
          if (reduced.matches) return;
          entry = ScrollTrigger.create({
            trigger: element,
            start: 'top bottom',
            end: 'top 15%',
            scrub: 0.6,
            onUpdate: (self) => {
              scene.setEntry(self.progress);
              scene.nudge(self.getVelocity() * -0.00004);
            },
            onRefresh: (self) => scene.setEntry(self.progress),
          });
          scene.setEntry(entry.progress);
        } catch (error) {
          // No WebGL: the headline and the store buttons still carry the CTA.
          console.warn('Bottle scene unavailable.', error);
        }
      },
      { rootMargin: '100% 0px' },
    );
    near.observe(element);
    cleanups.push(() => {
      near.disconnect();
      entry?.kill();
      scene?.destroy();
    });

    // ── Language ────────────────────────────────────────
    const relabel = () => {
      setTexts(segment);
      paint();
    };
    document.addEventListener(I18N_CHANGE, relabel);
    cleanups.push(() => document.removeEventListener(I18N_CHANGE, relabel));

    setTexts(segment);
    return () => cleanups.forEach((cleanup) => cleanup());
  },
};
