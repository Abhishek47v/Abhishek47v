#!/usr/bin/env node
/**
 * Builds the project cards in assets/ from the CARDS spec below.
 *
 * WHY THE CARDS ARE THEME-AGNOSTIC (one file, not a light/dark pair)
 * ------------------------------------------------------------------
 * A card has to be clickable — it is the link to the project. On GitHub you
 * cannot have both a link and a theme switch:
 *
 *   <a href><picture><source …><img …></picture></a>
 *
 * is rewritten by GitHub's sanitizer into an EMPTY <picture> plus the <img>
 * ejected into GitHub's own auto-link to the image file. The theme switch and
 * the link are both lost. Verified against POST /markdown.
 *
 * So: one file per card, drawn on a transparent ground, in colours that clear
 * 3:1 against BOTH GitHub backgrounds (#ffffff and #0d1117). No single colour
 * can clear 4.5:1 on both — the required luminance bands do not overlap — so
 * every piece of text here is either large or secondary, and `--check` fails
 * the build if any colour drifts out of the band.
 *
 * OTHER GITHUB CONSTRAINTS THE OUTPUT RESPECTS
 *   - raw.githubusercontent.com serves SVG under
 *     `default-src 'none'; style-src 'unsafe-inline'; sandbox` — inline <style>
 *     is fine, but nothing external loads. Hence the system font stacks.
 *   - Repo-local images are served from /<owner>/<repo>/raw/<branch>/… and are
 *     never passed through the camo proxy, so they update with the commit.
 *   - The GitHub mobile apps have a long history of not rendering SVG in a
 *     README at all, so every card carries its whole meaning in aria-label and
 *     in the alt text the README gives it.
 *
 * Usage: node scripts/build-svg.mjs [--check]
 *   --check  exit 1 if the files on disk differ, or if a colour fails contrast
 */

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* ---------------------------------------------------------------- palette
   Tuned so each colour reads on white and on #0d1117. `--check` recomputes
   the ratios, so a "nicer" colour cannot be dropped in without the build
   noticing. */
const C = {
  /* One ink for every word on the card. Hierarchy is size and weight, never
     lightness — on a theme-agnostic card lightness INVERTS between themes, so
     a title darker than its subtitle outranks it on white and is outranked by
     it on #0d1117. Opacity is the only quieting that behaves the same on both.
     #737B85 sits at the balance point where the two ratios meet (~4.3:1). */
  ink:   '#737B85',
  accent:'#A4763B',   // the one warm note, taken from the portfolio's tokens.css
  edge:  '#8B929C',   // borders only, always at low opacity
  day:   '#BCD2DF',   // literal sky colours inside the portfolio glyph — these
  sun:   '#E8C88B',   // sit on an opaque disc, so contrast does not apply
  night: '#152238',
  star:  '#DDE5EC',
};
const CONTRAST_EXEMPT = new Set(['day', 'sun', 'night', 'star', 'edge']);
const MIN_RATIO = 4;   // achievable on both grounds at the balance point

const W = 760;
const H = 116;
const GX = 60;   // glyph centre
const GY = 58;
const TX = 124;  // text column

/* ------------------------------------------------------------------ cards
   One line per card, and that line is the *interesting* thing about the
   project — not a description of it. If a card needs a paragraph to make
   sense, the card is wrong. */
const CARDS = [
  {
    file: 'card-portfolio',
    glyph: 'hours',
    title: 'portfolio-site',
    line: 'Zero runtime JavaScript, and 28 tests that prove it.',
    stack: 'Astro · TypeScript · Playwright · Cloudflare',
    alt: 'portfolio-site — a static portfolio that ships zero runtime JavaScript, with 28 Playwright '
       + 'tests holding contrast, keyboard order and the no-JavaScript path across both themes. '
       + 'Astro, TypeScript, Playwright, Cloudflare.',
  },
  {
    file: 'card-quipwire',
    glyph: 'messages',
    title: 'QuipWire',
    line: 'Real-time messaging that survives two clients and a reload.',
    stack: 'React · Express · MongoDB · Socket.IO',
    alt: 'QuipWire — a social app whose real-time messaging keeps presence, delivery and seen '
       + 'receipts correct across two connected clients and a page reload. '
       + 'React, Express, MongoDB, Socket.IO.',
  },
  {
    file: 'card-driver',
    glyph: 'classifier',
    title: 'Driver behaviour analysis',
    line: 'A classifier shipped like a service, not a notebook.',
    stack: 'Python · TensorFlow · Flask · Docker · Kubernetes',
    alt: 'Driver behaviour analysis — a classifier that flags unsafe driving from telemetry, '
       + 'packaged as a Flask service with a container image, Kubernetes manifests and a persistent '
       + 'volume for the trained model. Python, TensorFlow, Flask, Docker, Kubernetes.',
  },
];

/* ----------------------------------------------------------------- glyphs
   Each says what the project *is* in 64px, so a card still carries meaning at
   a phone's scale, where the smaller text does not. */
