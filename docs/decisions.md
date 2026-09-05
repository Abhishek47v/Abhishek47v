# Decisions

Why this profile is built the way it is. Each entry records what was chosen,
what was rejected, and the constraint that decided it.

---

### D-01 · The profile leads with the person and the numbers, not the projects

An earlier version gave each project a full-width card and a collapsible essay.
It read as a portfolio with a name attached, and everything else — who this is,
what the stack is, what the activity looks like — was starved of the page.

Projects are now three rows of a table near the bottom. They are still there,
still linked, still described in one line each. They just do not own the page.

### D-02 · Every widget was tested before it was used

Checked 2026-09-06, and three of the most-recommended tools in the
`beautify-github-profile` catalogue were dead:

| Tool | Result |
|---|---|
| `github-readme-stats` | `503 DEPLOYMENT_PAUSED` |
| `github-readme-activity-graph` | `402 DEPLOYMENT_DISABLED` — payment required |
| `github-profile-trophy` | `402 DEPLOYMENT_DISABLED` — payment required |

`github-readme-stats` has 79k stars and its public instance is off. Popularity
is not availability. What is used here answered on the day and is actively
maintained: `github-profile-summary-cards`, `streak-stats`, `capsule-render`,
`skillicons`, `shields`.

### D-03 · Static widgets are committed; only live data is fetched

The header, the typing line, the tech icons and the footer render identically on
every page view. Fetching them from someone else's server each time buys nothing
and costs reliability.

It was already costing it. GitHub's `camo` proxy had cached a **truncated**
response for the skillicons rows — 1998 bytes against 30928 at the origin — so
the profile showed one icon instead of eight. Every image still reported as
loaded, because a partial SVG is a valid SVG. Only a rendered screenshot caught
it.

So: anything whose output is fixed is downloaded once and committed. Only the
summary cards and the streak stay hosted, because they are the only things whose
content actually changes.

### D-04 · The contribution calendar is generated, not fetched

Both hosted contribution-graph services were dead (D-02). The calendar is
therefore produced by `github-profile-3d-contrib` running as an Action and
committed to `profile-3d-contrib/`. It is served from
`raw.githubusercontent.com` and cannot go dark because somebody else's free tier
ran out.

### D-05 · Every image has a dark variant

Each asset is a `<picture>` with a `prefers-color-scheme: dark` source, so the
page follows the reader's theme instead of assuming one. Most profiles built
from this kit assume light and look broken in dark mode.

The exception is the tech icons, which are drawn on their own opaque tiles and
read correctly on either ground, so they need only one file.

### D-06 · Stage before diffing in a workflow that commits generated files

The calendar job's first run went green having committed nothing. `git diff`
does not see untracked files, so freshly generated SVGs were invisible to the
change check and it reported "no change".

`git add -A` first, then `git diff --cached --quiet`. That sees new and modified
files alike. A green run that silently did nothing is worse than a red one.

### D-07 · Both workflows commit only on change

`profile-3d.yml` is the only workflow, it runs daily, and it exits without
committing when the drawing is identical. A cron job that commits every day
regardless is noise in the activity graph standing in for activity.

`actions/checkout` and the generator action are both pinned to full commit SHAs.

### D-08 · Numbers are shown as they are

The stats cards report 4 public repos, 0 stars, 0 PRs and a short streak,
because that is what is true today. The alternative — hiding the cards until the
numbers flatter — would mean the profile never shows them, since it is only by
having them up that the gap is visible at all. They will fill in.
