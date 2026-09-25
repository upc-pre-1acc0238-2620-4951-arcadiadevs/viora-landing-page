/**
 * Legal documents as modal dialogs inside the single page (US39).
 *
 * <dialog id="terms" data-legal-dialog> opens when the URL hash is `#terms`,
 * so footer links (<a href="#terms">) and shared URLs both work. Closing via
 * button, Escape or backdrop restores the previous URL; the browser Back
 * button closes it too. Focus trapping and restoration come from showModal().
 *
 * Inside, the sheet reads like a ledger: the index on the cover is built from
 * the section headings (rebuilt on every locale change), marks the section in
 * view and jumps to it without touching the hash; --progress drives the
 * reading bar and the burst; sections rise once as they enter the page.
 */
import { media } from '@/config/breakpoints.js';
import { I18N_CHANGE } from '@/i18n/index.js';
import { startScroll, stopScroll } from '@/core/scroll.js';

export const legalDialog = {
  selector: '[data-legal-dialog]',

  mount(dialog) {
    const hash = `#${dialog.id}`;
    let openedFromPage = false;

    const body = dialog.querySelector('[data-legal-body]');
    const index = dialog.querySelector('[data-legal-index]');
    const sections = [...dialog.querySelectorAll('[data-legal-section]')];
    const reduced = window.matchMedia(media.reducedMotion);

    // Index: one button per section (a hash link would close the dialog).
    const buildIndex = () => {
      index.replaceChildren(
        ...sections.map((section) => {
          const item = document.createElement('li');
          const jump = document.createElement('button');
          jump.type = 'button';
          jump.className = 'legal-dialog__jump';
          jump.dataset.legalJump = section.id;
          jump.textContent = section.querySelector('h3').textContent.trim();
          item.append(jump);
          return item;
        }),
      );
      markCurrent();
    };

    let current = null;
    const markCurrent = () => {
      // The last section whose top has passed the upper fifth of the page.
      const line = body.getBoundingClientRect().top + body.clientHeight * 0.2;
      const atEnd = body.scrollTop + body.clientHeight >= body.scrollHeight - 2;
      const next = atEnd
        ? sections.at(-1)
        : (sections.findLast((section) => section.getBoundingClientRect().top <= line) ??
          sections[0]);
      if (next === current && index.querySelector('[aria-current]')) return;
      current = next;
      sections.forEach((section) => section.classList.toggle('is-current', section === next));
      index.querySelectorAll('[data-legal-jump]').forEach((jump) => {
        if (jump.dataset.legalJump === next.id) jump.setAttribute('aria-current', 'true');
        else jump.removeAttribute('aria-current');
      });
    };

    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const range = body.scrollHeight - body.clientHeight;
        dialog.style.setProperty('--progress', range > 0 ? (body.scrollTop / range).toFixed(4) : 0);
        markCurrent();
      });
    };

    const onJump = (event) => {
      const jump = event.target.closest('[data-legal-jump]');
      if (!jump) return;
      const section = dialog.querySelector(`#${jump.dataset.legalJump}`);
      section.scrollIntoView({ block: 'start', behavior: reduced.matches ? 'auto' : 'smooth' });
      section.querySelector('h3').setAttribute('tabindex', '-1');
      section.querySelector('h3').focus({ preventScroll: true });
    };

    // Reveal: each section rises once, the first time it enters the page.
    const reveal = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-in');
          reveal.unobserve(entry.target);
        });
      },
      { root: body, threshold: 0.12 },
    );
    if (!reduced.matches) {
      dialog.classList.add('legal-dialog--reveal');
      sections.forEach((section) => reveal.observe(section));
    }

    const sync = () => {
      const shouldOpen = window.location.hash === hash;
      if (shouldOpen && !dialog.open) {
        body.scrollTop = 0;
        dialog.showModal();
        // Start on the page itself, so arrows and Space scroll the document.
        body.focus({ preventScroll: true });
        stopScroll();
        onScroll();
      } else if (!shouldOpen && dialog.open) {
        dialog.close();
      }
    };

    const onDocumentClick = (event) => {
      if (event.target.closest(`a[href="${hash}"]`)) openedFromPage = true;
    };

    const onDialogClick = (event) => {
      // The dialog box has no padding, so a click on the element itself is a backdrop click.
      if (event.target === dialog || event.target.closest('[data-dialog-close]')) dialog.close();
    };

    const onClose = () => {
      startScroll();
      if (window.location.hash === hash) {
        if (openedFromPage) {
          window.history.back();
        } else {
          const { pathname, search } = window.location;
          window.history.replaceState(null, '', pathname + search);
        }
      }
      openedFromPage = false;
    };

    body.tabIndex = -1;
    buildIndex();
    window.addEventListener('hashchange', sync);
    document.addEventListener('click', onDocumentClick);
    document.addEventListener(I18N_CHANGE, buildIndex);
    dialog.addEventListener('click', onDialogClick);
    dialog.addEventListener('close', onClose);
    index.addEventListener('click', onJump);
    body.addEventListener('scroll', onScroll, { passive: true });
    sync();

    return () => {
      window.removeEventListener('hashchange', sync);
      document.removeEventListener('click', onDocumentClick);
      document.removeEventListener(I18N_CHANGE, buildIndex);
      dialog.removeEventListener('click', onDialogClick);
      dialog.removeEventListener('close', onClose);
      index.removeEventListener('click', onJump);
      body.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
      reveal.disconnect();
    };
  },
};
