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
import {
  archivePublicUrl,
  formatDate,
  formatNumber,
  formatTimestamp,
  teamDisplay,
} from "./data";
import { SimpleTable } from "./SimpleTable";
import {
  ArchiveManifest,
  DraftPick,
  Matchup,
  PublicSeason,
  PublicTeam,
  PublicPlayer,
  PublicWeek,
  PlayerSeasonReport,
  LineupPlayer,
  SearchRow,
  SearchType,
  Transaction,
} from "./types";
import { useArchiveJson } from "./useArchiveJson";

type BrowserFilterType = SearchType | "all";
type BrowserView = "picker" | "all";

type BrowserFilters = {
  query: string;
  type: BrowserFilterType;
  year: string;
  view: BrowserView;
};

type KeeperRow = {
  id: string;
  year: number;
  auctionValue?: number;
  position?: string;
  name: string;
  teamName: string;
  playerKey?: string;
  draftPick?: number;
};

type BreadcrumbItem = {
  label: string;
  to?: string;
};

const defaultFilters: BrowserFilters = {
  query: "",
  type: "all",
  year: "all",
  view: "picker",
};

const recordTypeOptions: Array<{ value: BrowserFilterType; label: string }> = [
  { value: "all", label: "All record types" },
  { value: "season", label: "Seasons" },
  { value: "team", label: "Teams" },
  { value: "week", label: "Weeks" },
  { value: "matchup", label: "Matchups" },
  { value: "transaction", label: "Transactions" },
  { value: "draft", label: "Drafts" },
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
    title: "Drafts",
    label: "Find historical draft picks, nominations, bids, and keepers.",
    to: "/browse?type=draft",
    icon: <Database size={20} aria-hidden />,
  },
  {
    title: "Keepers",
    label: "Review keeper players, auction values, positions, and teams by season.",
    to: "/keepers",
    icon: <Trophy size={20} aria-hidden />,
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
    cell: ({ row }) => (
      <Link to={playerDetailHref(row.original) ?? row.original.href}>
        {row.original.label}
      </Link>
    ),
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
  {
    header: "Pick",
    accessorKey: "draftPick",
    cell: ({ row }) => row.original.draftPick ?? "-",
  },
  {
    header: "Player",
    accessorKey: "playerName",
    cell: ({ row }) => (
      <Link to={playerDetailHref(row.original) ?? row.original.href}>
        {row.original.playerName ?? row.original.label}
      </Link>
    ),
  },
  {
    header: "Team",
    accessorKey: "teamName",
    cell: ({ row }) => row.original.teamName ?? row.original.teamKey ?? "-",
  },
  {
    header: "Bid",
    accessorKey: "bidAmount",
    cell: ({ row }) =>
      typeof row.original.bidAmount === "number"
        ? `$${formatNumber(row.original.bidAmount)}`
        : "-",
  },
];

const transactionSearchColumns: ColumnDef<SearchRow>[] = [
  searchColumns[1],
  searchColumns[2],
  {
    header: "Type",
    accessorKey: "transactionActionType",
    cell: ({ row }) => row.original.transactionActionType || "Transaction",
  },
  {
    header: "FAB",
    accessorKey: "bidAmount",
    cell: ({ row }) =>
      formatTransactionFab(row.original.transactionType, row.original.bidAmount),
  },
  {
    header: "Team",
    accessorKey: "teamName",
    cell: ({ row }) => row.original.teamName ?? row.original.teamKey ?? "-",
  },
  {
    header: "Player",
    accessorKey: "playerName",
    cell: ({ row }) => (
      <Link to={playerDetailHref(row.original) ?? row.original.href}>
        {row.original.playerName ?? row.original.label}
      </Link>
    ),
  },
  {
    header: "Status",
    accessorKey: "transactionStatus",
    cell: ({ row }) => row.original.transactionStatus ?? row.original.summary,
  },
];

