/**
 * Handwritten field notes around the grower. Driven by the preloader's
 * stop-motion clock: each note is "written" a few letters per frame, lingers,
 * then is rubbed out in stepped fades — never tweened smoothly.
 */

/** Anchor points in % of the grower box, clear of the figure and the bough. */
const SLOTS = [
  [-6, 6],
  [26, -9],
  [-30, 36],
  [112, 22],
  [-18, 72],
  [104, 62],
  [66, -16],
  [96, 96],
  [8, 104],
  [58, 108],
];
const TONES = [0.92, 0.72, 0.5, 0.34];
const LETTERS_PER_FRAME = 1.5;
const LIFE = 34; // frames a note stays fully written
const FADE = [0.55, 0.2, 0];
const SPAWN_EVERY = 6;
const MAX_NOTES = 5;

const pick = (list) => list[Math.floor(Math.random() * list.length)];

export function createNotes(container, words) {
  const notes = [];
  const queue = [];
  let clock = 0;
  let closing = false;

  const nextWord = () => {
    if (!queue.length) queue.push(...[...words].sort(() => Math.random() - 0.5));
    return queue.shift();
  };

  function spawn() {
    const busy = new Set(notes.map((note) => note.slot));
    const free = SLOTS.map((_, index) => index).filter((index) => !busy.has(index));
    if (!free.length || notes.length >= MAX_NOTES) return;

    const slot = pick(free);
    const [x, y] = SLOTS[slot];
    const text = nextWord();
    const element = document.createElement('span');
    element.className = 'preloader__note';
    element.textContent = text;
    element.style.cssText = `left:${x}%;top:${y}%;--tone:${pick(TONES)};--tilt:${(Math.random() * 12 - 7).toFixed(1)}deg;--size:${(0.85 + Math.random() * 0.35).toFixed(2)}`;
    container.append(element);

    // Narrow screens: slots far from the figure can fall off the page.
    const box = element.getBoundingClientRect();
    if (box.left < 8 || box.right > window.innerWidth - 8 || box.top < 8) {
      element.remove();
      return;
    }
    notes.push({ element, slot, written: 0, length: text.length, age: 0, fade: -1 });
  }

  function paint(note) {
    const shown = Math.min(1, note.written / note.length);
    note.element.style.setProperty('--written', `${(1 - shown) * 100}%`);
    if (note.fade >= 0) note.element.style.setProperty('--fade', FADE[note.fade]);
  }

  return {
    step() {
      clock += 1;
      if (!closing && clock % SPAWN_EVERY === 1) spawn();

      for (const note of [...notes]) {
        if (note.fade >= 0) {
          note.fade += 1;
          if (note.fade >= FADE.length) {
            note.element.remove();
            notes.splice(notes.indexOf(note), 1);
            continue;
          }
        } else if (note.written < note.length) {
          note.written += LETTERS_PER_FRAME;
        } else if (++note.age > LIFE || closing) {
          note.fade = 0;
        }
        paint(note);
      }
      return notes.length === 0;
    },
    /** Stops writing and rubs every note out over the next frames. */
    close() {
      closing = true;
      notes.forEach((note) => {
        if (note.fade >= 0) return;
        note.fade = 0;
        paint(note);
      });
    },
    destroy() {
      notes.forEach((note) => note.element.remove());
      notes.length = 0;
    },
  };
}
