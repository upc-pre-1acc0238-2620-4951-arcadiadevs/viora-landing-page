/**
 * `image.complete` is also true when a download failed, so it can't tell a
 * loaded image from a broken one. A broken image uploaded as a WebGL texture
 * samples as opaque black: a flaky cold load once left the Hero black with
 * only the dragonflies on top. Ready means real pixels; a broken image is
 * requested again (a fresh URL, so a cached failure can't answer) before
 * giving up.
 */
const loaded = (image) => image.complete && image.naturalWidth > 0;

const settle = (image) =>
  new Promise((resolve) => {
    if (image.complete) {
      resolve();
      return;
    }
    image.addEventListener('load', resolve, { once: true });
    image.addEventListener('error', resolve, { once: true });
  });

async function load(image, retries) {
  for (let attempt = 0; ; attempt += 1) {
    await settle(image);
    if (loaded(image)) return image;
    if (attempt >= retries)
      throw new Error(`Image failed to load: ${image.currentSrc || image.src}`);
    const url = new URL(image.getAttribute('src'), document.baseURI);
    url.searchParams.set('retry', String(attempt + 1));
    image.src = url.href;
  }
}

// One attempt per image, shared: the preloader and the Hero scene wait on the
// same <img>, and two retry loops would restart each other's requests.
const pending = new WeakMap();

/** Resolves once `image` has pixels; rejects after `retries` failed reloads. */
export function whenImageReady(image, { retries = 2 } = {}) {
  if (!pending.has(image)) pending.set(image, load(image, retries));
  return pending.get(image);
}
