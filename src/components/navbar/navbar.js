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
import { INTRO_REVEAL, introReached, whenIntro } from '@/core/intro.js';
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

    // Tone of whatever sits under the navbar's vertical centre, read from the
    // live layout each frame the scroll moves (not from trigger ranges), so
    // pinned scenes and their spacers can never put it out of step. Among the
    // zones under that line, the last in the document wins: nested zones and
    // later sections sliding over earlier ones.
    const setTone = (tone) => {
      if (element.dataset.tone !== tone) element.dataset.tone = tone;
    };
    const zones = qsa('[data-nav-tone]').filter((zone) => !element.contains(zone));
    let lastScroll = -1;
    const sampleTone = () => {
      if (window.scrollY === lastScroll) return;
      lastScroll = window.scrollY;
      const y = element.offsetHeight / 2;
      let tone;
      zones.forEach((zone) => {
        const box = zone.getBoundingClientRect();
        if (box.height && box.top <= y && box.bottom > y) tone = zone.dataset.navTone;
      });
      if (tone) setTone(tone);
    };
    gsap.ticker.add(sampleTone);

    // Current section marker in the menu.
    const links = qsa('.navbar__link', element);
    const sectionTriggers = links.flatMap((link) => {
      const section = document.getElementById(link.hash.slice(1));
      if (!section) return [];
      return ScrollTrigger.create({
        trigger: section,
        start: 'top center',
        end: 'bottom center',
        refreshPriority: -1,
        onToggle: (self) => {
          if (!self.isActive) return;
          links.forEach((item) => item.removeAttribute('aria-current'));
          link.setAttribute('aria-current', 'true');
        },
      });
    });

    // Drops in as the preloader reveals the page (skipped on HMR remounts).
    let entrance = null;
    if (!introReached(INTRO_REVEAL) && !reducedMotion.matches) {
      const parts = [element.querySelector('.navbar__brand'), ...qsa('.navbar__item', element)];
      entrance = gsap.from(parts, {
        opacity: 0,
        y: -18,
        duration: 1.2,
        stagger: 0.08,
        delay: 0.7,
        ease: 'expo.out',
        paused: true,
        clearProps: 'opacity,transform',
      });
      whenIntro(INTRO_REVEAL).then(() => entrance?.play());
    }

    element.addEventListener('click', onToggle);
    element.addEventListener('click', onPanelClick);
    document.addEventListener('click', onDocumentClick);
    document.addEventListener('keydown', onKeydown);
    document.addEventListener(PREFERENCES_CHANGE, syncSwitches);
    document.addEventListener(I18N_CHANGE, syncMenuLabel);

    return () => {
      entrance?.revert();
      entrance = null;
      close();
      destroyGlass();
      gsap.ticker.remove(sampleTone);
      sectionTriggers.forEach((trigger) => trigger.kill());
      element.removeEventListener('click', onToggle);
      element.removeEventListener('click', onPanelClick);
      document.removeEventListener('click', onDocumentClick);
      document.removeEventListener('keydown', onKeydown);
      document.removeEventListener(PREFERENCES_CHANGE, syncSwitches);
      document.removeEventListener(I18N_CHANGE, syncMenuLabel);
    };
  },
};
