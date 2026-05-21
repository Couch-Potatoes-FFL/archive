import { ColumnDef } from "@tanstack/react-table";
import {
  ArrowRight,
  CalendarDays,
  Database,
  Home,
  Search,
  Shield,
  Trophy,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  Link,
  NavLink,
  Route,
  Routes,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { formatDate, formatNumber, teamDisplay } from "./data";
import { SimpleTable } from "./SimpleTable";
import {
  ArchiveManifest,
  DraftPick,
  Matchup,
  PublicSeason,
  PublicTeam,
  PublicWeek,
  LineupPlayer,
  SearchRow,
  SearchType,
  Transaction,
} from "./types";
import { useArchiveJson } from "./useArchiveJson";

type BrowserFilterType = SearchType | "all";

type BrowserFilters = {
  query: string;
  type: BrowserFilterType;
  year: string;
};

const defaultFilters: BrowserFilters = {
  query: "",
  type: "all",
  year: "all",
};

const recordTypeOptions: Array<{ value: BrowserFilterType; label: string }> = [
  { value: "all", label: "All record types" },
  { value: "season", label: "Seasons" },
  { value: "team", label: "Teams" },
  { value: "week", label: "Weeks" },
  { value: "matchup", label: "Matchups" },
  { value: "transaction", label: "Transactions" },
  { value: "draft", label: "Draft" },
  { value: "player", label: "Players" },
];

const starterSlotOrder = new Map(
  [
    "QB",
    "RB",
    "RB/WR",
    "WR",
    "TE",
    "RB/WR/TE",
    "OP",
    "D/ST",
    "K",
    "HC",
  ].map((slot, index) => [slot, index]),
);

const dataCategories: Array<{
  title: string;
  label: string;
  to: string;
  icon: React.ReactNode;
}> = [
  {
    title: "Full Archive Search",
    label: "Search teams, players, matchups, transactions, drafts, and seasons.",
    to: "/browse",
    icon: <Search size={20} aria-hidden />,
  },
  {
    title: "Season Pages",
    label: "Open season summaries, standings, draft data, settings, and week links.",
    to: "/browse?type=season",
    icon: <Trophy size={20} aria-hidden />,
  },
  {
    title: "Weekly Results",
    label: "Jump into weekly scoreboards, box scores, and transaction logs.",
    to: "/browse?type=week",
    icon: <CalendarDays size={20} aria-hidden />,
  },
  {
    title: "Teams",
    label: "Find team records, owners, standings rows, and related season entries.",
    to: "/browse?type=team",
    icon: <Shield size={20} aria-hidden />,
  },
  {
    title: "Players",
    label: "Search player rows across lineups, transactions, and draft records.",
    to: "/browse?type=player",
    icon: <Search size={20} aria-hidden />,
  },
  {
    title: "Matchups",
    label: "Browse historical head-to-head records by season and week.",
    to: "/browse?type=matchup",
    icon: <Database size={20} aria-hidden />,
  },
  {
    title: "Transactions",
    label: "Review waiver, roster, and trade records from the archive.",
    to: "/browse?type=transaction",
    icon: <ArrowRight size={20} aria-hidden />,
  },
  {
    title: "Draft",
    label: "Find historical draft picks, nominations, bids, and keepers.",
    to: "/browse?type=draft",
    icon: <Database size={20} aria-hidden />,
  },
];

const searchColumns: ColumnDef<SearchRow>[] = [
  {
    header: "Type",
    accessorKey: "type",
    cell: ({ row }) => <span className="pill">{row.original.type}</span>,
  },
  {
    header: "Season",
    accessorKey: "year",
  },
  {
    header: "Week",
    accessorKey: "week",
    cell: ({ row }) => row.original.week ?? "-",
  },
  {
    header: "Record",
    accessorKey: "label",
    cell: ({ row }) => <Link to={row.original.href}>{row.original.label}</Link>,
  },
  {
    header: "Summary",
    accessorKey: "summary",
  },
];

const draftSearchColumns: ColumnDef<SearchRow>[] = [
  searchColumns[0],
  searchColumns[1],
  searchColumns[2],
  searchColumns[3],
  {
    header: "Bid",
    accessorKey: "bidAmount",
    cell: ({ row }) =>
      typeof row.original.bidAmount === "number"
        ? `$${formatNumber(row.original.bidAmount)}`
        : "-",
  },
  searchColumns[4],
];

function App() {
  return (
    <div className="appShell">
      <header className="topBar">
        <Link className="brand" to="/">
          <Shield size={24} aria-hidden />
          <span>CPFFL Archive</span>
        </Link>
        <nav aria-label="Primary navigation">
          <NavLink to="/" end>
            <Home size={16} aria-hidden />
            Data Types
          </NavLink>
          <NavLink to="/browse">
            <Search size={16} aria-hidden />
            Browse
          </NavLink>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<DataLandingPage />} />
          <Route path="/browse" element={<BrowserPage />} />
          <Route path="/season/:year" element={<SeasonPage />} />
          <Route path="/season/:year/week/:week" element={<WeekPage />} />
        </Routes>
      </main>
    </div>
  );
}

