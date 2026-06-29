# GIMS Compliance Relay — Interactive Tech Demo — Proposal

## What This Is

A public, open-source, Vercel-hosted **interactive demonstration** of the GIMS
Compliance Relay. It reuses the real product's single-page UI verbatim so it looks
and feels identical, but every line behind the UI is a cosmetic stand-in: a fake
login that accepts anything, fake checksums that are random hex, a "chain verified ✓"
that is hard-coded true, and an in-browser mock that holds a handful of seeded
records in memory and forgets them on reload. There is **no backend** — not even a
serverless function. On top of the cloned UI sits a guided **gnome tutorial**: a
spotlight overlay that dims the whole screen except the one correct control and
walks a first-time visitor through the full workflow (sign in → watch a folder →
see a capture → verify → sign → export).

The point is a demo that is *convincing but unusable*, and that *cannot be turned
back into the real product from its own source* — because the parts that make the
real product defensible (keyed HMAC chaining, server-of-record custody, two-component
electronic signatures, notarization) are simply **not in this repository**. Neutering
here is **subtractive — we delete the brain, we don't lobotomize it behind a flag.**

---

## Context

- **Source of the UI.** The real product's served SPA lives in the private repo at
  `gims_relay/web/` — `index.html`, `app.js`, `styles.css`, `icons.svg`,
  `favicon.svg`. It is **vanilla, no-build** (no React, no bundler), which makes it a
  perfect static deploy target. The entire frontend talks to the backend through a
  **single function**, `api(path, opts)` in `app.js` (the `fetch` wrapper). That one
  function is the only seam we have to replace.
- **What the UI calls.** The endpoints the SPA hits today: `POST /auth/register`,
  `POST /auth/login`, `GET /auth/me`, `GET /events`, `GET /events/verify`,
  `POST /events/sign`, `GET /events/export.{csv,json}`, and the file-watcher set
  (`/filewatch/status|configure|start|stop`, `DELETE /filewatch/folder`). The mock
  only has to answer these.
- **Why not clone the real repo.** Git history in the private repo contains the real,
  un-neutered implementation. A clone would leak it. The demo therefore lives in a
  **fresh repository with fresh history** (`GIMS-Compliance-Relay-Demo`, already
  initialized, remote → `github.com/BMA-Corgea/GIMS-Compliance-Relay-Demo`).
- **Hosting target.** Vercel, static deployment, connected to the GitHub repo for
  auto-deploy on push. No env vars, no functions — keeping the server surface at
  literally zero is itself part of the security story.
