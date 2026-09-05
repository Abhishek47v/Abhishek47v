#!/usr/bin/env node
/**
 * Builds assets/unattended-{light,dark}.svg from the one spec below.
 *
 * Two files exist because GitHub's only reliable theme mechanism for images is
 * <picture> + prefers-color-scheme, which needs a separate file per theme. A
 * media query *inside* the SVG does not work here: an SVG loaded through <img>
 * resolves prefers-color-scheme against the operating system, not against the
 * GitHub theme the reader actually chose, so it is wrong for anyone whose two
 * settings disagree.
 *
 * Two files that must stay identical apart from five colours is a drift
 * problem, so neither file is hand-edited. Both are emitted from PALETTE +
 * one template, and .github/workflows/verify.yml re-runs this script in CI and
 * fails if the committed output differs.
 *
 * Constraints the output has to respect, all of them GitHub's:
 *   - raw.githubusercontent.com serves SVG under
 *     `default-src 'none'; style-src 'unsafe-inline'; sandbox`.
 *     So: inline <style> is allowed, and nothing external may be referenced —
 *     no webfont, no image, no script. Hence a system mono stack.
 *   - Animation is CSS only. Every animation runs on the same 8s timeline with
 *     no animation-delay, so the parts stay phase-locked to each other.
 *   - prefers-reduced-motion *does* resolve correctly here (it is an OS
 *     preference, which is the right source of truth), so the reduce branch
 *     stops everything and settles on the fully-lit end state.
 *
 * Usage: node scripts/build-svg.mjs [--check]
 *   --check  exit 1 if the files on disk differ from what this would write
 */

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* ------------------------------------------------------------------ palette
   Taken from the portfolio site's tokens.css so the two artefacts read as one
   identity: a warm bronze accent on slate ink, rather than the blue/neon that
   every generated profile asset defaults to. */
const PALETTE = {
  light: { ink: '#1C2730', soft: '#414D58', faint: '#59656F', accent: '#8A5E2A', rail: '#C4CDD4' },
  dark:  { ink: '#DDE5EC', soft: '#B3C0CC', faint: '#A4B1BE', accent: '#D8AE72', rail: '#3B4757' },
};

/* -------------------------------------------------------------------- shape
   Five stops on one rail. The first two are the attended half — someone is
   waiting on them. The last three keep running after that person has gone,
   which is the whole point of the picture. */
const NODES = [
  { x: 72,  name: 'interface', sub: 'React · TS' },
  { x: 224, name: 'api',       sub: 'Flask · Python' },
  { x: 376, name: 'queue',     sub: 'Redis' },
  { x: 528, name: 'worker',    sub: 'Docker · K8s' },
  { x: 680, name: 'store',     sub: 'AWS S3' },
];

const RAIL_Y = 82;

/* The viewBox is the measured ink box, not a round canvas, so the diagram's
   leftmost glyph sits flush with the README's left margin instead of floating
   an inch inside it. Measured with getBBox() over the whole tree with every
   animation forced visible: x 38.4 → 698.7, y 17 → 158. Re-measure if a node
   label changes length — a wider label silently clips. */
const VIEW = { x: 36, y: 11, w: 667, h: 151 };
const DASH = 30;                       // length of the travelling pulse, px
const RETURN = 'M528,74 C470,20 150,20 72,74';   // worker → interface, realtime

/* Sampled length of the return cubic. Needed because the pulse is a fixed-length
   dash swept with stroke-dashoffset, and the sweep range is (dash → -length).
   pathLength= would normalise this away but would also make the pulse on the
   long return arc three times the length of the pulse on a rail segment. */
function cubicLength(p0, p1, p2, p3, steps = 400) {
  const at = (a, b, c, d, t) => {
    const u = 1 - t;
    return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
  };
  let len = 0, px = p0[0], py = p0[1];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = at(p0[0], p1[0], p2[0], p3[0], t);
    const y = at(p0[1], p1[1], p2[1], p3[1], t);
    len += Math.hypot(x - px, y - py);
    px = x; py = y;
  }
  return len;
}