const playerSeasonColumns: ColumnDef<PlayerSeasonReport>[] = [
  {
    header: "Year",
    accessorKey: "year",
  },
  {
    header: "NFL Team",
    accessorKey: "nflTeam",
    cell: ({ row }) => row.original.nflTeam ?? "-",
  },
  {
    header: "Fantasy Team",
    accessorKey: "fantasyTeamName",
    cell: ({ row }) => row.original.fantasyTeamName || "FA",
  },
  {
    header: "Fantasy Points",
    accessorKey: "fantasyPoints",
    cell: ({ row }) => (
      <span className="numberText">{formatNumber(row.original.fantasyPoints, 1)}</span>
    ),
  },
  {
    header: "Player Rank",
    accessorKey: "playerRank",
    cell: ({ row }) => `#${row.original.playerRank}`,
  },
  {
    header: "Position Rank",
    accessorKey: "positionRank",
    cell: ({ row }) =>
      `#${row.original.positionRank}${row.original.position ? ` ${row.original.position}` : ""}`,
  },
  {
    header: "Games",
    accessorKey: "gamesPlayed",
  },
  {
    header: "Starts",
    accessorKey: "starts",
  },
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
            Home
          </NavLink>
          <NavLink to="/keepers">
            <Trophy size={16} aria-hidden />
            Keepers
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
          <Route path="/keepers" element={<KeepersPage />} />
          <Route path="/browse" element={<BrowserPage />} />
          <Route path="/player/:playerKey" element={<PlayerPage />} />
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

  const matchupCount = manifest.data.seasons.reduce(
    (total, season) => total + season.matchupCount,
    0,
  );

  return (
    <>
      <section className="pageIntro">
        <div>
          <h1>CPFFL Archive</h1>
        </div>
        <div className="statRail">
          <Metric
            icon={<CalendarDays size={18} />}
            label="Available Seasons"
            value={String(manifest.data.seasons.length)}
          />
          <Metric
            icon={<Database size={18} />}
            label="Total Matchups"
            value={formatNumber(matchupCount)}
          />
          <Metric
            icon={<Trophy size={18} />}
            label="Last Modified"
            value={formatTimestamp(manifest.data.exportedAt)}
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

function KeepersPage() {
  const manifest = useArchiveJson<ArchiveManifest>("manifest.json");
  const index = useArchiveJson<SearchRow[]>("search-index.json");
  const players = useArchiveJson<PublicPlayer[]>("players.json");
  const [searchParams, setSearchParams] = useSearchParams();

  const years = useMemo(
    () =>
      manifest.status === "loaded"
        ? [...manifest.data.seasons]
            .sort((left, right) => right.year - left.year)
            .map((season) => season.year)
        : [],
    [manifest],
  );
  const selectedYear = normalizeKeeperYear(searchParams.get("year"), years);
  const showsAllSeasons = selectedYear === "all";

  const keeperRows = useMemo(() => {
    if (index.status !== "loaded" || players.status !== "loaded") {
      return [];
    }

    const playerByKey = new Map(players.data.map((player) => [player.key, player]));

    return index.data
      .filter(
        (row) =>
          row.type === "draft" &&
          row.keeperStatus &&
          (selectedYear === "all" || row.year === Number(selectedYear)),
      )
      .map((row): KeeperRow => {
        const player = row.playerKey ? playerByKey.get(row.playerKey) : undefined;
        const playerSeason = player?.seasons.find((season) => season.year === row.year);

        return {
          id: row.id,
          year: row.year,
          auctionValue: row.bidAmount,
          position: playerSeason?.position ?? player?.primaryPosition,
          name: row.playerName ?? row.label,
          teamName: row.teamName ?? row.teamKey ?? "Unknown",
          playerKey: row.playerKey,
          draftPick: row.draftPick,
        };
      })
      .sort(sortKeeperRows);
  }, [index, players, selectedYear]);

  const keeperColumns = useMemo(
    () => keeperColumnsForView(showsAllSeasons),
    [showsAllSeasons],
  );
  const keeperSeasonCount = useMemo(
    () => new Set(keeperRows.map((row) => row.year)).size,
    [keeperRows],
  );
  const latestKeeperYear = keeperRows[0]?.year;

  if (
    manifest.status === "loading" ||
    index.status === "loading" ||
    players.status === "loading"
  ) {
    return <StatusPanel label="Loading keepers..." />;
  }

  if (
    manifest.status === "error" ||
    index.status === "error" ||
    players.status === "error"
  ) {
    return <StatusPanel label="Unable to load keepers." tone="danger" />;
  }

  function updateSelectedYear(year: string) {
    const params = new URLSearchParams();
    if (year !== "all") {
      params.set("year", year);
    }
    setSearchParams(params);
  }

  return (
    <>
      <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Keepers" }]} />
      <section className="pageIntro">
        <div>
          <p className="eyebrow">Draft auction history</p>
          <h1>Keepers</h1>
        </div>
        <div className="statRail">
          <Metric
            icon={<Trophy size={18} />}
            label="Keepers"
            value={formatNumber(keeperRows.length)}
          />
          <Metric
            icon={<CalendarDays size={18} />}
            label="Seasons"
            value={String(keeperSeasonCount)}
          />
          <Metric
            icon={<Database size={18} />}
            label="Latest"
            value={latestKeeperYear ? String(latestKeeperYear) : "-"}
          />
        </div>
      </section>

      <section className="keeperControlBand" aria-label="Keeper filters">
        <label>
          <span>Season</span>
          <select
            aria-label="Filter keepers by season"
            value={selectedYear}
            onChange={(event) => updateSelectedYear(event.target.value)}
          >
            <option value="all">All seasons</option>
            {years.map((seasonYear) => (
              <option key={seasonYear} value={seasonYear}>
                {seasonYear}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="contentBand">
        <div className="sectionHeader">
          <h2>{showsAllSeasons ? "All Keepers" : `${selectedYear} Keepers`}</h2>
          <span className="pendingNote">
            {formatNumber(keeperRows.length)} matching{" "}
            {keeperRows.length === 1 ? "keeper" : "keepers"}
          </span>
        </div>
        <SimpleTable
          data={keeperRows}
          columns={keeperColumns}
          emptyLabel="No keepers found for this season."
          mobileCard={(row) => (
            <KeeperMobileCard row={row} showsYear={showsAllSeasons} />
          )}
          mobileLabel="Keeper cards"
        />
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
        ? [...manifest.data.seasons]
            .sort((left, right) => right.year - left.year)
            .map((season) => season.year)
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
      return sortSearchRows(index.data);
    }

    return sortSearchRows(
      index.data.filter((row) => {
        const matchesType =
          appliedFilters.type === "all" || row.type === appliedFilters.type;
        const matchesYear =
          appliedFilters.year === "all" || row.year === Number(appliedFilters.year);
        if (!matchesType || !matchesYear) {
          return false;
        }

        const haystack = [
          row.year,
          row.label,
          row.summary,
          row.playerName,
          row.teamName,
          row.transactionActionType,
          row.transactionStatus,
        ]
          .filter(Boolean)
          .join(" ");
        const matchesQuery =
          normalizedQuery.length === 0 ||
          haystack.toLowerCase().includes(normalizedQuery);

        return matchesType && matchesYear && matchesQuery;
      }),
    );
  }, [appliedFilters, index]);

  if (manifest.status === "loading" || index.status === "loading") {
    return <StatusPanel label="Loading archive index..." />;
  }

  if (manifest.status === "error" || index.status === "error") {
    return <StatusPanel label="Unable to load archive data." tone="danger" />;
  }

  const hasPendingFilters = !filtersMatch(draftFilters, appliedFilters);
  const resultColumns = resultColumnsForType(appliedFilters.type);
  const usesPickerView = appliedFilters.view !== "all";
  const showSeasonHistory =
    appliedFilters.type === "season" &&
    appliedFilters.year === "all" &&
    usesPickerView;
  const showTeamYearPicker =
    appliedFilters.type === "team" &&
    appliedFilters.year === "all" &&
    usesPickerView;
  const showTeamHistory = appliedFilters.type === "team";
  const showWeekHistory =
    appliedFilters.type === "week" &&
    appliedFilters.year === "all" &&
    usesPickerView;
  const showMatchupHistory = appliedFilters.type === "matchup" && usesPickerView;
  const showTransactionHistory =
    appliedFilters.type === "transaction" &&
    appliedFilters.year === "all" &&
    usesPickerView;
  const showPlayerHistory = appliedFilters.type === "player" && usesPickerView;
  const showDraftHistory =
    appliedFilters.type === "draft" &&
    appliedFilters.year === "all" &&
    usesPickerView;
  const breadcrumbs = browserBreadcrumbItems(appliedFilters);

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
      <Breadcrumbs items={breadcrumbs} />
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
            aria-label="Search archive records"
            value={draftFilters.query}
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                query: event.target.value,
              }))
            }
            placeholder={
              draftFilters.type === "matchup"
                ? draftFilters.year === "all"
                  ? "Search seasons or enter a week number"
                  : "Search week number"
                : draftFilters.type === "player"
                  ? draftFilters.year === "all"
                    ? "Search seasons or enter a year"
                    : "Search players, NFL teams, fantasy teams"
                : "Search teams, players, matchups, transactions"
            }
          />
        </label>
        <select
          aria-label="Filter by season"
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
          aria-label="Filter by record type"
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

      {showSeasonHistory ? (
        <SeasonHistoryResults
          rows={filteredRows}
          query={appliedFilters.query}
          hasPendingFilters={hasPendingFilters}
        />
      ) : showTeamYearPicker ? (
        <RecordSeasonResults
          rows={filteredRows}
          type="team"
          title="Teams"
          query={appliedFilters.query}
          hasPendingFilters={hasPendingFilters}
        />
      ) : showTeamHistory ? (
        <TeamHistoryResults
          rows={filteredRows}
          hasPendingFilters={hasPendingFilters}
        />
      ) : showWeekHistory ? (
        <RecordSeasonResults
          rows={filteredRows}
          type="week"
          title="Weekly Results"
          query={appliedFilters.query}
          hasPendingFilters={hasPendingFilters}
        />
      ) : showPlayerHistory ? (
        appliedFilters.year === "all" ? (
          <PlayerSeasonResults
            seasons={manifest.data.seasons}
            query={appliedFilters.query}
            hasPendingFilters={hasPendingFilters}
          />
        ) : (
          <PlayerYearResults
            year={Number(appliedFilters.year)}
            query={appliedFilters.query}
            hasPendingFilters={hasPendingFilters}
          />
        )
      ) : showMatchupHistory ? (
        appliedFilters.year === "all" ? (
          <MatchupSeasonResults
            seasons={manifest.data.seasons}
            query={appliedFilters.query}
            hasPendingFilters={hasPendingFilters}
          />
        ) : (
          <MatchupWeekResults
            year={Number(appliedFilters.year)}
            query={appliedFilters.query}
            hasPendingFilters={hasPendingFilters}
          />
        )
      ) : showTransactionHistory ? (
        <RecordSeasonResults
          rows={filteredRows}
          type="transaction"
          title="Transactions"
          query={appliedFilters.query}
          hasPendingFilters={hasPendingFilters}
        />
      ) : showDraftHistory ? (
        <DraftSeasonResults
          rows={filteredRows}
          query={appliedFilters.query}
          hasPendingFilters={hasPendingFilters}
        />
      ) : (
        <section className="contentBand">
          <div className="sectionHeader">
            <h2>Results</h2>
            <span
              className={hasPendingFilters ? "pendingNote active" : "pendingNote"}
            >
              {hasPendingFilters
                ? "Filter changes pending"
                : `${formatNumber(filteredRows.length)} matching rows`}
            </span>
          </div>
          <SimpleTable
            data={filteredRows}
            columns={resultColumns}
            mobileCard={(row) => <SearchResultMobileCard row={row} />}
            mobileLabel="Archive result cards"
          />
        </section>
      )}
    </>
  );
}

