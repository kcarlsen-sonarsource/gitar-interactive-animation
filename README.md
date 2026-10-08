# Gitar — Don't just review. Ship.

An interactive, scroll-driven three.js journey through **Gitar**, Sonar's code change verification agent.

**Live:** https://kcarlsen-sonarsource.github.io/gitar-interactive-animation/

```bash
pnpm install
pnpm dev      # http://localhost:5173
pnpm build    # static site in dist/
```

## The story (11 chapters)

| # | Chapter | What you see |
|---|---------|--------------|
| 0 | Hero | The real Gitar wordmark (extruded from the brand SVG) assembling inside orbiting verification rings |
| 1 | The problem | Six coding agents flooding PRs into a funnel that jams at a narrow human-review gate |
| 2 | 01 · Review | A diff panel is scanned; speculative "nitpick" noise dissolves, 3 real findings light up, one consolidated comment |
| 3 | 02 · Diagnose | A CI job city: flaky tests and infra noise sink, 4 real failures converge on 1 root cause |
| 4 | 03 · Fix | The Gitar orb welds a fix: the bad line shatters, an ErrorBoundary patch lands, a commit appears on the branch |
| 5 | 04 · Verify | A ring of CI checks iterates lap by lap until everything is green, then commits on green |
| 6 | Guardrails | PRs travel a lane lined with plain-English `.gitar/rules/*.md`; a security rule blocks one at the merge gate |
| 7 | Integrations | Code hosts, CI systems and work tools orbit the Gitar core, streaming events in and fixes out |
| 8 | 05 · Insights | Time-to-merge bars fall while fix-share rises and flake rate drops (illustrative data) |
| 9 | Enterprise | Probes bounce off a geodesic shield around your source code; SOC 2 / ISO 27001 / GDPR / ZDR badges orbit |
| 10 | Ship | Warp tunnel of verified PRs through a portal — the CTA |

## Structure

- `src/main.ts` — renderer, scroll→camera choreography (dwell + arc flights), HUD, chapter lifecycle
- `src/world.ts` — shader grid floor, star dust, the main-branch light rail
- `src/post.ts` — bloom + chromatic aberration / vignette / grain finish pass
- `src/chapters/*` — one self-contained scene per chapter (`update({ t, a, local, since })`)
- `src/lib/text.ts` — canvas-rendered code panels, labels, comment cards and log textures

Copy follows the public messaging at sonarsource.com/products/gitar.

## Frame-accurate visual QA (dev only)

In `pnpm dev`, the page exposes `window.__capture(chapter, seconds, name)`. It freezes the camera on a
chapter coordinate (fractions = mid-flight) at a given chapter-local time, outlines the copy block in
red, and saves a JPEG to `.shots/<name>.jpg` via a dev-server endpoint, so layouts can be checked for
overlaps without a visible browser window:

```js
await __capture(4, 7, 'fix-after')   // chapter 4 (Fix), 7s in
```

## Booth video

The booth loop (1080p60, 2:03, seamless fade-from/to-black loop) is a separate deliverable, not part of the
hosted site. It is rendered deterministically from the same scenes. Dwell times per chapter live in `src/video.ts` (`HOLDS`). To re-render in `pnpm dev`:

```js
await __video({ fps: 60, name: 'booth' })   // frames → .video/booth/
```
```bash
ffmpeg -framerate 60 -i .video/booth/%06d.jpg -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -movflags +faststart gitar-booth-loop.mp4
```

## Hosting

Pushed to `main` → GitHub Actions builds and deploys to GitHub Pages (`.github/workflows/pages.yml`).
