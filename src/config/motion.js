/**
 * Motion tokens — keep in sync with the motion section of src/styles/settings/tokens.css.
 */
export const ease = Object.freeze({
  outExpo: 'expo.out',
  outQuart: 'quart.out',
  inOutCirc: 'circ.inOut',
  none: 'none',
});

export const duration = Object.freeze({
  fast: 0.2,
  base: 0.4,
  slow: 0.8,
  reveal: 1.2,
});

export const stagger = Object.freeze({
  tight: 0.04,
  base: 0.08,
  loose: 0.15,
});

/**
 * Smooth-scroll feel. `buttery` travels less per wheel tick and glides longer,
 * so scrubbed scenes (features flock, modules card) play out over more input;
 * set SCROLL_FEEL to 'snappy' to go back to the original tuning.
 */
const scrollFeels = {
  snappy: { lerp: 0.1, wheelMultiplier: 1 },
  buttery: { lerp: 0.075, wheelMultiplier: 0.75 },
};
const SCROLL_FEEL = 'buttery';

export const scroll = Object.freeze({
  ...scrollFeels[SCROLL_FEEL],
  revealStart: 'top 85%',
});
