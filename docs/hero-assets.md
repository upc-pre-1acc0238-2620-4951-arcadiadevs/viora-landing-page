# Hero image layers

The five production parallax layers were made with the built-in ImageGen tool on 2026-09-22, using `public/assets/images/hero/hero-full.png` as the edit target. No external API key or fallback CLI was used. The tool does not expose a selectable model/version in this session.

## Files and registration

Source PNGs and alpha-preserving WebP deliveries live in `public/assets/images/hero/generated/`:

| Layer    | Source generation                             | Placement                                   |
| -------- | --------------------------------------------- | ------------------------------------------- |
| backing  | exec-13942284-3d5b-49cc-b6af-2918bde09dc5.png | Full cover canvas                           |
| contours | exec-d2dde440-e994-40e1-8cbc-c65ed6c5eabb.png | Full cover canvas, shallow motion           |
| ground   | exec-a57c133f-bad0-4f3b-b56c-b18a863be4e7.png | Full cover canvas, behind foliage           |
| olives   | exec-5b39188f-1ac0-49fb-b2d6-8984621b1c58.png | 81% scale, translated to source composition |
| grower   | exec-7133ce51-17b2-4a6a-a556-e3dd128f3ad9.png | 60% scale, translated to source composition |

Every source is 1536 × 1024. The four foreground layers retain generated RGBA transparency. CSS registration corrects the generator's subject enlargement without destructively changing the PNG. A restrained scene tint brings the generated paper palette toward the reference.

These are generative extractions/reconstructions, not pixel-identical separations. The original master remains untouched. The initial deterministic layer experiment is superseded for all five parallax planes. The original image is still the reduced-motion/no-WebGL fallback; original golden insect textures feed Three.js subdivided, vertex-animated membranes.

## Prompt set

Shared specification for background, grower, and olives:

> Use the provided original Viora illustration as the EDIT TARGET, not merely inspiration. This is production layer decomposition for a parallax website. Preserve its exact antique olive-green and ochre hand-etched paper illustration style, original painted details, original composition and all spatial coordinates. Output landscape 1536x1024, full original canvas, no reframing, no zoom, no new text, no logos, no checkerboard pattern.

### Backing

> Use case: precise-object-edit. Generate ONLY the clean deepest background plate. Remove the seated olive farmer, basket, ALL olive branches/leaves/fruits, all three dragonflies, the big dark curved contour ribbons on the left, and the brown foreground earth at the bottom/right. Seamlessly reconstruct the exposed olive-green weathered paper background and preserve the broad diagonal ochre sunlit band exactly in its original position. Retain the fine natural paper grain; no smooth smudges or ghost silhouettes. Opaque background. This plate will go behind separate transparent foreground layers.

### Grower

> Use case: background-extraction. Generate ONLY a faithful transparent cutout of the seated farmer WITH his woven basket and its olives. Keep the EXACT original farmer silhouette, hat, face, hand holding branch pose, beige shirt, trousers, posture, and detailed ink hatching. Keep his original size and location on the RIGHT (roughly x1020..1440, y300..725 in 1536x1024). Remove absolutely all background, earth, ornamental lines, dragonflies and surrounding olive boughs, except the little held stem necessary for his fingers. Keep full canvas empty transparent margins. Genuine transparent alpha background, clean detailed antialiased edges. Do not center or enlarge the cutout; keep source coordinates.

### Olives

> Use case: background-extraction. Generate ONLY the original olive boughs, leaves and fruits as one transparent midground layer. Preserve all original branch placement and leaf silhouettes throughout the lower-middle/right image (roughly x440..1536,y280..820). Remove the farmer and basket, reconstructing ONLY the olive branches/leaves that logically continue behind him; do not invent new branches in blank areas. Remove ALL dragonflies, background paper, diagonal light band, dark ribbons and earth. Retain the original subtle etched olive-green, tan and dark-purple artwork, colors and scale. Genuine transparent alpha, original full-canvas coordinates, no centering, no crop, no checkerboard.

### Contours

> Use case: background-extraction. Edit the provided Viora artwork into ONLY its large dark olive curved ribbon/contour ornament on the LEFT side. Extract the same original wide looping painted lines as a transparent layer. Keep original 1536x1024 landscape canvas and exact source positions, scale and clipped edges. Remove paper, farmer, basket, foliage, dragonflies, ochre light and earth. Transparent alpha everywhere except the original dark ribbon paint, no halo, no glow, no shadows, no added ornament, no checkerboard, no text. This layer will recompose precisely with the original artwork; do not reinterpret or center it.

### Ground

> Use case: background-extraction. Edit target is the supplied Viora artwork. Produce ONLY the dark brown earthy foreground mound underneath the seated farmer and olive branches, original source coordinates on a full 1536x1024 landscape canvas. The earth occupies lower right, roughly x700..1536 y600..1024, fading naturally into the lower dark brown textured ground. Remove farmer, basket, ALL olive leaves/stems/fruits, dragonflies, dark curved ribbons, the diagonal ochre light band, and upper olive paper background. Reconstruct the terrain hidden by the removed objects with the SAME original dark umber/ochre etched paper texture. Upper and left unoccupied regions must be genuine alpha transparency. No black background, no glow/halo, no soft brown cloud, no invented objects, no text. Terrain belongs in its original lower-right position; do not enlarge/recenter.

## Encoding and integration

Run `python scripts/optimize-hero-assets.py` with Pillow to encode the five generated PNGs to WebP. This is file encoding only; layer placement lives in `src/styles/sections/hero.css` and source-coordinate cover registration in `src/sections/hero/Hero.js`.

The logo, menu, globe, arrows, notification icon, calendar, and temporary film image are downloaded Figma exports. English copy lives in `src/i18n/locales/en.json`. Menu and language controls are deliberately inactive. Download/video actions currently show honest availability dialogs until official destinations/media are supplied. The story arrow opens a short introduction until the next section is implemented.

The glass uses per-panel backdrop displacement maps and a CSS blur/material fallback. Browser compositing differs from Apple's native renderer, so this does not claim pixel-identical iOS glass across engines.
