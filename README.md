# TerraSlate CEO Dashboard

Port of TerraSlate's Data Studio → standalone web app, because the Looker
Studio report got too slow to load. This covers **only the CEO Dashboard
page** — later phases will add the other 8 sidebar pages (currently disabled
placeholders).

**Status: live data, functional date-range picker, dark premium theme.** Every
number on the page is pulled from the real source Google Sheet (not mock
data) via a Python fetch script, the date-range picker in the header actually
filters that data (presets and custom ranges both), and the UI has a dark,
glass-and-glow visual treatment on top of the original functional layout.

## Stack

- React 19 + TypeScript + Vite
- [Recharts](https://recharts.org) — sparklines (with an SVG glow filter), donut chart
- [react-simple-maps](https://www.react-simple-maps.io) — US choropleth, real sequential heatmap by state
- CSS Modules, hand-rolled (no Tailwind) — theme tokens in [`src/theme.css`](src/theme.css)
- [Inter](https://fonts.google.com/specimen/Inter) via `@fontsource/inter` (self-hosted, no CDN request)
- [lucide-react](https://lucide.dev) for icons
- Python 3 (stdlib only, no pandas) for the data pipeline — [`scripts/fetch_data.py`](scripts/fetch_data.py)

## Running locally

```bash
npm install
npm run dev
```

Opens on the port Vite picks (prints to the terminal, typically `5173`).

```bash
npm run build    # type-check + production build
npm run preview  # preview the production build locally
```

### If you don't have Node.js installed

This machine didn't have Node/npm/Homebrew when this project was built. Node
was installed standalone (no sudo) via the official binary tarball:

```bash
mkdir -p ~/.local && cd ~/.local
curl -fsSL -o node.tar.gz https://nodejs.org/dist/v22.14.0/node-v22.14.0-darwin-arm64.tar.gz
tar -xzf node.tar.gz && rm node.tar.gz && mv node-v22.14.0-darwin-arm64 node
echo 'export PATH="$HOME/.local/node/bin:$PATH"' >> ~/.zshrc
```

Open a new terminal (or `source ~/.zshrc`) and `node -v` / `npm -v` should work.

## Refreshing the data

```bash
python3 scripts/fetch_data.py
```

Pulls every relevant tab from the source Google Sheet ("DailyDashRaw_TerraSlate",
link-accessible, no auth needed) via CSV export, computes every date-range
preset (see below), leaderboards, per-state shipping totals, etc., and writes
`src/data/ceoDashboardData.json`. Re-run any time you want current numbers —
the dev server hot-reloads the new JSON automatically.

The script's own docstring documents every assumption it makes (trend window
length, Proof/Graphic team roster since the sheet has no team column, the
Walmart-feed staleness workaround, etc.) — read it before changing any
calculation.

## How the data flows

```
Google Sheet (DailyDashRaw_TerraSlate)
        │  CSV export per tab (scripts/fetch_data.py)
        ▼
src/data/ceoDashboardData.json
        │  reshaped into typed constants (src/data/ceoDashboardData.ts)
        ▼
section components (src/sections/*.tsx)
```

- **`src/data/ceoDashboardMockData.ts`** — still the home for shared TypeScript
  types (`KpiCard`, `TableSection`, `Source`, etc.), static UI config
  (sidebar nav items, truncated-label tooltips), and every section's
  `Source` label (confirmed 2026-08-08 and verified column-for-column
  against the real sheet — see the file's header comment for the full
  tab-by-tab map).
- **`src/data/ceoDashboardData.ts`** — the real-data adapter. Imports the
  generated JSON, reshapes it into the exact same typed constants the mock
  module exports, and reuses the confirmed `Source` labels from the mock
  module (sources don't change, only the numbers do).
- Section components import from `ceoDashboardData.ts`, not the mock module.

Two things worth knowing about the source data:

- **Walmart's feed appears stale.** The `Walmart` tab has real sales data
  through 2026-04-25 and nothing after. The dashboard correctly shows
  "Walmart Sales: No data" for any trailing-30-day window past that date —
  that's real behavior, not a bug, until whatever feeds that tab
  (Windsor.ai or similar) gets reconnected.
- **Shipping by State (5.8)** is fully live — the `country_city` tab had all
  the shipping-address data needed all along; the blank widget in the
  original Looker Studio report was a broken chart config there, not
  missing data.

## Date-range picker

Functional — presets and custom ranges both actually filter the data, not
just the UI. Only the trend-driven sections respond to it: **Sales Across
Channels, Marketing Metrics, Breadwinnaz, and Proof/Graphic Team sales +
Graphic Design Value + Graphics Team Hrs.** TerraSlate Tracker, Pre-Press,
Production Teams, Shipping by State, and Traffic are all-time/snapshot data
in the original report too — not date-ranged — so they're intentionally left
alone. That split is deliberate, documented in `fetch_data.py`'s docstring,
not an oversight.

**Presets** (Today, Yesterday, Last 7 days, Last 30 days, This month, Last
month) are computed exactly in Python — `fetch_data.py` produces one object
per preset per section, each anchored to that dataset's own latest *active*
date (see `latest_active_date()` — some tabs scaffold a few days of $0
placeholder rows ahead of real data landing, so anchoring on the raw max row
date would silently eat real days out of the window). The client
(`src/data/DateRangeContext.tsx`) just looks up the matching precomputed
object — no business logic duplicated in TypeScript for the common case.

**Custom range** can't be precomputed, so it's calculated client-side
(`src/lib/dateRange.ts`) from a capped trailing **180-day** raw daily
dataset (`dailyRaw` in the JSON) — mirrors the Python aggregation logic
(filter by date, sum, rank, trend-vs-immediately-preceding-same-length-span)
line for line. The 180-day cap keeps the bundle the whole rebuild exists to
make fast — shipping full history back to 2022 for every staff member and
every day would bloat it for a feature that's rarely used beyond the last
few months. A custom range older than ~6 months isn't supported; bump
`RAW_WINDOW_DAYS` in `fetch_data.py` if that's ever needed.

"Previous period" for any trend % is always the immediately preceding span
of the *same length* as the current one (e.g. "This month" 12 days in
compares against the 12 days before the 1st) — not a calendar-aligned
comparison. Simple and consistent across every preset and custom range alike.

## Dark premium theme + effects

The whole UI runs on CSS custom properties defined once in
[`src/theme.css`](src/theme.css) — deep navy/near-black surfaces, a luminous
blue accent (`--blue-500` / `--glow-blue`), soft ambient page-background
gradients, and glass-blur on the sticky header. Two specific effects:

- **Luminous sparklines** ([`src/components/shared/Sparkline.tsx`](src/components/shared/Sparkline.tsx)):
  each line renders twice — a thin, blurred "glow" pass (SVG `feGaussianBlur`
  + `feMerge` filter) behind an even thinner crisp core line — for a
  neon-tube look. Always the brand blue (`--glow-blue`); trend direction is
  carried by the `TrendIndicator` pill next to it, not re-encoded in the
  line color.
- **Scroll-triggered card glow** ([`src/hooks/useGlowOnScroll.ts`](src/hooks/useGlowOnScroll.ts)):
  every stat tile, table card, the donut card, and the map card use this
  hook. An `IntersectionObserver` adds a `glow-pulse` class (keyframes in
  `theme.css`) each time the card scrolls into view — re-triggerable on every
  re-entry, not just once — pulsing a soft blue box-shadow ring outward and
  back. Respects `prefers-reduced-motion`.
- **Choropleth heatmap** ([`src/components/shared/UsChoropleth.tsx`](src/components/shared/UsChoropleth.tsx)):
  real per-state order counts drive a sqrt-scaled sequential blue ramp (so
  one dominant state doesn't wash out the rest), with a hover tooltip and a
  Fewer→More legend.

## Mobile

Prioritized — the client checks this from his phone. Below 860px the sidebar
becomes an off-canvas drawer ([`Sidebar.tsx`](src/components/layout/Sidebar.tsx)):
a hamburger button in the header toggles it open over a blurred backdrop,
closes on backdrop click or on picking a page, and the main content reclaims
the full width since the collapsed sidebar is `position: fixed` (out of the
flex flow) rather than pushing content over. Header title and the date-range
trigger both truncate gracefully instead of colliding at narrow widths. All
grids already collapse to a single column at 720px (tables scroll
horizontally within their own card, which is standard/expected on mobile —
not a bug). Verified at 375×812 (phone) and 768×1024 (tablet) with no
horizontal page overflow at either size.

## Assumptions made building this

- **Proof Team / Graphic Team rosters** are hardcoded in `fetch_data.py`
  (`PROOF_TEAM`, `GRAPHIC_TEAM` sets) since `SalesPerStaff` has no team
  column — revisit if team membership changes.
- **Breakpoints**: 1180px collapses KPI/table grids from 4–5 columns down to
  2; 860px switches the sidebar to an off-canvas drawer; 720px collapses
  grids to a single column; 640px tightens header/section padding further
  for phones. See the Mobile section above.
- **Table sort default**: each table defaults to sorted by its primary value
  column, descending.
- **Choropleth base map**: US state outlines load from the public
  `us-atlas` CDN topology at runtime — geometry only, not business data.
- **Currency/number formatting**: USD, 2 decimal places for currency columns.

## Project structure

```
scripts/
  fetch_data.py             # pulls the sheet, computes preset windows + raw
                             # daily data, writes JSON
src/
  theme.css                 # design tokens + glow-pulse keyframes
  hooks/useGlowOnScroll.ts  # scroll-triggered card glow
  lib/dateRange.ts          # custom-range client-side aggregation (mirrors
                             # fetch_data.py's logic), preset resolution
  data/
    ceoDashboardMockData.ts # types, static config, confirmed Source labels
    ceoDashboardData.json   # generated — do not hand-edit, re-run the script
    ceoDashboardData.ts     # adapter: JSON → typed constants (build* fns for
                             # date-driven sections, static for all-time ones)
    DateRangeContext.tsx    # selection state + resolves the active window
                             # (preset lookup or custom computation)
  components/
    layout/                # Sidebar, Header, DateRangePicker
    shared/                 # StatTile, DataTable, DonutChart, Sparkline,
                             # TrendIndicator, EmptyState, UsChoropleth, Section
  sections/                 # one component per report section (5.1–5.9)
  pages/CeoDashboard.tsx    # assembles all sections in order
  App.tsx                   # Sidebar + Header + page shell
```

Sidebar nav items 2–9 (AirCall, Amazon Restock, Accounts Receivable, Google
Ads, Facebook Ads, Shipping, Sales Report, Paper Catalog) are disabled
placeholders — the shape is there for future phases, nothing behind them yet.