const GLYPHS = {
  // A disc split into day and night with a ridge across it — the portfolio's
  // own organising idea, which is the passage of hours.
  hours: () => `
    <defs><clipPath id="d"><circle cx="${GX}" cy="${GY}" r="27"/></clipPath></defs>
    <g clip-path="url(#d)">
      <rect x="${GX - 27}" y="${GY - 27}" width="27" height="54" fill="${C.day}"/>
      <rect x="${GX}" y="${GY - 27}" width="27" height="54" fill="${C.night}"/>
      <circle cx="${GX - 13}" cy="${GY - 8}" r="6" fill="${C.sun}"/>
      <circle cx="${GX + 11}" cy="${GY - 13}" r="1.5" fill="${C.star}"/>
      <circle cx="${GX + 19}" cy="${GY - 4}" r="1.1" fill="${C.star}"/>
      <circle cx="${GX + 6}" cy="${GY - 19}" r="1.1" fill="${C.star}"/>
      <path d="M${GX - 27},${GY + 13} q13,-9 27,-2 q14,7 27,-3 v22 h-54 z" fill="${C.accent}" opacity=".55"/>
    </g>
    <circle cx="${GX}" cy="${GY}" r="27" fill="none" stroke="${C.edge}" stroke-opacity=".45" stroke-width="1"/>`,

  // Two bubbles: one still being typed, one delivered and seen.
  messages: () => `
    <rect x="${GX - 27}" y="${GY - 25}" width="38" height="24" rx="7" fill="none" stroke="${C.ink}" stroke-width="1.6"/>
    ${[-16, -8, 0].map((d) => `<circle cx="${GX + d}" cy="${GY - 13}" r="1.8" fill="${C.ink}"/>`).join('')}
    <rect x="${GX - 11}" y="${GY + 2}" width="38" height="24" rx="7" fill="${C.accent}"/>
    <path d="M${GX - 3},${GY + 14} l4,4 l7,-8" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M${GX + 6},${GY + 14} l4,4 l7,-8" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" opacity=".7"/>`,

  // A decision boundary with points either side of it.
  classifier: () => {
    const safe = [[-20, 12], [-13, 17], [-5, 14], [-18, 3], [-9, 6], [-1, 20]];
    const flag = [[6, -12], [15, -6], [2, -3], [18, 6], [10, 2]];
    return `
    <path d="M${GX - 25},${GY - 24} v48 h50" fill="none" stroke="${C.edge}" stroke-opacity=".5" stroke-width="1.2"/>
    <path d="M${GX - 22},${GY + 20} L${GX + 22},${GY - 20}" stroke="${C.accent}" stroke-width="1.4" stroke-dasharray="3 3" opacity=".8"/>
    ${safe.map(([x, y]) => `<circle cx="${GX + x}" cy="${GY + y}" r="2.6" fill="none" stroke="${C.ink}" stroke-width="1.3"/>`).join('')}
    ${flag.map(([x, y]) => `<circle cx="${GX + x}" cy="${GY + y}" r="2.8" fill="${C.accent}"/>`).join('')}`;
  },
};

/* --------------------------------------------------------------- contrast
   WCAG relative luminance, and the ratio against both GitHub grounds. */
