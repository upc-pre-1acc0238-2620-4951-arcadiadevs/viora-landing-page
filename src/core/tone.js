/**
 * Background tone under a point of the viewport, read from the live layout.
 *
 * Sections (and parts of them) declare `data-nav-tone="dark|light"`. Fixed
 * chrome (navbar, scrollbar, sound toggle) asks which tone sits beneath it so
 * its ink keeps its contrast. Among the zones under the line, the last in the
 * document wins: nested zones and later sections sliding over earlier ones.
 * Reading rects (not trigger ranges) keeps pinned scenes and their spacers
 * from ever putting it out of step.
 */
import { qsa } from '@/utils/dom.js';

/** Every tone zone on the page, minus those inside `except` (a zone's own chrome). */
export const toneZones = (except) =>
  qsa('[data-nav-tone]').filter((zone) => !except?.contains(zone));

/** Tone of the zone under viewport line `y`, or undefined when none covers it. */
export function toneAt(zones, y) {
  let tone;
  zones.forEach((zone) => {
    const box = zone.getBoundingClientRect();
    if (box.height && box.top <= y && box.bottom > y) tone = zone.dataset.navTone;
  });
  return tone;
}
