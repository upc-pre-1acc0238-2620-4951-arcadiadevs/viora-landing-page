/**
 * Visitor experience preferences (settings panel), persisted in localStorage.
 *
 * - distortion: pointer-driven fluid distortion of the Hero artwork.
 * - sound: music beds and interface cues (core/sound.js), off by default:
 *   browsers only start audio from a gesture, and silence is the courteous default.
 * - soundAsked: the visitor already answered the preloader's "with sound / in
 *   silence" question, so it is not asked again.
 *
 * Emits `preferences:change` on document with `{ key, value }` so effects can
 * react live without importing the settings UI.
 */
import { media } from '@/config/breakpoints.js';

const STORAGE_KEY = 'viora:preferences';

export const PREFERENCES_CHANGE = 'preferences:change';

const defaults = () => ({
  distortion: !window.matchMedia(media.reducedMotion).matches,
  sound: false,
  soundAsked: false,
});

function read() {
  try {
    return { ...defaults(), ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') };
  } catch {
    return defaults();
  }
}

let state = read();

export const getPreference = (key) => state[key];

export function setPreference(key, value) {
  if (!Object.hasOwn(state, key) || state[key] === value) return;
  state = { ...state, [key]: value };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable (private mode) — preference lasts for this visit only */
  }
  document.dispatchEvent(new CustomEvent(PREFERENCES_CHANGE, { detail: { key, value } }));
}
