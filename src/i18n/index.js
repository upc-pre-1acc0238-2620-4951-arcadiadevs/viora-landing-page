/**
 * Client-side i18n (US41).
 *
 * - Detects the browser language on first visit (English if the browser uses
 *   it, Spanish otherwise) and persists manual choices in localStorage.
 * - Translates without reloading:
 *     data-i18n="nav.home"                         → textContent (also works on <title>)
 *     data-i18n-html="hero.title"                  → innerHTML (trusted locale strings only)
 *     data-i18n-attr="aria-label:nav.menu;alt:x.y" → attributes
 * - Switchers: <button data-locale-switch="en">English</button>
 * - Emits `i18n:beforechange` / `i18n:change` on document so modules that
 *   transform text (e.g. SplitText) can revert and rebuild.
 */
import en from './locales/en.json';
import es from './locales/es.json';
import { qsa } from '@/utils/dom.js';

const dictionaries = { es, en };
const DEFAULT_LOCALE = 'es';
const STORAGE_KEY = 'viora:locale';

export const I18N_BEFORE_CHANGE = 'i18n:beforechange';
export const I18N_CHANGE = 'i18n:change';

let currentLocale = DEFAULT_LOCALE;

const isSupported = (locale) => Object.hasOwn(dictionaries, locale);

function readStoredLocale() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeLocale(locale) {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* storage unavailable (private mode) — preference lasts for this visit only */
  }
}

function detectLocale() {
  const stored = readStoredLocale();
  if (isSupported(stored)) return stored;
  const prefersEnglish = navigator.languages?.[0]?.toLowerCase().startsWith('en');
  return prefersEnglish ? 'en' : DEFAULT_LOCALE;
}

export function t(key, locale = currentLocale) {
  const value = key.split('.').reduce((node, part) => node?.[part], dictionaries[locale]);
  return typeof value === 'string' ? value : key;
}

function translateAttributes(element) {
  element.dataset.i18nAttr.split(';').forEach((pair) => {
    const [attribute, key] = pair.split(':').map((part) => part.trim());
    if (attribute && key) element.setAttribute(attribute, t(key));
  });
}

function updateSwitchers() {
  qsa('[data-locale-switch]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.localeSwitch === currentLocale));
  });
}

function applyTranslations(root = document) {
  document.documentElement.lang = t('meta.lang');
  qsa('[data-i18n]', root).forEach((el) => (el.textContent = t(el.dataset.i18n)));
  qsa('[data-i18n-html]', root).forEach((el) => (el.innerHTML = t(el.dataset.i18nHtml)));
  qsa('[data-i18n-attr]', root).forEach(translateAttributes);
  updateSwitchers();
}

export function setLocale(locale) {
  if (!isSupported(locale) || locale === currentLocale) return;
  document.dispatchEvent(new CustomEvent(I18N_BEFORE_CHANGE, { detail: { locale } }));
  currentLocale = locale;
  storeLocale(locale);
  applyTranslations();
  document.dispatchEvent(new CustomEvent(I18N_CHANGE, { detail: { locale } }));
}

export const getLocale = () => currentLocale;

export function initI18n() {
  currentLocale = detectLocale();
  applyTranslations();

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-locale-switch]');
    if (button) setLocale(button.dataset.localeSwitch);
  });
}
