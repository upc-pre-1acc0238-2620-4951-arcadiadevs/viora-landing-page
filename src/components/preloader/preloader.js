/**
 * Page preloader: a stop-motion field notebook that hands over to an
 * editorial stage and opens onto the Hero through an olive-shaped window.
 *
 * 1. Notebook — the grower harvests at 12 fps while handwritten notes appear
 *    and a handwritten counter follows the REAL loading progress (fonts, Hero
 *    artwork, WebGL scene). It leaves only once everything is ready, the
 *    minimum time has passed and the olive has landed in the basket.
 * 2. Zoom    — the drawing is rubbed out, the grid zooms in and its centre
 *    cell fills with ink until it covers the screen.
 * 3. Stage   — frame, isotipo, wordmark and tracked place names.
 * 4. Window  — an olive opens onto the live Hero and expands to reveal it.
 *
 * Phases are broadcast through core/intro.js. Returning visitors (same tab
 * session) get a shorter notebook, "Skip intro" accelerates everything, and
 * reduced motion swaps the show for a still drawing and a simple fade.
 */
import { media } from '@/config/breakpoints.js';
import { gsap, SplitText } from '@/core/gsap.js';
import { emitIntro, INTRO_END, INTRO_OPEN, INTRO_REVEAL } from '@/core/intro.js';
import { startScroll, stopScroll } from '@/core/scroll.js';
import { t } from '@/i18n/index.js';
import { qsa } from '@/utils/dom.js';
import { whenImageReady } from '@/utils/image.js';
import { createGrower } from './grower.js';
import { createNotes } from './notes.js';

const FPS = 12;
const MAX_WAIT = 10000;
const MIN_TIME = { first: 3200, returning: 900 };
const SEEN_KEY = 'viora:intro-seen';
const GRID_ZOOM = 3.2;
const OLIVE_RATIO = 0.72;
const FONTS = [
  '400 1em "Reenie Beanie"',
  '400 1em "The Foriene Serif"',
  'italic 400 1em "The Foriene Serif"',
  '700 1em Axiforma',
];

const settle = (promise) =>
  Promise.resolve(promise).then(
    () => {},
    () => {},
  );
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A broken image is requested again (utils/image.js); a failure never blocks the intro. */
const imageLoaded = (image) => whenImageReady(image);

