import { media } from '@/config/breakpoints.js';
import { gsap } from '@/core/gsap.js';

/**
 * Sky (era-residence.com): cloud layers loop across the seam with the
 * previous section while a cream haze melts them into it. On the way down
 * the clouds trail behind at their own depth and the aerial view of La Yarada
 * settles from a slight zoom; the location label draws its rule and rises in.
 */
export const sky = {
  selector: '[data-sky]',
  mount(element) {
    const clouds = [...element.querySelectorAll('[data-sky-cloud]')];
    const view = element.querySelector('[data-sky-view] img');
    const place = element.querySelector('[data-sky-place]');

    // The loops are CSS; they only run while the clouds are on screen.
    const sight = new IntersectionObserver(([entry]) =>
      element.classList.toggle('is-drifting', entry.isIntersecting),
    );
    sight.observe(element.querySelector('.sky__clouds'));

    const motion = gsap.matchMedia();
    motion.add(media.motionOk, () => {
      // The clouds lag behind the page, nearer layers (higher factor) the most,
      // so the view slides out from under them. They never rise past the haze.
      clouds.forEach((cloud) => {
        const depth = Number(cloud.dataset.skyCloud);
        gsap.to(cloud, {
          yPercent: 10 * depth,
          ease: 'none',
          scrollTrigger: { trigger: element, start: 'top bottom', end: 'top top', scrub: true },
        });
      });

      gsap.fromTo(
        view,
        { scale: 1.14 },
        {
          scale: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: element,
            start: 'top bottom',
            end: 'bottom bottom',
            scrub: true,
          },
        },
      );

      const reveal = gsap.timeline({
        scrollTrigger: {
          trigger: place,
          start: 'top 88%',
          toggleActions: 'play none none reverse',
        },
      });
      reveal
        .from(place.querySelector('.sky__place-line'), {
          scaleY: 0,
          duration: 1.1,
          ease: 'expo.out',
        })
        .from(
          place.querySelectorAll(':scope > :not(.sky__place-line)'),
          { yPercent: 70, opacity: 0, duration: 0.9, stagger: 0.1, ease: 'expo.out' },
          0.15,
        );
    });

    return () => {
      sight.disconnect();
      motion.revert();
    };
  },
};
