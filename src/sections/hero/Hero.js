import { gsap } from '@/core/gsap.js';
import { t } from '@/i18n/index.js';
import { mountGlass } from '@/components/glass/glass.js';

export const hero = {
  selector: '[data-hero]',
  mount(element) {
    const destroyGlass = mountGlass(element);
    const art = element.querySelector('.hero__art');
    const registerLayers = () => {
      const width = art.clientWidth;
      const height = art.clientHeight;
      const scale = Math.max(width / 1536, height / 1024) * 1.035;
      const position = window.matchMedia('(max-width: 600px)').matches ? 0.72 : 0.5;
      art.style.setProperty('--art-width', `${1536 * scale}px`);
      art.style.setProperty('--art-height', `${1024 * scale}px`);
      art.style.setProperty('--art-left', `${(width - 1536 * scale) * position}px`);
      art.style.setProperty('--art-top', `${(height - 1024 * scale) / 2}px`);
    };
    const artObserver = new ResizeObserver(registerLayers);
    artObserver.observe(art);
    registerLayers();
    const motion = gsap.matchMedia();
    const layers = [...element.querySelectorAll('[data-depth]')];
    motion.add('(prefers-reduced-motion: no-preference)', () => {
      const entrance = gsap.from(element.querySelectorAll('[data-hero-reveal]'), {
        opacity: 0,
        y: 16,
        duration: 1.35,
        stagger: 0.09,
        delay: 0.25,
        ease: 'power3.out',
        clearProps: 'transform,opacity',
      });
      return () => entrance.revert();
    });
    motion.add('(prefers-reduced-motion: no-preference) and (pointer: fine)', () => {
      const setters = layers.map((layer) => ({
        x: gsap.quickTo(layer, 'x', { duration: 1.35, ease: 'power3.out' }),
        y: gsap.quickTo(layer, 'y', { duration: 1.35, ease: 'power3.out' }),
        depth: Number(layer.dataset.depth),
      }));
      // Window-level so moving onto the fixed navbar doesn't recentre the scene.
      const point = (event) => {
        const bounds = element.getBoundingClientRect();
        if (event.clientY > bounds.bottom || event.clientY < bounds.top) return;
        const x = (event.clientX - bounds.left) / bounds.width - 0.5;
        const y = (event.clientY - bounds.top) / bounds.height - 0.5;
        setters.forEach((set) => {
          set.x(-x * set.depth);
          set.y(-y * set.depth);
        });
      };
      const reset = () =>
        setters.forEach((set) => {
          set.x(0);
          set.y(0);
        });
      const leave = (event) => {
        if (!event.relatedTarget) reset();
      };
      window.addEventListener('pointermove', point, { passive: true });
      document.addEventListener('pointerout', leave);
      return () => {
        window.removeEventListener('pointermove', point);
        document.removeEventListener('pointerout', leave);
        setters.forEach((set) => {
          set.x.tween.kill();
          set.y.tween.kill();
        });
        gsap.set(layers, { clearProps: 'transform' });
      };
    });
    const modal = document.querySelector('[data-hero-modal]');
    const close = modal.querySelector('[data-hero-close]');
    let opener;
    const open = (event) => {
      const button = event.target.closest('[data-hero-dialog]');
      if (!button) return;
      opener = button;
      const key = button.dataset.heroDialog;
      modal.querySelector('h2').textContent = t(`hero.${key}Title`);
      modal.querySelector('.hero-dialog__body').textContent = t(`hero.${key}Body`);
      modal.showModal();
    };
    const dismiss = () => modal.close();
    const restoreFocus = () => opener?.focus({ preventScroll: true });
    const backdrop = (event) => {
      if (event.target !== modal) return;
      const box = modal.getBoundingClientRect();
      if (
        event.clientX < box.left ||
        event.clientX > box.right ||
        event.clientY < box.top ||
        event.clientY > box.bottom
      )
        dismiss();
    };
    // Document-level: the navbar's store buttons open the same download notice.
    document.addEventListener('click', open);
    close.addEventListener('click', dismiss);
    modal.addEventListener('click', backdrop);
    modal.addEventListener('close', restoreFocus);
    return () => {
      destroyGlass();
      artObserver.disconnect();
      motion.revert();
      document.removeEventListener('click', open);
      close.removeEventListener('click', dismiss);
      modal.removeEventListener('click', backdrop);
      modal.removeEventListener('close', restoreFocus);
      if (modal.open) modal.close();
    };
  },
};