function DataLandingPage() {
  const manifest = useArchiveJson<ArchiveManifest>("manifest.json");

  if (manifest.status === "loading") {
    return <StatusPanel label="Loading archive summary..." />;
  }

  if (manifest.status === "error") {
    return <StatusPanel label="Unable to load archive data." tone="danger" />;
  }

  const years = manifest.data.seasons.map((season) => season.year);
  const latestSeason = Math.max(...years);
  const weekCount = manifest.data.seasons.reduce(
    (total, season) => total + season.weekCount,
    0,
  );

  return (
    <>
      <section className="pageIntro">
        <div>
          <p className="eyebrow">Choose a data view</p>
          <h1>CPFFL Archive</h1>
        </div>
        <div className="statRail">
          <Metric
            icon={<CalendarDays size={18} />}
            label="Seasons"
            value={String(manifest.data.seasons.length)}
          />
          <Metric
            icon={<Database size={18} />}
            label="Weeks"
            value={formatNumber(weekCount)}
          />
          <Metric
            icon={<Trophy size={18} />}
            label="Latest"
            value={String(latestSeason)}
          />
        </div>
      </section>

      <section className="categoryGrid" aria-label="Archive data categories">
        {dataCategories.map((category) => (
          <Link className="categoryButton" key={category.title} to={category.to}>
            <span className="categoryIcon">{category.icon}</span>
            <span>
              <strong>{category.title}</strong>
              <small>{category.label}</small>
            </span>
            <ArrowRight size={18} aria-hidden />
          </Link>
        ))}
      </section>
    </>
  );
}

