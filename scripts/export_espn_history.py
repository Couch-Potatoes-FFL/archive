#!/usr/bin/env python3
"""Export ESPN fantasy football league history to static JSON files."""

from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional
from urllib.parse import urlencode
from urllib.request import Request, urlopen


DEFAULT_VIEWS = [
    "mSettings",
    "mTeam",
    "mRoster",
    "mMatchup",
    "mMatchupScore",
    "mScoreboard",
    "mStandings",
    "mStatus",
    "mDraftDetail",
    "mTransactions2",
]

TRANSACTION_TYPES = {"FREEAGENT", "WAIVER", "WAIVER_ERROR", "ROSTER"}


@dataclass(frozen=True)
class Config:
    league_id: int
    swid: str
    espn_s2: str
    start_year: int
    end_year: int
    max_week: int
    output_dir: Path


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def env_required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise SystemExit(f"Missing required environment variable: {name}")
    return value


def env_int(name: str, default: Optional[int] = None) -> int:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        if default is None:
            raise SystemExit(f"Missing required environment variable: {name}")
        return default

    try:
        return int(raw)
    except ValueError as exc:
        raise SystemExit(f"{name} must be an integer, got {raw!r}") from exc


def load_config(args: argparse.Namespace) -> Config:
    load_dotenv(Path(args.env_file))

    league_id = args.league_id or env_int("ESPN_LEAGUE_ID")
    start_year = args.start_year or env_int("ESPN_START_YEAR")
    end_year = args.end_year or env_int("ESPN_END_YEAR")
    max_week = args.max_week or env_int("ESPN_MAX_WEEK", 18)
    output_dir = Path(args.output_dir or os.environ.get("ESPN_OUTPUT_DIR", "data/espn"))

    if end_year < start_year:
        raise SystemExit("ESPN_END_YEAR must be greater than or equal to ESPN_START_YEAR")

    return Config(
        league_id=league_id,
        swid=args.swid or env_required("ESPN_SWID"),
        espn_s2=args.espn_s2 or env_required("ESPN_S2"),
        start_year=start_year,
        end_year=end_year,
        max_week=max_week,
        output_dir=output_dir,
    )


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n")


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def espn_url(league_id: int, year: int, params: Dict[str, Any]) -> str:
    base = (
        "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/"
        f"leagueHistory/{league_id}"
    )
    query_items: List[tuple[str, Any]] = [("seasonId", year)]
    for key, value in params.items():
        if isinstance(value, list):
            query_items.extend((key, item) for item in value)
        else:
            query_items.append((key, value))
    return f"{base}?{urlencode(query_items)}"


