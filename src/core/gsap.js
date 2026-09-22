/**
 * Single GSAP entry point: every module imports GSAP from here so plugins are
 * registered exactly once and global defaults stay consistent.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { duration, ease } from '@/config/motion.js';

gsap.registerPlugin(ScrollTrigger, SplitText);

gsap.defaults({
  duration: duration.base,
  ease: ease.outExpo,
});

export { gsap, ScrollTrigger, SplitText };
