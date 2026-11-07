/**
 * Quote request of the Cooperative plan (US35, US36) as a modal dialog.
 *
 * <dialog id="quote" data-quote-dialog> opens when the URL hash is `#quote`, the same way the
 * legal documents do: the card's "Request a quote", the footer link and the manager app (which
 * opens …/#quote) all land here. There is no form: the visitor picks WhatsApp or email and the
 * message goes through that channel only. Closing restores the previous URL; arriving from a
 * shared link also brings the plans into view, so the page behind makes sense.
 */
import { media } from '@/config/breakpoints.js';
import { duration, ease, stagger } from '@/config/motion.js';
import { gsap } from '@/core/gsap.js';
import { scrollTo, startScroll, stopScroll } from '@/core/scroll.js';
import { t } from '@/i18n/index.js';

const PHONE = '51933855712';
const EMAIL = 'arcadiaprueba8@gmail.com';
const COPIED_MS = 2000;

export const quoteDialog = {
  selector: '[data-quote-dialog]',
  mount(dialog) {
    const hash = `#${dialog.id}`;
    const reduced = window.matchMedia(media.reducedMotion);
    const copy = dialog.querySelector('[data-quote-copy]');
    const status = dialog.querySelector('[data-quote-copy-status]');
    let openedFromPage = false;
    let copiedTimer = 0;
    let entrance = null;

    // The messages follow the language of the page at the moment of the click.
    const updateLinks = () => {
      const text = encodeURIComponent(t('quote.whatsappMessage'));
      dialog.querySelector('[data-quote-whatsapp]').href = `https://wa.me/${PHONE}?text=${text}`;
      const subject = encodeURIComponent(t('quote.emailSubject'));
      const body = encodeURIComponent(t('quote.emailBody'));
      dialog.querySelector('[data-quote-email]').href =
        `mailto:${EMAIL}?subject=${subject}&body=${body}`;
    };

    const animateIn = () => {
      if (reduced.matches) return;
      entrance?.kill();
      entrance = gsap.from(dialog.querySelectorAll('[data-quote-rise]'), {
        y: 24,
        autoAlpha: 0,
        duration: duration.slow,
        ease: ease.outExpo,
        stagger: stagger.base,
        clearProps: 'transform,opacity,visibility',
      });
    };

    const sync = () => {
      const shouldOpen = window.location.hash === hash;
      if (shouldOpen && !dialog.open) {
        updateLinks();
        dialog.showModal();
        stopScroll();
        animateIn();
      } else if (!shouldOpen && dialog.open) {
        dialog.close();
      }
    };

    const onDocumentClick = (event) => {
      if (event.target.closest(`a[href="${hash}"]`)) openedFromPage = true;
    };

    const onDialogClick = (event) => {
      if (event.target === dialog || event.target.closest('[data-dialog-close]')) dialog.close();
    };

    const onCopy = async () => {
      try {
        await navigator.clipboard.writeText(EMAIL);
      } catch {
        return;
      }
      // The icon turns into a check and "Copied" floats over it; screen readers hear it once.
      copy.classList.add('is-copied');
      status.textContent = t('quote.copied');
      clearTimeout(copiedTimer);
      copiedTimer = window.setTimeout(() => {
        copy.classList.remove('is-copied');
        status.textContent = '';
      }, COPIED_MS);
    };

    const onClose = () => {
      startScroll();
      if (window.location.hash === hash) {
        if (openedFromPage) {
          window.history.back();
        } else {
          // Arrived from a link (the manager app): leave the visitor at the plans.
          const { pathname, search } = window.location;
          window.history.replaceState(null, '', pathname + search);
          scrollTo('#pricing', { immediate: true });
        }
      }
      openedFromPage = false;
    };

    window.addEventListener('hashchange', sync);
    document.addEventListener('click', onDocumentClick);
    dialog.addEventListener('click', onDialogClick);
    dialog.addEventListener('close', onClose);
    copy.addEventListener('click', onCopy);
    sync();

    return () => {
      window.removeEventListener('hashchange', sync);
      document.removeEventListener('click', onDocumentClick);
      dialog.removeEventListener('click', onDialogClick);
      dialog.removeEventListener('close', onClose);
      copy.removeEventListener('click', onCopy);
      clearTimeout(copiedTimer);
      entrance?.kill();
    };
  },
};
