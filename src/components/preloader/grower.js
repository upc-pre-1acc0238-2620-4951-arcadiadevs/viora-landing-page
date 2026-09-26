/**
 * Stop-motion olive grower for the preloader: an ink drawing rigged at the
 * shoulder, elbow, wrist, neck and hip, posed by keyframes and rendered one
 * frame at a time (12 fps, "on ones") so the motion reads as hand-animated.
 *
 * Each cycle he reaches up, plucks an olive, and drops it into his basket.
 * A turbulence filter re-seeded every frame adds the classic line boil.
 */

/** Pose keyframes: [frame, value]. Values hold after the last key. */
const CYCLE = 44;
const KEYS = {
  // Near arm, degrees. 0 hangs straight down, negative swings forward/up.
  upper: [
    [0, -22],
    [6, -22],
    [8, -14],
    [15, -150],
    [19, -150],
    [21, -146],
    [29, -22],
  ],
  fore: [
    [0, -60],
    [6, -60],
    [8, -66],
    [15, -6],
    [19, -8],
    [29, -60],
  ],
  head: [
    [0, 9],
    [6, 9],
    [11, -15],
    [21, -13],
    [27, 8],
  ],
  lean: [
    [0, 0],
    [8, 1.5],
    [15, -3],
    [20, -3],
    [27, 0],
  ],
  lift: [
    [0, 0],
    [8, 1],
    [15, -2.5],
    [20, -2.5],
    [26, 0],
  ],
  // The bough dips when the olive is pulled and springs back with overshoot.
  bough: [
    [0, 0],
    [16, 0],
    [17, 1.6],
    [19, -2.2],
    [21, 1.1],
    [23, -0.5],
    [25, 0],
  ],
  basket: [
    [0, 0],
    [32, 0],
    [33, 1.6],
    [35, -0.4],
    [36, 0],
  ],
};

const GRIP = [17, 30]; // hand closed around the olive
const DROP = [30, 34]; // olive falling into the basket
const REGROW = 38; // a new olive is ready on the bough (he is looking down)
const BLINKS = [3, 39];
export const REST = [35, 6]; // frames where he is idle, in a wrapping range

const SHOULDER = [134, 118];
const UPPER = 34;
const FORE = 30;
const HAND_OLIVE = 11.5;
const RIM = 186;
const PILE = 5;
const BOIL_SEEDS = [2, 9, 17];

const ease = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

function sample(keys, frame) {
  const next = keys.findIndex(([at]) => at > frame);
  if (next === -1) return keys.at(-1)[1];
  if (next === 0) return keys[0][1];
  const [from, a] = keys[next - 1];
  const [to, b] = keys[next];
  return a + (b - a) * ease((frame - from) / (to - from));
}

/** Direction of a limb drawn pointing down (+y) after rotating it by `deg`. */
function direction(deg) {
  const rad = (deg * Math.PI) / 180;
  return [-Math.sin(rad), Math.cos(rad)];
}

/** Forward kinematics: the held olive's position in body coordinates. */
function heldOlive(upper, fore) {
  const [ux, uy] = direction(upper);
  const [fx, fy] = direction(upper + fore);
  return [
    SHOULDER[0] + ux * UPPER + fx * (FORE + HAND_OLIVE),
    SHOULDER[1] + uy * UPPER + fy * (FORE + HAND_OLIVE),
  ];
}

const inRange = (frame, [from, to]) =>
  from <= to ? frame >= from && frame < to : frame >= from || frame < to;

const leaf = (x, y, angle, inked = false) =>
  `<g transform="translate(${x} ${y}) rotate(${angle})"><path class="${inked ? 'g-ink' : 'g-line'}" d="M0 0Q12-5 32 0Q12 5 0 0Z"/><path class="g-stroke g-fine" d="M3 0H25"/></g>`;

const LEAVES = [
  [286, 8, 160],
  [276, 11, 58, true],
  [262, 16, 172],
  [252, 19, 96],
  [238, 25, 150, true],
  [226, 29, 52],
  [212, 34, 166],
  [202, 37, 104, true],
  [190, 41, 140],
  [180, 44, 64],
  [160, 51, 170, true],
  [150, 55, 36],
  [142, 60, 132],
  [231, 34, 20],
  [233, 44, 118, true],
  [236, 52, 62],
]
  .map((args) => leaf(...args))
  .join('');

const PILE_OLIVES = [
  [158, 184],
  [182, 184.5],
  [170, 182.5],
  [163, 180.5],
  [177, 181],
]
  .map(
    ([cx, cy], index) =>
      `<ellipse data-grower="pile" class="${index % 2 ? 'g-line' : 'g-ink'}" cx="${cx}" cy="${cy}" rx="3.1" ry="3.8" transform="rotate(${index * 23 - 30} ${cx} ${cy})" visibility="hidden"/>`,
  )
  .join('');