const RETURN_LEN = cubicLength([528, 74], [470, 20], [150, 20], [72, 74]);
const SEG_LEN = NODES[1].x - NODES[0].x;

/* ----------------------------------------------------------------- timeline
   One 8s loop, in percent. Everything below is phase-locked to it.

     0 –  20%  a request runs interface → api → queue
    22 –  28%  interface and api dim: the request is answered, nobody is watching
    30 –  50%  the pulse carries on queue → worker → store, at the same pace
    52 –  84%  the unattended half holds; the bracket names it
    68 –  84%  a change travels back up the realtime edge
    84 – 100%  the interface lights again, settling to the frame 0% expects   */
const LOOP = '8s';

/** A pulse that enters at `from`% and exits at `to`%, and is invisible otherwise. */
function pulseKeyframes(name, len, from, to) {
  return `@keyframes ${name}{` +
    `0%,${from}%{stroke-dashoffset:${DASH};opacity:0}` +
    `${from + 0.5}%{opacity:1}` +
    `${to - 0.5}%{opacity:1}` +
    `${to}%,100%{stroke-dashoffset:${-len};opacity:0}}`;
}

/** A node's lit/dim cycle. `stops` is [percent, opacity] pairs; 0% and 100% must match. */
function nodeKeyframes(name, stops) {
  return `@keyframes ${name}{` +
    stops.map(([p, o]) => `${p}%{opacity:${o}}`).join('') + '}';
}

const DIM = 0.22;   // an unlit node still reads as present, just not active
const LIT = 1;

const NODE_CYCLES = [
  // interface: lit, dims once answered, lit again when the change comes back
  ['n1', [[0, LIT], [22, LIT], [28, DIM], [84, DIM], [90, LIT], [100, LIT]]],
  // api: dark at the top of the loop, lights on arrival, dims with the interface
  ['n2', [[0, DIM], [7, DIM], [10, LIT], [22, LIT], [28, DIM], [100, DIM]]],
  // queue: holds through both halves — it is the seam between them
  ['n3', [[0, DIM], [17, DIM], [20, LIT], [60, LIT], [66, DIM], [100, DIM]]],
  ['n4', [[0, DIM], [37, DIM], [40, LIT], [84, LIT], [92, DIM], [100, DIM]]],
  ['n5', [[0, DIM], [47, DIM], [50, LIT], [76, LIT], [84, DIM], [100, DIM]]],
];

