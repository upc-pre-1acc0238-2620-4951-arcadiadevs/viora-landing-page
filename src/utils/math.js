export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const lerp = (start, end, amount) => start + (end - start) * amount;

export const mapRange = (value, inMin, inMax, outMin, outMax) =>
  outMin + ((value - inMin) * (outMax - outMin)) / (inMax - inMin);
