/**
 * Sound toggle (santionispirits.com): four bars that dance to whatever is
 * playing, folding into four dots when sound is off.
 *
 * - The bars read the live spectrum (core/sound.js), one band each, so they
 *   follow the music rather than loop a canned animation.
 * - On but silent (a dialog holds the music back), they breathe low; off,
 *   a soft ripple runs along the dots every few seconds, a hint to listen.
 * - The click writes the `sound` preference; the engine fades, never cuts.
 * - Its ink follows the background beneath it (`data-nav-tone`).
 */
import { gsap } from '@/core/gsap.js';
import { INTRO_END, whenIntro } from '@/core/intro.js';
import { getPreference, PREFERENCES_CHANGE, setPreference } from '@/core/preferences.js';
import { musicPlaying, soundLevels } from '@/core/sound.js';
import { toneAt, toneZones } from '@/core/tone.js';
import { media } from '@/config/breakpoints.js';
import { qsa } from '@/utils/dom.js';

/** Half the tallest bar, in viewBox units (the viewBox is 24 tall). */
const REACH = 7;
/** Shortest bar while on: clearly a bar, never mistaken for the "off" dots. */
const FLOOR = 1.5;

export const soundToggle = {
  selector: '[data-sound-toggle]',
  mount(element) {
    const bars = qsa('[data-sound-bar]', element);
    const reduced = window.matchMedia(media.reducedMotion);
    const levels = new Float32Array(bars.length);
    const heights = new Float32Array(bars.length);
    // Each band's own running mean and recent peak. Raw loudness pins the
    // bass bar and leaves the treble flat, so every bar shows its band's swing
    // above its mean (a slow AGC): steady energy rests low, accents jump.
    const means = new Float32Array(bars.length);
    const peaks = new Float32Array(bars.length).fill(0.2);
    const state = { on: getPreference('sound') ? 1 : 0 };
    let drawn = '';

    const sync = () => {
      const on = Boolean(getPreference('sound'));
      element.setAttribute('aria-pressed', String(on));
      gsap.to(state, {
        on: on ? 1 : 0,
        duration: on ? 0.9 : 1.6,
        ease: on ? 'expo.out' : 'power2.inOut',
        overwrite: true,
      });
    };
    const onPreference = ({ detail }) => detail.key === 'sound' && sync();
    const toggle = () => setPreference('sound', !getPreference('sound'));

    const zones = toneZones(element);
    let lastScroll = -1;
    const draw = (time) => {
      if (window.scrollY !== lastScroll) {
        lastScroll = window.scrollY;
        const box = element.getBoundingClientRect();
        const tone = toneAt(zones, box.top + box.height / 2);
        if (tone && element.dataset.tone !== tone) element.dataset.tone = tone;
      }

      soundLevels(levels);
      const music = musicPlaying();
      const calm = reduced.matches;
      bars.forEach((_bar, i) => {
        // Low breathing while on, so "on but quiet" still reads as on.
        const breath = FLOOR + (calm ? 0.4 : 0.4 + 0.6 * Math.sin(time * 2.4 + i * 1.3));
        means[i] += (levels[i] - means[i]) * 0.03;
        peaks[i] = Math.max(levels[i], peaks[i] * 0.995, means[i] + 0.04);
        const floor = means[i] * 0.85;
        const level = Math.min(Math.max((levels[i] - floor) / (peaks[i] - floor), 0), 1);
        const live = music ? FLOOR + level ** 1.4 * (REACH - FLOOR) : breath;
        // Off: every 8 s one soft ripple runs along the dots, a hint to listen.
        const wave = (time % 8) * 4 - i * 0.9;
        const invite = !calm && wave > 0 && wave < Math.PI ? Math.sin(wave) ** 6 * 1.6 : 0;
        const target = state.on * live + (1 - state.on) * invite;
        // Rise fast, fall slow: reads like a VU meter.
        const speed = target > heights[i] ? 0.45 : 0.14;
        heights[i] += (target - heights[i]) * speed;
      });

      const next = [...heights].map((h) => h.toFixed(2)).join();
      if (next === drawn) return;
      drawn = next;
      bars.forEach((bar, i) => {
        bar.setAttribute('y1', (12 - heights[i]).toFixed(2));
        bar.setAttribute('y2', (12 + heights[i]).toFixed(2));
      });
    };
    gsap.ticker.add(draw);

    // Appears with the page, after the preloader.
    whenIntro(INTRO_END).then(() => element.classList.add('is-ready'));

    sync();
    element.addEventListener('click', toggle);
    document.addEventListener(PREFERENCES_CHANGE, onPreference);
    return () => {
      gsap.ticker.remove(draw);
      gsap.killTweensOf(state);
      element.removeEventListener('click', toggle);
      document.removeEventListener(PREFERENCES_CHANGE, onPreference);
    };
  },
};
