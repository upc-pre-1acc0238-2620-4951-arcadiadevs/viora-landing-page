/**
 * Fixed navbar: settings, language and section menu disclosures (US41).
 *
 * - One panel open at a time; Escape, an outside click or choosing an option
 *   closes it. Escape returns focus to its toggle.
 * - Sections declare `data-nav-tone="dark|light"`; the navbar adopts the tone
 *   of the section beneath it so its glass and icons keep their contrast.
 * - Switches write visitor preferences (core/preferences.js).
 */
import { mountGlass } from '@/components/glass/glass.js';
import { media } from '@/config/breakpoints.js';
import { gsap, ScrollTrigger } from '@/core/gsap.js';
import { getPreference, PREFERENCES_CHANGE, setPreference } from '@/core/preferences.js';
import { I18N_CHANGE, t } from '@/i18n/index.js';
import { qsa } from '@/utils/dom.js';

export const navbar = {
  selector: '[data-navbar]',

  mount(element) {
    const destroyGlass = mountGlass(element);
    const reducedMotion = window.matchMedia(media.reducedMotion);
    const menuToggle = element.querySelector('[data-navbar-menu]');
    const menuLabel = menuToggle.querySelector('[data-i18n]');
    let current = null;

    const panelOf = (toggle) => document.getElementById(toggle.getAttribute('aria-controls'));

    const show = (toggle) => {
      const panel = panelOf(toggle);
      toggle.setAttribute('aria-expanded', 'true');
      panel.hidden = false;
      gsap.killTweensOf([panel, ...qsa('[data-navbar-reveal]', panel)]);
      if (reducedMotion.matches) return;
      gsap.fromTo(
        panel,
        { opacity: 0, y: -10, scale: 0.94 },
        { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: 'expo.out' },
      );
      gsap.fromTo(
        qsa('[data-navbar-reveal]', panel),
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.045, delay: 0.06, ease: 'expo.out' },
      );
    };

    const hide = (toggle) => {
      const panel = panelOf(toggle);
      toggle.setAttribute('aria-expanded', 'false');
      gsap.killTweensOf([panel, ...qsa('[data-navbar-reveal]', panel)]);
      if (reducedMotion.matches) {
        panel.hidden = true;
        return;
      }
      gsap.to(panel, {
        opacity: 0,
        y: -6,
        scale: 0.97,
        duration: 0.22,
        ease: 'power2.in',
        onComplete: () => {
          panel.hidden = true;
        },
      });
    };

    const syncMenuLabel = () => {
      const key = current === menuToggle ? 'nav.close' : 'nav.menu';
      menuLabel.dataset.i18n = key;
      menuLabel.textContent = t(key);
    };

    const close = ({ restoreFocus = false } = {}) => {
      if (!current) return;
      const toggle = current;
      current = null;
      hide(toggle);
      syncMenuLabel();
      if (restoreFocus) toggle.focus();
    };

    const open = (toggle) => {
      if (current) hide(current);
      current = toggle;
      show(toggle);
      syncMenuLabel();
    };

    const onToggle = (event) => {
      const toggle = event.target.closest('[data-navbar-toggle]');
      if (!toggle) return;
      if (current === toggle) close();
      else open(toggle);
    };

    const onPanelClick = (event) => {
      if (
        event.target.closest(
          '[data-locale-switch], .navbar__link, .navbar__cta-action, [data-hero-dialog]',
        )
      )
        close();
      const control = event.target.closest('[data-preference]');
      if (!control || control.getAttribute('aria-disabled') === 'true') return;
      setPreference(control.dataset.preference, control.getAttribute('aria-checked') !== 'true');
    };

    const onDocumentClick = (event) => {
      if (current && !element.contains(event.target)) close();
    };

    const onKeydown = (event) => {
      if (event.key === 'Escape' && current) close({ restoreFocus: true });
    };

    const switches = qsa('[data-preference]', element);
    const syncSwitches = () => {
      switches.forEach((control) => {
        control.setAttribute(
          'aria-checked',
          String(Boolean(getPreference(control.dataset.preference))),
        );
      });
    };
    const distortion = element.querySelector('[data-preference="distortion"]');
    // The fluid effect never mounts under reduced motion, so the switch can't enable it.
    if (reducedMotion.matches) distortion.setAttribute('aria-disabled', 'true');
    syncSwitches();

    // Tone of the section under the navbar's vertical centre.
    const setTone = (tone) => {
      element.dataset.tone = tone;
    };
    const toneTriggers = qsa('[data-nav-tone]').map((section) =>
      ScrollTrigger.create({
        trigger: section,
        start: () => `top top+=${element.offsetHeight / 2}`,
        end: () => `bottom top+=${element.offsetHeight / 2}`,
        onToggle: (self) => self.isActive && setTone(section.dataset.navTone),
      }),
    );

    // Current section marker in the menu.
    const links = qsa('.navbar__link', element);
    const sectionTriggers = links.flatMap((link) => {
      const section = document.getElementById(link.hash.slice(1));
      if (!section) return [];
      return ScrollTrigger.create({
        trigger: section,
        start: 'top center',
        end: 'bottom center',
        onToggle: (self) => {
          if (!self.isActive) return;
          links.forEach((item) => item.removeAttribute('aria-current'));
          link.setAttribute('aria-current', 'true');
        },
      });
    });

    element.addEventListener('click', onToggle);
    element.addEventListener('click', onPanelClick);
    document.addEventListener('click', onDocumentClick);
    document.addEventListener('keydown', onKeydown);
    document.addEventListener(PREFERENCES_CHANGE, syncSwitches);
    document.addEventListener(I18N_CHANGE, syncMenuLabel);

    return () => {
      close();
      destroyGlass();
      [...toneTriggers, ...sectionTriggers].forEach((trigger) => trigger.kill());
      element.removeEventListener('click', onToggle);
      element.removeEventListener('click', onPanelClick);
      document.removeEventListener('click', onDocumentClick);
      document.removeEventListener('keydown', onKeydown);
      document.removeEventListener(PREFERENCES_CHANGE, syncSwitches);
      document.removeEventListener(I18N_CHANGE, syncMenuLabel);
    };
  },
};
