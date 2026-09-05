#!/usr/bin/env node
/**
 * Renders README.md from README.md.tpl, filling the marked sections.
 *
 * README.md is GENERATED. Edit README.md.tpl, never README.md.
 *
 * Right now there is one section: recent activity. It exists to answer the
 * thing a stats card answers badly — "is this person actually working?" — with
 * what was worked on rather than with a number.
 *
 * The rule that makes it safe to ship before there is much activity:
 * **the section renders nothing at all below MIN_ITEMS.** An empty activity
 * box is worse than no box, and a low commit count presented as a headline is
 * worse than silence. So the profile simply has no such section today, and
 * grows one on its own once the window is genuinely busy. Nobody has to
 * remember to switch it on.
 *
 * Failure is non-destructive: if the API call fails, whatever is already
 * between the markers in README.md is kept and the script exits 0. A network
 * blip must never blank a section that was fine yesterday.
 *
 * Usage: node scripts/render-readme.mjs [--check]
 *   --check  exit 1 if README.md differs from what this would write
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const USER = 'Abhishek47v';
const WINDOW_DAYS = 90;
const MIN_ITEMS = 3;          // below this, the section is empty on purpose
const MAX_ROWS = 5;

const TPL = join(ROOT, 'README.md.tpl');
const OUT = join(ROOT, 'README.md');
const START = '<!--START_SECTION:activity-->';
const END = '<!--END_SECTION:activity-->';

const between = (text) => {
  const a = text.indexOf(START);
  const b = text.indexOf(END);
  return a === -1 || b === -1 ? '' : text.slice(a + START.length, b);
};

/**
 * The public events endpoint is not usable for this: it returns a trimmed
 * payload with no `size` and an empty `commits` array, so commit counts come
 * back as zero. contributionsCollection is the same data the contribution
 * graph is drawn from, and it reports real per-repository counts.
 */
async function fetchContributions() {
  const to = new Date();
  const from = new Date(to.getTime() - WINDOW_DAYS * 864e5);
  const query = `
    query($login:String!, $from:DateTime!, $to:DateTime!) {
      user(login:$login) {
        contributionsCollection(from:$from, to:$to) {
          commitContributionsByRepository(maxRepositories:20) {
            repository { nameWithOwner isPrivate }
            contributions(first:1, orderBy:{field:OCCURRED_AT, direction:DESC}) {
              totalCount
              nodes { occurredAt }
            }
          }
          pullRequestContributions(first:20, orderBy:{direction:DESC}) {
            nodes { pullRequest { repository { nameWithOwner } createdAt } }
          }
        }
      }
    }`;

  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN is not set');

  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'user-agent': `${USER}-profile-renderer`,
    },
    body: JSON.stringify({
      query,
      variables: { login: USER, from: from.toISOString(), to: to.toISOString() },
    }),
  });
  if (!res.ok) throw new Error(`GitHub GraphQL ${res.status} ${res.statusText}`);

  const body = await res.json();
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join('; '));
  return body.data.user.contributionsCollection;
}

/** One row per repository, most recently touched first. Private repos are
    reported by the API without a name; they are dropped rather than shown as
    a mystery row. */
function summarise(c) {
  const byRepo = new Map();

  for (const r of c.commitContributionsByRepository ?? []) {
    if (r.repository.isPrivate) continue;
    byRepo.set(r.repository.nameWithOwner, {
      repo: r.repository.nameWithOwner,
      commits: r.contributions.totalCount ?? 0,
      prs: 0,
      last: Date.parse(r.contributions.nodes?.[0]?.occurredAt ?? 0) || 0,
    });
  }

  for (const n of c.pullRequestContributions?.nodes ?? []) {
    const name = n.pullRequest?.repository?.nameWithOwner;
    if (!name) continue;
    const row = byRepo.get(name) ?? { repo: name, commits: 0, prs: 0, last: 0 };
    row.prs += 1;
    row.last = Math.max(row.last, Date.parse(n.pullRequest.createdAt) || 0);
    byRepo.set(name, row);
  }

  return [...byRepo.values()]
    .filter((r) => r.commits > 0 || r.prs > 0)
    .sort((x, y) => y.last - x.last);
}

function render(rows) {
  const total = rows.reduce((n, r) => n + r.commits + r.prs, 0);
  if (total < MIN_ITEMS) return '\n';   // deliberately nothing — see the header

  const fmt = (ms) =>
    new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  const lines = rows.slice(0, MAX_ROWS).map((r) => {
    const name = r.repo.split('/')[1] ?? r.repo;
    const bits = [];
    if (r.commits) bits.push(`${r.commits} commit${r.commits === 1 ? '' : 's'}`);
    if (r.prs) bits.push(`${r.prs} PR${r.prs === 1 ? '' : 's'}`);
    return `<tr><td><a href="https://github.com/${r.repo}"><code>${name}</code></a></td>`
      + `<td>${bits.join(' · ')}</td><td><sub>${fmt(r.last)}</sub></td></tr>`;
  });

  return `\n\n### Recently\n\n<table>\n${lines.join('\n')}\n</table>\n\n`
    + `<sub>Last ${WINDOW_DAYS} days of public commit activity. Regenerated daily.</sub>\n\n`;
}

const tpl = readFileSync(TPL, 'utf8');

let section;
try {
  section = render(summarise(await fetchContributions()));
} catch (err) {
  // Keep whatever is already published rather than replacing it with nothing.
  section = existsSync(OUT) ? between(readFileSync(OUT, 'utf8')) : '\n';
  console.warn(`activity: ${err.message} — keeping the published section`);
}

const a = tpl.indexOf(START);
const b = tpl.indexOf(END);
if (a === -1 || b === -1) {
  console.error(`README.md.tpl is missing ${START} / ${END}`);
  process.exit(1);
}
const out = tpl.slice(0, a + START.length) + section + tpl.slice(b);

if (process.argv.includes('--check')) {
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  // The activity block is time-varying, so --check compares everything else.
  const strip = (t) => t.slice(0, t.indexOf(START)) + t.slice(t.indexOf(END));
  if (strip(current) !== strip(out)) {
    console.error('README.md is out of date with README.md.tpl. Run: node scripts/render-readme.mjs');
    process.exit(1);
  }
  console.log('ok   README.md matches README.md.tpl');
} else {
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (current === out) {
    console.log('README.md unchanged');
  } else {
    writeFileSync(OUT, out);
    console.log(`wrote README.md (activity section: ${section.trim() ? 'rendered' : 'empty'})`);
  }
}
