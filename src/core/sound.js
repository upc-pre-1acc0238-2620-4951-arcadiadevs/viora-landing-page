/**
 * Sound engine (Web Audio), driven by the `sound` visitor preference.
 *
 * The score — "Nocturno andino" — is one theme in many rooms. Every section
 * names its room with `data-sound-zone`; the room holding the middle of the
 * viewport owns the music.
 *
 * - Score beds share one form (16 bars in D major at 90 BPM, 42.667 s) and
 *   one clock, so a change of room waits for the next bar line and
 *   crossfades in time and in key, like a band changing section.
 * - The footer music box keeps its own time: it follows the tapestry's
 *   clock (`syncBed`).
 * - Modal dialogs pull the music back, and all the way out while one of
 *   their videos plays with sound; the open menu muffles it (low-pass).
 * - Interface cues play on interactive elements, mapped like
 *   pensatori-irrazionali.com: labelled links and buttons get the soft hover
 *   (their navHover), icon-only controls tick (their socialHover).
 *   `data-sound-hover="<cue>|none"` overrides it, and
 *   `data-sound-cue="open|none"` overrides the click (none mutes both).
 * - Turning sound off never cuts: the master fades out, then the context is
 *   suspended. Hidden tabs fade out the same way.
 * - An analyser after the master feeds `soundLevels` (the toggle's bars).
 *
 * Browsers only start audio from a gesture, so the context is created on the
 * click that turns sound on, or on the first tap/keypress of a visit that
 * remembers sound as on. Beds download and decode only once sound is on and
 * their room is near, and are dropped again after a while unheard.
 */
import { media } from '@/config/breakpoints.js';
import { getPreference, PREFERENCES_CHANGE } from '@/core/preferences.js';
import { qsa } from '@/utils/dom.js';

const BASE = '/assets/sound';
const EXT = document.createElement('audio').canPlayType('audio/ogg; codecs="vorbis"')
  ? 'ogg'
  : 'm4a';

/** The score's clock: 90 BPM in 4/4, 16-bar loops. */
const BAR = (60 / 90) * 4;
const SCORE_LOOP = BAR * 16;
/** Every score bed is mastered to the same loudness; this sets it in the page. */
const SCORE_VOLUME = 0.42;

const BEDS = {
  theme: { src: 'score/theme', score: true },
  cases: { src: 'score/cases', score: true },
  tacna: { src: 'score/tacna', score: true },
  sky: { src: 'score/sky', score: true },
  plans: { src: 'score/plans', score: true },
  about: { src: 'score/about', score: true },
  notturno: { src: 'score/notturno', score: true },
  musicbox: { src: 'score/musicbox', loop: 36, volume: 0.38 },
};

const CUES = {
  click: { src: 'ui/click', volume: 0.42 },
  hover: { src: 'ui/hover', volume: 0.09 },
  tick: { src: 'ui/tick', volume: 0.14 },
  open: { src: 'ui/open', volume: 0.45 },
};

/** Seconds to reach the new level (≈ 98 %, exponential like a hand on a fader). */
const FADE = { bedIn: 2.8, bedOut: 3.2, masterIn: 0.6, masterOut: 1.8, duck: 0.8 };
/** How far the music steps back behind a dialog, and under a playing video. */
const DUCK = { dialog: 0.35, video: 0 };
/** Low-pass while the menu is open (Hz). */
const MUFFLE = 700;
/** A bed unheard for this long is stopped and its decoded audio released. */
const EVICT_AFTER = 45;
/** Frequency bands (analyser bins at 48 kHz / 256) behind the toggle's bars. */
const BANDS = [
  [1, 3],
  [3, 7],
  [7, 16],
  [16, 44],
];

let ctx = null;
let master = null;
let music = null;
let muffle = null;
let analyser = null;
let spectrum = null;
let epoch = null;
let enabled = getPreference('sound');
let zone = null;
let sleep = 0;
const buffers = new Map();
const beds = new Map();
const clocks = new Map();

/** Glides an AudioParam to `value` in about `seconds`, from `at` (default now). */
function glide(param, value, seconds, at = ctx.currentTime) {
  const now = ctx.currentTime;
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  param.setTargetAtTime(value, Math.max(at, now), seconds / 4);
}

/** Encoder priming (AAC) shows up as leading digital silence: skip it. */
function leadOf(buffer) {
  const data = buffer.getChannelData(0);
  let lead = 0;
  while (lead < 4096 && lead < data.length && data[lead] === 0) lead += 1;
  return lead / buffer.sampleRate;
}

