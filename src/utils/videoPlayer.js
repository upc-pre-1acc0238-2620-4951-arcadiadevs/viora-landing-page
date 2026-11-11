/**
 * Dialog video player — one API for a native <video> or a YouTube embed.
 *
 * A YouTube slot is a placeholder element carrying `data-youtube="<id>"`.
 * The iframe is only built when the dialog opens (no third-party requests
 * until the visitor asks for the video) and removed on close, which is the
 * only reliable way to stop playback without loading the IFrame API.
 * The iframe takes its accessible title from the dialog's aria-label, so it
 * follows the active locale.
 */
const EMBED = 'https://www.youtube-nocookie.com/embed/';

const youtube = (slot, dialog) => {
  let frame = null;
  return {
    play() {
      if (frame) return;
      const params = new URLSearchParams({ autoplay: '1', rel: '0', playsinline: '1' });
      frame = document.createElement('iframe');
      frame.className = 'video-embed__frame';
      frame.src = `${EMBED}${slot.dataset.youtube}?${params}`;
      frame.title = dialog.getAttribute('aria-label') ?? '';
      frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      frame.allowFullscreen = true;
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      slot.append(frame);
      slot.classList.add('is-playing');
    },
    stop() {
      frame?.remove();
      frame = null;
      slot.classList.remove('is-playing');
    },
  };
};

const native = (video) => ({
  play() {
    video.currentTime = 0;
    video.play().catch(() => {});
  },
  stop() {
    video.pause();
  },
});

/** @param {HTMLDialogElement} dialog @param {string} selector the player slot */
export const createVideoPlayer = (dialog, selector) => {
  const slot = dialog.querySelector(selector);
  return slot.dataset.youtube ? youtube(slot, dialog) : native(slot);
};
