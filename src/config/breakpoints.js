/**
 * Breakpoints in px — Material 3 window size classes, mirrored in CSS media queries.
 * Figma frames: mobile 393, desktop 1440.
 */
export const breakpoints = Object.freeze({
  tablet: 600,
  desktop: 840,
  wide: 1440,
});

export const media = Object.freeze({
  mobile: `(max-width: ${breakpoints.tablet - 0.02}px)`,
  tablet: `(min-width: ${breakpoints.tablet}px) and (max-width: ${breakpoints.desktop - 0.02}px)`,
  desktop: `(min-width: ${breakpoints.desktop}px)`,
  motionOk: '(prefers-reduced-motion: no-preference)',
  reducedMotion: '(prefers-reduced-motion: reduce)',
  finePointer: '(hover: hover) and (pointer: fine)',
  /** Phones, portrait tablets and short landscape phones share the compact stage. */
  compact: `(max-width: ${breakpoints.desktop - 0.02}px), (max-height: 500px) and (orientation: landscape)`,
});