const MARKUP = `
<svg class="grower" viewBox="0 0 280 320" aria-hidden="true" focusable="false">
  <defs>
    <filter id="grower-boil" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence data-grower="noise" type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="2"/>
      <feDisplacementMap in="SourceGraphic" scale="2.6" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
  </defs>
  <g class="grower__ink" filter="url(#grower-boil)">
    <path class="g-stroke" d="M58 306Q92 303 126 305T196 304T236 306"/>
    <path class="g-stroke g-fine" d="M70 310H86M188 310H214M100 311H112"/>

    <g data-grower="bough">
      <path class="g-stroke g-bold" d="M312 2Q266 15 230 27Q196 40 170 47Q151 53 138 62"/>
      <path class="g-stroke" d="M230 27Q239 40 234 55"/>
      ${LEAVES}
      <path class="g-stroke g-fine" d="M251 20L250 26M223 31L222 38M199 40L198 47M234 55V58M169 47L168 51"/>
      <ellipse class="g-ink" cx="250" cy="29.5" rx="3" ry="3.8"/>
      <ellipse class="g-line" cx="222" cy="41.5" rx="3" ry="3.8"/>
      <ellipse class="g-ink" cx="198" cy="50.5" rx="3" ry="3.8"/>
      <ellipse class="g-line" cx="234" cy="61.5" rx="3" ry="3.8"/>
      <ellipse data-grower="target" class="g-ink" cx="168" cy="55" rx="3" ry="3.8"/>
    </g>

    <g class="grower__legs">
      <path class="g-ink" d="M101 192Q97 230 98 262Q99 280 101 296H117Q117 270 118 250Q120 226 121 200Z"/>
      <path class="g-ink" d="M119 198Q123 226 124 250Q127 274 126 296H142Q145 268 142 242Q141 220 140 192Z"/>
      <path class="g-paper-stroke" d="M109 214Q107 244 109 284M133 222Q135 250 134 286"/>
      <path class="g-line" d="M98 295H115Q125 297 127 305H97Q96 299 98 295Z"/>
      <path class="g-line" d="M126 295H141Q154 297 157 305H124Q123 299 126 295Z"/>
      <path class="g-stroke g-fine" d="M97 302H127M124 302H157M117 297L119 300M144 297L146 300"/>
    </g>

    <g data-grower="body">
      <path class="g-line" d="M98 116Q94 136 99 150H110Q112 134 110 118Z"/>
      <path class="g-line" d="M101 148Q118 168 144 174L146 181Q116 178 99 156Z"/>
      <path class="g-line" d="M114 96V112H124V96Z"/>
      <path class="g-line" d="M103 111Q119 104 135 111Q142 116 142 130L143 160Q144 180 141 196Q120 201 99 196Q95 172 97 150Q96 124 103 111Z"/>
      <path class="g-line" d="M112 109L118 118L124 108"/>
      <path class="g-stroke g-fine" d="M118 118L119 194M106 150Q110 164 108 180M134 146Q131 156 134 170M125 128H133V136H125Z"/>
      <path class="g-stroke" d="M99 190Q120 196 141 190"/>

      <ellipse class="g-ink" cx="170" cy="${RIM}" rx="26" ry="6"/>
      ${PILE_OLIVES}
      <ellipse data-grower="falling" class="g-ink" rx="3.1" ry="3.8" visibility="hidden"/>
      <g data-grower="basket">
        <path class="g-line" d="M144 ${RIM}A26 6 0 0 0 196 ${RIM}Q194 210 186 216H154Q146 210 144 ${RIM}Z"/>
        <path class="g-stroke g-fine" d="M146 194Q170 201 195 194M148 202Q170 209 193 202M151 209Q170 214 190 209M156 191L157 215M166 192V216M176 192L175.5 216M186 191L184.5 214"/>
        <path class="g-stroke g-bold" d="M144 ${RIM}A26 6 0 0 0 196 ${RIM}"/>
      </g>
      <path class="g-line" d="M141 180Q146 175 152 179Q154 185 148 187Q143 187 141 184Z"/>

      <g data-grower="head">
        <path class="g-line" d="M107 84Q106 68 120 67Q132 67 134 79L135 83Q140 88 135 90L134 93Q134 99 127 101Q117 103 111 97Q107 92 107 84Z"/>
        <path class="g-ink" d="M107 78Q104 88 109 95L112 90Q109 84 110 78Z"/>
        <path class="g-stroke g-fine" d="M113 83Q108 83 109 88Q110 92 114 91M125.5 77.5Q128.5 76 131 77.5M130 95.5Q132 96 133.5 95"/>
        <ellipse data-grower="eye" class="g-ink" cx="128" cy="81.5" rx="1.3" ry="1.7"/>
        <ellipse class="g-line" cx="121" cy="71" rx="27" ry="5.5"/>
        <path class="g-line" d="M107 71Q107 55 120.5 54Q134 55 134 71Z"/>
        <path class="g-ink" d="M107.5 65.5Q121 68.5 133.5 65.5L134 71Q121 74 107 71Z"/>
        <path class="g-stroke g-fine" d="M113 60L114.5 64M121 57V63M128 59.5L127 64M98 72.5L103 73M139 73.5L144 72.5M118 75.5L121 76"/>
      </g>

      <g transform="translate(${SHOULDER[0]} ${SHOULDER[1]})">
        <g data-grower="upper">
          <g transform="translate(0 ${UPPER})">
            <g data-grower="fore">
              <path class="g-line" d="M-4.4 0A4.4 4.4 0 0 1 4.4 0L3.8 ${FORE}H-3.6Z"/>
              <g transform="translate(0 ${FORE})">
                <ellipse data-grower="held" class="g-ink" cx="0" cy="${HAND_OLIVE}" rx="3" ry="3.8" visibility="hidden"/>
                <g data-grower="open">
                  <path class="g-line" d="M-3.8-1H4Q6.2 6 4.6 11Q3 16-.5 15.5Q-4 15-4.5 10L-8.4 7.4Q-9 5-6.2 5L-4.4 6.2Z"/>
                  <path class="g-stroke g-fine" d="M-1 9.5L-.6 15M1.8 9L2.2 15"/>
                </g>
                <g data-grower="closed" visibility="hidden">
                  <path class="g-line" d="M-4-1H4Q6.6 5 4.6 9.6Q1 12.2-3 10.2Q-6.2 7-4-1Z"/>
                  <path class="g-stroke g-fine" d="M-3 6Q0 7.5 3.4 6"/>
                </g>
              </g>
            </g>
          </g>
          <path class="g-line" d="M-8-4Q-9.5 12-7.5 26H7.5Q9 12 7.5-5Z"/>
          <path class="g-line" d="M-8 23H8L8.5 30H-8.2Z"/>
          <path class="g-stroke g-fine" d="M-3 5Q-2 13-3 19"/>
        </g>
      </g>
    </g>
  </g>
</svg>`;

