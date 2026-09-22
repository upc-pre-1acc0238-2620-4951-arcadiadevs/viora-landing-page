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

export const scroll = Object.freeze({
  lerp: 0.1,
  wheelMultiplier: 1,
  revealStart: 'top 85%',
});