function svg(theme) {
  const c = PALETTE[theme];

  const css = [
    `text{font-family:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,"Liberation Mono",monospace;`
      + `-webkit-font-smoothing:antialiased}`,
    `.rail{fill:none;stroke:${c.rail};stroke-width:1.25}`,
    `.arc{fill:none;stroke:${c.rail};stroke-width:1.25;stroke-dasharray:2 4;opacity:.75}`,
    `.pulse{fill:none;stroke:${c.accent};stroke-width:2;stroke-linecap:round}`,
    `.ring{fill:none;stroke:${c.soft};stroke-width:1.5}`,
    `.core{fill:${c.accent}}`,
    `.name{fill:${c.ink};font-size:12px;letter-spacing:.02em}`,
    `.sub{fill:${c.faint};font-size:10px;letter-spacing:.02em}`,
    `.edge-label{fill:${c.faint};font-size:10px;letter-spacing:.09em}`,
    `.brace{fill:none;stroke:${c.accent};stroke-width:1.25;opacity:.55}`,
    `.brace-label{fill:${c.accent};font-size:10.5px;letter-spacing:.12em}`,
    `.node{opacity:${DIM}}`,

    // pulses
    ...[0, 1, 2, 3].map((i) => `.p${i + 1}{animation:p${i + 1} ${LOOP} linear infinite}`),
    `.pr{animation:pr ${LOOP} linear infinite}`,
    ...NODE_CYCLES.map(([n]) => `.${n}{animation:${n} ${LOOP} ease-in-out infinite}`),
    `.brace-group{opacity:0;animation:brace ${LOOP} ease-in-out infinite}`,

    pulseKeyframes('p1', SEG_LEN, 0, 8),
    pulseKeyframes('p2', SEG_LEN, 10, 18),
    pulseKeyframes('p3', SEG_LEN, 30, 38),
    pulseKeyframes('p4', SEG_LEN, 40, 48),
    pulseKeyframes('pr', RETURN_LEN.toFixed(1), 68, 84),
    ...NODE_CYCLES.map(([n, stops]) => nodeKeyframes(n, stops)),
    `@keyframes brace{0%,30%{opacity:0}38%{opacity:1}76%{opacity:1}84%,100%{opacity:0}}`,

    /* Reduced motion: nothing moves, and the frame that remains is the whole
       system lit at once. The picture still says what it says; it just says it
       all at the same time. */
    `@media (prefers-reduced-motion:reduce){`
      + `.pulse{animation:none;opacity:0}`
      + `.node,.brace-group{animation:none;opacity:1}}`,
  ].join('');

  const rail = `<path class="rail" d="M${NODES[0].x},${RAIL_Y} H${NODES[4].x}"/>`;

  const pulses = NODES.slice(0, 4).map((n, i) =>
    `<path class="pulse p${i + 1}" d="M${n.x},${RAIL_Y} H${NODES[i + 1].x}" `
    + `stroke-dasharray="${DASH} ${SEG_LEN}"/>`).join('');

  const returnEdge =
    `<path class="arc" d="${RETURN}"/>`
    + `<path class="pulse pr" d="${RETURN}" stroke-dasharray="${DASH} ${RETURN_LEN.toFixed(1)}"/>`
    + `<text class="edge-label" x="307" y="26" text-anchor="middle">realtime</text>`;

  const nodes = NODES.map((n, i) =>
    `<g class="node ${NODE_CYCLES[i][0]}">`
    + `<circle class="ring" cx="${n.x}" cy="${RAIL_Y}" r="5"/>`
    + `<circle class="core" cx="${n.x}" cy="${RAIL_Y}" r="2.25"/>`
    + `<text class="name" x="${n.x}" y="${RAIL_Y + 24}" text-anchor="middle">${n.name}</text>`
    + `<text class="sub" x="${n.x}" y="${RAIL_Y + 39}" text-anchor="middle">${n.sub}</text>`
    + `</g>`).join('');

  const brace =
    `<g class="brace-group">`
    + `<path class="brace" d="M${NODES[2].x},134 v6 H${NODES[4].x} v-6"/>`
    + `<text class="brace-label" x="528" y="156" text-anchor="middle">RUNS UNATTENDED</text>`
    + `</g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" `
    + `viewBox="${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}" width="${VIEW.w}" height="${VIEW.h}" `
    + `role="img" aria-labelledby="t d">`
    + `<title id="t">A request, and what happens after it</title>`
    + `<desc id="d">A request travels from the interface to the API to the queue. The interface and API `
    + `dim once it has been answered, and the queue, worker and store carry on without them — the part `
    + `that runs unattended — before a change is pushed back up to the interface over a realtime edge.</desc>`
    + `<style>${css}</style>`
    + rail + returnEdge + pulses + nodes + brace
    + `</svg>\n`;
}

const outputs = Object.keys(PALETTE).map((theme) => ({
  path: join(ROOT, 'assets', `unattended-${theme}.svg`),
  body: svg(theme),
}));

if (process.argv.includes('--check')) {
  const stale = outputs.filter(
    (o) => !existsSync(o.path) || readFileSync(o.path, 'utf8') !== o.body,
  );
  if (stale.length) {
    console.error('Committed SVGs are out of date. Run: node scripts/build-svg.mjs');
    for (const o of stale) console.error(`  ${o.path.replace(ROOT + '/', '')}`);
    process.exit(1);
  }
  console.log('assets are in sync with scripts/build-svg.mjs');
} else {
  for (const o of outputs) {
    writeFileSync(o.path, o.body);
    console.log(`wrote ${o.path.replace(ROOT + '/', '')} (${o.body.length} bytes)`);
  }
}