function BrowserPage() {
  const manifest = useArchiveJson<ArchiveManifest>("manifest.json");
  const index = useArchiveJson<SearchRow[]>("search-index.json");
  const [searchParams, setSearchParams] = useSearchParams();
  const searchParamString = searchParams.toString();
  const [draftFilters, setDraftFilters] = useState<BrowserFilters>(() =>
    filtersFromSearchParams(searchParams),
  );
  const [appliedFilters, setAppliedFilters] = useState<BrowserFilters>(() =>
    filtersFromSearchParams(searchParams),
  );

  useEffect(() => {
    const nextFilters = filtersFromSearchParams(
      new URLSearchParams(searchParamString),
    );
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
  }, [searchParamString]);

  const years = useMemo(
    () =>
      manifest.status === "loaded"
        ? manifest.data.seasons.map((season) => season.year)
        : [],
    [manifest],
  );

  const filteredRows = useMemo(() => {
    if (index.status !== "loaded") {
      return [];
    }

    const normalizedQuery = appliedFilters.query.trim().toLowerCase();

    if (
      normalizedQuery.length === 0 &&
      appliedFilters.type === "all" &&
      appliedFilters.year === "all"
    ) {
      return index.data;
    }

    return index.data.filter((row) => {
      const matchesType =
        appliedFilters.type === "all" || row.type === appliedFilters.type;
      const matchesYear =
        appliedFilters.year === "all" || row.year === Number(appliedFilters.year);
      if (!matchesType || !matchesYear) {
        return false;
      }

      const haystack = `${row.label} ${row.summary} ${row.playerName ?? ""}`;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        haystack.toLowerCase().includes(normalizedQuery);

      return matchesType && matchesYear && matchesQuery;
    });
  }, [appliedFilters, index]);

  if (manifest.status === "loading" || index.status === "loading") {
    return <StatusPanel label="Loading archive index..." />;
  }

  if (manifest.status === "error" || index.status === "error") {
    return <StatusPanel label="Unable to load archive data." tone="danger" />;
  }

  const hasPendingFilters = !filtersMatch(draftFilters, appliedFilters);
  const resultColumns =
    appliedFilters.type === "draft" ? draftSearchColumns : searchColumns;

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextFilters = normalizeFilters(draftFilters);
    setAppliedFilters(nextFilters);
    setSearchParams(paramsFromFilters(nextFilters));
  }

  function clearFilters() {
    setDraftFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
    setSearchParams({});
  }

  return (
    <>
      <section className="pageIntro">
        <div>
          <p className="eyebrow">Historical fantasy football data</p>
          <h1>League Archive Browser</h1>
        </div>
        <div className="statRail">
          <Metric
            icon={<CalendarDays size={18} />}
            label="Seasons"
            value={String(manifest.data.seasons.length)}
          />
          <Metric
            icon={<Database size={18} />}
            label="Indexed rows"
            value={formatNumber(index.data.length)}
          />
          <Metric
            icon={<Trophy size={18} />}
            label="Latest"
            value={String(Math.max(...years))}
          />
        </div>
      </section>

      <form className="controlBand" aria-label="Archive filters" onSubmit={applyFilters}>
        <label className="searchField">
          <Search size={18} aria-hidden />
          <input
            value={draftFilters.query}
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                query: event.target.value,
              }))
            }
            placeholder="Search teams, players, matchups, transactions"
          />
        </label>
        <select
          value={draftFilters.year}
          onChange={(event) =>
            setDraftFilters((current) => ({
              ...current,
              year: event.target.value,
            }))
          }
        >
          <option value="all">All seasons</option>
          {years.map((seasonYear) => (
            <option key={seasonYear} value={seasonYear}>
              {seasonYear}
            </option>
          ))}
        </select>
        <select
          value={draftFilters.type}
          onChange={(event) =>
            setDraftFilters((current) => ({
              ...current,
              type: event.target.value as BrowserFilterType,
            }))
          }
        >
          {recordTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="filterActions">
          <button className="primaryButton" type="submit">
            <Search size={16} aria-hidden />
            Update
          </button>
          <button className="ghostButton" type="button" onClick={clearFilters}>
            Clear
          </button>
        </div>
      </form>

      <section className="contentBand">
        <div className="sectionHeader">
          <h2>Results</h2>
          <span className={hasPendingFilters ? "pendingNote active" : "pendingNote"}>
            {hasPendingFilters
              ? "Filter changes pending"
              : `${formatNumber(filteredRows.length)} matching rows`}
          </span>
        </div>
        <SimpleTable data={filteredRows} columns={resultColumns} />
      </section>
    </>
  );
}

