# CPFFL Historical Data Archive

CPFFL is a static, searchable archive for the Couch Potatoes Fantasy Football League. It preserves ESPN league history in a format that league members can browse without requiring a live ESPN login or a backend service.

## What it does

The archive lets members explore league history across seasons, including:

- league records, champions, and lifetime owner totals;
- season settings, standings, and weekly results;
- team records, rosters, matchups, scoring, and draft history;
- draft picks, auction values, and keeper information;
- player history and season-by-season fantasy-point totals; and
- weekly scoreboards, box scores, and transactions.

The archive browser also provides filtered search across seasons, teams, weeks, transactions, drafts, and players.

## How it works

1. The Python exporter authenticates to ESPN with league credentials and downloads each requested season and week into `data/espn`.
2. It saves both ESPN's raw responses and a compact, structured export. Raw files are preserved locally for future normalization; they are not intended for publication.
3. `npm run build:data` reads the local export and creates a compact public archive in `public/archive`. It builds season and week data, player and search indexes, and local copies of team logos.
4. `npm run verify:data` checks the generated archive for data that must not be published, such as ESPN cookies, league and owner identifiers, raw payloads, and notification settings.
5. The Vite/React app fetches that generated JSON at runtime and renders the archive entirely in the browser. The result can be deployed to any static host, including GitHub Pages.

There is no application server or database in production: the published site is the compiled frontend plus its static JSON archive.

## Technology

| Area | Tools |
| --- | --- |
| ESPN export | Python 3, [`espn-api`](https://github.com/cwendt94/espn-api), and Python's standard HTTP/JSON libraries |
| Archive build and validation | Node.js ESM scripts and the Node file-system APIs |
| Frontend | React 19, TypeScript, Vite, and React Router |
| Data presentation | TanStack React Table, Lucide React, React Icons, and CSS |
| Deployment | Static files generated into `dist/` with public data in `public/archive/` |

## Run the archive locally

The committed public archive can be browsed without ESPN credentials.

```bash
npm install
npm run dev
```

Vite prints the local URL. To make a production build instead:

```bash
npm run build
```

## Refresh ESPN data

Refreshing the source archive requires Python 3 and access to the private ESPN league.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Set these values in `.env`:

- `ESPN_LEAGUE_ID`
- `ESPN_SWID`
- `ESPN_S2`
- `ESPN_START_YEAR`
- `ESPN_END_YEAR`

Then export, build, and validate the publishable archive:

```bash
python scripts/export_espn_history.py
npm run build:data
npm run verify:data
npm run typecheck
```

`npm run check:local` runs the final three steps after an export. `npm run check` validates the current public archive and type-checks the frontend.

## Data and privacy

Keep `.env` private. It contains ESPN credentials, while `data/espn` contains the complete local export, including raw ESPN responses. Both are ignored by Git.

Only `public/archive` is consumed by the frontend. Before deploying an updated archive, run `npm run verify:data`; it rejects generated JSON containing blocked credential, identifier, raw-data, or notification-setting fields. Even filtered league history may include member names, team data, scores, rosters, drafts, and transactions, so publish it only with the league's consent.

## Project layout

```text
src/                         React archive browser
scripts/export_espn_history.py  Authenticated ESPN export
scripts/build_public_archive.mjs  Local export → public static archive
scripts/verify_public_archive.mjs Privacy and reference validation
data/espn/                   Local raw and structured ESPN data (ignored)
public/archive/              Generated data used by the frontend
```
