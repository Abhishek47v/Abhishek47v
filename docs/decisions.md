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

### D-07 · No scheduled workflow

The one workflow runs on push, pull request and manual dispatch, with
`contents: read` and no write permission. It regenerates the cards, compares, and
checks every colour against both grounds. It never commits.

Nothing here depends on time or on the GitHub API, so a cron job would only produce
commits that change nothing — noise in the activity graph standing in for activity.
The generator has no dependencies, so there is nothing to install or cache, and
`actions/checkout` is pinned to a full commit SHA.

### D-08 · No badges

They are near-universal, which means they carry close to zero signal. Three
projects, each with one specific sentence, say more about judgment than any
generated card — and they stay true when the API behind the card changes.
