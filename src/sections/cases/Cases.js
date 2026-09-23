import { media } from '@/config/breakpoints.js';
import { gsap, ScrollTrigger } from '@/core/gsap.js';
import { I18N_CHANGE, t } from '@/i18n/index.js';
import { clamp } from '@/utils/math.js';

const DRAG_START = 6;
/** One page at a time on portrait phones and tablets; mirrored in cases.css. */
const SINGLE = '(width < 840px) and (height > 500px)';

const face = (side, content) => {
  const node = document.createElement('div');
  node.className = `book__face book__face--${side}`;
  if (content) node.append(...[content].flat());
  return node;
};

/**
 * Builds the notebook out of the case articles.
 *
 * Spread (wide): a real book. Leaf j lies on the right half with the solution
 * of case j on its front and the problem of case j + 1 on its back; turning it
 * over the spine opens spread j + 1. Two fixed pages close the ends: the first
 * problem on the left and the last solution on the right.
 *
 * Single (compact): one leaf per case, problem over solution, that turns away
 * to the left to uncover the next one.
 *
 * Returns the leaves, each face tagged with the case it shows, and an undo
 * that puts every page back in its article.
 */
function buildBook(book, articles, single) {
  const pages = articles.map((article) => ({
    article,
    problem: article.querySelector('.case__problem'),
    solution: article.querySelector('.case__solution'),
  }));
  const faces = [];
  const leaves = [];
  const add = (node, index) => {
    node.dataset.case = String(index);
    faces.push(node);
    return node;
  };
  if (single) {
    pages.forEach(({ problem, solution }, index) => {
      const leaf = document.createElement('div');
      leaf.className = 'book__leaf';
      leaf.append(add(face('front', [problem, solution]), index), face('back book__back'));
      leaves.push(leaf);
    });
  } else {
    const last = pages.length - 1;
    book.append(
      add(face('left book__base', pages[0].problem), 0),
      add(face('right book__base book__base--end', pages[last].solution), last),
    );
    pages.slice(0, last).forEach(({ solution }, index) => {
      const leaf = document.createElement('div');
      leaf.className = 'book__leaf';
      leaf.append(
        add(face('right book__front', solution), index),
        add(face('left book__back', pages[index + 1].problem), index + 1),
      );
      leaves.push(leaf);
    });
  }
  book.append(...leaves);
  const undo = () => {
    pages.forEach(({ article, problem, solution }) => article.append(problem, solution));
    book.querySelectorAll('.book__face, .book__leaf').forEach((node) => node.remove());
  };
  return { leaves, faces, undo };
}

/**
 * Use cases (crency.agency): a field notebook of four difficult years. Drag a
 * page, use its arrows or pick a tab from the fanned stacks to turn to a case.
 */
