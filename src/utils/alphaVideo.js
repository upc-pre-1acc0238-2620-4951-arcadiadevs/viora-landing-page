/**
 * The branch clips are VP9 with alpha. Safari decodes VP9 but drops the
 * alpha (the clip turns into a black square), so it keeps the posters.
 */
export const supportsAlphaVideo = () => {
  const probe = document.createElement('video');
  const safari = /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);
  return !safari && probe.canPlayType('video/webm; codecs="vp9"') !== '';
};