function SeasonPage() {
  const { year = "" } = useParams();
  const season = useArchiveJson<PublicSeason>(`seasons/${year}.json`);
  const [search, setSearch] = useState("");

  if (season.status === "loading") {
    return <StatusPanel label="Loading season..." />;
  }

  if (season.status === "error") {
    return <StatusPanel label="Unable to load this season." tone="danger" />;
  }

  const champion = [...season.data.standings].sort(
    (a, b) => (a.finalStanding ?? 999) - (b.finalStanding ?? 999),
  )[0];

  const teamNames = teamNameMap(season.data.teams);
  const standingsColumns: ColumnDef<PublicTeam>[] = [
    {
      header: "Finish",
      accessorKey: "finalStanding",
      cell: ({ row }) => row.original.finalStanding ?? "-",
    },
    {
      header: "Team",
      accessorKey: "name",
      cell: ({ row }) => <TeamLabel team={row.original} />,
    },
    {
      header: "Owner",
      accessorFn: (team) => team.ownerNames.join(", "),
    },
    {
      header: "W",
      accessorKey: "wins",
    },
    {
      header: "L",
      accessorKey: "losses",
    },
    {
      header: "PF",
      accessorKey: "pointsFor",
      cell: ({ row }) => formatNumber(row.original.pointsFor),
    },
    {
      header: "PA",
      accessorKey: "pointsAgainst",
      cell: ({ row }) => formatNumber(row.original.pointsAgainst),
    },
    {
      header: "Moves",
      accessorFn: (team) => team.transactions.acquisitions,
    },
  ];

  const draftColumns: ColumnDef<DraftPick>[] = [
    { header: "Pick", accessorKey: "pick" },
    { header: "Round", accessorKey: "round" },
    {
      header: "Team",
      accessorKey: "teamKey",
      cell: ({ row }) => teamDisplay(row.original.teamKey, teamNames),
    },
    { header: "Player", accessorKey: "playerName" },
    {
      header: "Bid",
      accessorKey: "bidAmount",
      cell: ({ row }) => row.original.bidAmount ?? "-",
    },
  ];

  return (
    <>
      <section className="pageIntro">
        <div>
          <p className="eyebrow">{season.data.settings.name}</p>
          <h1>{season.data.year} Season</h1>
        </div>
        <div className="statRail">
          <Metric
            icon={<Trophy size={18} />}
            label="Champion"
            value={champion?.name ?? "-"}
          />
          <Metric
            icon={<Database size={18} />}
            label="Teams"
            value={String(season.data.settings.teamCount)}
          />
          <Metric
            icon={<CalendarDays size={18} />}
            label="Weeks"
            value={String(season.data.weeks.length)}
          />
        </div>
      </section>

      <section className="contentGrid">
        <div className="panel">
          <h2>Settings</h2>
          <dl className="definitionGrid">
            <div>
              <dt>Scoring</dt>
              <dd>{season.data.settings.scoringType ?? "-"}</dd>
            </div>
            <div>
              <dt>Regular season</dt>
              <dd>{season.data.settings.regSeasonCount ?? "-"} weeks</dd>
            </div>
            <div>
              <dt>Playoff teams</dt>
              <dd>{season.data.settings.playoffTeamCount ?? "-"}</dd>
            </div>
            <div>
              <dt>Divisions</dt>
              <dd>{season.data.settings.divisions.join(", ") || "-"}</dd>
            </div>
          </dl>
        </div>
        <div className="panel">
          <h2>Weeks</h2>
          <div className="weekGrid">
            {season.data.weeks.map((week) => (
              <Link key={week.week} className="weekTile" to={week.href}>
                <span>Week {week.week}</span>
                <small>
                  {week.scoreboardCount} games, {week.transactionCount} moves
                </small>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="contentBand">
        <div className="sectionHeader">
          <h2>Standings</h2>
          <label className="compactSearch">
            <Search size={16} aria-hidden />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filter standings"
            />
          </label>
        </div>
        <SimpleTable
          data={season.data.standings}
          columns={standingsColumns}
          search={search}
        />
      </section>

      <section className="contentBand">
        <div className="sectionHeader">
          <h2>Draft</h2>
        </div>
        <SimpleTable data={season.data.draft} columns={draftColumns} />
      </section>
    </>
  );
}

function WeekPage() {
  const { year = "", week = "" } = useParams();
  const season = useArchiveJson<PublicSeason>(`seasons/${year}.json`);
  const weekData = useArchiveJson<PublicWeek>(`seasons/${year}/weeks/${week}.json`);

  if (season.status === "loading" || weekData.status === "loading") {
    return <StatusPanel label="Loading week..." />;
  }

  if (season.status === "error" || weekData.status === "error") {
    return <StatusPanel label="Unable to load this week." tone="danger" />;
  }

  const teamNames = teamNameMap(season.data.teams);
  const matchupColumns: ColumnDef<Matchup>[] = [
    {
      header: "Away",
      accessorKey: "awayTeamKey",
      cell: ({ row }) => teamDisplay(row.original.awayTeamKey, teamNames),
    },
    {
      header: "Away score",
      accessorKey: "awayScore",
      cell: ({ row }) => formatNumber(row.original.awayScore),
    },
    {
      header: "Home",
      accessorKey: "homeTeamKey",
      cell: ({ row }) => teamDisplay(row.original.homeTeamKey, teamNames),
    },
    {
      header: "Home score",
      accessorKey: "homeScore",
      cell: ({ row }) => formatNumber(row.original.homeScore),
    },
    {
      header: "Winner",
      accessorKey: "winnerTeamKey",
      cell: ({ row }) => teamDisplay(row.original.winnerTeamKey, teamNames),
    },
  ];

  const transactionColumns: ColumnDef<Transaction>[] = [
    {
      header: "Date",
      accessorKey: "date",
      cell: ({ row }) => formatDate(row.original.date),
    },
    {
      header: "Team",
      accessorKey: "teamKey",
      cell: ({ row }) => teamDisplay(row.original.teamKey, teamNames),
    },
    { header: "Type", accessorKey: "type" },
    { header: "Status", accessorKey: "status" },
    {
      header: "Players",
      accessorFn: (transaction) =>
        transaction.items.map((item) => `${item.type}: ${item.player}`).join(", "),
    },
  ];

  return (
    <>
      <section className="pageIntro">
        <div>
          <p className="eyebrow">{season.data.year} Season</p>
          <h1>Week {weekData.data.week}</h1>
        </div>
        <div className="statRail">
          <Metric
            icon={<Database size={18} />}
            label="Games"
            value={String(weekData.data.scoreboard.length)}
          />
          <Metric
            icon={<CalendarDays size={18} />}
            label="Box scores"
            value={String(weekData.data.boxScores.length)}
          />
          <Metric
            icon={<Search size={18} />}
            label="Transactions"
            value={String(weekData.data.transactions.length)}
          />
        </div>
      </section>

      <section className="contentBand">
        <div className="sectionHeader">
          <h2>Scoreboard</h2>
        </div>
        <SimpleTable data={weekData.data.scoreboard} columns={matchupColumns} />
      </section>

      <section className="contentBand">
        <div className="sectionHeader">
          <h2>Box Scores</h2>
        </div>
        {weekData.data.boxScores.length ? (
          <div className="boxScoreList">
            {weekData.data.boxScores.map((boxScore) => (
              <article className="boxScore" key={boxScore.matchupKey}>
                <h3>
                  {teamDisplay(boxScore.awayTeamKey, teamNames)} at{" "}
                  {teamDisplay(boxScore.homeTeamKey, teamNames)}
                </h3>
                <div className="lineupColumns">
                  <LineupTable
                    title={teamDisplay(boxScore.awayTeamKey, teamNames)}
                    players={boxScore.awayLineup}
                  />
                  <LineupTable
                    title={teamDisplay(boxScore.homeTeamKey, teamNames)}
                    players={boxScore.homeLineup}
                  />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="emptyNote">Box scores are not available for this week.</p>
        )}
      </section>

      <section className="contentBand">
        <div className="sectionHeader">
          <h2>Transactions</h2>
        </div>
        <SimpleTable
          data={weekData.data.transactions}
          columns={transactionColumns}
        />
      </section>

      <section className="contentBand">
        <details className="jsonDetails">
          <summary>Sanitized JSON</summary>
          <pre>{JSON.stringify(weekData.data, null, 2)}</pre>
        </details>
      </section>
    </>
  );
}

function LineupTable({
  title,
  players,
}: {
  title: string;
  players: PublicWeek["boxScores"][number]["homeLineup"];
}) {
  const starterRows = orderLineupPlayers(
    players.filter((player) => lineupSection(player) === "starter"),
  );
  const benchRows = orderLineupPlayers(
    players.filter((player) => lineupSection(player) === "bench"),
  );
  const irRows = orderLineupPlayers(
    players.filter((player) => lineupSection(player) === "ir"),
  );

  return (
    <div className="lineupTable">
      <h4>{title}</h4>
      <div className="lineupScroll">
        <table className="boxScoreTable">
          <thead>
            <tr>
              <th>Slot</th>
              <th>Player, Team Pos</th>
              <th>Opp</th>
              <th>Proj</th>
              <th>FPTS</th>
            </tr>
          </thead>
          <tbody>
            {starterRows.map((player, index) => (
              <LineupRow player={player} key={lineupRowKey(player, index)} />
            ))}
            {starterRows.length ? (
              <LineupSummaryRow label="Starters Total" players={starterRows} />
            ) : null}
            {benchRows.map((player, index) => (
              <LineupRow player={player} key={lineupRowKey(player, index)} />
            ))}
            {benchRows.length ? (
              <LineupSummaryRow label="Bench Total" players={benchRows} />
            ) : null}
            {irRows.map((player, index) => (
              <LineupRow player={player} key={lineupRowKey(player, index)} />
            ))}
            {!players.length ? (
              <tr>
                <td className="emptyCell" colSpan={5}>
                  No lineup players found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LineupRow({
  player,
}: {
  player: LineupPlayer;
}) {
  const injuryLabel = displayInjuryStatus(player.injuryStatus);
  const section = lineupSection(player);

  return (
    <tr className={`boxScorePlayerRow ${section}`}>
      <td className="slotCell">{displayLineupSlot(player)}</td>
      <td className="playerCell">
        <span className="lineupPlayerName">
          <strong>{player.name}</strong>
          {injuryLabel ? (
            <span className="injuryBadge" title={player.injuryStatus}>
              {injuryLabel}
            </span>
          ) : null}
        </span>
        <small>
          {player.proTeam ?? "-"} {player.position ?? "-"}
        </small>
      </td>
      <td>{player.proOpponent ?? "-"}</td>
      <td className="numberCell">{formatNumber(player.projectedPoints, 1)}</td>
      <td className="numberCell">{formatNumber(player.points, 1)}</td>
    </tr>
  );
}

function LineupSummaryRow({
  label,
  players,
}: {
  label: string;
  players: LineupPlayer[];
}) {
  return (
    <tr className="lineupSummaryRow">
      <td colSpan={3}>{label}</td>
      <td className="numberCell">
        {formatNumber(sumLineupValue(players, "projectedPoints"), 1)}
      </td>
      <td className="numberCell">
        {formatNumber(sumLineupValue(players, "points"), 1)}
      </td>
    </tr>
  );
}

function orderLineupPlayers(players: LineupPlayer[]): LineupPlayer[] {
  return [...players].sort((left, right) => {
    const leftSlot = rawLineupSlot(left);
    const rightSlot = rawLineupSlot(right);
    const leftOrder = starterSlotOrder.get(leftSlot) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = starterSlotOrder.get(rightSlot) ?? Number.MAX_SAFE_INTEGER;

    return leftOrder - rightOrder;
  });
}

function lineupSection(player: LineupPlayer): "starter" | "bench" | "ir" {
  const slot = rawLineupSlot(player);

  if (slot === "IR") {
    return "ir";
  }
  if (slot === "BE") {
    return "bench";
  }
  return "starter";
}

function rawLineupSlot(player: LineupPlayer): string {
  return player.lineupSlot ?? player.slotPosition ?? "";
}

function displayLineupSlot(player: LineupPlayer): string {
  const slot = rawLineupSlot(player);

  if (slot === "RB/WR/TE") {
    return "FLEX";
  }
  if (slot === "BE") {
    return "Bench";
  }
  return slot || "-";
}

function displayInjuryStatus(status: string | undefined): string | undefined {
  if (!status) {
    return undefined;
  }

  const normalized = status.toUpperCase();
  if (normalized === "ACTIVE" || normalized === "NORMAL") {
    return undefined;
  }

  const labels: Record<string, string> = {
    QUESTIONABLE: "Q",
    DOUBTFUL: "D",
    OUT: "O",
    INJURED_RESERVE: "IR",
    SUSPENSION: "S",
  };

  return labels[normalized] ?? normalized[0];
}

function sumLineupValue(
  players: LineupPlayer[],
  field: "points" | "projectedPoints",
): number {
  return players.reduce((total, player) => {
    const value = player[field];
    return typeof value === "number" && Number.isFinite(value) ? total + value : total;
  }, 0);
}

function lineupRowKey(player: LineupPlayer, index: number): string {
  return `${rawLineupSlot(player)}-${player.name}-${index}`;
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="metric">
      <span className="metricIcon">{icon}</span>
      <span>
        <small>{label}</small>
        <strong>{value}</strong>
      </span>
    </div>
  );
}

function StatusPanel({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "danger";
}) {
  return <section className={`statusPanel ${tone}`}>{label}</section>;
}

function TeamLabel({ team }: { team: PublicTeam }) {
  return (
    <span className="teamLabel">
      {team.logoUrl ? <img src={team.logoUrl} alt="" loading="lazy" /> : null}
      <span>
        <strong>{team.name}</strong>
        <small>{team.abbrev}</small>
      </span>
    </span>
  );
}

function teamNameMap(teams: PublicTeam[]): Map<string, string> {
  return new Map(teams.map((team) => [team.key, team.name]));
}

function filtersFromSearchParams(searchParams: URLSearchParams): BrowserFilters {
  const type = searchParams.get("type");

  return normalizeFilters({
    query: searchParams.get("q") ?? "",
    type: isBrowserFilterType(type) ? type : "all",
    year: searchParams.get("year") ?? "all",
  });
}

function paramsFromFilters(filters: BrowserFilters): URLSearchParams {
  const params = new URLSearchParams();
  const normalizedFilters = normalizeFilters(filters);

  if (normalizedFilters.query) {
    params.set("q", normalizedFilters.query);
  }
  if (normalizedFilters.type !== "all") {
    params.set("type", normalizedFilters.type);
  }
  if (normalizedFilters.year !== "all") {
    params.set("year", normalizedFilters.year);
  }

  return params;
}

function normalizeFilters(filters: BrowserFilters): BrowserFilters {
  const query = filters.query.trim();
  const type = isBrowserFilterType(filters.type) ? filters.type : "all";
  const year =
    filters.year === "all" || /^\d{4}$/.test(filters.year) ? filters.year : "all";

  return { query, type, year };
}

function isBrowserFilterType(value: unknown): value is BrowserFilterType {
  return (
    typeof value === "string" &&
    recordTypeOptions.some((option) => option.value === value)
  );
}

function filtersMatch(left: BrowserFilters, right: BrowserFilters): boolean {
  const normalizedLeft = normalizeFilters(left);
  const normalizedRight = normalizeFilters(right);

  return (
    normalizedLeft.query === normalizedRight.query &&
    normalizedLeft.type === normalizedRight.type &&
    normalizedLeft.year === normalizedRight.year
  );
}

export default App;
