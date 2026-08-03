# CPFFL Historical Data

Static-friendly ESPN fantasy football data export for a private league.

## Archive Site

This repo includes a Vite/React archive browser that publishes to GitHub Pages
as a project site, currently at `/archive/`.

```bash
npm install
npm run build:data
npm run verify:data
npm run dev
```

The site reads from `public/archive`, which is generated from the local ESPN
exports. The generator intentionally omits raw ESPN API payloads, league IDs,
owner IDs, notification settings, and auth-related values. To refresh the site
after a new export, rerun:

```bash
npm run build:data
npm run check:local
```

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Fill in `.env` with:

- `ESPN_LEAGUE_ID`
- `ESPN_SWID`
- `ESPN_S2`
- `ESPN_START_YEAR`
- `ESPN_END_YEAR`

Do not commit `.env`. The generated JSON may include names, team data, matchup
history, rosters, draft data, and other league/member information, so keep the
repo private unless the league is comfortable publishing it.

## Export Data

```bash
python scripts/export_espn_history.py
```

Output is written under `data/espn`:

```text
data/espn/
  manifest.json
  seasons/
    2024/
      raw_league.json
      structured.json
      weeks/
        01.json
        02.json
```

`raw_league.json` preserves ESPN's API response. `structured.json` contains a
frontend-friendlier export produced with `espn-api`.

The `espn-api` wrapper does not expose every historical endpoint for every
season. In particular, box scores and recent activity are not available through
the wrapper before 2019, so those sections may contain an `{ "ok": false }`
entry in `structured.json`. The raw ESPN API responses are still written for
each season/week so older data can be normalized later if needed.

The full raw archive can be large. For the static frontend, prefer loading the
compact `structured.json` files and keep the raw files as a preservation archive.