function load(src) {
  if (!buffers.has(src)) {
    const pending = fetch(`${BASE}/${src}.${EXT}`)
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status}`);
        return response.arrayBuffer();
      })
      .then((data) => ctx.decodeAudioData(data))
      .catch((error) => {
        console.warn(`Sound "${src}" unavailable.`, error);
        buffers.delete(src);
        return null;
      });
    buffers.set(src, pending);
  }
  return buffers.get(src);
}

function createContext() {
  const Context = window.AudioContext ?? window.webkitAudioContext;
  if (!Context) return false;
  ctx = new Context();
  master = ctx.createGain();
  master.gain.value = 0;
  music = ctx.createGain();
  muffle = ctx.createBiquadFilter();
  muffle.type = 'lowpass';
  muffle.frequency.value = ctx.sampleRate / 2;
  muffle.Q.value = 0.5;
  analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.72;
  spectrum = new Uint8Array(analyser.frequencyBinCount);
  music.connect(muffle).connect(master);
  master.connect(analyser);
  analyser.connect(ctx.destination);
  Object.values(CUES).forEach(({ src }) => load(src));
  return true;
}

// ── Beds ──────────────────────────────────────────────────────────────────
/** Where a bed's loop should be at context time `at`. */
function offsetAt(name, at) {
  const spec = BEDS[name];
  if (spec.score) return (((at - epoch) % SCORE_LOOP) + SCORE_LOOP) % SCORE_LOOP;
  const clock = clocks.get(name);
  const length = spec.loop ?? 0;
  if (!clock) return 0;
  const time = clock.time + (clock.running ? at - clock.at : 0);
  return length ? ((time % length) + length) % length : 0;
}

/** Starts (or restarts, e.g. after a jump) a bed's looping voice at `at`. */
function voice(entry, at) {
  const { name, buffer } = entry;
  const spec = BEDS[name];
  const lead = leadOf(buffer);
  const length = spec.score ? SCORE_LOOP : (spec.loop ?? buffer.duration - lead);
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  source.buffer = buffer;
  source.loop = true;
  source.loopStart = lead;
  source.loopEnd = lead + length;
  gain.gain.value = 0;
  gain.gain.setTargetAtTime(1, at, 0.02);
  source.connect(gain).connect(entry.fader);
  source.start(at, lead + (offsetAt(name, at) % length));
  const previous = entry.voice;
  if (previous) {
    previous.gain.gain.setTargetAtTime(0, at, 0.03);
    previous.source.stop(at + 0.3);
  }
  entry.voice = { source, gain };
}

function bed(name) {
  if (beds.has(name)) return beds.get(name);
  const fader = ctx.createGain();
  fader.gain.value = 0;
  fader.connect(music);
  const entry = { name, fader, buffer: null, voice: null, heard: ctx.currentTime };
  beds.set(name, entry);
  entry.ready = load(BEDS[name].src).then((buffer) => {
    if (!buffer || !ctx || beds.get(name) !== entry) return;
    entry.buffer = buffer;
    if (BEDS[name].score && epoch === null) epoch = ctx.currentTime;
    voice(entry, ctx.currentTime + 0.05);
  });
  return entry;
}

function evict(entry) {
  entry.voice?.source.stop();
  entry.fader.disconnect();
  beds.delete(entry.name);
  buffers.delete(BEDS[entry.name].src);
}

/** The next bar line of the score clock (now, if nothing is sounding yet). */
function nextBar() {
  const now = ctx.currentTime;
  const sounding = [...beds.values()].some(
    (entry) => entry.voice && entry.fader.gain.value > 0.02 && BEDS[entry.name].score,
  );
  if (epoch === null || !sounding) return now;
  return epoch + Math.ceil((now + 0.05 - epoch) / BAR) * BAR;
}

function route() {
  const target = zone;
  if (target) {
    const entry = bed(target);
    entry.ready.then(() => {
      if (!ctx || zone !== target || !entry.buffer) return;
      const spec = BEDS[target];
      const at = spec.score ? nextBar() : ctx.currentTime;
      const level = spec.score ? SCORE_VOLUME : spec.volume;
      const clock = clocks.get(target);
      glide(entry.fader.gain, clock && !clock.running ? 0 : level, FADE.bedIn, at);
      beds.forEach((other) => {
        if (other !== entry) glide(other.fader.gain, 0, FADE.bedOut, at);
      });
    });
  } else {
    beds.forEach((other) => glide(other.fader.gain, 0, FADE.bedOut));
  }
}

const audible = () => enabled && !document.hidden;

function sync() {
  if (!ctx) return;
  window.clearTimeout(sleep);
  if (audible()) {
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    glide(master.gain, 1, FADE.masterIn);
    route();
  } else {
    glide(master.gain, 0, FADE.masterOut);
    // Let the fade finish, then stop the audio thread altogether.
    sleep = window.setTimeout(() => ctx?.suspend().catch(() => {}), FADE.masterOut * 1000);
  }
}

/** Creates or wakes the context. Must run inside a user gesture. */
function unlock() {
  if (!enabled) return;
  if (!ctx && !createContext()) return;
  sync();
}

/**
 * Locks a free bed to an outside clock (the footer tapestry): `time` is where
 * that clock is now, in seconds; `running` false holds the music box still.
 */
export function syncBed(name, time, running = true) {
  const at = ctx ? ctx.currentTime : 0;
  clocks.set(name, { time, at, running });
  const entry = beds.get(name);
  if (!ctx || !entry?.buffer) return;
  if (running) voice(entry, ctx.currentTime + 0.02);
  if (zone === name) {
    glide(entry.fader.gain, running ? BEDS[name].volume : 0, running ? 0.6 : 1.4);
  }
}

export function playCue(name) {
  if (!ctx || !audible() || ctx.state !== 'running') return;
  const { src, volume } = CUES[name];
  load(src).then((buffer) => {
    if (!buffer || !ctx) return;
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    // A hair of pitch drift so repeated cues don't sound machine-gunned.
    source.playbackRate.value = 0.96 + Math.random() * 0.08;
    gain.gain.value = volume;
    source.connect(gain).connect(master);
    source.start();
  });
}

/** Whether any music bed is currently sounding (for the toggle's idle look). */
export const musicPlaying = () =>
  Boolean(
    ctx &&
    audible() &&
    ctx.state === 'running' &&
    [...beds.values()].some((entry) => entry.voice && entry.fader.gain.value > 0.05),
  );

/**
 * Writes the loudness of each band (0–1) into `out` (length 4). Zeros while
 * silent, so the toggle can read it every frame without checking state.
 */
export function soundLevels(out) {
  if (!analyser || ctx.state !== 'running') {
    out.fill(0);
    return out;
  }
  analyser.getByteFrequencyData(spectrum);
  BANDS.forEach(([from, to], i) => {
    let sum = 0;
    for (let bin = from; bin < to; bin += 1) sum += spectrum[bin];
    out[i] = sum / (to - from) / 255;
  });
  return out;
}

const INTERACTIVE = 'a[href], button, [role="tab"], summary, label[for]';

/** Mounts preference, zone, focus, visibility and interaction listeners. */
export function initSound() {
  const cleanups = [];
  const on = (target, type, handler, options) => {
    target.addEventListener(type, handler, options);
    cleanups.push(() => target.removeEventListener(type, handler, options));
  };

  on(document, PREFERENCES_CHANGE, ({ detail }) => {
    if (detail.key !== 'sound') return;
    enabled = detail.value;
    if (enabled) unlock();
    else sync();
  });

  // A remembered "on" waits for the visit's first gesture.
  const gesture = () => {
    if (enabled && (!ctx || ctx.state !== 'running')) unlock();
  };
  ['pointerdown', 'touchend', 'keydown'].forEach((type) =>
    on(document, type, gesture, { capture: true }),
  );
  on(document, 'visibilitychange', sync);

  // ── Rooms: the zone crossing the middle of the viewport owns the music ──
  const zones = qsa('[data-sound-zone]');
  const inside = new Set();
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(({ target, isIntersecting }) =>
        isIntersecting ? inside.add(target) : inside.delete(target),
      );
      const next = zones.filter((element) => inside.has(element)).pop()?.dataset.soundZone;
      // Between rooms (a gap, a pin spacer) the last one keeps playing.
      if (!next || next === zone) return;
      zone = next;
      if (ctx && audible()) route();
    },
    { rootMargin: '-50% 0px -50% 0px' },
  );
  zones.forEach((element) => observer.observe(element));
  cleanups.push(() => observer.disconnect());

  // Rooms a screen away start loading, so the change lands on the bar.
  const nearby = new IntersectionObserver(
    (entries) =>
      entries.forEach(({ target, isIntersecting }) => {
        if (isIntersecting && ctx && enabled) bed(target.dataset.soundZone);
      }),
    { rootMargin: '100% 0px' },
  );
  zones.forEach((element) => nearby.observe(element));
  cleanups.push(() => nearby.disconnect());

  // Unheard beds give their memory back (a decoded bed is ~16 MB).
  const sweep = window.setInterval(() => {
    if (!ctx) return;
    const now = ctx.currentTime;
    beds.forEach((entry) => {
      if (entry.fader.gain.value > 0.001 || entry.name === zone) entry.heard = now;
      else if (now - entry.heard > EVICT_AFTER) evict(entry);
    });
  }, 5000);
  cleanups.push(() => window.clearInterval(sweep));

  // ── Focus: dialogs pull the music back, the menu muffles it ──
  const playing = new Set();
  const duck = () => {
    if (!ctx) return;
    const open = qsa('dialog[open]');
    const level = playing.size ? DUCK.video : open.length ? DUCK.dialog : 1;
    glide(music.gain, level, FADE.duck);
  };
  const dialogs = new MutationObserver(duck);
  qsa('dialog').forEach((dialog) => dialogs.observe(dialog, { attributeFilter: ['open'] }));
  cleanups.push(() => dialogs.disconnect());
  const onMedia = ({ target, type }) => {
    if (!(target instanceof HTMLVideoElement) || !target.closest('dialog')) return;
    if (type === 'play' && !target.muted) playing.add(target);
    else playing.delete(target);
    duck();
  };
  ['play', 'pause', 'ended', 'volumechange'].forEach((type) =>
    on(document, type, onMedia, { capture: true }),
  );

  const menu = document.querySelector('[data-navbar-menu]');
  if (menu) {
    const muffled = new MutationObserver(() => {
      if (!ctx) return;
      const open = menu.getAttribute('aria-expanded') === 'true';
      glide(muffle.frequency, open ? MUFFLE : ctx.sampleRate / 2, open ? 0.5 : 0.9);
    });
    muffled.observe(menu, { attributeFilter: ['aria-expanded'] });
    cleanups.push(() => muffled.disconnect());
  }

  // ── Interface cues ──
  const hoverCue = (element) => {
    const forced = element.closest('[data-sound-hover]')?.dataset.soundHover;
    if (forced) return forced;
    return element.textContent.trim() ? 'hover' : 'tick';
  };
  const cueOf = (element) => element.closest('[data-sound-cue]')?.dataset.soundCue;
  on(document, 'click', (event) => {
    const target = event.target.closest(INTERACTIVE);
    if (!target || target.matches(':disabled, [aria-disabled="true"]')) return;
    const cue = cueOf(target) ?? 'click';
    if (cue !== 'none') playCue(cue);
  });
  const fine = window.matchMedia(media.finePointer);
  let lastHover = 0;
  on(document, 'pointerover', (event) => {
    if (!fine.matches || event.pointerType !== 'mouse') return;
    const target = event.target.closest(INTERACTIVE);
    if (!target || target.contains(event.relatedTarget) || cueOf(target) === 'none') return;
    if (target.closest('[data-sound-hover]')?.dataset.soundHover === 'none') return;
    const now = performance.now();
    if (now - lastHover < 80) return;
    lastHover = now;
    playCue(hoverCue(target));
  });

  if (import.meta.env.DEV) {
    // Design QA: which room is playing and how loud each bed is.
    window.__sound = {
      zone: () => zone,
      beds: () =>
        Object.fromEntries([...beds].map(([name, entry]) => [name, entry.fader.gain.value])),
      duck: () => music?.gain.value,
      muffle: () => muffle?.frequency.value,
      bar: () => (ctx && epoch !== null ? ((ctx.currentTime - epoch) / BAR) % 16 : null),
    };
  }

  return () => {
    cleanups.forEach((cleanup) => cleanup());
    window.clearTimeout(sleep);
    beds.forEach((entry) => entry.voice?.source.stop());
    beds.clear();
    buffers.clear();
    clocks.clear();
    ctx?.close().catch(() => {});
    ctx = null;
    master = null;
    music = null;
    muffle = null;
    analyser = null;
    epoch = null;
    zone = null;
  };
}
