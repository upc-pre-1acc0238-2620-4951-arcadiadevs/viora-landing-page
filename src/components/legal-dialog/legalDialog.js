/**
 * Legal documents as modal dialogs inside the single page (US39).
 *
 * <dialog id="terms" data-legal-dialog> opens when the URL hash is `#terms`,
 * so footer links (<a href="#terms">) and shared URLs both work. Closing via
 * button, Escape or backdrop restores the previous URL; the browser Back
 * button closes it too. Focus trapping and restoration come from showModal().
 */
import { startScroll, stopScroll } from '@/core/scroll.js';

export const legalDialog = {
  selector: '[data-legal-dialog]',

  mount(dialog) {
    const hash = `#${dialog.id}`;
    let openedFromPage = false;

    const sync = () => {
      const shouldOpen = window.location.hash === hash;
      if (shouldOpen && !dialog.open) {
        dialog.showModal();
        stopScroll();
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

    window.addEventListener('hashchange', sync);
    document.addEventListener('click', onDocumentClick);
    dialog.addEventListener('click', onDialogClick);
    dialog.addEventListener('close', onClose);
    sync();

    return () => {
      window.removeEventListener('hashchange', sync);
      document.removeEventListener('click', onDocumentClick);
      dialog.removeEventListener('click', onDialogClick);
      dialog.removeEventListener('close', onClose);
    };
  },
};