function MatchupSeasonResults({
  seasons,
  query,
  hasPendingFilters,
}: {
  seasons: ArchiveManifest["seasons"];
  query: string;
  hasPendingFilters: boolean;
}) {
  const normalizedQuery = query.trim().toLowerCase();
  const filtersBySeasonYear = /^\d{3,4}$/.test(normalizedQuery);
  const seasonRows = useMemo(
    () =>
      [...seasons]
        .sort((left, right) => right.year - left.year)
        .filter((season) =>
          filtersBySeasonYear ? String(season.year).includes(normalizedQuery) : true,
        ),
    [filtersBySeasonYear, normalizedQuery, seasons],
  );

  return (
    <section className="teamHistoryBand">
      <div className="sectionHeader">
        <h2>Matchups</h2>
        <span className={hasPendingFilters ? "pendingNote active" : "pendingNote"}>
          {hasPendingFilters
            ? "Filter changes pending"
            : `${formatNumber(seasonRows.length)} matching ${pluralizeSeason(
                seasonRows.length,
              )}`}
        </span>
      </div>

      {seasonRows.length ? (
        <div className="teamCardGrid">
          <AllSeasonsCard type="matchup" query={query} />
          {seasonRows.map((season) => (
            <Link
              className="teamHistoryCard"
              key={season.year}
              to={matchupYearBrowseHref(season.year, query)}
            >
              <span className="teamCardIcon" aria-hidden>
                <CalendarDays size={20} aria-hidden />
              </span>
              <span className="teamCardText">
                <strong>{season.year}</strong>
                <small>
                  {season.teamCount} teams, {season.weekCount}{" "}
                  {pluralizeWeek(season.weekCount)}
                </small>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="emptyNote">No matchup seasons match these filters.</p>
      )}
    </section>
  );
}

function MatchupWeekResults({
  year,
  query,
  hasPendingFilters,
}: {
  year: number;
  query: string;
  hasPendingFilters: boolean;
}) {
  const season = useArchiveJson<PublicSeason>(`seasons/${year}.json`);
  const normalizedQuery = query.trim().toLowerCase();

  const weekRows = useMemo(() => {
    if (season.status !== "loaded") {
      return [];
    }

    return season.data.weeks
      .filter((week) => matchesMatchupWeekQuery(week.week, normalizedQuery))
      .sort((left, right) => left.week - right.week);
  }, [normalizedQuery, season]);

  if (season.status === "loading") {
    return <StatusPanel label="Loading matchup weeks..." />;
  }

  if (season.status === "error") {
    return <StatusPanel label="Unable to load matchup weeks." tone="danger" />;
  }

  return (
    <section className="teamHistoryBand">
      <div className="sectionHeader">
        <div>
          <h2>{year} Matchups</h2>
          <Link className="textLink" to="/browse?type=matchup">
            &larr; Back to Year Select
          </Link>
        </div>
        <span className={hasPendingFilters ? "pendingNote active" : "pendingNote"}>
          {hasPendingFilters
            ? "Filter changes pending"
            : `${formatNumber(weekRows.length)} matching ${pluralizeWeek(
                weekRows.length,
              )}`}
        </span>
      </div>

      {weekRows.length ? (
        <div className="weekPickerGrid">
          {weekRows.map((week) => (
            <Link className="matchupWeekCard" key={week.week} to={week.href}>
              <span className="teamCardIcon" aria-hidden>
                <CalendarDays size={20} aria-hidden />
              </span>
              <span className="teamCardText">
                <strong>Week {week.week}</strong>
                <small>
                  {week.scoreboardCount} games, {week.boxScoreCount} box scores
                </small>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="emptyNote">No matchup weeks match these filters.</p>
      )}
    </section>
  );
}

function PlayerSeasonResults({
  seasons,
  query,
  hasPendingFilters,
}: {
  seasons: ArchiveManifest["seasons"];
  query: string;
  hasPendingFilters: boolean;
}) {
  const normalizedQuery = query.trim().toLowerCase();
  const filtersBySeasonYear = /^\d{3,4}$/.test(normalizedQuery);
  const seasonRows = useMemo(
    () =>
      [...seasons]
        .sort((left, right) => right.year - left.year)
        .filter((season) =>
          filtersBySeasonYear ? String(season.year).includes(normalizedQuery) : true,
        ),
    [filtersBySeasonYear, normalizedQuery, seasons],
  );

  return (
    <section className="teamHistoryBand">
      <div className="sectionHeader">
        <h2>Players</h2>
        <span className={hasPendingFilters ? "pendingNote active" : "pendingNote"}>
          {hasPendingFilters
            ? "Filter changes pending"
            : `${formatNumber(seasonRows.length)} matching ${pluralizeSeason(
                seasonRows.length,
              )}`}
        </span>
      </div>

      {seasonRows.length ? (
        <div className="teamCardGrid">
          <AllSeasonsCard type="player" query={query} />
          {seasonRows.map((season) => (
            <Link
              className="teamHistoryCard"
              key={season.year}
              to={playerYearBrowseHref(season.year, query)}
            >
              <span className="teamCardIcon" aria-hidden>
                <Search size={20} aria-hidden />
              </span>
              <span className="teamCardText">
                <strong>{season.year}</strong>
                <small>
                  {formatNumber(season.playerCount)}{" "}
                  {pluralizePlayer(season.playerCount)}, {season.weekCount}{" "}
                  {pluralizeWeek(season.weekCount)}
                </small>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="emptyNote">No player seasons match these filters.</p>
      )}
    </section>
  );
}

function PlayerYearResults({
  year,
  query,
  hasPendingFilters,
}: {
  year: number;
  query: string;
  hasPendingFilters: boolean;
}) {
  const players = useArchiveJson<PublicPlayer[]>("players.json");
  const normalizedQuery = query.trim().toLowerCase();

  const playerRows = useMemo(() => {
    if (players.status !== "loaded") {
      return [];
    }

    return players.data
      .map((player) => {
        const season = player.seasons.find((row) => row.year === year);
        return season ? { player, season } : undefined;
      })
      .filter((row): row is { player: PublicPlayer; season: PlayerSeasonReport } =>
        Boolean(row),
      )
      .filter(({ player, season }) => matchesPlayerYearQuery(player, season, normalizedQuery))
      .sort(
        (left, right) =>
          right.season.fantasyPoints - left.season.fantasyPoints ||
          left.player.name.localeCompare(right.player.name),
      );
  }, [normalizedQuery, players, year]);

  if (players.status === "loading") {
    return <StatusPanel label="Loading player index..." />;
  }

  if (players.status === "error") {
    return <StatusPanel label="Unable to load player index." tone="danger" />;
  }

  return (
    <section className="teamHistoryBand">
      <div className="sectionHeader">
        <div>
          <h2>{year} Players</h2>
          <Link className="textLink" to="/browse?type=player">
            &larr; Back to Year Select
          </Link>
        </div>
        <span className={hasPendingFilters ? "pendingNote active" : "pendingNote"}>
          {hasPendingFilters
            ? "Filter changes pending"
            : `${formatNumber(playerRows.length)} matching ${pluralizePlayer(
                playerRows.length,
              )}`}
        </span>
      </div>

      {playerRows.length ? (
        <div className="playerCardGrid">
          {playerRows.map(({ player, season }) => (
            <Link
              className="playerResultCard"
              key={player.key}
              to={`/player/${player.key}?fromYear=${year}`}
            >
              <PlayerAvatar player={player} />
              <span className="playerResultMain">
                <span className="playerResultNameLine">
                  <span className="playerRankBadge">#{season.playerRank}</span>
                  <strong>{player.name}</strong>
                </span>
                <small>
                  {season.position ?? "Player"}, {season.nflTeam ?? "NFL"},{" "}
                  {season.fantasyTeamName || "FA"}
                </small>
              </span>
              <span className="playerResultStats">
                <strong>{formatNumber(season.fantasyPoints, 1)}</strong>
                <small>
                  #{season.positionRank} {season.position ?? "pos"}
                </small>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="emptyNote">No players match these filters.</p>
      )}
    </section>
  );
}

function DraftSeasonResults({
  rows,
  query,
  hasPendingFilters,
}: {
  rows: SearchRow[];
  query: string;
  hasPendingFilters: boolean;
}) {
  const groupedDrafts = useMemo(() => groupRowsByYear(rows), [rows]);

  return (
    <section className="teamHistoryBand">
      <div className="sectionHeader">
        <h2>Drafts</h2>
        <span className={hasPendingFilters ? "pendingNote active" : "pendingNote"}>
          {hasPendingFilters
            ? "Filter changes pending"
            : `${formatNumber(groupedDrafts.length)} matching ${pluralizeSeason(
                groupedDrafts.length,
              )}`}
        </span>
      </div>

      <div className="teamCardGrid">
        <AllSeasonsCard type="draft" query={query} />
        {groupedDrafts.map((group) => (
          <Link
            className="teamHistoryCard"
            key={group.year}
            to={draftYearBrowseHref(group.year, query)}
          >
            <span className="teamCardIcon" aria-hidden>
              <Database size={20} aria-hidden />
            </span>
            <span className="teamCardText">
              <strong>{group.year}</strong>
              <small>
                {formatNumber(group.rows.length)} {pluralizeDraftPick(group.rows.length)}
              </small>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function RecordSeasonResults({
  rows,
  type,
  title,
  query,
  hasPendingFilters,
}: {
  rows: SearchRow[];
  type: SearchType;
  title: string;
  query: string;
  hasPendingFilters: boolean;
}) {
  const groupedRows = useMemo(() => groupRowsByYear(rows), [rows]);

  return (
    <section className="teamHistoryBand">
      <div className="sectionHeader">
        <h2>{title}</h2>
        <span className={hasPendingFilters ? "pendingNote active" : "pendingNote"}>
          {hasPendingFilters
            ? "Filter changes pending"
            : `${formatNumber(groupedRows.length)} matching ${pluralizeSeason(
                groupedRows.length,
              )}`}
        </span>
      </div>

      <div className="teamCardGrid">
        <AllSeasonsCard type={type} query={query} />
        {groupedRows.map((group) => (
          <Link
            className="teamHistoryCard"
            key={group.year}
            to={yearBrowseHref(type, group.year, query)}
          >
            <span className="teamCardIcon" aria-hidden>
              {recordTypeIcon(type)}
            </span>
            <span className="teamCardText">
              <strong>{group.year}</strong>
              <small>{recordYearSummary(type, group.rows.length)}</small>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function SeasonHistoryResults({
  rows,
  query,
  hasPendingFilters,
}: {
  rows: SearchRow[];
  query: string;
  hasPendingFilters: boolean;
}) {
  const seasonRows = useMemo(
    () => [...rows].sort((left, right) => right.year - left.year),
    [rows],
  );

  return (
    <section className="teamHistoryBand">
      <div className="sectionHeader">
        <h2>Seasons</h2>
        <span className={hasPendingFilters ? "pendingNote active" : "pendingNote"}>
          {hasPendingFilters
            ? "Filter changes pending"
            : `${formatNumber(rows.length)} matching ${pluralizeSeason(rows.length)}`}
        </span>
      </div>

      {seasonRows.length ? (
        <div className="teamCardGrid">
          <AllSeasonsCard type="season" query={query} />
          {seasonRows.map((season) => (
            <Link className="teamHistoryCard" key={season.id} to={season.href}>
              <span className="teamCardIcon" aria-hidden>
                <CalendarDays size={20} aria-hidden />
              </span>
              <span className="teamCardText">
                <strong>{season.year}</strong>
                <small>{season.summary}</small>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="emptyNote">No seasons match these filters.</p>
      )}
    </section>
  );
}

function TeamHistoryResults({
  rows,
  hasPendingFilters,
}: {
  rows: SearchRow[];
  hasPendingFilters: boolean;
}) {
  const groupedTeams = useMemo(() => groupRowsByYear(rows), [rows]);

  return (
    <section className="teamHistoryBand">
      <div className="sectionHeader">
        <h2>Teams</h2>
        <span className={hasPendingFilters ? "pendingNote active" : "pendingNote"}>
          {hasPendingFilters
            ? "Filter changes pending"
            : `${formatNumber(rows.length)} matching ${pluralizeTeam(rows.length)}`}
        </span>
      </div>

      {groupedTeams.length ? (
        <div className="teamYearList">
          {groupedTeams.map((group) => (
            <section className="teamYearGroup" key={group.year}>
              <div className="teamYearHeader">
                <h3>{group.year}</h3>
                <span>
                  {formatNumber(group.rows.length)} {pluralizeTeam(group.rows.length)}
                </span>
              </div>
              <div className="teamCardGrid">
                {group.rows.map((team) => (
                  <Link className="teamHistoryCard" key={team.id} to={team.href}>
                    <TeamCardIcon logoUrl={team.logoUrl} />
                    <span className="teamCardText">
                      <strong>{team.label}</strong>
                      <small>{team.summary}</small>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <p className="emptyNote">No teams match these filters.</p>
      )}
    </section>
  );
}

function TeamCardIcon({
  logoUrl,
}: {
  logoUrl?: string;
}) {
  const [failed, setFailed] = useState(false);
  const resolvedLogoUrl = archivePublicUrl(logoUrl);

  if (resolvedLogoUrl && !failed) {
    return (
      <span className="teamCardIcon logo">
        <img
          src={resolvedLogoUrl}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
        />
      </span>
    );
  }

  return (
    <span className="teamCardIcon" aria-hidden>
      <Shield size={20} aria-hidden />
    </span>
  );
}

function AllSeasonsCard({
  type,
  query,
}: {
  type: SearchType;
  query: string;
}) {
  return (
    <Link className="teamHistoryCard" to={allSeasonsBrowseHref(type, query)}>
      <span className="teamCardIcon" aria-hidden>
        <Database size={20} aria-hidden />
      </span>
      <span className="teamCardText">
        <strong>All Seasons</strong>
        <small>Browse every matching row</small>
      </span>
    </Link>
  );
}

function PlayerAvatar({ player }: { player: PublicPlayer }) {
  const [failed, setFailed] = useState(false);
  const photoUrl = archivePublicUrl(player.photoUrl);

  if (!photoUrl || failed) {
    return (
      <span className="playerAvatarPlaceholder" aria-hidden>
        <Shield size={22} />
      </span>
    );
  }

  return (
    <span className="playerAvatar">
      <img
        src={photoUrl}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </span>
  );
}

function PlayerPage() {
  const { playerKey = "" } = useParams();
  const [searchParams] = useSearchParams();
  const players = useArchiveJson<PublicPlayer[]>("players.json");

  if (players.status === "loading") {
    return <StatusPanel label="Loading player report..." />;
  }

  if (players.status === "error") {
    return <StatusPanel label="Unable to load player report." tone="danger" />;
  }

  const player = players.data.find((row) => row.key === playerKey);
  if (!player) {
    return <StatusPanel label="Player report not found." tone="danger" />;
  }

  const seasons = [...player.seasons].sort((left, right) => right.year - left.year);
  const latestSeason = player.latestSeason ?? seasons[0];
  const fromYear = Number(searchParams.get("fromYear"));
  const breadcrumbYear = seasons.some((season) => season.year === fromYear)
    ? fromYear
    : latestSeason?.year;
  const bestSeason = player.bestSeason ?? [...seasons].sort(
    (left, right) => right.fantasyPoints - left.fantasyPoints,
  )[0];
  const bestPositionRankSeason = [...seasons].sort(
    (left, right) =>
      left.positionRank - right.positionRank ||
      right.fantasyPoints - left.fantasyPoints ||
      right.year - left.year,
  )[0];

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Home", to: "/" },
          { label: "Players", to: "/browse?type=player" },
          breadcrumbYear
            ? {
                label: `${breadcrumbYear} Players`,
                to: `/browse?type=player&year=${breadcrumbYear}`,
              }
            : undefined,
          { label: player.name },
        ]}
      />
      <section className="pageIntro">
        <div>
          <p className="eyebrow">
            {player.primaryPosition ?? "Player"} career report
          </p>
          <h1>{player.name}</h1>
        </div>
        <div className="statRail">
          <Metric
            icon={<CalendarDays size={18} />}
            label="Seasons"
            value={String(seasons.length)}
          />
          <Metric
            icon={<Trophy size={18} />}
            label="Career Points"
            value={formatNumber(player.totalFantasyPoints, 1)}
          />
          <Metric
            icon={<Database size={18} />}
            label="Latest Fantasy Team"
            value={latestSeason?.fantasyTeamName || "FA"}
          />
        </div>
      </section>

      <section className="contentGrid">
        <div className="panel">
          <div className="sectionHeader">
            <h2>Summary</h2>
          </div>
          <div className="playerSummaryLayout">
            <dl className="definitionGrid">
              <div>
                <dt>Primary position</dt>
                <dd>{player.primaryPosition ?? "-"}</dd>
              </div>
              <div>
                <dt>Best season</dt>
                <dd>
                  {bestSeason
                    ? `${bestSeason.year}, ${formatNumber(
                        bestSeason.fantasyPoints,
                        1,
                      )} points`
                    : "-"}
                </dd>
              </div>
              <div>
                <dt>Best overall rank</dt>
                <dd>
                  {bestSeason ? `#${bestSeason.playerRank} in ${bestSeason.year}` : "-"}
                </dd>
              </div>
              <div>
                <dt>Best position rank</dt>
                <dd>
                  {bestPositionRankSeason
                    ? `#${bestPositionRankSeason.positionRank} ${
                        bestPositionRankSeason.position ?? ""
                      } in ${bestPositionRankSeason.year}`.trim()
                    : "-"}
                </dd>
              </div>
            </dl>
            <PlayerPhoto player={player} />
          </div>
        </div>
        <div className="panel">
          <div className="sectionHeader">
            <h2>Yearly Points</h2>
          </div>
          <PlayerPointChart seasons={seasons} />
        </div>
      </section>

      <section className="contentBand">
        <div className="sectionHeader">
          <h2>Year By Year</h2>
        </div>
        <SimpleTable
          data={seasons}
          columns={playerSeasonColumns}
          emptyLabel="No player seasons found."
          mobileCard={(season) => <PlayerSeasonMobileCard season={season} />}
          mobileLabel="Player season cards"
        />
      </section>
    </>
  );
}

function PlayerPointChart({ seasons }: { seasons: PlayerSeasonReport[] }) {
  const [activeTooltipYear, setActiveTooltipYear] = useState<number>();
  const rows = [...seasons].sort((left, right) => left.year - right.year);
  const maxPoints = Math.max(...rows.map((row) => row.fantasyPoints), 1);
  const width = 720;
  const height = 260;
  const padding = { top: 20, right: 28, bottom: 40, left: 56 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const xForIndex = (index: number) =>
    rows.length === 1
      ? padding.left + chartWidth / 2
      : padding.left + (index / (rows.length - 1)) * chartWidth;
  const yForPoints = (points: number) =>
    padding.top + chartHeight - (points / maxPoints) * chartHeight;
  const points = rows
    .map((season, index) => `${xForIndex(index)},${yForPoints(season.fantasyPoints)}`)
    .join(" ");
  const activeTooltip = rows
    .map((season, index) => ({ season, index }))
    .find(({ season }) => season.year === activeTooltipYear);
  const tooltipWidth = 190;
  const tooltipHeight = 58;
  const tooltipPosition = (season: PlayerSeasonReport, index: number) => {
    const x = xForIndex(index);
    const y = yForPoints(season.fantasyPoints);
    return {
      x: x + tooltipWidth + 16 > width ? x - tooltipWidth - 12 : x + 12,
      y: Math.max(8, y - tooltipHeight - 12),
    };
  };

  return (
    <figure className="playerLineChart" aria-label="Player fantasy points by season">
      <svg viewBox={`0 0 ${width} ${height}`} role="img">
        <line
          className="chartAxis"
          x1={padding.left}
          y1={padding.top + chartHeight}
          x2={padding.left + chartWidth}
          y2={padding.top + chartHeight}
        />
        <line
          className="chartAxis"
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={padding.top + chartHeight}
        />
        {[0, 0.5, 1].map((tick) => {
          const y = padding.top + chartHeight - tick * chartHeight;
          return (
            <g key={tick}>
              <line
                className="chartGridLine"
                x1={padding.left}
                y1={y}
                x2={padding.left + chartWidth}
                y2={y}
              />
              <text className="chartTick" x={padding.left - 10} y={y + 4}>
                {formatNumber(maxPoints * tick, 0)}
              </text>
            </g>
          );
        })}
        <polyline className="chartLine" points={points} />
        {rows.map((season, index) => {
          const x = xForIndex(index);
          const y = yForPoints(season.fantasyPoints);
          return (
            <g
              className="chartPointGroup"
              key={season.year}
              tabIndex={0}
              aria-label={`${season.year}: ${formatNumber(
                season.fantasyPoints,
                1,
              )} points, #${season.playerRank} overall, #${season.positionRank} ${
                season.position ?? "position"
              }`}
              onMouseEnter={() => setActiveTooltipYear(season.year)}
              onMouseLeave={() => setActiveTooltipYear(undefined)}
              onFocus={() => setActiveTooltipYear(season.year)}
              onBlur={() => setActiveTooltipYear(undefined)}
            >
              <circle className="chartPoint" cx={x} cy={y} r="5" />
              <text className="chartYear" x={x} y={height - 14}>
                {season.year}
              </text>
            </g>
          );
        })}
        {activeTooltip ? (
          <ChartTooltip
            season={activeTooltip.season}
            width={tooltipWidth}
            height={tooltipHeight}
            {...tooltipPosition(activeTooltip.season, activeTooltip.index)}
          />
        ) : null}
      </svg>
    </figure>
  );
}

function ChartTooltip({
  season,
  x,
  y,
  width,
  height,
}: {
  season: PlayerSeasonReport;
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  return (
    <g className="chartTooltip active" transform={`translate(${x} ${y})`}>
      <rect width={width} height={height} rx="8" />
      <text x="12" y="19">
        {season.year}: {formatNumber(season.fantasyPoints, 1)} points
      </text>
      <text x="12" y="39">
        #{season.playerRank} overall, #{season.positionRank}{" "}
        {season.position ?? "position"}
      </text>
    </g>
  );
}

function PlayerPhoto({ player }: { player: PublicPlayer }) {
  const [failed, setFailed] = useState(false);
  const photoUrl = archivePublicUrl(player.photoUrl);

  if (!photoUrl || failed) {
    return (
      <div className="playerPhotoPlaceholder" aria-hidden>
        <Shield size={42} />
      </div>
    );
  }

  return (
    <div className="playerPhotoFrame">
      <img
        src={photoUrl}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

function SearchResultMobileCard({ row }: { row: SearchRow }) {
  const href = playerDetailHref(row) ?? row.href;

  return (
    <article className="mobileDataCard">
      <div className="mobileCardHeader">
        <span className="pill">{row.type}</span>
        <span className="mobileCardKicker">
          {row.year}
          {row.week ? `, Week ${row.week}` : ""}
        </span>
      </div>
      <Link className="mobileCardTitle" to={href}>
        {row.playerName ?? row.label}
      </Link>
      <p className="mobileCardSummary">{row.summary}</p>
      <MobileFieldGrid
        items={[
          { label: "Team", value: row.teamName ?? row.teamKey },
          { label: "Pick", value: row.draftPick },
          {
            label: "Bid",
            value:
              typeof row.bidAmount === "number"
                ? `$${formatNumber(row.bidAmount)}`
                : undefined,
          },
          { label: "Action", value: row.transactionActionType },
          { label: "Status", value: row.transactionStatus },
        ]}
      />
    </article>
  );
}

function PlayerSeasonMobileCard({
  season,
}: {
  season: PlayerSeasonReport;
}) {
  return (
    <article className="mobileDataCard">
      <div className="mobileCardHeader">
        <strong className="mobileCardTitleText">{season.year}</strong>
        <span className="mobileCardKicker">
          #{season.playerRank} overall
        </span>
      </div>
      <MobileFieldGrid
        items={[
          {
            label: "Fantasy Points",
            value: formatNumber(season.fantasyPoints, 1),
          },
          {
            label: "Position Rank",
            value: `#${season.positionRank}${
              season.position ? ` ${season.position}` : ""
            }`,
          },
          { label: "Fantasy Team", value: season.fantasyTeamName || "FA" },
          { label: "NFL Team", value: season.nflTeam ?? "-" },
          { label: "Games", value: season.gamesPlayed },
          { label: "Starts", value: season.starts },
        ]}
      />
    </article>
  );
}

function KeeperMobileCard({
  row,
  showsYear,
}: {
  row: KeeperRow;
  showsYear: boolean;
}) {
  return (
    <article className="mobileDataCard">
      <div className="mobileCardHeader">
        {row.playerKey ? (
          <Link className="mobileCardTitle" to={`/player/${row.playerKey}?fromYear=${row.year}`}>
            {row.name}
          </Link>
        ) : (
          <strong className="mobileCardTitleText">{row.name}</strong>
        )}
        <span className="mobileCardKicker">
          {showsYear ? row.year : row.position ?? "-"}
        </span>
      </div>
      <MobileFieldGrid
        items={[
          { label: "Year", value: showsYear ? row.year : undefined },
          { label: "Auction Value", value: formatAuctionValue(row.auctionValue) },
          { label: "Position", value: row.position ?? "-" },
          { label: "Team", value: row.teamName },
          { label: "Pick", value: row.draftPick },
        ]}
      />
    </article>
  );
}

function StandingsMobileCard({ team }: { team: PublicTeam }) {
  return (
    <article className="mobileDataCard">
      <div className="mobileCardHeader">
        <TeamLabel team={team} />
        <span className="mobileCardKicker">
          Finish {team.finalStanding ?? "-"}
        </span>
      </div>
      <MobileFieldGrid
        items={[
          { label: "Owner", value: team.ownerNames.join(", ") || "-" },
          { label: "Record", value: `${team.wins}-${team.losses}` },
          { label: "PF", value: formatNumber(team.pointsFor) },
          { label: "PA", value: formatNumber(team.pointsAgainst) },
          { label: "Moves", value: team.transactions.acquisitions },
        ]}
      />
    </article>
  );
}

function DraftPickMobileCard({
  pick,
  teamNames,
}: {
  pick: DraftPick;
  teamNames: Map<string, string>;
}) {
  return (
    <article className="mobileDataCard">
      <div className="mobileCardHeader">
        <strong className="mobileCardTitleText">{pick.playerName}</strong>
        <span className="mobileCardKicker">Pick {pick.pick}</span>
      </div>
      <MobileFieldGrid
        items={[
          { label: "Round", value: pick.round ?? "-" },
          { label: "Team", value: teamDisplay(pick.teamKey, teamNames) },
          {
            label: "Bid",
            value:
              typeof pick.bidAmount === "number"
                ? `$${formatNumber(pick.bidAmount)}`
                : "-",
          },
          { label: "Keeper", value: pick.keeperStatus ? "Yes" : undefined },
        ]}
      />
    </article>
  );
}

function MatchupMobileCard({
  matchup,
  teamNames,
}: {
  matchup: Matchup;
  teamNames: Map<string, string>;
}) {
  return (
    <article className="mobileDataCard">
      <div className="mobileScoreRows">
        <MobileScoreRow
          label="Away"
          team={teamDisplay(matchup.awayTeamKey, teamNames)}
          score={matchup.awayScore}
          isWinner={matchup.winnerTeamKey === matchup.awayTeamKey}
        />
        <MobileScoreRow
          label="Home"
          team={teamDisplay(matchup.homeTeamKey, teamNames)}
          score={matchup.homeScore}
          isWinner={matchup.winnerTeamKey === matchup.homeTeamKey}
        />
      </div>
      <MobileFieldGrid
        items={[
          {
            label: "Winner",
            value: teamDisplay(matchup.winnerTeamKey, teamNames),
          },
          { label: "Type", value: matchup.matchupType },
          { label: "Playoff", value: matchup.isPlayoff ? "Yes" : undefined },
        ]}
      />
    </article>
  );
}

function TransactionMobileCard({
  transaction,
  teamNames,
}: {
  transaction: Transaction;
  teamNames: Map<string, string>;
}) {
  return (
    <article className="mobileDataCard">
      <div className="mobileCardHeader">
        <strong className="mobileCardTitleText">
          {transaction.type || "Transaction"}
        </strong>
        <span className="mobileCardKicker">
          {formatDate(transaction.date)}
        </span>
      </div>
      <p className="mobileCardSummary">{transactionItemsLabel(transaction)}</p>
      <MobileFieldGrid
        items={[
          { label: "Team", value: teamDisplay(transaction.teamKey, teamNames) },
          {
            label: "FAB",
            value: formatTransactionFab(transaction.type, transaction.bidAmount),
          },
          { label: "Status", value: transaction.status },
          { label: "Period", value: transaction.scoringPeriod },
        ]}
      />
    </article>
  );
}

function MobileScoreRow({
  label,
  team,
  score,
  isWinner,
}: {
  label: string;
  team: string;
  score?: number;
  isWinner: boolean;
}) {
  return (
    <div className={isWinner ? "mobileScoreRow winner" : "mobileScoreRow"}>
      <span>
        <small>{label}</small>
        <strong>{team}</strong>
      </span>
      <strong className="mobileScoreValue">{formatNumber(score)}</strong>
    </div>
  );
}

function MobileFieldGrid({
  items,
}: {
  items: Array<{ label: string; value: React.ReactNode }>;
}) {
  const visibleItems = items.filter(
    (item) => item.value !== undefined && item.value !== null && item.value !== "",
  );

  if (!visibleItems.length) {
    return null;
  }

  return (
    <dl className="mobileFieldGrid">
      {visibleItems.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function transactionItemsLabel(transaction: Transaction): string {
  if (!transaction.items.length) {
    return "No player details";
  }
  return transaction.items
    .map((item) => (item.type ? `${item.type}: ${item.player}` : item.player))
    .join(", ");
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
      <Breadcrumbs
        items={[
          { label: "Home", to: "/" },
          { label: "Seasons", to: "/browse?type=season" },
          { label: `${season.data.year} Season` },
        ]}
      />
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
              aria-label="Filter standings"
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
          mobileCard={(team) => <StandingsMobileCard team={team} />}
          mobileLabel="Standings cards"
        />
      </section>

      <section className="contentBand">
        <div className="sectionHeader">
          <h2>Drafts</h2>
        </div>
        <SimpleTable
          data={season.data.draft}
          columns={draftColumns}
          mobileCard={(pick) => (
            <DraftPickMobileCard pick={pick} teamNames={teamNames} />
          )}
          mobileLabel="Draft pick cards"
        />
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
    {
      header: "FAB",
      accessorKey: "bidAmount",
      cell: ({ row }) =>
        formatTransactionFab(row.original.type, row.original.bidAmount),
    },
    { header: "Status", accessorKey: "status" },
    {
      header: "Players",
      accessorFn: (transaction) =>
        transaction.items.map((item) => `${item.type}: ${item.player}`).join(", "),
    },
  ];

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Home", to: "/" },
          { label: "Seasons", to: "/browse?type=season" },
          { label: `${season.data.year} Season`, to: `/season/${season.data.year}` },
          { label: `Week ${weekData.data.week}` },
        ]}
      />
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
        <SimpleTable
          data={weekData.data.scoreboard}
          columns={matchupColumns}
          mobileCard={(matchup) => (
            <MatchupMobileCard matchup={matchup} teamNames={teamNames} />
          )}
          mobileLabel="Scoreboard cards"
        />
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
                    year={season.data.year}
                  />
                  <LineupTable
                    title={teamDisplay(boxScore.homeTeamKey, teamNames)}
                    players={boxScore.homeLineup}
                    year={season.data.year}
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
          mobileCard={(transaction) => (
            <TransactionMobileCard
              transaction={transaction}
              teamNames={teamNames}
            />
          )}
          mobileLabel="Transaction cards"
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
  year,
}: {
  title: string;
  players: PublicWeek["boxScores"][number]["homeLineup"];
  year: number;
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
              <LineupRow player={player} year={year} key={lineupRowKey(player, index)} />
            ))}
            {starterRows.length ? (
              <LineupSummaryRow label="Starters Total" players={starterRows} />
            ) : null}
            {benchRows.map((player, index) => (
              <LineupRow player={player} year={year} key={lineupRowKey(player, index)} />
            ))}
            {benchRows.length ? (
              <LineupSummaryRow label="Bench Total" players={benchRows} />
            ) : null}
            {irRows.map((player, index) => (
              <LineupRow player={player} year={year} key={lineupRowKey(player, index)} />
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
  year,
}: {
  player: LineupPlayer;
  year: number;
}) {
  const injuryLabel = displayInjuryStatus(player.injuryStatus);
  const section = lineupSection(player);

  return (
    <tr className={`boxScorePlayerRow ${section}`}>
      <td className="slotCell">{displayLineupSlot(player)}</td>
      <td className="playerCell">
        <span className="lineupPlayerName">
          {player.key ? (
            <Link to={`/player/${player.key}?fromYear=${year}`}>
              <strong>{player.name}</strong>
            </Link>
          ) : (
            <strong>{player.name}</strong>
          )}
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

function Breadcrumbs({
  items,
}: {
  items: Array<BreadcrumbItem | undefined>;
}) {
  const visibleItems = items.filter(
    (item): item is BreadcrumbItem => Boolean(item),
  );

  if (visibleItems.length < 2) {
    return null;
  }

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ol>
        {visibleItems.map((item, index) => {
          const isCurrent = index === visibleItems.length - 1;
          return (
            <li key={`${item.label}-${index}`}>
              {item.to && !isCurrent ? (
                <Link to={item.to}>{item.label}</Link>
              ) : (
                <span aria-current={isCurrent ? "page" : undefined}>
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function TeamLabel({ team }: { team: PublicTeam }) {
  const logoUrl = archivePublicUrl(team.logoUrl);

  return (
    <span className="teamLabel">
      {logoUrl ? <img src={logoUrl} alt="" loading="lazy" /> : null}
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

function keeperColumnsForView(showsYear: boolean): ColumnDef<KeeperRow>[] {
  const columns: ColumnDef<KeeperRow>[] = [
    {
      header: "Auction Value",
      accessorKey: "auctionValue",
      cell: ({ row }) => formatAuctionValue(row.original.auctionValue),
    },
    {
      header: "Position",
      accessorKey: "position",
      cell: ({ row }) => row.original.position ?? "-",
    },
    {
      header: "Name",
      accessorKey: "name",
      cell: ({ row }) =>
        row.original.playerKey ? (
          <Link to={`/player/${row.original.playerKey}?fromYear=${row.original.year}`}>
            {row.original.name}
          </Link>
        ) : (
          row.original.name
        ),
    },
    {
      header: "Team Name",
      accessorKey: "teamName",
    },
  ];

  if (showsYear) {
    columns.unshift({
      header: "Year",
      accessorKey: "year",
    });
  }

  return columns;
}

function formatAuctionValue(value: number | undefined): string {
  return typeof value === "number" && Number.isFinite(value)
    ? `$${formatNumber(value)}`
    : "-";
}

function formatTransactionFab(type?: string, bidAmount?: number): string {
  if (type?.toUpperCase() === "FREEAGENT") {
    return "N/A";
  }
  if (typeof bidAmount === "number" && Number.isFinite(bidAmount)) {
    return `$${formatNumber(bidAmount)}`;
  }
  return "N/A";
}

function resultColumnsForType(type: BrowserFilterType): ColumnDef<SearchRow>[] {
  if (type === "draft") {
    return draftSearchColumns;
  }
  if (type === "transaction") {
    return transactionSearchColumns;
  }
  return searchColumns;
}

function sortSearchRows(rows: SearchRow[]): SearchRow[] {
  return [...rows].sort((left, right) => {
    if (left.year !== right.year) {
      return right.year - left.year;
    }

    if (left.type !== right.type) {
      return left.type.localeCompare(right.type);
    }

    const leftWeek = left.week ?? -1;
    const rightWeek = right.week ?? -1;
    if (leftWeek !== rightWeek) {
      return rightWeek - leftWeek;
    }

    if (left.type === "draft" && right.type === "draft") {
      const leftPick = left.draftPick ?? Number.MAX_SAFE_INTEGER;
      const rightPick = right.draftPick ?? Number.MAX_SAFE_INTEGER;
      if (leftPick !== rightPick) {
        return leftPick - rightPick;
      }
    }

    return left.label.localeCompare(right.label);
  });
}

function sortKeeperRows(left: KeeperRow, right: KeeperRow): number {
  if (left.year !== right.year) {
    return right.year - left.year;
  }

  const teamCompare = left.teamName.localeCompare(right.teamName);
  if (teamCompare !== 0) {
    return teamCompare;
  }

  const leftPick = left.draftPick ?? Number.MAX_SAFE_INTEGER;
  const rightPick = right.draftPick ?? Number.MAX_SAFE_INTEGER;
  if (leftPick !== rightPick) {
    return leftPick - rightPick;
  }

  return left.name.localeCompare(right.name);
}

function normalizeKeeperYear(
  year: string | null,
  availableYears: number[],
): string {
  if (year && availableYears.includes(Number(year))) {
    return year;
  }
  return "all";
}

function groupRowsByYear(rows: SearchRow[]): Array<{ year: number; rows: SearchRow[] }> {
  const grouped = rows.reduce((groups, row) => {
    const existingRows = groups.get(row.year) ?? [];
    existingRows.push(row);
    groups.set(row.year, existingRows);
    return groups;
  }, new Map<number, SearchRow[]>());

  return [...grouped.entries()]
    .sort(([leftYear], [rightYear]) => rightYear - leftYear)
    .map(([year, yearRows]) => ({
      year,
      rows: [...yearRows].sort((left, right) => left.label.localeCompare(right.label)),
    }));
}

function pluralizeTeam(count: number): string {
  return count === 1 ? "team" : "teams";
}

function pluralizeSeason(count: number): string {
  return count === 1 ? "season" : "seasons";
}

function pluralizeWeek(count: number): string {
  return count === 1 ? "week" : "weeks";
}

function pluralizePlayer(count: number): string {
  return count === 1 ? "player" : "players";
}

function pluralizeDraftPick(count: number): string {
  return count === 1 ? "draft pick" : "draft picks";
}

function pluralizeRowType(type: SearchType, count: number): string {
  if (type === "team") {
    return pluralizeTeam(count);
  }
  if (type === "week") {
    return pluralizeWeek(count);
  }
  if (type === "draft") {
    return pluralizeDraftPick(count);
  }
  if (type === "player") {
    return pluralizePlayer(count);
  }
  if (type === "season") {
    return pluralizeSeason(count);
  }
  if (type === "transaction") {
    return count === 1 ? "transaction" : "transactions";
  }
  return count === 1 ? "row" : "rows";
}

function recordYearSummary(type: SearchType, count: number): string {
  return `${formatNumber(count)} ${pluralizeRowType(type, count)}`;
}

function recordTypeIcon(type: SearchType): React.ReactNode {
  if (type === "team") {
    return <Shield size={20} aria-hidden />;
  }
  if (type === "week") {
    return <CalendarDays size={20} aria-hidden />;
  }
  if (type === "transaction") {
    return <ArrowRight size={20} aria-hidden />;
  }
  if (type === "draft") {
    return <Database size={20} aria-hidden />;
  }
  return <Search size={20} aria-hidden />;
}

function browserBreadcrumbItems(filters: BrowserFilters): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [{ label: "Home", to: "/" }];

  if (filters.type !== "all") {
    const typeLabel =
      recordTypeOptions.find((option) => option.value === filters.type)?.label ??
      filters.type;
    items.push({
      label: typeLabel,
      to: filters.year === "all" ? undefined : `/browse?type=${filters.type}`,
    });
  }

  if (filters.year !== "all") {
    items.push({ label: filters.year });
  } else if (filters.view === "all" && filters.type !== "all") {
    items.push({ label: "All Seasons" });
  }

  return items;
}

function playerDetailHref(row: SearchRow): string | undefined {
  if (row.playerKey) {
    return `/player/${row.playerKey}?fromYear=${row.year}`;
  }
  if (row.type === "player" && row.href.startsWith("/player/")) {
    const separator = row.href.includes("?") ? "&" : "?";
    return `${row.href}${separator}fromYear=${row.year}`;
  }
  return undefined;
}

function playerYearBrowseHref(year: number, query: string): string {
  return yearBrowseHref("player", year, query);
}

function matchupYearBrowseHref(year: number, query: string): string {
  return yearBrowseHref("matchup", year, query);
}

function draftYearBrowseHref(year: number, query: string): string {
  return yearBrowseHref("draft", year, query);
}

function yearBrowseHref(type: SearchType, year: number, query: string): string {
  const params = new URLSearchParams({
    type,
    year: String(year),
  });
  const normalizedQuery = query.trim();

  if (normalizedQuery) {
    params.set("q", normalizedQuery);
  }

  return `/browse?${params.toString()}`;
}

function allSeasonsBrowseHref(type: SearchType, query: string): string {
  const params = new URLSearchParams({
    type,
    view: "all",
  });
  const normalizedQuery = query.trim();

  if (normalizedQuery) {
    params.set("q", normalizedQuery);
  }

  return `/browse?${params.toString()}`;
}

function matchesMatchupWeekQuery(week: number, query: string): boolean {
  if (!query) {
    return true;
  }

  const weekSearch = query.match(/\d+/)?.[0];
  if (!weekSearch) {
    return true;
  }

  return String(week).includes(weekSearch) || `week ${week}`.includes(query);
}

function matchesPlayerYearQuery(
  player: PublicPlayer,
  season: PlayerSeasonReport,
  query: string,
): boolean {
  if (!query) {
    return true;
  }

  const haystack = [
    player.name,
    player.primaryPosition,
    season.position,
    season.nflTeam,
    season.fantasyTeamName,
    season.year,
    season.playerRank,
    season.positionRank,
  ].join(" ");

  return haystack.toLowerCase().includes(query);
}

function filtersFromSearchParams(searchParams: URLSearchParams): BrowserFilters {
  const type = searchParams.get("type");

  return normalizeFilters({
    query: searchParams.get("q") ?? "",
    type: isBrowserFilterType(type) ? type : "all",
    year: searchParams.get("year") ?? "all",
    view: searchParams.get("view") === "all" ? "all" : "picker",
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
  if (normalizedFilters.view === "all") {
    params.set("view", "all");
  }

  return params;
}

function normalizeFilters(filters: BrowserFilters): BrowserFilters {
  const query = filters.query.trim();
  const type = isBrowserFilterType(filters.type) ? filters.type : "all";
  const year =
    filters.year === "all" || /^\d{4}$/.test(filters.year) ? filters.year : "all";
  const view = filters.view === "all" ? "all" : "picker";

  return { query, type, year, view };
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
    normalizedLeft.year === normalizedRight.year &&
    normalizedLeft.view === normalizedRight.view
  );
}

export default App;