def fetch_json(
    *,
    league_id: int,
    year: int,
    swid: str,
    espn_s2: str,
    params: Dict[str, Any],
    headers: Optional[Dict[str, str]] = None,
) -> Any:
    request_headers = {
        "Accept": "application/json",
        "Cookie": f"SWID={swid}; espn_s2={espn_s2}",
        "User-Agent": "cpffl-history-export/1.0",
    }
    if headers:
        request_headers.update(headers)

    request = Request(espn_url(league_id, year, params), headers=request_headers)
    with urlopen(request, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def unwrap_history_response(payload: Any) -> Any:
    if isinstance(payload, list) and len(payload) == 1:
        return payload[0]
    return payload


def fetch_raw_season(config: Config, year: int) -> Any:
    return unwrap_history_response(
        fetch_json(
            league_id=config.league_id,
            year=year,
            swid=config.swid,
            espn_s2=config.espn_s2,
            params={"view": DEFAULT_VIEWS},
        )
    )


def fetch_raw_week(config: Config, year: int, week: int) -> Any:
    return unwrap_history_response(
        fetch_json(
            league_id=config.league_id,
            year=year,
            swid=config.swid,
            espn_s2=config.espn_s2,
            params={
                "view": ["mMatchupScore", "mScoreboard"],
                "scoringPeriodId": week,
            },
        )
    )


def public_attrs(obj: Any) -> Dict[str, Any]:
    return {
        key: value
        for key, value in getattr(obj, "__dict__", {}).items()
        if not key.startswith("_") and not callable(value)
    }


def team_to_dict(team: Any) -> Dict[str, Any]:
    attrs = public_attrs(team)
    schedule = attrs.get("schedule", [])
    attrs["schedule"] = [getattr(opponent, "team_id", opponent) for opponent in schedule]
    return {key: to_jsonable(value) for key, value in attrs.items()}


def to_jsonable(value: Any, depth: int = 0, seen: Optional[set[int]] = None) -> Any:
    if seen is None:
        seen = set()

    if value is None or isinstance(value, (bool, int, float, str)):
        return value

    if depth > 8:
        return repr(value)

    if isinstance(value, Path):
        return str(value)

    if isinstance(value, dict):
        return {
            str(key): to_jsonable(item, depth + 1, seen)
            for key, item in value.items()
        }

    if isinstance(value, (list, tuple, set)):
        return [to_jsonable(item, depth + 1, seen) for item in value]

    obj_id = id(value)
    if obj_id in seen:
        if hasattr(value, "team_id"):
            return getattr(value, "team_id")
        if hasattr(value, "playerId"):
            return getattr(value, "playerId")
        return repr(value)

    seen.add(obj_id)
    try:
        if value.__class__.__name__ == "Team":
            return team_to_dict(value)

        attrs = public_attrs(value)
        if attrs:
            return {
                key: to_jsonable(item, depth + 1, seen)
                for key, item in attrs.items()
            }

        return repr(value)
    finally:
        seen.discard(obj_id)


def maybe_call(method: Any, *args: Any, **kwargs: Any) -> Dict[str, Any]:
    try:
        return {"ok": True, "data": to_jsonable(method(*args, **kwargs))}
    except Exception as exc:
        return {
            "ok": False,
            "error": f"{exc.__class__.__name__}: {exc}",
        }


def team_id(team: Any) -> Optional[int]:
    if team in (None, ""):
        return None
    if isinstance(team, int):
        return team
    return getattr(team, "team_id", None)


def compact_player(player: Any) -> Any:
    if player in (None, ""):
        return None
    if isinstance(player, (int, str)):
        return player

    return {
        "player_id": getattr(player, "playerId", None),
        "name": getattr(player, "name", None),
        "position": getattr(player, "position", None),
        "eligible_slots": getattr(player, "eligibleSlots", []),
        "lineup_slot": getattr(player, "lineupSlot", None),
        "slot_position": getattr(player, "slot_position", None),
        "pro_team": getattr(player, "proTeam", None),
        "pro_opponent": getattr(player, "pro_opponent", None),
        "points": getattr(player, "points", None),
        "projected_points": getattr(player, "projected_points", None),
        "total_points": getattr(player, "total_points", None),
        "avg_points": getattr(player, "avg_points", None),
        "injury_status": getattr(player, "injuryStatus", None),
    }


def compact_team(team: Any, include_roster: bool = True) -> Dict[str, Any]:
    payload = {
        "team_id": getattr(team, "team_id", None),
        "abbrev": getattr(team, "team_abbrev", None),
        "name": getattr(team, "team_name", None),
        "division_id": getattr(team, "division_id", None),
        "division_name": getattr(team, "division_name", None),
        "wins": getattr(team, "wins", None),
        "losses": getattr(team, "losses", None),
        "ties": getattr(team, "ties", None),
        "points_for": getattr(team, "points_for", None),
        "points_against": getattr(team, "points_against", None),
        "standing": getattr(team, "standing", None),
        "final_standing": getattr(team, "final_standing", None),
        "logo_url": getattr(team, "logo_url", None),
        "owners": to_jsonable(getattr(team, "owners", [])),
        "schedule": [team_id(opponent) for opponent in getattr(team, "schedule", [])],
        "scores": getattr(team, "scores", []),
        "outcomes": getattr(team, "outcomes", []),
        "mov": getattr(team, "mov", []),
        "transactions": {
            "acquisitions": getattr(team, "acquisitions", 0),
            "acquisition_budget_spent": getattr(team, "acquisition_budget_spent", 0),
            "drops": getattr(team, "drops", 0),
            "trades": getattr(team, "trades", 0),
            "move_to_ir": getattr(team, "move_to_ir", 0),
        },
    }
    if include_roster:
        payload["roster"] = [
            compact_player(player) for player in getattr(team, "roster", [])
        ]
    return payload


def compact_matchup(matchup: Any) -> Dict[str, Any]:
    return {
        "matchup_type": getattr(matchup, "matchup_type", None),
        "is_playoff": getattr(matchup, "is_playoff", None),
        "home_team_id": team_id(getattr(matchup, "home_team", None))
        or getattr(matchup, "_home_team_id", None),
        "away_team_id": team_id(getattr(matchup, "away_team", None))
        or getattr(matchup, "_away_team_id", None),
        "home_score": getattr(matchup, "home_score", None),
        "away_score": getattr(matchup, "away_score", None),
    }


def compact_box_score(box_score: Any) -> Dict[str, Any]:
    return {
        "matchup_type": getattr(box_score, "matchup_type", None),
        "is_playoff": getattr(box_score, "is_playoff", None),
        "home_team_id": team_id(getattr(box_score, "home_team", None)),
        "away_team_id": team_id(getattr(box_score, "away_team", None)),
        "home_score": getattr(box_score, "home_score", None),
        "away_score": getattr(box_score, "away_score", None),
        "home_projected": getattr(box_score, "home_projected", None),
        "away_projected": getattr(box_score, "away_projected", None),
        "home_lineup": [
            compact_player(player) for player in getattr(box_score, "home_lineup", [])
        ],
        "away_lineup": [
            compact_player(player) for player in getattr(box_score, "away_lineup", [])
        ],
    }


def compact_transaction(transaction: Any) -> Dict[str, Any]:
    return {
        "team_id": team_id(getattr(transaction, "team", None)),
        "type": getattr(transaction, "type", None),
        "status": getattr(transaction, "status", None),
        "scoring_period": getattr(transaction, "scoring_period", None),
        "date": getattr(transaction, "date", None),
        "bid_amount": getattr(transaction, "bid_amount", None),
        "items": [
            {
                "type": getattr(item, "type", None),
                "player_id": getattr(item, "playerId", None),
                "player": getattr(item, "player", None),
            }
            for item in getattr(transaction, "items", [])
        ],
    }


def compact_activity(activity: Any) -> Dict[str, Any]:
    actions = []
    for action in getattr(activity, "actions", []):
        team, action_type, player, bid_amount = (list(action) + [None] * 4)[:4]
        actions.append(
            {
                "team_id": team_id(team),
                "action": action_type,
                "player": compact_player(player),
                "bid_amount": bid_amount,
            }
        )

    return {
        "date": getattr(activity, "date", None),
        "actions": actions,
    }


def compact_draft_pick(pick: Any) -> Dict[str, Any]:
    payload = {}
    for key, value in public_attrs(pick).items():
        if key in {"team", "team_id", "nominatingTeam", "nominating_team"}:
            payload[key] = team_id(value) or value
        elif key in {"player", "keeper_status"}:
            payload[key] = compact_player(value)
        elif key == "playerPoolEntry":
            continue
        else:
            payload[key] = to_jsonable(value)
    return payload


def maybe_compact(method: Any, serializer: Any, *args: Any, **kwargs: Any) -> Dict[str, Any]:
    try:
        result = method(*args, **kwargs)
        if isinstance(result, list):
            data = [serializer(item) for item in result]
        else:
            data = serializer(result)
        return {"ok": True, "data": data}
    except Exception as exc:
        return {
            "ok": False,
            "error": f"{exc.__class__.__name__}: {exc}",
        }


def collect_recent_activity(
    league: Any,
    page_size: int = 100,
    max_items: int = 500,
) -> Dict[str, Any]:
    activities = []
    for offset in range(0, max_items, page_size):
        result = maybe_compact(
            league.recent_activity,
            compact_activity,
            size=page_size,
            offset=offset,
        )
        if not result["ok"]:
            if activities:
                return {
                    "ok": True,
                    "data": activities,
                    "warning": result["error"],
                }
            return result

        batch = result["data"]
        if not batch:
            break

        activities.extend(batch)
        if len(batch) < page_size:
            break

    return {"ok": True, "data": activities}


def build_structured_season(config: Config, year: int) -> Dict[str, Any]:
    try:
        from espn_api.football import League
    except ImportError as exc:
        raise SystemExit(
            "Missing dependency: espn-api. Run `pip install -r requirements.txt`."
        ) from exc

    league = League(
        league_id=config.league_id,
        year=year,
        espn_s2=config.espn_s2,
        swid=config.swid,
    )

    final_week = int(
        getattr(league, "finalScoringPeriod", 0)
        or getattr(getattr(league, "settings", None), "finalScoringPeriod", 0)
        or config.max_week
    )
    final_week = max(1, min(final_week, config.max_week))

    weeks = []
    for week in range(1, final_week + 1):
        weeks.append(
            {
                "week": week,
                "scoreboard": maybe_compact(league.scoreboard, compact_matchup, week),
                "box_scores": maybe_compact(
                    league.box_scores,
                    compact_box_score,
                    week,
                ),
                "transactions": maybe_compact(
                    league.transactions,
                    compact_transaction,
                    scoring_period=week,
                    types=TRANSACTION_TYPES,
                ),
            }
        )

    return {
        "league_id": config.league_id,
        "year": year,
        "exported_at": now_iso(),
        "settings": to_jsonable(getattr(league, "settings", None)),
        "teams": [compact_team(team) for team in getattr(league, "teams", [])],
        "draft": [compact_draft_pick(pick) for pick in getattr(league, "draft", [])],
        "standings": maybe_compact(
            league.standings,
            lambda team: compact_team(team, include_roster=False),
        ),
        "weeks": weeks,
        "recent_activity": collect_recent_activity(league),
    }


def export_year(config: Config, year: int, raw_only: bool) -> Dict[str, Any]:
    season_dir = config.output_dir / "seasons" / str(year)
    result = {
        "year": year,
        "ok": True,
        "errors": [],
        "paths": {},
    }

    try:
        raw = fetch_raw_season(config, year)
        raw_path = season_dir / "raw_league.json"
        write_json(raw_path, raw)
        result["paths"]["raw_league"] = str(raw_path)
    except Exception as exc:
        result["ok"] = False
        result["errors"].append(f"raw_league: {exc.__class__.__name__}: {exc}")

    for week in range(1, config.max_week + 1):
        try:
            weekly = fetch_raw_week(config, year, week)
            week_path = season_dir / "weeks" / f"{week:02d}.json"
            write_json(week_path, weekly)
        except Exception as exc:
            result["errors"].append(
                f"week {week:02d}: {exc.__class__.__name__}: {exc}"
            )
            break

    result["paths"]["raw_weeks"] = str(season_dir / "weeks")

    if not raw_only:
        try:
            structured = build_structured_season(config, year)
            structured_path = season_dir / "structured.json"
            write_json(structured_path, structured)
            result["paths"]["structured"] = str(structured_path)
        except Exception as exc:
            result["ok"] = False
            result["errors"].append(f"structured: {exc.__class__.__name__}: {exc}")

    return result


def build_manifest(config: Config, seasons: Iterable[Dict[str, Any]]) -> Dict[str, Any]:
    return {
        "league_id": config.league_id,
        "exported_at": now_iso(),
        "start_year": config.start_year,
        "end_year": config.end_year,
        "max_week": config.max_week,
        "seasons": list(seasons),
    }


def parse_args(argv: List[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export ESPN fantasy football league history to JSON."
    )
    parser.add_argument("--env-file", default=".env")
    parser.add_argument("--league-id", type=int)
    parser.add_argument("--swid")
    parser.add_argument("--espn-s2")
    parser.add_argument("--start-year", type=int)
    parser.add_argument("--end-year", type=int)
    parser.add_argument("--max-week", type=int)
    parser.add_argument("--output-dir")
    parser.add_argument(
        "--raw-only",
        action="store_true",
        help="Skip espn-api object export and only write raw ESPN JSON.",
    )
    return parser.parse_args(argv)


def main(argv: List[str]) -> int:
    args = parse_args(argv)
    config = load_config(args)

    print(
        f"Exporting league {config.league_id} seasons "
        f"{config.start_year}-{config.end_year} to {config.output_dir}",
        flush=True,
    )

    season_results = []
    for year in range(config.start_year, config.end_year + 1):
        print(f"Exporting {year}...", flush=True)
        season_results.append(export_year(config, year, raw_only=args.raw_only))

    manifest = build_manifest(config, season_results)
    write_json(config.output_dir / "manifest.json", manifest)

    failures = [season for season in season_results if not season["ok"]]
    if failures:
        print(f"Export finished with {len(failures)} failed season(s).", file=sys.stderr)
        return 1

    print("Export complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