function readSeen() {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function storeSeen() {
  try {
    sessionStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* storage unavailable — the full intro plays again next time */
  }
}

/** Chamfered frame (Era-style) as an SVG path in viewport pixels. */
function framePath(width, height) {
  const inset = width < 600 ? 10 : 20;
  const cut = width < 600 ? 14 : 24;
  const [l, t0, r, b] = [inset, inset, width - inset, height - inset];
  return `M${l + cut} ${t0}H${r - cut}L${r} ${t0 + cut}V${b - cut}L${r - cut} ${b}H${l + cut}L${l} ${b - cut}V${t0 + cut}Z`;
}

export function mountPreloader({ ready: external = [] } = {}) {
  const root = document.querySelector('[data-preloader]');
  if (!root || root.hidden) {
    emitIntro(INTRO_END);
    return () => {};
  }

  const html = document.documentElement;
  const sheet = root.querySelector('[data-preloader-sheet]');
  const grid = root.querySelector('[data-preloader-grid]');
  const figure = root.querySelector('[data-preloader-figure]');
  const counter = root.querySelector('[data-preloader-count]');
  const progress = root.querySelector('[data-preloader-progress]');
  const stage = root.querySelector('[data-preloader-stage]');
  const frame = root.querySelector('[data-preloader-frame]');
  const skip = root.querySelector('[data-preloader-skip]');
  const blocked = [document.querySelector('[data-navbar]'), document.getElementById('main')];

  const calm = window.matchMedia(media.reducedMotion).matches;
  const seen = readSeen();
  const minTime = seen ? MIN_TIME.returning : MIN_TIME.first;
  const started = performance.now();

  // ── Lock the page behind the curtain ─────────────────────────────────────
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (!location.hash) window.scrollTo(0, 0);
  html.classList.add('is-intro');
  blocked.forEach((element) => element?.setAttribute('inert', ''));
  stopScroll();

  let cell = 0;
  const layout = () => {
    cell = Math.max(56, window.innerWidth * 0.0715);
    grid.style.setProperty('--cell', `${cell}px`);
  };
  layout();
  window.addEventListener('resize', layout);

  // ── Real loading progress ────────────────────────────────────────────────
  const hero = document.querySelector('[data-hero]');
  const tasks = [
    ...FONTS.map((font) => document.fonts.load(font)),
    ...qsa('img', hero ?? document).map(imageLoaded),
    ...qsa('img', root).map(imageLoaded),
    ...external,
  ].map(settle);
  let loadedTasks = 0;
  tasks.forEach((task) => task.then(() => (loadedTasks += 1)));
  let loaded = false;
  // Dev only: `?hold` keeps the notebook looping for design QA.
  const hold = import.meta.env.DEV && new URLSearchParams(location.search).has('hold');
  if (!hold) Promise.race([Promise.all(tasks), wait(MAX_WAIT)]).then(() => (loaded = true));

  // ── Stop-motion notebook ─────────────────────────────────────────────────
  const grower = createGrower(figure);
  const notes = createNotes(figure, t('preloader.notes').split('|'));
  let shown = 0;
  let harvested = false;
  let skipped = false;
  let outro = null;
  let splits = [];
  let accumulator = 0;
  let destroyed = false;

  const paintCounter = () => {
    const value = Math.floor(shown);
    counter.textContent = String(value);
    progress.value = value;
  };

  const canLeave = () =>
    loaded && shown >= 100 && (skipped || seen || (harvested && grower.resting));

  function frameStep() {
    const elapsed = performance.now() - started;
    const real = (loadedTasks / tasks.length) * 100;
    const paced = skipped ? 100 : (elapsed / minTime) * 100;
    const goal = loaded ? Math.min(100, paced) : Math.min(real, paced, 99);
    if (goal > shown) shown = Math.min(goal, shown + Math.max(1, (goal - shown) * 0.3));
    paintCounter();

    if (!outro) {
      grower.step();
      if (grower.frame === 35) harvested = true;
      notes.step();
      if (canLeave()) playOutro();
    } else {
      notes.step();
    }
  }

  const tick = (_time, deltaMs) => {
    accumulator += deltaMs / 1000;
    if (accumulator < 1 / FPS) return;
    accumulator = Math.min(accumulator - 1 / FPS, 1 / FPS);
    frameStep();
  };

  // ── Outro choreography ───────────────────────────────────────────────────
  function stageSplits() {
    const byChar = (selector, options = {}) =>
      SplitText.create(root.querySelector(selector), { type: 'chars', ...options });
    splits = [
      byChar('[data-preloader-name]', { mask: 'chars' }),
      byChar('[data-preloader-script]'),
      ...qsa('[data-preloader-side]', root).map((side) =>
        SplitText.create(side, { type: 'chars' }),
      ),
    ];
    const [name, script, ...sides] = splits;
    return { name: name.chars, script: script.chars, sides: sides.map((side) => side.chars) };
  }

  function playOutro() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const zoomed = cell * GRID_ZOOM;
    const [cellX, cellY] = [(width - zoomed) / 2, (height - zoomed) / 2];
    const center = 0.52;
    const openX = Math.min(height * 0.245, width * 0.36);
    const coverX = Math.hypot(width / 2, height * center * OLIVE_RATIO) * 1.08;

    frame.parentElement.setAttribute('viewBox', `0 0 ${width} ${height}`);
    frame.setAttribute('d', framePath(width, height));
    const frameLength = frame.getTotalLength();
    const chars = stageSplits();
    const edgeChars = (index) => chars.sides[index];

    window.removeEventListener('resize', layout);
    notes.close();
    stage.style.setProperty('--wc', `${center * 100}%`);

    outro = gsap.timeline({
      defaults: { ease: 'expo.out' },
      onComplete: finish,
    });

    outro
      // 2 · rub out the drawing, zoom into the grid, fill the centre cell
      .to(figure, { opacity: 0, duration: 0.3, ease: 'steps(3)' }, 0)
      .to('[data-preloader-meta]', { opacity: 0, duration: 0.3, ease: 'steps(3)' }, 0)
      .to(grid, { '--cell': `${zoomed}px`, duration: 1.4, ease: 'expo.inOut' }, 0.1)
      .set(stage, { visibility: 'visible' }, 0.95)
      // Ink rises inside the centre cell, then floods the page.
      .fromTo(
        stage,
        {
          '--ink-top': `${cellY + zoomed}px`,
          '--ink-x': `${cellX}px`,
          '--ink-bottom': `${cellY}px`,
        },
        { '--ink-top': `${cellY}px`, duration: 0.5, ease: 'power3.inOut' },
        0.95,
      )
      .to(
        stage,
        {
          '--ink-top': '0px',
          '--ink-x': '0px',
          '--ink-bottom': '0px',
          duration: 1,
          ease: 'expo.inOut',
        },
        1.45,
      )
      .set(sheet, { visibility: 'hidden' }, 2.45)

      // 3 · editorial stage
      .fromTo(
        frame,
        { strokeDasharray: frameLength, strokeDashoffset: frameLength },
        { strokeDashoffset: 0, duration: 1.8, ease: 'power2.inOut' },
        1.9,
      )
      .from('[data-preloader-mark]', { opacity: 0, scale: 0.6, rotate: -60, duration: 1.4 }, 2)
      .from(chars.name, { yPercent: 110, duration: 1.2, stagger: 0.07 }, 2.05)
      .from(
        chars.script,
        {
          opacity: 0,
          filter: 'blur(8px)',
          x: -6,
          duration: 0.9,
          stagger: 0.035,
          ease: 'power2.out',
        },
        2.45,
      )
      .from(
        edgeChars(0),
        { opacity: 0, x: -24, duration: 1, stagger: { each: 0.06, from: 'end' } },
        2.2,
      )
      .from(edgeChars(1), { opacity: 0, x: 24, duration: 1, stagger: 0.06 }, 2.2)
      .fromTo(
        '[data-preloader-watermark]',
        { opacity: 0, scale: 1.12 },
        { opacity: 1, scale: 1, duration: 3, ease: 'power2.out' },
        2.1,
      )
      .from('[data-preloader-rule]', { scaleY: 0, duration: 1.1, ease: 'expo.inOut' }, 2.5)
      .from(
        '[data-preloader-tagline] > *',
        { yPercent: 100, opacity: 0, stagger: 0.08, duration: 0.9 },
        2.8,
      )

      // 4 · the olive window
      .to(chars.name, { yPercent: -110, duration: 0.6, stagger: 0.035, ease: 'power3.in' }, 3.9)
      .to(
        chars.script,
        { opacity: 0, filter: 'blur(6px)', duration: 0.5, stagger: 0.02, ease: 'power2.in' },
        3.95,
      )
      .to(
        ['[data-preloader-rule]', '[data-preloader-tagline]'],
        { opacity: 0, duration: 0.4, ease: 'power2.in' },
        4,
      )
      .call(() => emitIntro(INTRO_OPEN), null, 4.3)
      .set(stage, { '--wx': '0.01px', '--wy': '0.01px' }, 4.3)
      .call(() => root.classList.add('is-window'), null, 4.3)
      .to(stage, { '--wx': `${openX}px`, '--wy': `${openX / OLIVE_RATIO}px`, duration: 1.3 }, 4.3)
      .fromTo(
        '[data-preloader-ring]',
        { opacity: 0, scale: 0.7 },
        { opacity: 1, scale: 1, duration: 1.4, stagger: 0.12 },
        4.35,
      )
      .call(() => emitIntro(INTRO_REVEAL), null, 5.4)
      .to(
        stage,
        {
          '--wx': `${coverX}px`,
          '--wy': `${coverX / OLIVE_RATIO}px`,
          duration: 1.5,
          ease: 'expo.inOut',
        },
        5.4,
      )
      .to(
        '[data-preloader-ring]',
        { scale: 2.6, opacity: 0, duration: 1.3, ease: 'expo.inOut' },
        5.4,
      )
      .to(
        edgeChars(0),
        { x: -40, opacity: 0, duration: 0.8, stagger: 0.03, ease: 'power3.in' },
        5.4,
      )
      .to(
        edgeChars(1),
        {
          x: 40,
          opacity: 0,
          duration: 0.8,
          stagger: { each: 0.03, from: 'end' },
          ease: 'power3.in',
        },
        5.4,
      )
      .to(
        ['[data-preloader-mark]', '[data-preloader-watermark]', frame, skip],
        { opacity: 0, duration: 0.7, ease: 'power2.in' },
        5.45,
      );

    outro.timeScale(seen ? 1.9 : 1.15);
    if (skipped) outro.timeScale(2.6);
  }

  function finish() {
    if (destroyed) return;
    emitIntro(INTRO_END);
    storeSeen();
    teardown();
  }

  function teardown() {
    gsap.ticker.remove(tick);
    window.removeEventListener('resize', layout);
    skip.removeEventListener('click', onSkip);
    notes.destroy();
    grower.destroy();
    splits.forEach((split) => split.revert());
    root.hidden = true;
    html.classList.remove('is-intro');
    blocked.forEach((element) => element?.removeAttribute('inert'));
    startScroll();
  }

  function onSkip() {
    skipped = true;
    outro?.timeScale(2.6);
    skip.disabled = true;
  }

  // Unblock the page the moment its content starts entering.
  const onReveal = () => blocked.forEach((element) => element?.removeAttribute('inert'));
  document.addEventListener(INTRO_REVEAL, onReveal, { once: true });

  if (calm) {
    grower.svg.classList.add('grower--still');
    const calmTick = () => {
      shown = (loadedTasks / tasks.length) * 100;
      paintCounter();
    };
    gsap.ticker.add(calmTick);
    Promise.race([Promise.all(tasks), wait(MAX_WAIT)]).then(() => {
      gsap.ticker.remove(calmTick);
      shown = 100;
      paintCounter();
      emitIntro(INTRO_REVEAL);
      gsap.to(root, { opacity: 0, duration: 0.35, ease: 'power1.out', onComplete: finish });
    });
  } else {
    gsap.ticker.add(tick);
  }
  if (import.meta.env.DEV) {
    window.__preloader = {
      outro: () => outro,
      advance: frameStep,
      freeze: () => gsap.ticker.remove(tick),
      step: () => (grower.step(), grower.frame),
      resume: () => gsap.ticker.add(tick),
    };
  }
  skip.addEventListener('click', onSkip);

  return () => {
    if (destroyed) return;
    destroyed = true;
    outro?.kill();
    document.removeEventListener(INTRO_REVEAL, onReveal);
    if (!root.hidden) teardown();
  };
}
