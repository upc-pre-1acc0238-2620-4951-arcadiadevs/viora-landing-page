/**
 * "Reserve" dress for the Viora bottle (BottleScene, LABEL_STYLE = 'reserve'):
 * a tall front label in the premium oil tradition (deep ground, gold foil,
 * a serif brand, an olive sprig) and a foil collar on the neck.
 *
 * Everything is painted once on 2D canvases: one colour texture and one foil
 * mask per segment. The shader reads the mask to turn the gold into metal
 * (studio reflections, a travelling glint) and to emboss it (the mask's
 * slope bends the normal), then adds paper grain, a satin varnish and the
 * paper's edge. Two small textures and a handful of samples: cheap.
 */

/** Canvas size and where the label sits on the body (bottle space). */
export const RESERVE = {
  width: 720,
  height: 1320,
  top: 0.12,
  bottom: -1.62,
  radius: 0.448,
};

/** Per segment: grower (early harvest, green fruit) and cooperative (ripe, black fruit). */
export const RESERVE_INKS = [
  {
    ground: '#11201a',
    glow: '#1f3a2c',
    gold: '#c8a24a',
    cream: '#f1e9d6',
    leaf: '#8a9a4e',
    leafDark: '#3f4f1f',
    fruit: '#a2ae36',
    fruitDark: '#4a5610',
    collar: '#11201a',
  },
  {
    ground: '#1d1410',
    glow: '#3a2619',
    gold: '#c8a24a',
    cream: '#f1e9d6',
    leaf: '#8d8a52',
    leafDark: '#454221',
    fruit: '#6b4a6e',
    fruitDark: '#24142a',
    collar: '#1d1410',
  },
];

/** The foil mask draws the same label: gold is white, everything else black. */
const MASK = {
  ground: '#000',
  glow: '#000',
  gold: '#fff',
  cream: '#000',
  leaf: '#000',
  leafDark: '#000',
  fruit: '#000',
  fruitDark: '#000',
};

