export const qs = (selector, scope = document) => scope.querySelector(selector);

export const qsa = (selector, scope = document) => [...scope.querySelectorAll(selector)];

/** Reads a data attribute as a number, falling back when missing or invalid. */
export function dataNumber(element, key, fallback) {
  const value = Number.parseFloat(element.dataset[key]);
  return Number.isFinite(value) ? value : fallback;
}
