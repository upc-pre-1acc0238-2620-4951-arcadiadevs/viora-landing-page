/**
 * Component registry — reusable UI pieces shared across sections
 * (header, menu, video player...). Each component lives in its own folder:
 * src/components/<name>/<name>.js and exports `{ selector, mount(element) }`.
 */
import { mountAll } from '@/utils/mount.js';
import { legalDialog } from './legal-dialog/legalDialog.js';
import { navbar } from './navbar/navbar.js';
import { scrollbar } from './scrollbar/scrollbar.js';
import { soundToggle } from './sound/sound.js';

const registry = [navbar, legalDialog, scrollbar, soundToggle];

export const mountComponents = (root = document) => mountAll(registry, root);
