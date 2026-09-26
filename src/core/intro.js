/**
 * Page intro phases, announced by the preloader so every module can choreograph
 * its entrance against the same clock without importing the preloader itself.
 *
 * - INTRO_OPEN:   the olive window opens over the live Hero.
 * - INTRO_REVEAL: the window expands to full screen; content entrances start.
 * - INTRO_END:    the preloader is gone and the page is interactive.
 *
 * Phases are sticky: `whenIntro` resolves immediately for a phase already
 * reached, so late mounts (HMR, slow effects) never wait forever.
 */
export const INTRO_OPEN = 'intro:open';
export const INTRO_REVEAL = 'intro:reveal';
export const INTRO_END = 'intro:end';

const PHASES = [INTRO_OPEN, INTRO_REVEAL, INTRO_END];
const reached = new Set();

/** Announces a phase, implicitly completing any earlier one that was skipped. */
export function emitIntro(phase) {
  PHASES.slice(0, PHASES.indexOf(phase) + 1).forEach((step) => {
    if (reached.has(step)) return;
    reached.add(step);
    document.dispatchEvent(new CustomEvent(step));
  });
}

export const introReached = (phase) => reached.has(phase);

export function whenIntro(phase) {
  if (reached.has(phase)) return Promise.resolve();
  return new Promise((resolve) =>
    document.addEventListener(phase, () => resolve(), { once: true }),
  );
}
