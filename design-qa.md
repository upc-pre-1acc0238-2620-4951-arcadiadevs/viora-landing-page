# Hero and navbar design QA

Result: passed for the implemented Hero/navbar scope in Chromium, with the documented fidelity and integration limits below. Reviewed on 2026-09-22.

## Reference and evidence

- Figma file `MLkFDnRX3jcUlbqxL0CIOp`, Hero node `32:2063`.
- Reference: `.cache/hero-qa/figma.png`, 1440 × 942.
- Implementation: `.cache/hero-qa/generated-desktop.png`, 1440 × 942.
- Side-by-side: `.cache/hero-qa/generated-comparison.png`.
- Mobile: `.cache/hero-qa/generated-mobile-top.png` and `generated-mobile-bottom.png`, 393 × 852 viewport. Also inspected 320 × 740.

Evidence is local and ignored by Git. The original user artwork remains unchanged.

## Visual review

Desktop preserves the reference hierarchy, header spacing, left headline and split CTA, upper-right film dock, notification stack and calendar, and lower-right editorial title. English copy intentionally changes line lengths. Local Axiforma and Foriene fonts and the project Playfair face preserve the type direction.

Five ImageGen layers now supply the paper background, contour ribbons, ground, olive foliage, and grower. Their alpha edges, registration, and occlusion were inspected in the actual page. Three.js insects fly behind foliage and the grower. Pointer testing confirmed distinct layer translations at depths 5, 8, 16, 28, and 36.

Mobile recomposes the scene vertically and retains readable headline, CTA, film preview, glass widgets, and closing story. At 320 px, document content width was 305 px with a scrollbar: no horizontal overflow. The grower is intentionally cropped at the right edge on narrow screens.

## Corrections made

1. Replaced the initial deterministic background extraction with five generated plates following the user's explicit request.
2. Corrected generated subject enlargement using source-coordinate CSS registration.
3. Adjusted scene tint and foreground layering after comparison against Figma.
4. Widened the English intro area and adjusted small-screen notification typography to prevent collisions.
5. Preserved independent glass surfaces for each notification in the stack, the calendar shell, and the nested video dock.

## Functional checks

- ESLint, Stylelint, HTML validation, Prettier check, and production build pass.
- No browser warning/error logs during the final Chromium check.
- Download and film placeholder dialogs open; Escape dismisses the download dialog and restores focus.
- Story dialog opens with English copy and closes using its close button.
- Menu and language controls remain inactive as requested; English is selected without changing the Spanish translation file.
- Reduced-motion and unavailable-WebGL paths retain the original still illustration. These paths were inspected in code; OS preference switching and GPU context loss were not simulated in final browser QA.

## Limits and pending integration

Generated separations reconstruct portions of the source and are not pixel-identical cutouts. Subject details and foliage density differ slightly from the source. See `docs/hero-assets.md` for prompts and provenance.

Clear glass uses an SVG displacement lens, transparency, highlights, and a blur fallback. Native iOS rendering equivalence is not claimed; Safari and Firefox have not been visually validated.

The film uses a placeholder thumbnail, and app-store/video destinations are not supplied. Those controls show explicit placeholder information. The editorial arrow opens a story summary until the following landing section is built.

The asynchronous Three.js build chunk exceeds Vite's default 500 kB raw warning threshold (approximately 133 kB gzip). It is lazy-loaded. No performance score or award readiness is asserted.

No commits or pushes were made. The report repository was treated as read-only.

## Follow-up corrections

Viewport follow-up: removed all fixed/minimum Hero heights and use `100dvh` with `100svh` fallback. Desktop dimensions scale against both container axes; compact mobile typography and the intermediate-width widget row keep content inside the scene. The root scrollbar is hidden without disabling scrolling for future sections. Browser measurements confirmed Hero height and document height equal viewport height at 1366×768, 1920×1080, 2560×1440, 3840×2160, 393×852, 320×568, and 768×600. Also visually reviewed 1920×900. These supersede the earlier tall mobile layout evidence.

The rear notification panels are now clipped to their exposed lower strips, so their glass filters do not overlap behind the front panel. The standalone calendar has been replaced with the existing official `viora-icon.png` asset in the same glass container. The story arrow now has a slow diagonal drift, pauses on hover/focus, and remains static with reduced motion. Checked the updated layout at 1440 px and 671 px in Chromium; lint and build pass.

Fluid distortion follow-up: the Hero artwork (five plates and the dragonflies) is now composited in one WebGL stage (`src/effects/scenes/HeroScene.js`) and displaced by a GPU stable-fluids velocity field (`src/effects/webgl/FluidSimulation.js`) driven by the pointer, with a slight RGB split on moving fronts (strength 0.022, splat radius 0.0016); dragonflies now render above the olive boughs and behind the grower, and a one-time intro sweep. Text, CTAs and glass widgets stay in the DOM and are not distorted; the glass panels refract the distorted art behind them. The DOM layers remain the static, reduced-motion and no-WebGL fallback, and still own the GSAP parallax, which the WebGL planes mirror. Verified in headless Chrome at 1440×900 and 393×852: registration matches the DOM composition, distortion appears during a stroke and settles within about one second. Lint, Prettier and build pass; the lazy scene chunk is about 135 kB gzip.

Navbar follow-up: the navbar is now a fixed global component (`src/components/navbar/`) outside the Hero, with three liquid-glass controls (settings, language, section menu) and solid Forest-dark panels. One panel opens at a time; Escape (restoring focus), an outside click or choosing an option closes it. Settings holds the distortion switch (persisted in `viora:preferences`, fades the Hero displacement live, disabled under reduced motion) and a disabled Sound switch marked "Soon". Language switches English/Español without reloading; Spanish keys missing from `es.json` fall back to English. The menu lists Home, Product, Who it's for, Plans and Team; only `#hero` exists so far. Sections declare `data-nav-tone` and the navbar adopts dark/light ink and glass tint; only the dark tone is exercised until light sections exist. Verified in headless Chrome at 1440×900 and 393×852.

Menu follow-up: the section menu now follows the reference's three stacked cards: white navigation card (five links at `--text-xl`), white CTA card ("Compare plans for your grove" → `#plans`) and a Forest download card with Android and iOS buttons. Until store listings exist, both store buttons open the Hero download notice, per the IA rule of not presenting unpublished stores as available. Settings and language are bare floating icons again (no glass shell) with a soft drop shadow over the artwork; only the menu pill keeps liquid glass. Verified in headless Chrome at 1440×900 and 393×852.

Liquid glass follow-up: `<html data-glass="liquid">` enables an iOS-style clear material (`src/components/glass/glass.js`, `src/styles/components/glass.css`): a convex bezel (up to 36 px, capped at 24% of the element height so short pieces like the notification stack only bend at the rim) pulls the backdrop inward at the rim with slight red/green/blue dispersion, near-zero blur, a masked specular rim and soft depth shadows. `.glass--frosted` (settings and language panels) keeps the lens rim over a 16 px frost with a forest tint for text contrast. Deleting the attribute restores the previous classic material and solid panels; this was verified in headless Chrome. The menu download card now uses the provided Google Play and App Store icons, extracted from the Figma SVG wrappers to 64 px WebP (0.9 kB and 1.8 kB); the SVG originals remain in `public/assets/icons`. Lens and dispersion render only in Chromium; other engines keep the CSS material.

Notification stack exception: the nearest `data-glass` ancestor now selects the material per element, and `.hero__notification` carries `data-glass="classic"`, so the short stacked notification keeps the previous frosted lens while the rest of the page stays liquid. The clear lens still pulled thin artwork lines along that stack's rim even with the thinner bezel.
