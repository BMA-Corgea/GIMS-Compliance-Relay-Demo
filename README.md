# GIMS Compliance Relay — Interactive Demo

> **This is a non-functional demonstration.** It looks and feels like the GIMS
> Compliance Relay, but it has **no real backend, no real authentication, no real
> cryptographic integrity, and stores nothing.** All data is simulated and resets
> on reload. It exists to show the workflow and UI — not to be used for regulated
> record-keeping.
>
> The real, 21 CFR Part 11-defensible system (keyed integrity chaining,
> server-of-record custody, two-component electronic signatures, notarization) is
> a separate, private product. **None of that logic lives in this repository.**

A guided, gnome-led walkthrough of the Compliance Relay workflow, hosted as a
static site. Sign in, watch an instrument folder, see a capture land on the trail,
verify, sign a record, and export the evidence — all entirely in your browser.

## Try it

A gnome 🧙 tutorial starts automatically on first visit and walks you through the
whole flow. Use **↻ Replay tour** in the yellow DEMO banner to see it again.

- **Login:** any email + any password works.
- **Everything is simulated** and lives only in memory — reload to reset.

### Run locally

No build step, no dependencies, no server code. Serve the folder statically:

```bash
npx serve .            # then open the printed URL
# or
python3 -m http.server 4000   # then open http://localhost:4000
```

(Open `index.html` over `http://`, not `file://`, so the SVG icon sprite loads.)

## What this demonstrates

The Compliance Relay turns loose instrument output into a **tamper-evident,
attributable audit trail**:

- **Automatic capture** — point it at an instrument's export folder and every new
  file is logged automatically, attributed to the operator.
- **One unified, append-only trail** — captures, reviewer access, electronic
  signatures, and exports all land in a single ordered stream.
- **Tamper-evident chain** — every record is linked to the one before it, so the
  trail can be re-verified end-to-end.
- **21 CFR Part 11 electronic signatures** — reviewers re-authenticate to bind an
  approval/review/rejection (with a reason) to a specific record.
- **Sealed exports** — the production product exports a signed evidence package
  that an auditor can re-verify offline.

> This demo shows **what** the product does, not **how**. The mechanisms that make
> the real product defensible are deliberately not present here (see below).

## What this is NOT

- **Not a usable compliance system.** No real auth, integrity, or persistence.
  Never describe or deploy it as functional. Exports are watermarked as simulated.
- **Not a backend.** There is no server and no serverless function — the API the UI
  talks to is an in-browser mock. The deploy surface is intentionally zero.
- **Not the real product's core.** None of the integrity, custody, signature, or
  notarization logic is in this repo — by design, and enforced by CI.

## How it's built

A static single-page UI (vanilla, no framework) cloned verbatim from the product,
with its **one** backend call routed to an in-browser mock instead of the network:

```
index.html · styles.css · icons.svg          cloned product UI (only change: the api() seam)
        │
      app.js ──► api() ──► mock/mock-api.js   the single seam; no fetch, no server
                               ├─ fixtures.js     seeded in-memory records
                               └─ fake-crypto.js  cosmetic "demo…" checksums
tutorial/  ──► gnome spotlight tour (engine + this demo's steps)
```

### Why you can't turn the demo back into the product

The neutering is **subtractive, not switchable**. We did not ship the real
algorithms behind an `if (DEMO)` flag — there is nothing to uncomment. The pieces
that make the product defensible (keyed integrity chaining, an append-only
server-of-record operators can't touch, real two-component e-signatures,
notarization) are **simply not in this repository**, and a client-only static page
structurally cannot reconstruct a server-of-record. Client code is always readable;
the defense here is **absence, not obfuscation**. A CI guard
(`.github/workflows/neutering-guard.yml`) fails the build if any real
implementation or private-repo artifact ever leaks back in.

## Repository layout

| Path | What |
|---|---|
| `index.html`, `app.js`, `styles.css`, `icons.svg`, `favicon.svg` | cloned product UI |
| `demo.css` | demo-only additions (banner, tour reveals) |
| `mock/` | the in-browser stand-in backend |
| `tutorial/` | the gnome spotlight tour (`tutorial.js` engine + `steps.js` content) |
| `assets/gnome.png` | the tutorial's narrator |
| `tests/smoke.spec.js` | optional local Playwright smoke (not in CI) |
| `proposals/tech_demo.md` | the technical proposal behind this demo |

## License

Source-available for viewing, learning, and running locally — **not** for
production or commercial use, and never to be represented as a functional or
compliant system. See [`LICENSE`](LICENSE).
