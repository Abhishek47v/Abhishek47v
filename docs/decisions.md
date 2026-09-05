# Decisions

Why this profile is built the way it is. Each entry records what was chosen, what
was rejected, and the constraint that decided it.

---

### D-01 · Self-hosted SVG, not a third-party image service

**Chosen:** the diagram lives in `assets/` in this repository.
**Rejected:** `capsule-render`, `readme-typing-svg`, `github-readme-stats` and the
rest of the hosted-generator family.

Two reasons, one of them measurable.

*Availability.* A hosted asset is a permanent dependency on someone else's uptime
and someone else's interest. The `readme-SVG` toolkit — a whole organisation of
README asset generators — was archived on 10 August 2026. Every profile pointing at
it now shows broken images, and none of those owners were told.

*Delivery.* A repo-local image is served from
`github.com/<owner>/<repo>/raw/<branch>/…`, which redirects to
`raw.githubusercontent.com` and is **not** passed through GitHub's `camo` proxy —
camo only handles third-party origins. So there is no proxy cache to go stale, and
the image is exactly what the last commit put there.

### D-02 · Two theme variants from one generator, not two hand-written files

GitHub's only reliable theme mechanism for images is `<picture>` with
`prefers-color-scheme`, and that needs one file per theme.

A media query *inside* the SVG does not substitute for it. An SVG loaded through
`<img>` resolves `prefers-color-scheme` against the **operating system**, not
against the GitHub theme the reader actually picked, so it is wrong for anyone
whose two settings disagree — a common case, and an invisible failure.

Two near-identical files is a drift problem, so neither is edited by hand.
`scripts/build-svg.mjs` emits both from one `PALETTE` and one template, and
`.github/workflows/verify.yml` fails the build if the committed output no longer
matches the generator.

### D-03 · The dark variant is referenced by absolute URL

GitHub's markdown pipeline rewrites a relative `<img src>` to the repository's
`/raw/` path, but it leaves `<source srcset>` untouched. The `srcset` is therefore
an absolute `raw.githubusercontent.com` URL, and the relative path stays on the
`<img>` fallback — which is also the light variant, so a reader who gets no
`<source>` at all still gets the correct default.

### D-04 · CSS animation, not SMIL

`raw.githubusercontent.com` serves SVG under
`default-src 'none'; style-src 'unsafe-inline'; sandbox`. Inline `<style>` is
explicitly permitted; scripts and every external reference are not. That rules out
webfonts (hence the system mono stack) and it rules out JavaScript.

Both CSS and SMIL animate correctly inside an `<img>`, but only CSS can be switched
off by `prefers-reduced-motion`, which has no SMIL equivalent. Reduced motion is an
OS preference and therefore *does* resolve correctly here — unlike colour scheme —
so the reduce branch is honest, and it settles on the whole diagram lit at once
rather than on a blank or half-drawn frame.

### D-05 · Every animation is 8s with no `animation-delay`

Phase is expressed as percentages inside each `@keyframes`, on one shared 8s
duration. Sequencing by `animation-delay` puts each element on its own timeline,
which stays aligned only as long as nothing restarts; percentages on a common
duration cannot drift apart.

### D-06 · The README has to work with no images at all

The GitHub mobile apps have a long-standing history of not rendering SVG in
READMEs. The diagram is therefore an enhancement, never the message: the
positioning sentence, the work and the links are all plain text, and the `alt`
text is a full sentence describing what the diagram shows rather than a label.

### D-07 · No scheduled workflow

The one workflow here runs on push, on pull request, and on manual dispatch, with
`contents: read` and no write permission at all. It regenerates the assets and
compares; it never commits.

Nothing on this profile depends on time or on the GitHub API, so a cron job would
only produce commits that change nothing — noise in the activity graph standing in
for activity. The generator has no dependencies, so there is nothing to install or
cache, and `actions/checkout` is pinned to a full commit SHA.

### D-08 · No badges, stats cards, streaks, or contribution snake

They are near-universal, which means they carry close to zero signal, and the
ones that report activity report it whether or not it is flattering. Three
repositories described in a sentence each say more about judgment than any
generated card, and they stay true when the API behind the card changes.