let grain = null;
/** A small tile of paper fibre noise, made once. */
function grainTile() {
  if (grain) return grain;
  grain = document.createElement('canvas');
  grain.width = 160;
  grain.height = 160;
  const ctx = grain.getContext('2d');
  const image = ctx.createImageData(160, 160);
  for (let i = 0; i < image.data.length; i += 4) {
    const v = 128 + (Math.random() - 0.5) * 120;
    image.data[i] = v;
    image.data[i + 1] = v;
    image.data[i + 2] = v;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  // Fibres: faint horizontal streaks, like laid paper.
  ctx.globalAlpha = 0.08;
  for (let y = 0; y < 160; y += 3) {
    ctx.fillStyle = y % 2 ? '#fff' : '#000';
    ctx.fillRect(0, y, 160, 1);
  }
  return grain;
}

/** Tracked text, centred: canvas letter-spacing trails the last glyph. */
function spaced(ctx, text, x, y, size, font, tracking) {
  ctx.font = `${font} ${size}px Axiforma, sans-serif`;
  const gap = size * tracking;
  ctx.letterSpacing = `${gap}px`;
  ctx.fillText(text, x + gap / 2, y);
  const width = ctx.measureText(text).width;
  ctx.letterSpacing = '0px';
  return width - gap;
}

/** A frame with clipped corners. */
function frame(ctx, w, h, inset, cut) {
  ctx.beginPath();
  ctx.moveTo(inset + cut, inset);
  ctx.lineTo(w - inset - cut, inset);
  ctx.lineTo(w - inset, inset + cut);
  ctx.lineTo(w - inset, h - inset - cut);
  ctx.lineTo(w - inset - cut, h - inset);
  ctx.lineTo(inset + cut, h - inset);
  ctx.lineTo(inset, h - inset - cut);
  ctx.lineTo(inset, inset + cut);
  ctx.closePath();
  ctx.stroke();
}

/** A rule with a lozenge in the middle. */
function ornament(ctx, cx, y, half, p) {
  ctx.strokeStyle = p.gold;
  ctx.fillStyle = p.gold;
  ctx.lineWidth = 2;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + side * 16, y);
    ctx.lineTo(cx + side * half, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + side * half, y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(cx, y - 8);
  ctx.lineTo(cx + 8, y);
  ctx.lineTo(cx, y + 8);
  ctx.lineTo(cx - 8, y);
  ctx.closePath();
  ctx.fill();
}

/** One leaf, base at the origin, pointing along +x. */
function leaf(ctx, x, y, angle, length, p, mask) {
  const width = length * 0.2;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(length * 0.42, -width * 1.6, length, 0);
  ctx.quadraticCurveTo(length * 0.42, width * 1.6, 0, 0);
  ctx.closePath();
  if (mask) {
    ctx.fillStyle = p.leaf;
  } else {
    const shade = ctx.createLinearGradient(0, -width, 0, width);
    shade.addColorStop(0, p.leaf);
    shade.addColorStop(1, p.leafDark);
    ctx.fillStyle = shade;
  }
  ctx.fill();
  ctx.strokeStyle = p.gold;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(length * 0.04, 0);
  ctx.quadraticCurveTo(length * 0.5, -width * 0.25, length * 0.92, 0);
  ctx.stroke();
  ctx.restore();
}

/** One olive on a short gold stalk. */
function olive(ctx, x, y, angle, size, p, mask) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.strokeStyle = p.gold;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(size * 0.3, size * 0.5, 0, size * 0.9);
  ctx.stroke();
  ctx.translate(0, size * 1.75);
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.72, size * 0.9, 0, 0, Math.PI * 2);
  if (mask) {
    ctx.fillStyle = p.fruit;
    ctx.fill();
  } else {
    const body = ctx.createRadialGradient(-size * 0.25, -size * 0.35, size * 0.1, 0, 0, size * 1);
    body.addColorStop(0, p.fruit);
    body.addColorStop(1, p.fruitDark);
    ctx.fillStyle = body;
    ctx.fill();
    // A soft highlight: the fruit's wax.
    ctx.fillStyle = 'rgb(255 255 255 / 30%)';
    ctx.beginPath();
    ctx.ellipse(-size * 0.25, -size * 0.38, size * 0.16, size * 0.24, -0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = p.gold;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.72, size * 0.9, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** A sprig across the lower half: a curved stem, leaves in pairs, three olives. */
function sprig(ctx, w, h, p, mask) {
  const p0 = [w * 0.1, h * 0.715];
  const c = [w * 0.46, h * 0.735];
  const p1 = [w * 0.9, h * 0.555];
  const at = (t) => [
    (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * c[0] + t ** 2 * p1[0],
    (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * c[1] + t ** 2 * p1[1],
  ];
  const heading = (t) =>
    Math.atan2(
      2 * (1 - t) * (c[1] - p0[1]) + 2 * t * (p1[1] - c[1]),
      2 * (1 - t) * (c[0] - p0[0]) + 2 * t * (p1[0] - c[0]),
    );

  ctx.strokeStyle = p.gold;
  ctx.lineCap = 'round';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(...p0);
  ctx.quadraticCurveTo(...c, ...p1);
  ctx.stroke();

  const leaves = [
    [0.14, -1, 0.9],
    [0.22, 1, 1],
    [0.33, -1, 1.05],
    [0.44, 1, 1],
    [0.55, -1, 1.1],
    [0.66, 1, 0.95],
    [0.76, -1, 0.9],
    [0.86, 1, 0.8],
  ];
  leaves.forEach(([t, side, scale]) => {
    const [x, y] = at(t);
    leaf(ctx, x, y, heading(t) + side * 0.95, h * 0.085 * scale, p, mask);
  });
  // The tip leaf carries on along the stem.
  leaf(ctx, ...p1, heading(1) - 0.1, h * 0.07, p, mask);

  [
    [0.3, 0.25, 0.028],
    [0.5, -0.15, 0.032],
    [0.61, 0.35, 0.026],
  ].forEach(([t, tilt, size]) => {
    const [x, y] = at(t);
    olive(ctx, x, y, tilt, h * size, p, mask);
  });
}

/** Paints the label on `ctx` in palette `p` (colour pass or foil mask). */
function draw(ctx, p, text, mark, mask) {
  const { width: w, height: h } = ctx.canvas;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Ground: a lit centre falling to the deep colour at the edges.
  if (mask) {
    ctx.fillStyle = p.ground;
  } else {
    const ground = ctx.createRadialGradient(w / 2, h * 0.36, 0, w / 2, h * 0.36, h * 0.72);
    ground.addColorStop(0, p.glow);
    ground.addColorStop(1, p.ground);
    ctx.fillStyle = ground;
  }
  ctx.fillRect(0, 0, w, h);

  // Double gold frame with clipped corners.
  ctx.strokeStyle = p.gold;
  ctx.lineWidth = 3;
  frame(ctx, w, h, 30, 26);
  ctx.lineWidth = 1.4;
  frame(ctx, w, h, 42, 22);

  // Crest: the isotipo in a gold ring.
  const crest = [w / 2, h * 0.105];
  const ring = h * 0.045;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(...crest, ring, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(...crest, ring - 7, 0, Math.PI * 2);
  ctx.stroke();
  if (mark) {
    const size = ring * 1.15;
    const tint = document.createElement('canvas');
    tint.width = 256;
    tint.height = 256;
    const tctx = tint.getContext('2d');
    tctx.drawImage(mark, 0, 0, 256, 256);
    tctx.globalCompositeOperation = 'source-in';
    tctx.fillStyle = p.gold;
    tctx.fillRect(0, 0, 256, 256);
    ctx.drawImage(tint, crest[0] - size / 2, crest[1] - size / 2, size, size);
  }

  ctx.fillStyle = p.gold;
  spaced(ctx, text.top.toUpperCase(), w / 2, h * 0.19, h * 0.0165, 600, 0.3);

  // The brand.
  ctx.fillStyle = p.cream;
  ctx.font = `${h * 0.14}px "The Foriene Serif", Georgia, serif`;
  ctx.fillText('Viora', w / 2, h * 0.3);

  ornament(ctx, w / 2, h * 0.378, w * 0.26, p);

  // The segment in a gold cartouche.
  const kind = text.kind.toUpperCase();
  const size = h * 0.02;
  ctx.fillStyle = p.gold;
  const width = spaced(ctx, kind, w / 2, h * 0.43, size, 600, 0.42);
  ctx.strokeStyle = p.gold;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.roundRect(
    w / 2 - width / 2 - size * 1.4,
    h * 0.43 - size * 1.3,
    width + size * 2.8,
    size * 2.6,
    size * 1.3,
  );
  ctx.stroke();

  sprig(ctx, w, h, p, mask);

  // Batch and harvest, set small like a vintage.
  ctx.fillStyle = p.cream;
  spaced(ctx, text.batch.toUpperCase(), w / 2, h * 0.83, h * 0.0158, 500, 0.26);
  ornament(ctx, w / 2, h * 0.862, w * 0.12, p);
  ctx.fillStyle = p.gold;
  spaced(ctx, text.bottom.toUpperCase(), w / 2, h * 0.895, h * 0.019, 600, 0.3);
  ctx.fillStyle = p.cream;
  spaced(ctx, '500 ML', w / 2, h * 0.935, h * 0.0145, 500, 0.3);

  // Paper grain over everything (colour pass only).
  if (!mask) {
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.09;
    ctx.fillStyle = ctx.createPattern(grainTile(), 'repeat');
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
}

/** Paints one segment's label and its foil mask. */
export function paintReserveLabel(canvas, foil, look, text, mark) {
  draw(canvas.getContext('2d'), look, text, mark, false);
  draw(foil.getContext('2d'), MASK, text, mark, true);
}

export const reserveVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorld;
  varying vec3 vUp;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vUp = normalize(mat3(modelMatrix) * vec3(0.0, 1.0, 0.0));
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

/** `studio` is the scene's shared environment GLSL. */
export const reserveFragment = (studio) => /* glsl */ `
  uniform sampler2D uMap;
  uniform sampler2D uNext;
  uniform sampler2D uFoil;
  uniform sampler2D uFoilNext;
  uniform float uSwap;
  uniform float uTime;
  uniform vec2 uTexel;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorld;
  varying vec3 vUp;
  ${studio}
  float foilAt(vec2 uv) {
    return mix(texture2D(uFoil, uv).r, texture2D(uFoilNext, uv).r, uSwap);
  }
  void main() {
    if (!gl_FrontFacing) {
      // The glued back, seen through the glass.
      gl_FragColor = vec4(0.62, 0.6, 0.54, 1.0);
      return;
    }
    vec3 ink = mix(texture2D(uMap, vUv), texture2D(uNext, vUv), uSwap).rgb;
    float foil = foilAt(vUv);

    // Emboss: the foil's slope tips the normal, so its edges catch light.
    float gx = foilAt(vUv + vec2(uTexel.x, 0.0)) - foilAt(vUv - vec2(uTexel.x, 0.0));
    float gy = foilAt(vUv + vec2(0.0, uTexel.y)) - foilAt(vUv - vec2(0.0, uTexel.y));
    vec3 n = normalize(vNormal);
    vec3 up = normalize(vUp);
    vec3 side = normalize(cross(up, n));
    n = normalize(n - (side * gx + up * gy) * 0.55);

    vec3 view = normalize(cameraPosition - vWorld);
    vec3 key = normalize(vec3(-0.45, 0.5, 0.9));
    float facing = clamp(dot(n, view), 0.0, 1.0);
    vec3 r = reflect(-view, n);
    float env = studio(r);

    // Paper: matte, lit softly, with a satin varnish that shows at an angle.
    float wrap = 0.62 + 0.4 * max(dot(n, key), 0.0);
    vec3 paper = ink * wrap + env * 0.045 + pow(1.0 - facing, 4.0) * 0.05;

    // Foil: metal takes its light from the room, plus a glint that travels
    // across as the bottle turns.
    float spec = pow(max(dot(r, key), 0.0), 36.0);
    float sweep = smoothstep(0.35, 0.0, abs(dot(r, vec3(0.8, 0.0, 0.6)) - 0.55 - 0.1 * sin(uTime * 0.6)));
    vec3 metal = ink * (0.32 + env * 1.7 + sweep * 0.45) + vec3(1.0, 0.92, 0.72) * spec * 0.9;
    vec3 color = mix(paper, metal, foil);

    // Round the body: darken to the silhouette.
    color *= 1.0 - pow(1.0 - clamp(dot(normalize(vNormal), view), 0.0, 1.0), 2.2) * 0.55;
    // The paper's cut edge: a fine light line on all four sides.
    vec2 edge = min(vUv, 1.0 - vUv) / (uTexel * 1.5);
    color = mix(vec3(0.86, 0.82, 0.72), color, clamp(min(edge.x, edge.y), 0.0, 1.0));

    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

/** The neck collar: the ground colour with gold hairlines, all in the shader. */
export const collarFragment = (studio) => /* glsl */ `
  uniform vec3 uGround;
  uniform vec3 uGold;
  uniform float uTime;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying vec3 vLocal;
  ${studio}
  void main() {
    vec3 n = normalize(vNormal);
    vec3 view = normalize(cameraPosition - vWorld);
    float y = vLocal.y;
    float line = 0.0;
    line += smoothstep(0.006, 0.0, abs(y - 1.395));
    line += smoothstep(0.004, 0.0, abs(y - 1.378));
    line += smoothstep(0.006, 0.0, abs(y - 1.185));
    line += smoothstep(0.004, 0.0, abs(y - 1.202));
    // A band of fine gold dots around the middle.
    float angle = atan(vLocal.z, vLocal.x);
    vec2 cell = vec2(fract(angle * 48.0 / 6.28318) - 0.5, (y - 1.29) / 0.02);
    line += smoothstep(0.22, 0.1, length(cell * vec2(1.0, 0.5)));
    line = clamp(line, 0.0, 1.0);
    vec3 r = reflect(-view, n);
    float env = studio(r);
    float wrap = 0.6 + 0.4 * max(dot(n, normalize(vec3(-0.45, 0.5, 0.9))), 0.0);
    vec3 paper = uGround * wrap + env * 0.06;
    vec3 metal = uGold * (0.35 + env * 1.7);
    vec3 color = mix(paper, metal, line);
    color *= 1.0 - pow(1.0 - clamp(dot(n, view), 0.0, 1.0), 2.0) * 0.5;
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;