export function createGrower(host) {
  host.insertAdjacentHTML('beforeend', MARKUP);
  const svg = host.lastElementChild;
  const part = (name) => svg.querySelector(`[data-grower="${name}"]`);
  const parts = {
    noise: part('noise'),
    bough: part('bough'),
    body: part('body'),
    head: part('head'),
    upper: part('upper'),
    fore: part('fore'),
    basket: part('basket'),
    target: part('target'),
    held: part('held'),
    open: part('open'),
    closed: part('closed'),
    falling: part('falling'),
    eye: part('eye'),
    pile: [...svg.querySelectorAll('[data-grower="pile"]')],
  };

  const show = (element, visible) =>
    element.setAttribute('visibility', visible ? 'visible' : 'hidden');

  let frame = 0;
  let harvested = 0;
  let boil = 0;

  function render() {
    const pose = Object.fromEntries(
      Object.entries(KEYS).map(([key, keys]) => [key, sample(keys, frame)]),
    );
    const gripping = inRange(frame, GRIP);

    parts.body.setAttribute('transform', `translate(0 ${pose.lift}) rotate(${pose.lean} 120 192)`);
    parts.head.setAttribute('transform', `rotate(${pose.head} 119 100)`);
    parts.upper.setAttribute('transform', `rotate(${pose.upper})`);
    parts.fore.setAttribute('transform', `rotate(${pose.fore})`);
    parts.bough.setAttribute('transform', `rotate(${pose.bough} 312 2)`);
    parts.basket.setAttribute('transform', `translate(0 ${pose.basket})`);
    parts.eye.setAttribute('ry', BLINKS.includes(frame) ? 0.3 : 1.7);

    show(parts.target, frame < GRIP[0] || frame >= REGROW);
    show(parts.held, gripping);
    show(parts.closed, gripping);
    show(parts.open, !gripping);

    const falling = inRange(frame, DROP);
    show(parts.falling, falling);
    if (falling) {
      const [x, y] = heldOlive(sample(KEYS.upper, DROP[0]), sample(KEYS.fore, DROP[0]));
      const t = (frame - DROP[0] + 1) / (DROP[1] - DROP[0]);
      parts.falling.setAttribute('cx', x - 3 * t);
      parts.falling.setAttribute('cy', y + (RIM + 2 - y) * t * t);
    }
    if (frame === DROP[1]) harvested = Math.min(harvested + 1, PILE);
    parts.pile.forEach((olive, index) => show(olive, index < harvested));

    boil = (boil + 1) % BOIL_SEEDS.length;
    parts.noise.setAttribute('seed', BOIL_SEEDS[boil]);
  }

  render();

  return {
    svg,
    get frame() {
      return frame;
    },
    /** Advances one stop-motion frame. Returns true when a cycle wraps. */
    step() {
      frame = (frame + 1) % CYCLE;
      render();
      return frame === 0;
    },
    /** True when he has just harvested (or has not started reaching yet). */
    get resting() {
      return inRange(frame, REST);
    },
    destroy() {
      svg.remove();
    },
  };
}
