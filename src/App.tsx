import { ColumnDef } from "@tanstack/react-table";
import {
  CalendarDays,
  Database,
  Home,
  Search,
  Shield,
  Trophy,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, NavLink, Route, Routes, useParams } from "react-router-dom";
import { formatDate, formatNumber, teamDisplay } from "./data";
import { SimpleTable } from "./SimpleTable";
import {
  ArchiveManifest,
  DraftPick,
  Matchup,
  PublicSeason,
  PublicTeam,
  PublicWeek,
  SearchRow,
  Transaction,
} from "./types";
import { useArchiveJson } from "./useArchiveJson";

function App() {
  return (
    <div className="appShell">
      <header className="topBar">
        <Link className="brand" to="/">
          <Shield size={24} aria-hidden />
          <span>CPFFL Archive</span>
        </Link>
        <nav aria-label="Primary navigation">
          <NavLink to="/">
            <Home size={16} aria-hidden />
            Search
          </NavLink>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/season/:year" element={<SeasonPage />} />
          <Route path="/season/:year/week/:week" element={<WeekPage />} />
        </Routes>
      </main>
    </div>
  );
}

function HomePage() {
  const manifest = useArchiveJson<ArchiveManifest>("manifest.json");
  const index = useArchiveJson<SearchRow[]>("search-index.json");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [year, setYear] = useState("all");

  if (manifest.status === "loading" || index.status === "loading") {
    return <StatusPanel label="Loading archive index..." />;
  }

  if (manifest.status === "error" || index.status === "error") {
    return <StatusPanel label="Unable to load archive data." tone="danger" />;
  }

  const years = manifest.data.seasons.map((season) => season.year);
  const filteredRows = index.data.filter((row) => {
    const matchesType = type === "all" || row.type === type;
    const matchesYear = year === "all" || row.year === Number(year);
    const haystack = `${row.label} ${row.summary} ${row.playerName ?? ""}`;
    const matchesQuery = haystack.toLowerCase().includes(query.toLowerCase());
    return matchesType && matchesYear && matchesQuery;
  });

  const columns: ColumnDef<SearchRow>[] = [
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

      <section className="controlBand" aria-label="Archive filters">
        <label className="searchField">
          <Search size={18} aria-hidden />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search teams, players, matchups, transactions"
          />
        </label>
        <select value={year} onChange={(event) => setYear(event.target.value)}>
          <option value="all">All seasons</option>
          {years.map((seasonYear) => (
            <option key={seasonYear} value={seasonYear}>
              {seasonYear}
            </option>
          ))}
        </select>
        <select value={type} onChange={(event) => setType(event.target.value)}>
          <option value="all">All record types</option>
          <option value="season">Seasons</option>
          <option value="team">Teams</option>
          <option value="week">Weeks</option>
          <option value="matchup">Matchups</option>
          <option value="transaction">Transactions</option>
          <option value="draft">Draft</option>
          <option value="player">Players</option>
        </select>
      </section>

      <section className="contentBand">
        <SimpleTable data={filteredRows} columns={columns} />
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
  return (
    <div className="lineupTable">
      <h4>{title}</h4>
      {players.map((player, index) => (
        <div className="lineupRow" key={`${player.name}-${index}`}>
          <span>{player.lineupSlot ?? player.slotPosition ?? "-"}</span>
          <strong>{player.name}</strong>
          <small>
            {player.position ?? "-"} · {formatNumber(player.points, 1)}
          </small>
        </div>
      ))}
    </div>
  );
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

export default App;
