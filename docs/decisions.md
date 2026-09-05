# Decisions

Why this profile is built the way it is. Each entry records what was chosen, what
was rejected, and the constraint that decided it.

---

### D-01 · Self-hosted SVG, not a third-party image service

**Chosen:** the cards live in `assets/` in this repository.
**Rejected:** `capsule-render`, `readme-typing-svg`, `github-readme-stats` and the
rest of the hosted-generator family.

*Availability.* A hosted asset is a permanent dependency on someone else's uptime
and someone else's interest. The `readme-SVG` toolkit — a whole organisation of
README asset generators — was archived on 10 August 2026. Every profile pointing
at it now shows broken images, and none of those owners were told.

*Delivery.* A repo-local image is served from
`github.com/<owner>/<repo>/raw/<branch>/…` and is **not** passed through GitHub's
`camo` proxy — camo only handles third-party origins. There is no proxy cache to
go stale; the image is exactly what the last commit put there.

### D-02 · Cards, not prose

The first version of this README was a diagram plus four paragraphs. Nobody reads
four paragraphs on a profile. The work now arrives as three cards, each carrying a
glyph, a name, one sentence and its stack — and the sentence is the *interesting*
thing about the project, not a description of it. If a card needs a paragraph to
make sense, the card is wrong.

### D-03 · No contribution or stats card

GitHub already renders the contribution graph natively, directly below this README,
on the same page. A stats card would duplicate what a visitor can already see two
inches lower. The visual budget goes to the thing GitHub does not show: what the
projects actually are.

What replaces it is the activity section (D-09) — the same question answered with
what was worked on rather than with a count, and silent when there is nothing to
say.

### D-04 · The cards are theme-agnostic, because they have to be clickable

A card is a link. On GitHub you cannot have both a link and a theme switch:

```html
<a href="…"><picture><source …><img …></picture></a>
```

is rewritten by the sanitizer into an **empty** `<picture>` plus the `<img>`
ejected into GitHub's own auto-link to the image file — losing the theme switch
*and* the link. Verified against `POST /markdown`.

So each card is one file on a transparent ground. `<picture>` was the right answer
for a decorative image and is the wrong answer for a card.

### D-05 · One ink colour; hierarchy is size and weight, never lightness

On a theme-agnostic card, **lightness inverts between themes.** A title darker than
its subtitle outranks it on white and is outranked by it on `#0d1117` — the first
version had exactly this bug, and the title read as the quietest thing on the card
in dark mode.

Every word is therefore the same `#737B85`, which sits at the balance point where
the two contrast ratios meet (4.28:1 on white, 4.42:1 on `#0d1117`). Rank comes
from 22px/600 versus 17px versus 13.5px. Where something needs to be quieter it is
quieted with **opacity**, which is the only adjustment that behaves identically
against both grounds.

No single colour can clear 4.5:1 on both: the luminance bands the two grounds
require do not overlap. 4:1 is the achievable bar, and `--check` enforces it.

### D-06 · The README has to work with no images at all

The GitHub mobile apps have a long-standing history of not rendering SVG in
READMEs, and at phone width the cards' smaller type is decorative at best. So each
card's alt text is a full sentence naming the project, what is interesting about it
and its stack — and the opening sentence and the links are plain text. With every
image stripped, the README still says who this is and what the work is.

### D-07 · Depth is collapsed, not deleted

The tension is that a profile has to be readable in thirty seconds *and* has to
survive someone who wants to know whether the work is real. A `<details>` under
each card resolves it: three cards and a sentence by default, and the problem,
the decisions and the screenshots for anyone who opens one. Nothing is cut for
brevity; it is just not in the way.

### D-08 · Two workflows, because only one of them may write

`verify.yml` is the gate: push, pull request and manual dispatch, `contents:
read`, no write permission at all. `activity.yml` is the only thing here that
commits, and it commits one file.

The earlier version of this repository had no scheduled workflow at all, on the
grounds that a cron job that changes nothing is noise standing in for activity.
That still holds for stats cards. It does not hold for the activity section,
which is genuinely time-varying — so the schedule exists, it is daily rather
than hourly, and the job exits without committing when nothing changed.

`actions/checkout` is pinned to a full commit SHA in both. The generators have
no dependencies, so there is nothing to install, cache or resolve.

### D-09 · The activity section renders nothing below a threshold

A stats card answers "is this person working?" with a number, and a small number
answers it badly. The activity section answers it with *what was worked on*
instead — but the same trap applies: an empty box is worse than no box.

So `render-readme.mjs` emits nothing at all below `MIN_ITEMS`, and the section
appears on its own once the window is genuinely busy. Nobody has to remember to
switch it on, and nobody has to notice it should be switched off.

Failure is non-destructive for the same reason: if the API call fails, whatever
is already published between the markers is kept. A network blip must never
blank a section that was fine yesterday.

### D-10 · The gates panel animates its ticks, never its text

The panel showing `npm run verify` first faded whole rows in and back out. That
meant the box was empty for the first half-second of every seven, and a reader
arriving at the wrong moment saw nothing at all.

Evidence has to be legible in every frame, so the text is now permanent and only
the ticks draw themselves in. The worst frame is four passing gates without
their ticks yet — still true, still readable.

The numbers in it come from a real run (2026-09-05, exit 0). If the suite
changes, re-run it and update `GATES`, or take the panel down.

### D-11 · No badges

They are near-universal, which means they carry close to zero signal. Three
projects, each with one specific sentence, say more about judgment than any
generated card — and they stay true when the API behind the card changes.