function luminance(hex) {
  const ch = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
function ratio(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function card(spec) {
  const css =
    `text{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans",Helvetica,Arial,sans-serif}`
    + `.t{fill:${C.ink};font-size:22px;font-weight:600}`
    + `.l{fill:${C.ink};font-size:17px;opacity:.92}`
    + `.s{fill:${C.ink};font-size:13.5px;opacity:.72;letter-spacing:.02em;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" `
    + `role="img" aria-label="${esc(spec.alt)}">`
    + `<style>${css}</style>`
    + `<rect x=".75" y=".75" width="${W - 1.5}" height="${H - 1.5}" rx="10" fill="none" stroke="${C.edge}" stroke-opacity=".32"/>`
    + GLYPHS[spec.glyph]()
    + `<text class="t" x="${TX}" y="44">${esc(spec.title)}</text>`
    + `<text class="l" x="${TX}" y="72">${esc(spec.line)}</text>`
    + `<text class="s" x="${TX}" y="97">${esc(spec.stack)}</text>`
    + `<path d="M726,54 l6,4 l-6,4" fill="none" stroke="${C.accent}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity=".8"/>`
    + `</svg>\n`;
}


/* ------------------------------------------------------------------ gates
   The four gates of `npm run verify` in portfolio-site, with the numbers from
   a real run on 2026-09-05 (exit 0). Nothing here is illustrative — if the
   suite changes, re-run it and update GATES, or take the panel down. It lives
   inside the portfolio card's <details>, as the evidence for the claim on the
   card, not at the top of the profile. */
const GATES = {
  cmd: 'npm run verify',
  repo: 'portfolio-site',
  rows: [
    ['astro check',  '46 files, 0 errors'],
    ['tokens gate',  'no colour literal outside tokens.css'],
    ['astro build',  '2 pages in 1.45s'],
    ['playwright',   '28 passed in 21.5s'],
  ],
};
const GATE_LOOP = '7s';

function gatesPanel() {
  const rowY = (i) => 60 + i * 25;
  /* Each row owns a slice of one shared 7s timeline. Reveal is staggered, the
     whole set holds lit for the last third, and reduced motion shows the
     finished run rather than a half-drawn one. */
  /* The text never animates. Only the ticks draw themselves in, one after the
     other, and they stay drawn for the rest of the loop.

     The first version faded whole rows in and back out, which meant that for
     the first half-second of every 7s cycle the panel was an empty box — and a
     reader arriving at the wrong moment saw exactly that. Evidence has to be
     legible at every frame, so the reveal moved onto the ticks alone. */
  const css =
    `text{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace}`
    + `.c{fill:${C.ink};font-size:13px}`
    + `.g{fill:${C.ink};font-size:13px}`
    + `.d{fill:${C.ink};font-size:13px;opacity:.66}`
    + `.r{fill:${C.ink};font-size:12px;opacity:.55}`
    + `.tick{fill:none;stroke:${C.accent};stroke-width:1.8;stroke-linecap:round;`
    + `stroke-linejoin:round;stroke-dasharray:17;stroke-dashoffset:17}`
    + GATES.rows.map((_, i) =>
        `.tick${i}{animation:tick${i} ${GATE_LOOP} ease-out infinite}`).join('')
    + GATES.rows.map((_, i) => {
        const a = 4 + i * 9;               // this tick starts drawing, in percent
        return `@keyframes tick${i}{0%,${a}%{stroke-dashoffset:17}`
             + `${a + 7}%,96%{stroke-dashoffset:0}100%{stroke-dashoffset:17}}`;
      }).join('')
    + `@media (prefers-reduced-motion:reduce){`
    + `.tick{stroke-dashoffset:0}[class^="tick"]{animation:none}}`;

  const rows = GATES.rows.map(([name, detail], i) =>
    `<g>`
    + `<path class="tick tick${i}" d="M10,${rowY(i) - 5} l4,4 l7,-8"/>`
    + `<text class="g" x="32" y="${rowY(i)}">${esc(name)}</text>`
    + `<text class="d" x="176" y="${rowY(i)}">${esc(detail)}</text>`
    + `</g>`).join('');

  const alt = `A run of ${GATES.cmd} in ${GATES.repo}, all four gates passing: `
    + GATES.rows.map(([n, d]) => `${n}, ${d}`).join('; ') + '.';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 172" width="${W}" height="172" `
    + `role="img" aria-label="${esc(alt)}">`
    + `<style>${css}</style>`
    + `<rect x=".75" y=".75" width="${W - 1.5}" height="170.5" rx="10" fill="none" stroke="${C.edge}" stroke-opacity=".32"/>`
    + `<text class="c" x="20" y="30"><tspan fill="${C.accent}">$</tspan> ${esc(GATES.cmd)}</text>`
    + `<text class="r" x="${W - 20}" y="30" text-anchor="end">${esc(GATES.repo)}</text>`
    + `<path d="M20,42 H${W - 20}" stroke="${C.edge}" stroke-opacity=".3" stroke-width="1"/>`
    + rows
    + `</svg>\n`;
}

const outputs = CARDS.map((spec) => ({
  path: join(ROOT, 'assets', `${spec.file}.svg`),
  body: card(spec),
})).concat([{ path: join(ROOT, 'assets', 'verify-gates.svg'), body: gatesPanel() }]);

if (process.argv.includes('--check')) {
  let failed = false;
  for (const [name, hex] of Object.entries(C)) {
    if (CONTRAST_EXEMPT.has(name)) continue;
    const l = ratio(hex, '#ffffff'), d = ratio(hex, '#0d1117');
    const ok = l >= MIN_RATIO && d >= MIN_RATIO;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(7)} ${hex}  light ${l.toFixed(2)}:1  dark ${d.toFixed(2)}:1`);
    if (!ok) failed = true;
  }
  if (failed) console.error(`\nA colour fails ${MIN_RATIO}:1 on one of GitHub's two backgrounds.`);

  const stale = outputs.filter((o) => !existsSync(o.path) || readFileSync(o.path, 'utf8') !== o.body);
  if (stale.length) {
    failed = true;
    console.error('\nCommitted SVGs are out of date. Run: node scripts/build-svg.mjs');
    for (const o of stale) console.error(`  ${o.path.replace(ROOT + '/', '')}`);
  } else {
    console.log('\nok   assets are in sync with scripts/build-svg.mjs');
  }
  process.exit(failed ? 1 : 0);
} else {
  for (const o of outputs) {
    writeFileSync(o.path, o.body);
    console.log(`wrote ${o.path.replace(ROOT + '/', '')} (${o.body.length} bytes)`);
  }
}