- **Asset on hand.** `assets/gnome.png` (the user's transparent gnome) is already
  copied into the demo repo and is the tutorial's narrator.

### Already done (repo scaffolding)

- New folder `GIMS-Compliance-Relay-Demo/` created as a sibling, **`git init` with
  clean history**, `main` branch, remote `origin` set to the GitHub demo repo.
- `assets/gnome.png`, `.gitignore`, placeholder `README.md` in place. Nothing pushed
  yet.

---

## Design

### Architecture: static SPA + in-browser mock

```
┌──────────────────────────── Browser (the entire app) ────────────────────────────┐
│                                                                                   │
│   index.html ── styles.css ── icons.svg        (cloned UI, paths fixed)           │
│        │                                                                          │
│      app.js  ──────────►  api(path, opts)                                         │
│                               │   (the ONLY backend seam)                         │
│                               ▼                                                   │
│                         mock/mock-api.js   ──►  routes path → handler             │
│                               │                                                   │
│                               ├─ fixtures.js     seeded records, users, files     │
│                               └─ fake-crypto.js  random-hex "checksums"           │
│                                                                                   │
│   tutorial/tutorial.js  ──►  spotlight overlay + gnome narration                  │
│                                                                                   │
│   In-memory state only. Resets on reload. No network. No storage of record data.  │
└───────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ✗  no server, no serverless, no database
```

There is exactly one code change to the cloned `app.js`: point `api()` at the mock
router instead of `fetch`. Everything else in the UI is untouched, so the demo stays
visually identical to the product and easy to keep in sync.

### The mock backend (`mock/`)

A small router that pattern-matches the path + method and returns canned data. It is
deliberately dumb — there is no auth logic, no crypto, no persistence to attack.

| Endpoint | Mock behavior |
|---|---|
| `POST /auth/register` | Records a display name in memory; returns ok. No password hashing. |
| `POST /auth/login` | **Accepts any email/password.** Returns a constant token (`"demo.session"`) + a fake user. |
| `GET /auth/me` | Returns the in-memory user if a token string is present (presence only — nothing verified). |
| `GET /events` | Returns seeded fixtures, filtered/paginated **client-side** to honor `search`/`kind`/`limit`/`offset`. |
| `GET /events/verify` | **Always** `{ ok: true, records_checked: N, head_seq: N }`. Cosmetic. |
| `POST /events/sign` | Accepts any password; appends a fake `signature` event to the in-memory list. |
| `POST /filewatch/configure\|start\|stop`, `DELETE /filewatch/folder` | Toggle in-memory folder state. |
| `GET /filewatch/status` | Returns the in-memory folder list with fake detected/logged counters. |
| `GET /events/export.{csv,json}` | Builds a file from in-memory rows, **watermarked** as simulated, returned as a Blob download. |

**Simulated capture.** When a folder is "watched," a timer periodically appends a
fake `file_capture` event drawn from a canned list of plausible instrument filenames
(e.g. `NMR_run_042.fid`, `HPLC_2026-06-24.csv`), so the trail visibly grows and the
file-watcher panel's counters tick — exactly what a live demo needs.

### Neutering strategy — subtractive, not switchable

This is the core design principle and the answer to *"could a savvy person one-shot
the fixes from the open source?"*

1. **Subtract the brain; don't disable it.** We do **not** ship the real algorithms
   behind an `if (DEMO)` flag or commented out — that is one edit away from working.
   We ship cosmetic replacements *of a different shape*: a checksum is
   `randomHex()`, not a keyed hash; verify is a constant `true`, not a walk over a
   linked chain. There is no real function to uncomment, no flag to flip.
2. **No key material, no server, no persistence.** Even a perfect re-derivation of the
   HMAC algorithm has **nothing to key with and nothing to write to**. The real
   product's guarantee is *out-of-process append-only custody on a server-of-record
   operators cannot touch* — that is structurally impossible to reconstruct from a
   client-only static page. The hardest, most valuable part of the product can't be
   inferred from the demo because it isn't a client-side thing at all.
3. **Public docs describe WHAT, not HOW.** The demo's README states the marketing
   claims ("tamper-evident, Part 11"), but the repo carries none of the design
   specifics — what the HMAC covers, canonical serialization, the stripe-lock
   concurrency model, the notarization protocol, the forward/dedup scheme. Those stay
   only in the private repo's `proposals/compliance_relay_refactor.md`.
4. **Make the fakeness loud and intentional.** A persistent "DEMO — simulated data,
   resets on reload" banner; checksums visibly tagged as demo values; export files
   watermarked. This sets honest expectations, stops anyone passing the demo off as
   the real product, and signals to any would-be "fixer" that they would be building
   a product from zero, not patching this one.
5. **License + terms.** Ship a license that permits viewing and learning but **not**
   production or commercial use, plus an explicit "non-functional demonstration"
   statement (already in the README).

**Honest limit (worth stating plainly):** any client-side code can be read; no
obfuscation or minification *prevents* reconstruction, it only slows it. A skilled
person armed with the public *claims* could build *a* compliance logger. What they
cannot do is reconstruct *this* product's specific guarantees from the demo, because
those guarantees live in code that isn't here and on a server they can't see. So we
rely on **subtraction, not secrecy-by-obfuscation** — the only defense that actually
holds. The goal is met when "fix the demo" is equivalent to "build your own product."

### The gnome tutorial overlay (`tutorial/`)

A self-contained coachmark/spotlight system layered over the cloned UI.

- **Spotlight mechanism.** A full-screen dim layer, with a "hole" cut around the
  current target element using the box-shadow trick — a transparent box positioned
  over the target with `box-shadow: 0 0 0 9999px rgba(6,10,20,.72)`. The target is
  raised above the dim layer and stays clickable; everything else is dimmed and
  click-blocked by the overlay. A `body.tutorial-active` class additionally fades
  non-target controls so only the "correct button" stands out.
- **The narrator.** `assets/gnome.png` sits in a corner with a speech bubble holding
  the step text and a **Next ▶** control (and a **Skip tutorial** escape).
- **Step sequence** (walks the real workflow):
  1. **Sign in** — spotlight the Sign-in button (creds pre-filled; any value works).
  2. **Pick a trail** — spotlight the trail input.
  3. **Watch a folder** — spotlight the folder field + add button; a simulated capture
     then appears in the trail.
  4. **Read the trail** — spotlight the newly captured row.
  5. **Verify the chain** — spotlight Verify → the pill turns green "verified ✓".
  6. **Sign a record** — spotlight a row's sign button → the e-signature modal →
     spotlight password + confirm.
  7. **Export evidence** — spotlight CSV/JSON; a watermarked file downloads.
  8. **Wrap-up** — the gnome closes with a one-line "this was a demo" + CTA.
- **Persistence & replay.** A `tutorial_done` flag in `localStorage` auto-skips on
  return; a small "Replay tutorial" affordance restarts it.
- **Driven by data.** A `STEPS` array (`{ selector, text, advanceOn }`) so steps are
  easy to reorder/edit without touching the engine.

### Proposed file layout

```
GIMS-Compliance-Relay-Demo/
├── index.html              # cloned; /static/ paths → relative; tutorial scripts added
├── app.js                  # cloned; api() re-pointed at the mock router
├── styles.css              # cloned
├── icons.svg  favicon.svg  # cloned
├── mock/
│   ├── mock-api.js         # path/method router → handlers
│   ├── fixtures.js         # seeded events, fake users, canned filenames
│   └── fake-crypto.js      # cosmetic random-hex "checksum" generator
├── tutorial/
│   ├── tutorial.js         # spotlight engine + STEPS
│   └── tutorial.css        # overlay, spotlight, speech bubble, faded-control styles
├── assets/gnome.png        # already present
├── proposals/tech_demo.md  # this file
├── vercel.json             # optional: headers / SPA fallback / clean static config
├── README.md  LICENSE
```

### Path handling

The cloned UI references assets as `/static/...`. Two clean options on Vercel:
either (a) rewrite those references to **relative paths** (`./styles.css`,
`./icons.svg#i-shield`) and serve everything from the root — simplest, no config; or
(b) keep `/static/` and add a `vercel.json` rewrite `"/static/(.*)" → "/$1"`.
**Recommend (a)** to keep the deploy config-free. Note the SVG `<use href=".../icons.svg#id">`
is an external-file reference and must remain same-origin (it will be, on Vercel).

---

## What This Is Not

- **Not a usable compliance system.** No real auth, no real integrity, no Part 11
  anything. It must never be described or deployed as functional.
- **Not a backend port.** No FastAPI, no SQLite/Postgres, no file watcher process, no
  serverless functions. The server surface is intentionally zero.
- **Does not contain the real core.** None of `gims_relay/core`, `adapters`, `app`,
  `migrations`, secrets, or the integrity algorithms appear in this repo — by design,
  and enforced by a CI guard (see Testing).
- **Not multi-user or persistent.** State is per-session, in-memory, gone on reload.
- **Not relying on obfuscation.** We do not pretend minification hides anything; the
  defense is that the valuable code isn't here, not that it's scrambled.
- **Not a redesign of the UI.** It clones the existing SPA as-is; restyling is out of
  scope (the look is already the agreed Nocturne/OpenClaw aesthetic).

---

## Testing

Light backend (there isn't one) but the visitor-facing flow and the neutering
invariant both need real verification.

- **Manual smoke (primary).**
  - Fresh load with cleared `localStorage`: login accepts arbitrary creds; dashboard
    renders; seeded trail shows.
  - Reload → all appended/captured/signed records are gone (reset-on-reload holds).
  - Verify pill always reads green; checksums render as demo-tagged values.
  - Watch a folder → simulated captures appear and counters tick.
  - Sign a record (any password) → a signature row appears.
  - Export CSV and JSON → files download and contain the **DEMO watermark**.
- **Gnome tutorial.**
  - Each step's spotlight aligns to the correct element (test at 1280px and on mobile
    width; re-measure on window resize).
  - Only the highlighted control is clickable; the rest is faded + click-blocked.
  - Skip works; completion sets `tutorial_done`; replay restarts cleanly.
- **Neutering invariant (CI guard — important).** A GitHub Action that **fails the
  build** if the repo contains forbidden content: e.g. `grep` for `hmac`,
  `secret_provider`, `boto3`, `gims_relay/core`, `Authorization: Bearer` server code,
  or real key material. This keeps future edits from accidentally re-introducing the
  brain.
- **Automated happy-path (optional).** A Playwright script (Playwright is already in
  the private repo's `.venv`) that loads the static site, runs the tutorial path, and
  asserts the trail populates and an export downloads. Can run in CI against a static
  server or `vercel dev`.
- **Cross-browser.** Verify the SVG `<use>` external-file reference and the
  box-shadow spotlight render in Chrome, Firefox, and Safari.
- **Edge cases.** Narrow viewport spotlight alignment; rapid Next clicks; signing with
  empty reason (UI validation still fires); export with an active search filter.

---

## Implementation Phases

### Phase 0 — Scaffold (done)
- [x] Create sibling folder with fresh `git init` (clean history) and `main` branch
- [x] Set `origin` → `github.com/BMA-Corgea/GIMS-Compliance-Relay-Demo`
- [x] Copy `assets/gnome.png`, add `.gitignore` + placeholder `README.md`
- [x] Add a `LICENSE` (view/learn, no production/commercial use)

### Phase 1 — Port the UI shell
- [x] Copy `index.html`, `app.js`, `styles.css`, `icons.svg`, `favicon.svg` from
      `gims_relay/web/`
- [x] Rewrite `/static/...` references to relative paths
- [x] Add a persistent "DEMO — simulated data, resets on reload" banner
- [x] Confirm the static page renders (verified in a headless browser; see Phase 3 note)

### Phase 2 — Mock backend
- [x] `mock/fixtures.js` — seeded events (varied kinds), fake users, canned filenames
- [x] `mock/fake-crypto.js` — cosmetic random-hex checksum generator (demo-tagged)
- [x] `mock/mock-api.js` — router covering every endpoint in the Design table
- [x] Re-point `api()` in `app.js` to the mock router (single seam: `fetch` → `MockAPI.fetch`)
- [x] Simulated capture timer for watched folders
- [x] Watermark exports

### Phase 3 — Neutering audit
- [x] Diff against the endpoint list; confirm no real auth/crypto/persistence path
- [x] Confirm none of `gims_relay/core|adapters|app`, secrets, or `boto3` are present
- [x] Loud demo labeling on checksums + exports verified
- [x] Adversarial multi-agent review of the neutering invariant + contract fidelity

### Phase 4 — Gnome tutorial
- [x] `tutorial/tutorial.css` — overlay, spotlight (four-panel frame), speech bubble
- [x] `tutorial/tutorial.js` — spotlight engine + resize re-measure (+ `steps.js` content)
- [x] Wire the workflow (10 steps); Skip / Next / Back / Replay; `tutorial_done` persistence
- [x] Narrow-viewport handling (engine clamps + re-measures; CSS responsive)
- [x] **Also turned the engine into a reusable `guided-tour` skill** (per owner request)

### Phase 5 — Deploy + CI
- [x] `vercel.json` (minimal: static, clean URLs, safe headers — relative paths need no rewrites)
- [ ] Connect the GitHub repo to Vercel; verify auto-deploy on push to `main` *(owner action)*
- [x] GitHub Action: neutering-invariant grep guard (fails on forbidden content) + zero-server-surface assert
- [x] Optional Playwright happy-path (`tests/smoke.spec.js`; local, not wired into CI by default)

### Phase 6 — Polish & docs
- [x] Finalize public README (claims only, no how-it-works)
- [ ] Screenshot/GIF of the tutorial for the repo *(captured during verification; not yet committed)*
- [ ] First push to `origin/main` (confirm with owner before pushing — outward-facing) *(awaiting owner OK)*

---

## Notes for Future Sessions

- **The whole demo hinges on one seam:** `api(path, opts)` in the cloned `app.js`.
  Replace its body to call `mock/mock-api.js`; touch nothing else in the UI. This is
  what keeps the demo visually identical to and easy to re-sync with the product.
- **Endpoint contract to mock** is fixed by the cloned `app.js`: auth
  (`register|login|me`), `events` (+`verify`, `sign`, `export.csv|json`), filewatch
  (`status|configure|start|stop` + `DELETE folder`). Match those shapes exactly or the
  UI breaks.
- **Subtractive neutering is the non-negotiable rule.** Never ship real integrity code
  behind a flag. Replace with different-shaped cosmetic fakes (random hex; constant
  `verify=true`). The CI grep guard exists to enforce this — keep it.
- **Do not copy from the private repo's git history**; copy only the five web files +
  the gnome PNG (already done) as working files, never as git history.
- **No serverless functions on Vercel.** Zero server surface is part of the security
  posture; keep it static-only.
- **Honest framing for the owner's "one-shot fix" worry:** client code is always
  readable; the defense is that the valuable code (server-of-record custody, keyed
  chaining, real e-sign) is *absent*, not *hidden*. "Fixing" the demo = rebuilding the
  product. That is the realistic, achievable bar.
- **Pushing is outward-facing** — confirm with the owner before the first
  `git push -u origin main`.
- **Next immediate task if interrupted:** the build is complete and verified.
  Remaining are owner-gated outward-facing steps: (1) get owner OK, then
  `git push -u origin main`; (2) connect the GitHub repo to Vercel for auto-deploy;
  (3) optionally commit a tutorial screenshot/GIF into the repo.
- **The gnome tour is now a reusable skill:** `~/.claude/skills/guided-tour/`
  (engine `reference/tour.js` + `reference/tour.css`). The demo's `tutorial/tutorial.js`
  and `tutorial.css` are copies of that engine; `tutorial/steps.js` holds the demo's
  step content. Keep them in sync if the engine changes.

---

## Session Log

| Date | Notes |
|---|---|
| 2026-06-24 | Proposal written. Repo scaffolded (Phase 0 mostly done): fresh git init, remote set, gnome asset + `.gitignore` + README in place. Architecture chosen: static SPA + in-browser mock, subtractive neutering, gnome spotlight tutorial. Nothing pushed yet. |
| 2026-06-24 | **Implemented Phases 0–6** (all but owner-gated Vercel connect + first push). Ported the 5 web files (only logic change: `api()` `fetch`→`MockAPI.fetch`); built `mock/{fake-crypto,fixtures,mock-api}.js`; added `demo.css` DEMO banner; built the gnome tour (`tutorial/{tutorial.js,tutorial.css,steps.js}`, 10 steps); `LICENSE`, `vercel.json`, neutering-guard CI, `tests/smoke.spec.js`. Verified in a headless browser: 16/16 checks (login/seed/verify/watch/sign/export/reset) green, no console errors. Ran an adversarial multi-agent audit of the neutering invariant + contract fidelity. **Also extracted the tour engine into a reusable global skill `guided-tour`** (`~/.claude/skills/guided-tour/`). Still not pushed. |