export const cases = {
  selector: '[data-cases]',
  mount(element) {
    const book = element.querySelector('[data-cases-book]');
    const articles = [...book.querySelectorAll('[data-case]')];
    const status = element.querySelector('[data-cases-status]');
    const badge = element.querySelector('[data-cases-drag]');
    const compact = window.matchMedia(SINGLE);
    const reduced = window.matchMedia(media.reducedMotion);
    const total = articles.length;
    const labels = ['off', 'chill', 'late', 'intake'];

    let current = 0;
    let model;
    let angles = [];
    let tween;

    const single = () => model.single;
    // How many leaves are turned at spread k: every leaf before it.
    const restAngle = (index, spread) => (index < spread ? -180 : 0);

    const render = () => {
      model.leaves.forEach((leaf, index) => {
        const angle = angles[index];
        const turned = angle <= -90;
        const moving = angle > -180 && angle < 0;
        // Unturned leaves stack first-on-top; turned ones last-on-top.
        leaf.style.zIndex = moving ? 300 : turned ? 100 + index : 100 - index;
        leaf.style.transform = `rotateY(${angle}deg)`;
        leaf.style.setProperty('--shade', (Math.sin((-angle * Math.PI) / 180) * 0.28).toFixed(3));
        // A page turned away in single mode leaves the book entirely.
        leaf.style.visibility = single() && angle <= -179.5 ? 'hidden' : '';
      });
    };

    const sync = () => {
      model.faces.forEach((node) => {
        const visible = Number(node.dataset.case) === current;
        node.inert = !visible;
        node.setAttribute('aria-hidden', String(!visible));
      });
      status.textContent = t('cases.status')
        .replace('{current}', String(current + 1))
        .replace('{total}', String(total))
        .replace('{label}', t(`cases.${labels[current]}.label`));
    };

    const build = () => {
      tween?.kill();
      model?.undo();
      model = { ...buildBook(book, articles, compact.matches), single: compact.matches };
      angles = model.leaves.map((_, index) => restAngle(index, current));
      element.classList.add('cases--book');
      render();
      sync();
    };

    /** Animates leaves to spread `target`, one after another. */
    const turnTo = (target, { focus } = {}) => {
      target = clamp(target, 0, total - 1);
      if (target === current && angles.every((a, i) => a === restAngle(i, target))) return;
      tween?.kill();
      const from = angles.slice();
      const to = angles.map((_, index) => restAngle(index, target));
      const order = angles.map((_, index) => index).filter((index) => from[index] !== to[index]);
      if (target < current) order.reverse();
      current = target;
      sync();
      const proxy = order.map((index) => ({ index, value: from[index] }));
      tween = gsap.to(proxy, {
        value: (i) => to[proxy[i].index],
        duration: reduced.matches ? 0 : 0.9,
        ease: 'power3.inOut',
        stagger: reduced.matches ? 0 : 0.14,
        onUpdate: () => {
          proxy.forEach(({ index, value }) => (angles[index] = value));
          render();
        },
      });
      if (focus) {
        const page = model.faces.find(
          (node) => Number(node.dataset.case) === current && node.querySelector('.case__nav'),
        );
        const arrows = [...page.querySelectorAll('[data-case-step]')];
        const preferred = arrows.find(
          (arrow) => arrow.dataset.caseStep === focus && !arrow.disabled,
        );
        (preferred ?? arrows.find((arrow) => !arrow.disabled))?.focus({ preventScroll: true });
      }
    };

    // ── Drag ──────────────────────────────────────────────
    let drag = null;
    const leafWidth = () => (single() ? book.clientWidth : book.clientWidth / 2);
    const down = (event) => {
      if (event.button !== 0 || event.target.closest('button, a')) return;
      drag = { x: event.clientX, t: performance.now(), dx: 0, v: 0, leaf: null };
    };
    const move = (event) => {
      if (!drag) return;
      const dx = event.clientX - drag.x;
      const now = performance.now();
      drag.v = (dx - drag.dx) / Math.max(now - drag.t, 1);
      drag.t = now;
      drag.dx = dx;
      if (drag.leaf === null) {
        if (Math.abs(dx) < DRAG_START) return;
        const forward = dx < 0;
        if (forward ? current >= total - 1 : current <= 0) {
          drag = null;
          return;
        }
        drag.forward = forward;
        drag.leaf = forward ? current : current - 1;
        tween?.kill();
        book.setPointerCapture(event.pointerId);
        book.classList.add('is-dragging');
      }
      const progress = clamp(Math.abs(dx) / (leafWidth() * 1.1), 0, 1);
      angles[drag.leaf] = drag.forward ? -180 * progress : -180 * (1 - progress);
      render();
    };
    const up = () => {
      if (!drag) return;
      const { leaf, forward, dx, v } = drag;
      drag = null;
      book.classList.remove('is-dragging');
      if (leaf === null) return;
      const progress = Math.abs(dx) / (leafWidth() * 1.1);
      const flick = Math.abs(v) > 0.45 && Math.sign(v) === (forward ? -1 : 1);
      const commit = progress > 0.35 || flick;
      // An uncommitted page settles back: turnTo eases it to its resting angle.
      turnTo(commit ? (forward ? current + 1 : current - 1) : current);
    };

    // ── Buttons, tabs and card links ──────────────────────
    const click = (event) => {
      const step = event.target.closest('[data-case-step]');
      if (step) turnTo(current + Number(step.dataset.caseStep), { focus: step.dataset.caseStep });
      const tab = event.target.closest('.cases__tab');
      if (tab) turnTo(Number(tab.dataset.caseLink));
    };
    const open = (event) => turnTo(event.detail.index);
    const relabel = () => sync();

    // ── Drag badge (fine pointers) ────────────────────────
    const fine = window.matchMedia(media.finePointer);
    const badgeX = gsap.quickTo(badge, 'x', { duration: 0.35, ease: 'power3.out' });
    const badgeY = gsap.quickTo(badge, 'y', { duration: 0.35, ease: 'power3.out' });
    const hover = (event) => {
      const show = fine.matches && !event.target.closest('button, a');
      badge.style.visibility = show ? 'visible' : 'hidden';
      badgeX(event.clientX + 18);
      badgeY(event.clientY + 18);
    };
    const leave = () => (badge.style.visibility = 'hidden');

    build();
    book.addEventListener('pointerdown', down);
    book.addEventListener('pointermove', move);
    book.addEventListener('pointermove', hover);
    book.addEventListener('pointerleave', leave);
    book.addEventListener('pointerup', up);
    book.addEventListener('pointercancel', up);
    element.addEventListener('click', click);
    document.addEventListener('cases:open', open);
    document.addEventListener(I18N_CHANGE, relabel);
    compact.addEventListener('change', build);

    // ── Scroll: burst turns, stacks fan out from behind the book ──
    const motion = gsap.matchMedia();
    motion.add(media.motionOk, () => {
      const burst = element.querySelector('[data-cases-burst]');
      const stacks = [...element.querySelectorAll('[data-cases-stack]')];
      gsap.fromTo(
        burst,
        { rotation: -12 },
        {
          rotation: 28,
          ease: 'none',
          scrollTrigger: { trigger: element, start: 'top bottom', end: 'bottom top', scrub: true },
        },
      );
      const entrance = gsap.timeline({
        scrollTrigger: {
          trigger: element.querySelector('.cases__stage'),
          start: 'top 85%',
          end: 'top 35%',
          scrub: 0.8,
        },
      });
      entrance.from(book, { y: 80, scale: 0.92, ease: 'power2.out' }, 0);
      stacks.forEach((stack, side) => {
        entrance.from(
          stack.children,
          {
            x: (index) => (side ? -1 : 1) * 54 * (index + 1),
            rotation: (index) => (side ? -1 : 1) * 2 * (index + 1),
            ease: 'power2.out',
            stagger: 0.04,
          },
          0.1,
        );
      });
    });

    return () => {
      motion.revert();
      tween?.kill();
      book.removeEventListener('pointerdown', down);
      book.removeEventListener('pointermove', move);
      book.removeEventListener('pointermove', hover);
      book.removeEventListener('pointerleave', leave);
      book.removeEventListener('pointerup', up);
      book.removeEventListener('pointercancel', up);
      element.removeEventListener('click', click);
      document.removeEventListener('cases:open', open);
      document.removeEventListener(I18N_CHANGE, relabel);
      compact.removeEventListener('change', build);
      model.undo();
      element.classList.remove('cases--book');
      ScrollTrigger.refresh();
    };
  },
};
