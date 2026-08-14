import { ColumnDef } from "@tanstack/react-table";
import {
  ArrowRight,
  ArrowLeftRight,
  BarChart3,
  ChevronDown,
  Home,
  Search,
  Shield,
  X,
} from "lucide-react";
import {
  LiaArchiveSolid,
  LiaCalendarAltSolid,
  LiaChartBarSolid,
  LiaClipboardListSolid,
  LiaExchangeAltSolid,
  LiaFootballBallSolid,
  LiaSearchSolid,
  LiaTrophySolid,
  LiaUsersSolid,
} from "react-icons/lia";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  Link,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  archivePublicUrl,
  fetchArchiveJson,
  formatDate,
  formatNumber,
  formatOwnerNames,
  teamDisplay,
} from "./data";
import { SimpleTable } from "./SimpleTable";
import {
  ArchiveManifest,
  BoxScore,
  DraftPick,
  Matchup,
  PublicSeason,
  PublicTeam,
  PublicPlayer,
  PublicTrade,
  PublicWeek,
  PlayerSeasonReport,
  LineupPlayer,
  SearchRow,
  SearchType,
  Transaction,
} from "./types";
import { useArchiveJson } from "./useArchiveJson";
import { includesSearchText, normalizeSearchText } from "./search";

type BrowserFilterType = SearchType | "all";
type BrowserView = "picker" | "all";

type BrowserFilters = {
  query: string;
  type: BrowserFilterType;
  year: string;
  view: BrowserView;
  position: PositionFilter | "";
};

type PositionFilter = (typeof positionFilterOptions)[number];

type KeeperFilters = {
  query: string;
  year: string;
  position: PositionFilter | "";
};

type KeeperRow = {
  id: string;
  year: number;
  auctionValue?: number;
  position?: string;
  name: string;
  teamName: string;
  keeperEligible: boolean;
  teamKey?: string;
  playerKey?: string;
  draftPick?: number;
};

type PlayerSearchResult = {
  id: string;
  year: number;
  player: PublicPlayer;
  season: PlayerSeasonReport;
};

type TeamMatchupRow = {
  id: string;
  week: number;
  href: string;
  opponentKey?: string;
  opponentName: string;
  location: "Home" | "Away" | "-";
  teamScore?: number;
  opponentScore?: number;
  outcome?: string;
  matchupType?: string;
  isPlayoff: boolean;
};

type TeamRosterSnapshot = {
  week: number;
  players: LineupPlayer[];
};

type TeamRosterAggregateRow = {
  id: string;
  player: LineupPlayer;
  positionRank?: number;
  appearances: number;
  starts: number;
  totalProjected: number;
  totalPoints: number;
  averageProjected: number;
  averagePoints: number;
};

type TeamDraftSummaryRow = {
  id: string;
  pick: DraftPick;
  player: LineupPlayer;
  auctionValue?: number;
  positionRank?: number;
  totalFantasyPoints?: number;
};

const LEAGUE_ORIGIN_DATE = { year: 2005, monthIndex: 6, day: 1 };

type LeagueRecordData = {
  season: PublicSeason;
  weeks: PublicWeek[];
};

type LeagueRecordDataState =
  | { status: "idle" | "loading"; data: LeagueRecordData[]; requestKey: string }
  | { status: "loaded"; data: LeagueRecordData[]; requestKey: string }
  | { status: "error"; data: LeagueRecordData[]; requestKey: string };

type ScoredMatchup = Matchup & { homeScore: number; awayScore: number };

type FeaturedBroadcastScore = {
  year: number;
  matchup: ScoredMatchup;
  homeTeam?: PublicTeam;
  awayTeam?: PublicTeam;
};

type FeaturedBroadcastScoreState =
  | { status: "loading"; data?: undefined }
  | { status: "loaded"; data?: FeaturedBroadcastScore }
  | { status: "error"; data?: undefined };

type LeagueRecordCard = {
  id: string;
  title: string;
  value: string;
  subtitle: string;
  meta: string;
  href?: string;
};

type LeagueRecordCandidate = {
  value: number;
  subtitle: string;
  meta: string;
  href?: string;
};

type OwnerRecordRow = {
  id: string;
  owner: string;
  seasons: number;
  championships: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  averagePointsFor: number;
  averagePointsAgainst: number;
};

type ChampionRecordRow = {
  id: string;
  year: number;
  owner: string;
  teamName: string;
  record?: string;
  pointsFor?: number;
  pointsAgainst?: number;
  href?: string;
};

type LeagueRecords = {
  highLowRecords: LeagueRecordCard[];
  ownerRows: OwnerRecordRow[];
  championRows: ChampionRecordRow[];
};

type SeasonWeeksState =
  | { status: "idle" | "loading"; data: PublicWeek[]; requestKey: string }
  | { status: "loaded"; data: PublicWeek[]; requestKey: string }
  | { status: "error"; data: PublicWeek[]; requestKey: string };

type BreadcrumbItem = {
  label: string;
  to?: string;
};

// ESPN retains champion results before this archive's detailed data begins in 2012.
const HISTORICAL_CHAMPIONS = [
  { year: 2006, owner: "George B", teamName: "Steve Smith Raptors" },
  { year: 2007, owner: "George B", teamName: "Brady-Moss The Unstopable Toss" },
  { year: 2008, owner: "Ethan J", teamName: "Urine the Championship!!!" },
  { year: 2009, owner: "Mark M", teamName: "The T.No Show" },
  { year: 2010, owner: "Ethan J", teamName: "Whatchu Talkin Bout Hillis?" },
  { year: 2011, owner: "Andy M", teamName: "Make it Dwayne On Them Bowes" },
] as const;

const defaultFilters: BrowserFilters = {
  query: "",
  type: "all",
  year: "all",
  view: "picker",
  position: "",
};

const positionFilterOptions = ["QB", "RB", "WR", "TE", "OP", "D/ST", "K", "HC"] as const;

const recordTypeOptions: Array<{ value: BrowserFilterType; label: string }> = [
  { value: "all", label: "All record types" },
  { value: "season", label: "Seasons" },
  { value: "team", label: "Teams" },
  { value: "week", label: "Weeks" },
  { value: "transaction", label: "Add/Drop" },
  { value: "draft", label: "Drafts" },
  { value: "player", label: "Players" },
];

enum TransactionTypeLabel {
  FREEAGENT = "Free Agent",
  ROSTER = "Roster",
  TRADE_ACCEPT = "Trade",
  WAIVER = "Waiver",
}

enum TransactionStatusLabel {
  CANCELED = "Canceled",
  EXECUTED = "Executed",
  FAILED_AUCTIONBUDGETEXCEEDED = "Failed: Auction Budget Exceeded",
  FAILED_INVALIDPLAYERSOURCE = "Failed: Invalid Player Source",
  FAILED_IRSLOT = "Failed: IR Slot",
  FAILED_MATCHUPACQUISITIONLIMIT = "Failed: Matchup Acquisition Limit",
  FAILED_PLAYERALREADYDROPPED = "Failed: Player Already Dropped",
  FAILED_POSITIONLIMIT = "Failed: Position Limit",
  FAILED_ROSTERLIMIT = "Failed: Roster Limit",
  FAILED_ROSTERLOCK = "Failed: Roster Lock",
  PENDING = "Pending",
}

enum TransactionItemTypeLabel {
  ADD = "Add",
  DROP = "Drop",
  LINEUP = "Lineup",
  TRADE = "Trade",
}

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
    title: "Records",
    label: "See league records, championships, and lifetime owner scoring totals.",
    to: "/records",
    icon: <LiaChartBarSolid size={22} aria-hidden />,
  },
  {
    title: "Drafts",
    label: "Find historical draft picks and auction values.",
    to: "/drafts",
    icon: <LiaClipboardListSolid size={22} aria-hidden />,
  },
  {
    title: "Keepers",
    label: "Review keeper auction values and teams by season.",
    to: "/keepers",
    icon: <LiaTrophySolid size={22} aria-hidden />,
  },
  {
    title: "Teams",
    label: "Find team records, owners, yearly results, and weekly scoring.",
    to: "/browse?type=team",
    icon: <LiaUsersSolid size={22} aria-hidden />,
  },
  {
    title: "Players",
    label: "Browse player season rankings and fantasy point totals.",
    to: "/players",
    icon: <LiaFootballBallSolid size={22} aria-hidden />,
  },
  {
    title: "Add / Drops",
    label: "Review historical waiver and roster moves.",
    to: "/freeagency",
    icon: <LiaExchangeAltSolid size={22} aria-hidden />,
  },
  {
    title: "Season Pages",
    label: "Open season summaries, standings, draft data, settings, and week links.",
    to: "/browse?type=season",
    icon: <LiaArchiveSolid size={22} aria-hidden />,
  },
  {
    title: "Weekly Results",
    label: "Jump into weekly scoreboards, box scores, and transaction logs.",
    to: "/browse?type=week",
    icon: <LiaCalendarAltSolid size={22} aria-hidden />,
  },
  {
    title: "Trades",
    label: "Browse executed player trades from past seasons.",
    to: "/trades",
    icon: <LiaExchangeAltSolid size={22} aria-hidden />,
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
      <Link to={searchRowDetailHref(row.original)}>
        {row.original.label}
      </Link>
    ),
  },
  {
    header: "Summary",
    accessorKey: "summary",
    cell: ({ row }) => displaySearchRowSummary(row.original),
  },
];

const playerSearchColumns: ColumnDef<PlayerSearchResult>[] = [
  {
    header: "Season",
    accessorKey: "year",
  },
  {
    header: "Position",
    id: "position",
    accessorFn: (row) => row.season.position ?? row.player.primaryPosition ?? "",
    cell: ({ row }) =>
      row.original.season.position ?? row.original.player.primaryPosition ?? "-",
  },
  {
    header: "Player",
    id: "player",
    accessorFn: (row) => row.player.name,
    cell: ({ row }) => (
      <Link to={`/player/${row.original.player.key}?fromYear=${row.original.year}`}>
        {row.original.player.name}
      </Link>
    ),
  },
  {
    header: "NFL Team",
    id: "nflTeam",
    accessorFn: (row) => row.season.nflTeam ?? "",
    cell: ({ row }) => row.original.season.nflTeam ?? "-",
  },
  {
    header: "Fantasy Team",
    id: "fantasyTeam",
    accessorFn: (row) => row.season.fantasyTeamName,
    cell: ({ row }) => <FantasyTeamLink season={row.original.season} />,
  },
  {
    header: "Draft Value",
    id: "draftValue",
    accessorFn: (row) => row.season.draftValue ?? 0,
    cell: ({ row }) => formatDraftValue(row.original.season.draftValue),
  },
  {
    header: "P:D",
    id: "pointsPerDollar",
    accessorFn: (row) => pointsPerDollar(row.season) ?? 0,
    cell: ({ row }) => (
      <span className="numberText">
        {formatNumber(pointsPerDollar(row.original.season), 1)}
      </span>
    ),
  },
  {
    header: "Fantasy Points",
    id: "points",
    accessorFn: (row) => row.season.fantasyPoints,
    cell: ({ row }) => (
      <span className="numberText">
        {formatNumber(row.original.season.fantasyPoints, 1)}
      </span>
    ),
  },
  {
    header: "PVOA",
    id: "pvoa",
    accessorFn: (row) => seasonPvoa(row.season),
    cell: ({ row }) => {
      const pvoa = seasonPvoa(row.original.season);
      return <span className={pvoaClassName(pvoa)}>{formatPvoa(pvoa)}</span>;
    },
  },
  {
    header: "Player Rank",
    id: "playerRank",
    accessorFn: (row) => row.season.playerRank,
    cell: ({ row }) => `#${row.original.season.playerRank}`,
  },
  {
    header: "Position Rank",
    id: "positionRank",
    accessorFn: (row) => row.season.positionRank,
    cell: ({ row }) => formatPositionRank(row.original.season),
  },
  {
    header: "Starts",
    id: "starts",
    accessorFn: (row) => row.season.starts,
  },
];

const draftSearchColumns: ColumnDef<SearchRow>[] = [
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
    cell: ({ row }) => <TeamSearchLink row={row.original} />,
  },
  {
    header: "Draft Amount",
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
    cell: ({ row }) => displaySearchTransactionAction(row.original) ?? "Transaction",
  },
  {
    header: "FAB",
    accessorKey: "bidAmount",
    cell: ({ row }) =>
      formatTransactionFab(row.original.transactionType, row.original.bidAmount),
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
    cell: ({ row }) => <TeamSearchLink row={row.original} />,
  },
  {
    header: "Status",
    accessorKey: "transactionStatus",
    cell: ({ row }) =>
      displayTransactionStatus(row.original.transactionStatus) ??
      row.original.summary,
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
    cell: ({ row }) => <FantasyTeamLink season={row.original} />,
  },
  {
    header: "Draft Value",
    id: "draftValue",
    accessorFn: (season) => season.draftValue ?? 0,
    cell: ({ row }) => formatDraftValue(row.original.draftValue),
  },
  {
    header: "P:D",
    id: "pointsPerDollar",
    accessorFn: (season) => pointsPerDollar(season) ?? 0,
    cell: ({ row }) => {
      const ratio = pointsPerDollar(row.original);
      return <span className="numberText">{formatNumber(ratio, 1)}</span>;
    },
  },
  {
    header: "Fantasy Points",
    accessorKey: "fantasyPoints",
    cell: ({ row }) => (
      <span className="numberText">{formatNumber(row.original.fantasyPoints, 1)}</span>
    ),
  },
  {
    header: "PVOA",
    id: "pvoa",
    accessorFn: (season) => seasonPvoa(season),
    cell: ({ row }) => {
      const pvoa = seasonPvoa(row.original);
      return <span className={pvoaClassName(pvoa)}>{formatPvoa(pvoa)}</span>;
    },
  },
  {
    header: "Player Rank",
    accessorKey: "playerRank",
    cell: ({ row }) => `#${row.original.playerRank}`,
  },
  {
    header: "Position Rank",
    accessorKey: "positionRank",
    cell: ({ row }) => formatPositionRank(row.original),
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
          <span>CPFFL</span>
        </Link>
        <nav aria-label="Primary navigation">
          <NavLink to="/" end>
            <Home size={16} aria-hidden />
            Home
          </NavLink>
          <NavLink to="/browse">
            <Search size={16} aria-hidden />
            Browse
          </NavLink>
          <NavLink to="/records">
            <BarChart3 size={16} aria-hidden />
            Records
          </NavLink>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<DataLandingPage />} />
          <Route path="/records" element={<RecordsPage />} />
          <Route path="/keepers" element={<KeepersPage />} />
          <Route path="/browse" element={<BrowserPage />} />
          <Route path="/freeagency" element={<Navigate replace to="/browse?type=transaction" />} />
          <Route path="/trades" element={<TradesPage />} />
          <Route path="/drafts" element={<DraftBrowserPage />} />
          <Route path="/players" element={<PlayerBrowserPage />} />
          <Route path="/player/:playerKey" element={<PlayerPage />} />
          <Route path="/season/:year" element={<SeasonPage />} />
          <Route path="/season/:year/team/:teamKey/draft" element={<TeamDraftPage />} />
          <Route path="/season/:year/team/:teamKey" element={<TeamPage />} />
          <Route path="/season/:year/week/:week" element={<WeekPage />} />
        </Routes>
      </main>
    </div>
  );
}

function DataLandingPage() {
  const manifest = useArchiveJson<ArchiveManifest>("manifest.json");
  const leagueAge = yearsSinceLeagueOrigin();
  const sortedSeasonSummaries = useMemo(
    () =>
      manifest.status === "loaded"
        ? [...manifest.data.seasons].sort((left, right) => left.year - right.year)
        : [],
    [manifest],
  );
  const firstSeason = sortedSeasonSummaries.at(0)?.year;
  const latestSeason = sortedSeasonSummaries.at(-1)?.year;
  const featuredBroadcastScore = useFeaturedBroadcastScore(latestSeason);

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
  const playerCount = manifest.data.seasons.reduce(
    (total, season) => total + season.playerCount,
    0,
  );
  const broadcastScore =
    featuredBroadcastScore.status === "loaded"
      ? featuredBroadcastScore.data
      : undefined;

  return (
    <>
      <section className="landingHero">
        <div className="heroCopy">
          <h1>Couch Potatoes x{leagueAge}</h1>
          <p>
            A backup data archive of the CPFFL ESPN based fantasy football league, for when Disney inevitably decides to offload more data from their servers and our hard earned championships are forever lost.
          </p>
          <div className="heroActions" aria-label="Primary archive actions">
            <Link className="primaryButton" to="/players">
              <Search size={16} aria-hidden />
              Browse Players
            </Link>
            <Link className="ghostButton heroGhostButton" to="/records">
              <BarChart3 size={16} aria-hidden />
              View records
            </Link>
          </div>
        </div>
        <div className="broadcastPanel" aria-label="Archive broadcast summary">
          <div
            className={broadcastScore ? "scorebug hasScore" : "scorebug"}
            aria-label={
              broadcastScore
                ? `${broadcastTeamLabel(
                    broadcastScore.awayTeam,
                    broadcastScore.matchup.awayTeamKey,
                    "Away",
                  )} ${formatNumber(
                    broadcastScore.matchup.awayScore,
                    2,
                  )} at ${broadcastTeamLabel(
                    broadcastScore.homeTeam,
                    broadcastScore.matchup.homeTeamKey,
                    "Home",
                  )} ${formatNumber(
                    broadcastScore.matchup.homeScore,
                    2,
                  )}, ${broadcastScore.year} final`
                : "CPFFL archive final scorebug"
            }
          >
            {broadcastScore ? (
              <>
                <span
                  className={
                    broadcastScore.matchup.winnerTeamKey ===
                    broadcastScore.matchup.awayTeamKey
                      ? "scorebugTeam winner"
                      : "scorebugTeam"
                  }
                >
                  <small>
                    {broadcastTeamLabel(
                      broadcastScore.awayTeam,
                      broadcastScore.matchup.awayTeamKey,
                      "Away",
                    )}
                  </small>
                  <b>{formatNumber(broadcastScore.matchup.awayScore, 2)}</b>
                </span>
                <span
                  className={
                    broadcastScore.matchup.winnerTeamKey ===
                    broadcastScore.matchup.homeTeamKey
                      ? "scorebugTeam winner"
                      : "scorebugTeam"
                  }
                >
                  <small>
                    {broadcastTeamLabel(
                      broadcastScore.homeTeam,
                      broadcastScore.matchup.homeTeamKey,
                      "Home",
                    )}
                  </small>
                  <b>{formatNumber(broadcastScore.matchup.homeScore, 2)}</b>
                </span>
                <strong>{broadcastScore.year}</strong>
                <span>FINAL</span>
              </>
            ) : (
              <>
                <span>CPFFL</span>
                <strong>{latestSeason ?? "Archive"}</strong>
                <span>FINAL</span>
              </>
            )}
          </div>
          <div className="fieldGraphic" aria-hidden>
            <div className="yardNumbers top">
              <span>10</span>
              <span>20</span>
              <span>30</span>
              <span>40</span>
              <span>50</span>
              <span>40</span>
              <span>30</span>
              <span>20</span>
              <span>10</span>
            </div>
            <div className="yardNumbers bottom">
              <span>10</span>
              <span>20</span>
              <span>30</span>
              <span>40</span>
              <span>50</span>
              <span>40</span>
              <span>30</span>
              <span>20</span>
              <span>10</span>
            </div>
            <LiaFootballBallSolid className="heroFootball" size={58} />
          </div>
          <dl className="heroStats">
            <div>
              <dt>Seasons</dt>
              <dd>
                {firstSeason && latestSeason
                  ? `${firstSeason}-${latestSeason}`
                  : formatNumber(manifest.data.seasons.length)}
              </dd>
            </div>
            <div>
              <dt>Matchups</dt>
              <dd>{formatNumber(matchupCount)}</dd>
            </div>
            <div>
              <dt>Players</dt>
              <dd>{formatNumber(playerCount)}</dd>
            </div>
          </dl>
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

function RecordsPage() {
  const manifest = useArchiveJson<ArchiveManifest>("manifest.json");
  const players = useArchiveJson<PublicPlayer[]>("players.json");
  const seasonYears = useMemo(
    () =>
      manifest.status === "loaded"
        ? manifest.data.seasons.map((season) => season.year)
        : [],
    [manifest],
  );
  const recordData = useLeagueRecordData(seasonYears);
  const records = useMemo(
    () =>
      recordData.status === "loaded" && players.status === "loaded"
        ? buildLeagueRecords(recordData.data, players.data)
        : undefined,
    [players, recordData],
  );

  const championColumns = useMemo<ColumnDef<ChampionRecordRow>[]>(
    () => [
      {
        header: "Year",
        accessorKey: "year",
      },
      {
        header: "Owner",
        accessorKey: "owner",
      },
      {
        header: "Team",
        accessorKey: "teamName",
        cell: ({ row }) => <ChampionTeam row={row.original} />,
      },
      {
        header: "PF",
        accessorKey: "pointsFor",
        cell: ({ row }) => formatScore(row.original.pointsFor, false),
      },
      {
        header: "PA",
        accessorKey: "pointsAgainst",
        cell: ({ row }) => formatScore(row.original.pointsAgainst, false),
      },
    ],
    [],
  );
  const ownerColumns = useMemo<ColumnDef<OwnerRecordRow>[]>(
    () => [
      {
        header: "Owner",
        accessorKey: "owner",
      },
      {
        header: "Championships",
        accessorKey: "championships",
      },
      {
        header: "Seasons",
        accessorKey: "seasons",
      },
      {
        header: "Wins",
        accessorKey: "wins",
      },
      {
        header: "Losses",
        accessorKey: "losses",
      },
      {
        header: "Points For",
        accessorKey: "pointsFor",
        cell: ({ row }) => formatScore(row.original.pointsFor, false),
      },
      {
        header: "Points Against",
        accessorKey: "pointsAgainst",
        cell: ({ row }) => formatScore(row.original.pointsAgainst, false),
      },
      {
        header: "Avg PF",
        accessorKey: "averagePointsFor",
        cell: ({ row }) => formatScore(row.original.averagePointsFor),
      },
      {
        header: "Avg PA",
        accessorKey: "averagePointsAgainst",
        cell: ({ row }) => formatScore(row.original.averagePointsAgainst),
      },
    ],
    [],
  );

  if (
    manifest.status === "loading" ||
    players.status === "loading" ||
    recordData.status === "idle" ||
    recordData.status === "loading"
  ) {
    return <StatusPanel label="Loading league records..." />;
  }

  if (
    manifest.status === "error" ||
    players.status === "error" ||
    recordData.status === "error" ||
    !records
  ) {
    return <StatusPanel label="Unable to load league records." tone="danger" />;
  }

  return (
    <>
      <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Records" }]} />
      <section className="pageIntro">
        <div>
          <p className="eyebrow">League history</p>
          <h1>Records</h1>
        </div>
      </section>

      <section className="recordsGrid" aria-label="League high and low records">
        {records.highLowRecords.map((record) => (
          <RecordStatCard record={record} key={record.id} />
        ))}
      </section>

      <section className="contentBand">
        <div className="sectionHeader">
          <h2>Champions By Season</h2>
          <span className="pendingNote">
            {formatNumber(records.championRows.length)}{" "}
            {records.championRows.length === 1 ? "champion" : "champions"}
          </span>
        </div>
        <SimpleTable
          data={records.championRows}
          columns={championColumns}
          emptyLabel="No champions found."
          mobileCard={(row) => <ChampionMobileCard row={row} />}
          mobileLabel="Champion cards"
        />
      </section>

      <section className="contentBand">
        <div className="sectionHeader">
          <h2>Owner Totals</h2>
          <span className="pendingNote">
            {formatNumber(records.ownerRows.length)} owners
          </span>
        </div>
        <p className="pendingNote">
          Championship totals include the 2006–11 ESPN history; all other owner
          statistics begin in 2012.
        </p>
        <SimpleTable
          data={records.ownerRows}
          columns={ownerColumns}
          emptyLabel="No owner totals found."
          mobileCard={(row) => <OwnerRecordMobileCard row={row} />}
          mobileLabel="Owner total cards"
        />
      </section>
    </>
  );
}

function RecordStatCard({ record }: { record: LeagueRecordCard }) {
  const content = (
    <>
      <span className="recordCardTitle" role="heading" aria-level={2}>
        {record.title}
      </span>
      <strong className="recordCardValue">{record.value}</strong>
      <span className="recordCardDetails">
        <span className="recordCardSubtitle">{record.subtitle}</span>
        <span className="recordCardMeta">{record.meta}</span>
      </span>
      <LiaFootballBallSolid className="recordCardIcon" size={62} aria-hidden />
    </>
  );

  return record.href ? (
    <Link className="recordCard" to={record.href}>
      {content}
    </Link>
  ) : (
    <article className="recordCard">{content}</article>
  );
}

function ChampionMobileCard({ row }: { row: ChampionRecordRow }) {
  return (
    <article className="mobileDataCard compact">
      <div className="keeperMobileTitleRow">
        <ChampionTeam className="mobileCardTitle" row={row} />
        <strong className="keeperMobileValue">{row.year}</strong>
      </div>
      <p className="keeperMobileTeamLine">
        {row.owner} · {formatScore(row.pointsFor, false)} PF ·{" "}
        {formatScore(row.pointsAgainst, false)} PA
      </p>
    </article>
  );
}

function ChampionTeam({
  className,
  row,
}: {
  className?: string;
  row: ChampionRecordRow;
}) {
  const label = `${row.teamName}${row.record ? ` (${row.record})` : ""}`;
  return row.href ? (
    <Link className={className} to={row.href}>
      {label}
    </Link>
  ) : (
    <span className={className}>{label}</span>
  );
}

function OwnerRecordMobileCard({ row }: { row: OwnerRecordRow }) {
  return (
    <article className="mobileDataCard">
      <div className="mobileCardHeader">
        <strong className="mobileCardTitleText">{row.owner}</strong>
        <span className="mobileCardKicker">
          {row.championships} {row.championships === 1 ? "title" : "titles"}
        </span>
      </div>
      <MobileFieldGrid
        items={[
          { label: "Seasons", value: row.seasons },
          { label: "Wins", value: row.wins },
          { label: "Losses", value: row.losses },
          { label: "Points For", value: formatScore(row.pointsFor, false) },
          { label: "Points Against", value: formatScore(row.pointsAgainst, false) },
          { label: "Avg PF", value: formatScore(row.averagePointsFor) },
        ]}
      />
    </article>
  );
}

function PositionFilterBadges({
  selectedPosition,
  onChange,
}: {
  selectedPosition: PositionFilter | "";
  onChange: (position: PositionFilter | "") => void;
}) {
  return (
    <div className="positionFilterBadges" aria-label="Position filters">
      <button
        className={selectedPosition ? "positionBadge" : "positionBadge active"}
        type="button"
        aria-pressed={!selectedPosition}
        onClick={() => onChange("")}
      >
        ALL
      </button>
      {positionFilterOptions.map((position) => {
        const isActive = selectedPosition === position;

        return (
          <button
            className={isActive ? "positionBadge active" : "positionBadge"}
            type="button"
            aria-pressed={isActive}
            key={position}
            onClick={() => onChange(position)}
          >
            {position}
          </button>
        );
      })}
    </div>
  );
}

function KeepersPage() {
  const manifest = useArchiveJson<ArchiveManifest>("manifest.json");
  const index = useArchiveJson<SearchRow[]>("search-index.json");
  const players = useArchiveJson<PublicPlayer[]>("players.json");
  const [searchParams, setSearchParams] = useSearchParams();
  const searchParamString = searchParams.toString();
  const [keeperFilters, setKeeperFilters] = useState<KeeperFilters>(() => ({
    query: searchParams.get("q") ?? "",
    year: searchParams.get("year") ?? "all",
    position: normalizePositionFilter(searchParams.get("pos")),
  }));

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
  const selectedPosition = normalizePositionFilter(searchParams.get("pos"));
  const appliedQuery = searchParams.get("q")?.trim() ?? "";
  const normalizedQuery = normalizeSearchText(appliedQuery);
  const showsAllSeasons = selectedYear === "all";

  useEffect(() => {
    const params = new URLSearchParams(searchParamString);
    setKeeperFilters({
      query: params.get("q") ?? "",
      year: normalizeKeeperYear(params.get("year"), years),
      position: normalizePositionFilter(params.get("pos")),
    });
  }, [searchParamString, years]);

  const keeperRows = useMemo(() => {
    if (index.status !== "loaded" || players.status !== "loaded") {
      return [];
    }

    const playerByKey = new Map(players.data.map((player) => [player.key, player]));
    const keeperEligibleByRowId = keeperEligibilityByRowId(index.data);

    return index.data
      .filter(
        (row) => {
          if (
            row.type !== "draft" ||
            !row.keeperStatus ||
            (selectedYear !== "all" && row.year !== Number(selectedYear)) ||
            !matchesDraftSearchRowQuery(row, normalizedQuery)
          ) {
            return false;
          }

          const player = row.playerKey ? playerByKey.get(row.playerKey) : undefined;
          const playerSeason = player?.seasons.find((season) => season.year === row.year);
          return matchesPositionFilter(
            playerSeason?.position ?? player?.primaryPosition,
            selectedPosition,
          );
        },
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
          keeperEligible: keeperEligibleByRowId.get(row.id) ?? true,
          teamKey: row.teamKey,
          playerKey: row.playerKey,
          draftPick: row.draftPick,
        };
      })
      .sort(sortKeeperRows);
  }, [index, normalizedQuery, players, selectedPosition, selectedYear]);

  const keeperColumns = useMemo(
    () => keeperColumnsForView(showsAllSeasons),
    [showsAllSeasons],
  );
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

  const hasPendingFilters =
    keeperFilters.query.trim() !== appliedQuery ||
    normalizeKeeperYear(keeperFilters.year, years) !== selectedYear ||
    keeperFilters.position !== selectedPosition;

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = keeperFilters.query.trim();
    const year = normalizeKeeperYear(keeperFilters.year, years);
    const position = normalizePositionFilter(keeperFilters.position);
    const params = new URLSearchParams();

    if (query) {
      params.set("q", query);
    }
    if (year !== "all") {
      params.set("year", year);
    }
    if (position) {
      params.set("pos", position);
    }

    setKeeperFilters({ query, year, position });
    setSearchParams(params);
  }

  function clearFilters() {
    const params = new URLSearchParams();
    if (selectedYear !== "all") {
      params.set("year", selectedYear);
    }
    if (selectedPosition) {
      params.set("pos", selectedPosition);
    }
    setKeeperFilters({ query: "", year: selectedYear, position: selectedPosition });
    setSearchParams(params);
  }

  function applyYearFilter(yearValue: string) {
    const query = keeperFilters.query.trim();
    const year = normalizeKeeperYear(yearValue, years);
    const position = normalizePositionFilter(keeperFilters.position);
    const params = new URLSearchParams();

    if (query) {
      params.set("q", query);
    }
    if (year !== "all") {
      params.set("year", year);
    }
    if (position) {
      params.set("pos", position);
    }

    setKeeperFilters({ query, year, position });
    setSearchParams(params);
  }

  function applyPositionFilter(position: PositionFilter | "") {
    const query = keeperFilters.query.trim();
    const year = normalizeKeeperYear(keeperFilters.year, years);
    const nextPosition = selectedPosition === position ? "" : position;
    const params = new URLSearchParams();

    if (query) {
      params.set("q", query);
    }
    if (year !== "all") {
      params.set("year", year);
    }
    if (nextPosition) {
      params.set("pos", nextPosition);
    }

    setKeeperFilters({ query, year, position: nextPosition });
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
      </section>

      <form
        className="controlBand keeperControlBand"
        aria-label="Keeper filters"
        onSubmit={applyFilters}
      >
        <label className="searchField">
          <Search size={18} aria-hidden />
          <input
            aria-label="Search keeper records"
            value={keeperFilters.query}
            onChange={(event) =>
              setKeeperFilters((current) => ({
                ...current,
                query: event.target.value,
              }))
            }
            placeholder="Search keeper players"
          />
        </label>
        <label className="fieldLabel">
          <select
            aria-label="Filter keepers by season"
            value={keeperFilters.year}
            onChange={(event) => applyYearFilter(event.target.value)}
          >
            <option value="all">All seasons</option>
            {years.map((seasonYear) => (
              <option key={seasonYear} value={seasonYear}>
                {seasonYear}
              </option>
            ))}
          </select>
        </label>
        <div className="filterActions">
          <button className="primaryButton" type="submit">
            <Search size={16} aria-hidden />
            Update
          </button>
          <button className="ghostButton" type="button" onClick={clearFilters}>
            Clear
          </button>
        </div>
        <PositionFilterBadges
          selectedPosition={selectedPosition}
          onChange={applyPositionFilter}
        />
      </form>

      <section className="contentBand">
        <div className="sectionHeader">
          <h2>{showsAllSeasons ? "All Keepers" : `${selectedYear} Keepers`}</h2>
          <span className={hasPendingFilters ? "pendingNote active" : "pendingNote"}>
            {hasPendingFilters
              ? "Filter changes pending"
              : `${formatNumber(keeperRows.length)} matching ${
                  keeperRows.length === 1 ? "keeper" : "keepers"
                }`}
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

    const normalizedQuery = normalizeSearchText(appliedFilters.query);

    if (
      normalizedQuery.length === 0 &&
      appliedFilters.type === "all" &&
      appliedFilters.year === "all"
    ) {
      return sortSearchRows(
        index.data.filter(
          (row) =>
            row.type !== "draft" &&
            row.type !== "player" &&
            row.transactionType !== "FUTURE_ROSTER",
        ),
      );
    }

    return sortSearchRows(
      index.data.filter((row) => {
        if (
          row.type === "draft" ||
          row.type === "player" ||
          row.transactionType === "FUTURE_ROSTER"
        ) {
          return false;
        }

        const matchesType =
          appliedFilters.type === "all" || row.type === appliedFilters.type;
        const matchesYear =
          appliedFilters.year === "all" || row.year === Number(appliedFilters.year);
        if (!matchesType || !matchesYear) {
          return false;
        }

        return matchesSearchRowQuery(row, normalizedQuery);
      }),
    );
  }, [appliedFilters, index]);

  if (appliedFilters.type === "draft") {
    return <Navigate replace to={draftsHrefFromFilters(appliedFilters)} />;
  }

  if (appliedFilters.type === "player") {
    return <Navigate replace to={playersHrefFromFilters(appliedFilters)} />;
  }

  if (manifest.status === "loading" || index.status === "loading") {
    return <StatusPanel label="Loading archive index..." />;
  }

  if (manifest.status === "error" || index.status === "error") {
    return <StatusPanel label="Unable to load archive data." tone="danger" />;
  }

  const hasPendingFilters = !filtersMatch(draftFilters, appliedFilters);
  const resultColumns = resultColumnsForType(
    appliedFilters.type,
    appliedFilters.year === "all",
  );
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
  const showTransactionHistory =
    appliedFilters.type === "transaction" &&
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
    const nextFilters = clearedBrowserFilters(appliedFilters);
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setSearchParams(paramsFromFilters(nextFilters));
  }

  function applyYearFilter(year: string) {
    const nextFilters = normalizeFilters({ ...draftFilters, year, view: "all" });
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setSearchParams(paramsFromFilters(nextFilters));
  }

  return (
    <>
      <Breadcrumbs items={breadcrumbs} />
      <section className="pageIntro">
        <div>
          <p className="eyebrow">Historical fantasy football data</p>
          <h1>League Archive Browser</h1>
        </div>
      </section>

      <form
        className="controlBand browseControlBand"
        aria-label="Archive filters"
        onSubmit={applyFilters}
      >
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
            placeholder={searchPlaceholder(draftFilters)}
          />
        </label>
        <select
          aria-label="Filter by season"
          value={draftFilters.year}
          onChange={(event) => applyYearFilter(event.target.value)}
        >
          <option value="all">All seasons</option>
          {years.map((seasonYear) => (
            <option key={seasonYear} value={seasonYear}>
              {seasonYear}
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
          query={appliedFilters.query}
          hasPendingFilters={hasPendingFilters}
        />
      ) : showTransactionHistory ? (
        <RecordSeasonResults
          rows={filteredRows}
          type="transaction"
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

function TradesPage() {
  const trades = useArchiveJson<PublicTrade[]>("trades.json");
  const [selectedTradeKey, setSelectedTradeKey] = useState<string>();
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [draftYear, setDraftYear] = useState("all");
  const [year, setYear] = useState("all");

  if (trades.status === "loading") {
    return <StatusPanel label="Loading trades..." />;
  }

  if (trades.status === "error") {
    return <StatusPanel label="Unable to load trades." tone="danger" />;
  }

  const years = [...new Set(trades.data.map((trade) => trade.year))].sort(
    (left, right) => right - left,
  );
  const normalizedQuery = normalizeSearchText(query);
  const filteredTrades = trades.data.filter((trade) => {
    const matchesYear = year === "all" || trade.year === Number(year);
    const matchesQuery =
      !normalizedQuery ||
      includesSearchText(
        [trade.player, trade.fromTeamName, trade.toTeamName, trade.type, trade.year].join(" "),
        normalizedQuery,
      );
    return matchesYear && matchesQuery;
  });
  const filteredTradeCount = new Set(
    filteredTrades.map((trade) => trade.transactionKey),
  ).size;
  const commissionerMoveCount = new Set(
    filteredTrades
      .filter((trade) => trade.type === "COMMISSIONER_MOVE")
      .map((trade) => trade.transactionKey),
  ).size;
  const filteredTradeGroups = Array.from(
    filteredTrades.reduce((groups, trade) => {
      const group = groups.get(trade.transactionKey) ?? [];
      group.push(trade);
      groups.set(trade.transactionKey, group);
      return groups;
    }, new Map<string, PublicTrade[]>()).values(),
  );
  const selectedTrade = trades.data.find(
    (trade) => trade.transactionKey === selectedTradeKey,
  );
  const selectedTradeLines = selectedTrade
    ? trades.data.filter((trade) => trade.transactionKey === selectedTrade.transactionKey)
    : [];

  const columns: ColumnDef<PublicTrade[]>[] = [
    {
      header: "Week",
      accessorFn: (trade) =>
        trade[0] ? trade[0].year * 100 + trade[0].week : 0,
      cell: ({ row }) => `Week ${row.original[0]?.week}, ${row.original[0]?.year}`,
    },
    {
      header: "Players",
      accessorFn: (trade) => trade.map((line) => line.player).join(" "),
      cell: ({ row }) => {
        const sides = Array.from(
          row.original.reduce((groups, line) => {
            const key = line.fromTeamKey || line.fromTeamName;
            const group = groups.get(key) ?? [];
            group.push(line);
            groups.set(key, group);
            return groups;
          }, new Map<string, PublicTrade[]>()).values(),
        );

        return (
          <span className="tradePlayerExchange">
            {sides.map((players, index) => (
              <span className="tradePlayerSide" key={players[0]?.fromTeamKey || players[0]?.fromTeamName}>
                {index ? <ArrowLeftRight className="tradeExchangeIcon" size={17} aria-hidden /> : null}
                {players.map((line, playerIndex) => (
                  <span key={line.tradeKey}>
                    {playerIndex ? ", " : ""}
                    {line.playerKey ? (
                      <Link to={`/player/${encodeURIComponent(line.playerKey)}`}>
                        {line.player}
                      </Link>
                    ) : (
                      line.player
                    )}
                  </span>
                ))}
              </span>
            ))}
          </span>
        );
      },
    },
    {
      header: "Teams",
      accessorFn: (trade) =>
        [...new Set(trade.flatMap((line) => [line.fromTeamName, line.toTeamName]))].join(" "),
      cell: ({ row }) => {
        const sendingTeams = [...new Set(row.original.map((line) => line.fromTeamName))];
        const teams = [
          ...new Set(row.original.flatMap((line) => [line.fromTeamName, line.toTeamName])),
        ];
        return teams.join(sendingTeams.length > 1 ? " ↔ " : " → ");
      },
    },
    {
      header: "Details",
      accessorFn: () => "Trade",
      cell: ({ row }) => (
        <button
          className="linkButton"
          type="button"
          onClick={() => setSelectedTradeKey(row.original[0]?.transactionKey)}
        >
          Info
        </button>
      ),
    },
  ];

  return (
    <>
      <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Trades" }]} />
      <section className="pageIntro">
        <div>
          <p className="eyebrow">Historical fantasy football data</p>
          <h1>Trades</h1>
        </div>
      </section>
      <form
        className="controlBand browseControlBand"
        aria-label="Trade filters"
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(draftQuery.trim());
          setYear(draftYear);
        }}
      >
        <label className="searchField">
          <Search size={18} aria-hidden />
          <input
            aria-label="Search trades"
            value={draftQuery}
            onChange={(event) => setDraftQuery(event.target.value)}
            placeholder="Search players or teams"
          />
        </label>
        <select
          aria-label="Filter trades by season"
          value={draftYear}
          onChange={(event) => setDraftYear(event.target.value)}
        >
          <option value="all">All seasons</option>
          {years.map((tradeYear) => (
            <option key={tradeYear} value={tradeYear}>
              {tradeYear}
            </option>
          ))}
        </select>
        <div className="filterActions">
          <button className="primaryButton" type="submit">
            <Search size={16} aria-hidden />
            Update
          </button>
          <button
            className="ghostButton"
            type="button"
            onClick={() => {
              setDraftQuery("");
              setQuery("");
              setDraftYear("all");
              setYear("all");
            }}
          >
            Clear
          </button>
        </div>
      </form>
      <section className="contentBand">
        <div className="sectionHeader">
          <h2>Trade History</h2>
          <span className="pendingNote">
            {formatNumber(filteredTradeCount - commissionerMoveCount)} trades
            {commissionerMoveCount ? `, ${formatNumber(commissionerMoveCount)} commissioner moves` : ""}
            {`, ${formatNumber(filteredTrades.length)} player movements`}
          </span>
        </div>
        <SimpleTable
          data={filteredTradeGroups}
          columns={columns}
          emptyLabel="No executed trades found."
          mobileLabel="Trade cards"
        />
      </section>
      {selectedTrade ? (
        <TradeModal
          trade={selectedTrade}
          lines={selectedTradeLines}
          onClose={() => setSelectedTradeKey(undefined)}
        />
      ) : null}
    </>
  );
}

function TradeModal({
  trade,
  lines,
  onClose,
}: {
  trade: PublicTrade;
  lines: PublicTrade[];
  onClose: () => void;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const titleId = "trade-detail-title";
  const sendingTeams = lines.reduce(
    (groups, line) => {
      const key = line.fromTeamKey || line.fromTeamName;
      const group = groups.get(key) ?? { name: line.fromTeamName, players: [] };
      group.players.push(line);
      groups.set(key, group);
      return groups;
    },
    new Map<string, { name: string; players: PublicTrade[] }>(),
  );

  return (
    <div
      className="modalBackdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="matchupModal tradeModal"
        role="dialog"
      >
        <div className="modalHeader">
          <div>
            <p className="eyebrow">Week {trade.week} · {trade.year}</p>
            <h2 id={titleId}>{trade.type === "COMMISSIONER_MOVE" ? "Commissioner Move" : "Trade"}</h2>
          </div>
          <div className="tradeModalActions">
            <div className="tradeModalMeta">
              {trade.type === "COMMISSIONER_MOVE" ? (
                <span className="pill">Executed by LM</span>
              ) : null}
              {trade.date ? <strong>{formatDate(trade.date)}</strong> : null}
            </div>
            <button
              autoFocus
              className="modalCloseButton"
              type="button"
              onClick={onClose}
              title="Close trade details"
            >
              <X size={20} aria-hidden />
            </button>
          </div>
        </div>
        <div className="tradeDetailList">
          {[...sendingTeams.entries()].map(([key, team]) => (
            <section className="tradeSendingTeam" key={key}>
              <h3>{team.name} sends:</h3>
              <ul>
                {team.players.map((line) => (
                  <li key={line.tradeKey}>
                    {line.playerKey ? (
                      <Link
                        to={`/player/${encodeURIComponent(line.playerKey)}`}
                        onClick={onClose}
                      >
                        {line.player}
                      </Link>
                    ) : (
                      line.player
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}

function DraftBrowserPage() {
  const manifest = useArchiveJson<ArchiveManifest>("manifest.json");
  const index = useArchiveJson<SearchRow[]>("search-index.json");
  const players = useArchiveJson<PublicPlayer[]>("players.json");
  const [searchParams, setSearchParams] = useSearchParams();
  const searchParamString = searchParams.toString();
  const [draftFilters, setDraftFilters] = useState<BrowserFilters>(() => ({
    ...filtersFromSearchParams(searchParams),
    type: "draft",
  }));
  const [appliedFilters, setAppliedFilters] = useState<BrowserFilters>(() => ({
    ...filtersFromSearchParams(searchParams),
    type: "draft",
  }));

  useEffect(() => {
    const nextFilters = {
      ...filtersFromSearchParams(new URLSearchParams(searchParamString)),
      type: "draft" as const,
    };
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
    if (index.status !== "loaded" || players.status !== "loaded") {
      return [];
    }

    const normalizedQuery = normalizeSearchText(appliedFilters.query);
    const playerByKey = new Map(players.data.map((player) => [player.key, player]));

    return sortDraftSearchRows(
      index.data.filter((row) => {
        if (row.type !== "draft") {
          return false;
        }
        if (
          appliedFilters.year !== "all" &&
          row.year !== Number(appliedFilters.year)
        ) {
          return false;
        }
        if (
          !matchesPositionFilter(
            draftSearchRowPosition(row, playerByKey),
            appliedFilters.position,
          )
        ) {
          return false;
        }
        return matchesDraftSearchRowQuery(row, normalizedQuery);
      }),
    );
  }, [appliedFilters, index, players]);

  if (
    manifest.status === "loading" ||
    index.status === "loading" ||
    players.status === "loading"
  ) {
    return <StatusPanel label="Loading draft index..." />;
  }

  if (
    manifest.status === "error" ||
    index.status === "error" ||
    players.status === "error"
  ) {
    return <StatusPanel label="Unable to load draft data." tone="danger" />;
  }

  const hasPendingFilters = !filtersMatch(draftFilters, appliedFilters);
  const showDraftHistory =
    !appliedFilters.query &&
    !appliedFilters.position &&
    appliedFilters.year === "all" &&
    appliedFilters.view !== "all";
  const resultColumns = resultColumnsForType("draft", appliedFilters.year === "all");

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextFilters = normalizeFilters({ ...draftFilters, type: "draft" });
    setAppliedFilters(nextFilters);
    setSearchParams(draftParamsFromFilters(nextFilters));
  }

  function clearFilters() {
    const nextFilters = clearedBrowserFilters(appliedFilters, "draft");
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setSearchParams(draftParamsFromFilters(nextFilters));
  }

  function applyYearFilter(year: string) {
    const nextFilters = normalizeFilters({
      ...draftFilters,
      type: "draft",
      year,
      view: "all",
    });
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setSearchParams(draftParamsFromFilters(nextFilters));
  }

  function applyPositionFilter(position: PositionFilter | "") {
    const nextFilters = normalizeFilters({
      ...draftFilters,
      type: "draft",
      position: appliedFilters.position === position ? "" : position,
    });
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setSearchParams(draftParamsFromFilters(nextFilters));
  }

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Home", to: "/" },
          { label: "Drafts", to: "/drafts" },
          appliedFilters.year !== "all" ? { label: appliedFilters.year } : undefined,
          appliedFilters.year === "all" && appliedFilters.view === "all"
            ? { label: "All Seasons" }
            : undefined,
        ]}
      />
      <section className="pageIntro">
        <div>
          <p className="eyebrow">Draft auction history</p>
          <h1>Draft Browser</h1>
        </div>
      </section>

      <form
        className="controlBand draftControlBand"
        aria-label="Draft filters"
        onSubmit={applyFilters}
      >
        <label className="searchField">
          <Search size={18} aria-hidden />
          <input
            aria-label="Search draft records"
            value={draftFilters.query}
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                query: event.target.value,
              }))
            }
            placeholder="Search drafted players"
          />
        </label>
        <select
          aria-label="Filter drafts by season"
          value={draftFilters.year}
          onChange={(event) => applyYearFilter(event.target.value)}
        >
          <option value="all">All seasons</option>
          {years.map((seasonYear) => (
            <option key={seasonYear} value={seasonYear}>
              {seasonYear}
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
        <PositionFilterBadges
          selectedPosition={appliedFilters.position}
          onChange={applyPositionFilter}
        />
      </form>

      {showDraftHistory ? (
        <DraftSeasonResults
          rows={filteredRows}
          query={appliedFilters.query}
          hasPendingFilters={hasPendingFilters}
        />
      ) : (
        <section className="contentBand">
          <div className="sectionHeader">
            <h2>Draft Results</h2>
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
            emptyLabel="No draft records found."
            mobileCard={(row) => <SearchResultMobileCard row={row} />}
            mobileLabel="Draft result cards"
          />
        </section>
      )}
    </>
  );
}

function PlayerBrowserPage() {
  const manifest = useArchiveJson<ArchiveManifest>("manifest.json");
  const players = useArchiveJson<PublicPlayer[]>("players.json");
  const [searchParams, setSearchParams] = useSearchParams();
  const searchParamString = searchParams.toString();
  const [draftFilters, setDraftFilters] = useState<BrowserFilters>(() => ({
    ...filtersFromSearchParams(searchParams),
    type: "player",
  }));
  const [appliedFilters, setAppliedFilters] = useState<BrowserFilters>(() => ({
    ...filtersFromSearchParams(searchParams),
    type: "player",
  }));

  useEffect(() => {
    const nextFilters = {
      ...filtersFromSearchParams(new URLSearchParams(searchParamString)),
      type: "player" as const,
    };
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

  const playerRows = useMemo(() => {
    if (players.status !== "loaded") {
      return [];
    }

    const normalizedQuery = normalizeSearchText(appliedFilters.query);

    return players.data
      .flatMap((player) =>
        player.seasons.map((season) => ({
          id: `${player.key}-${season.year}`,
          year: season.year,
          player,
          season,
        })),
      )
      .filter(({ player, season }) => {
        if (
          appliedFilters.year !== "all" &&
          season.year !== Number(appliedFilters.year)
        ) {
          return false;
        }
        if (
          !matchesPositionFilter(
            season.position,
            appliedFilters.position,
          )
        ) {
          return false;
        }

        return appliedFilters.year === "all"
          ? matchesPlayerQuery(player, normalizedQuery)
          : matchesPlayerYearQuery(player, season, normalizedQuery);
      })
      .sort(
        (left, right) =>
          right.year - left.year ||
          right.season.fantasyPoints - left.season.fantasyPoints ||
          left.player.name.localeCompare(right.player.name),
      );
  }, [appliedFilters, players]);

  if (manifest.status === "loading" || players.status === "loading") {
    return <StatusPanel label="Loading player index..." />;
  }

  if (manifest.status === "error" || players.status === "error") {
    return <StatusPanel label="Unable to load player data." tone="danger" />;
  }

  const hasPendingFilters = !filtersMatch(draftFilters, appliedFilters);
  const showYearPicker =
    !appliedFilters.query &&
    !appliedFilters.position &&
    appliedFilters.year === "all" &&
    appliedFilters.view !== "all";
  const showYearCards =
    !appliedFilters.query &&
    !appliedFilters.position &&
    appliedFilters.year !== "all" &&
    appliedFilters.view !== "all";
  const resultColumns =
    appliedFilters.year === "all"
      ? playerSearchColumns
      : playerSearchColumns.filter((column) => column.header !== "Season");

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextFilters = normalizeFilters({ ...draftFilters, type: "player" });
    setAppliedFilters(nextFilters);
    setSearchParams(playerParamsFromFilters(nextFilters));
  }

  function clearFilters() {
    const nextFilters = clearedBrowserFilters(appliedFilters, "player");
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setSearchParams(playerParamsFromFilters(nextFilters));
  }

  function applyYearFilter(year: string) {
    const nextFilters = normalizeFilters({
      ...draftFilters,
      type: "player",
      year,
      view: "all",
    });
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setSearchParams(playerParamsFromFilters(nextFilters));
  }

  function applyPositionFilter(position: PositionFilter | "") {
    const nextFilters = normalizeFilters({
      ...draftFilters,
      type: "player",
      position: appliedFilters.position === position ? "" : position,
    });
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setSearchParams(playerParamsFromFilters(nextFilters));
  }

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Home", to: "/" },
          { label: "Players", to: "/players" },
          appliedFilters.year !== "all" ? { label: appliedFilters.year } : undefined,
          appliedFilters.year === "all" && appliedFilters.view === "all"
            ? { label: "All Seasons" }
            : undefined,
        ]}
      />
      <section className="pageIntro">
        <div>
          <p className="eyebrow">Historical player scoring</p>
          <h1>Player Browser</h1>
        </div>
      </section>

      <form
        className="controlBand playerControlBand"
        aria-label="Player filters"
        onSubmit={applyFilters}
      >
        <label className="searchField">
          <Search size={18} aria-hidden />
          <input
            aria-label="Search players"
            value={draftFilters.query}
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                query: event.target.value,
              }))
            }
            placeholder={searchPlaceholder(draftFilters)}
          />
        </label>
        <select
          aria-label="Filter players by season"
          value={draftFilters.year}
          onChange={(event) => applyYearFilter(event.target.value)}
        >
          <option value="all">All seasons</option>
          {years.map((seasonYear) => (
            <option key={seasonYear} value={seasonYear}>
              {seasonYear}
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
        <PositionFilterBadges
          selectedPosition={appliedFilters.position}
          onChange={applyPositionFilter}
        />
      </form>

      {showYearPicker ? (
        <PlayerSeasonResults
          seasons={manifest.data.seasons}
          query={appliedFilters.query}
          hasPendingFilters={hasPendingFilters}
        />
      ) : showYearCards ? (
        <PlayerYearResults
          year={Number(appliedFilters.year)}
          query={appliedFilters.query}
          hasPendingFilters={hasPendingFilters}
        />
      ) : (
        <section className="contentBand">
          <div className="sectionHeader">
            <h2>Player Results</h2>
            <span
              className={hasPendingFilters ? "pendingNote active" : "pendingNote"}
            >
              {hasPendingFilters
                ? "Filter changes pending"
                : `${formatNumber(playerRows.length)} matching players`}
            </span>
          </div>
          <SimpleTable
            data={playerRows}
            columns={resultColumns}
            emptyLabel="No player records found."
            mobileCard={(row) => <PlayerSearchMobileCard row={row} />}
            mobileLabel="Player result cards"
          />
        </section>
      )}
    </>
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
  const normalizedQuery = normalizeSearchText(query);
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
        <h2>Choose a Season</h2>
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
  const normalizedQuery = normalizeSearchText(query);

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
                <small>{season.fantasyTeamName || "Free Agent"}</small>
              </span>
              <span className="playerResultStats">
                <strong>{formatNumber(season.fantasyPoints, 1)}</strong>
                <small>{formatPositionRank(season)}</small>
                {typeof season.draftValue === "number" && season.draftValue > 0 ? (
                  <small>{formatDraftValue(season.draftValue)}</small>
                ) : null}
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
        <h2>Choose a Season</h2>
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
              <LiaClipboardListSolid size={23} aria-hidden />
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
  query,
  hasPendingFilters,
}: {
  rows: SearchRow[];
  type: SearchType;
  query: string;
  hasPendingFilters: boolean;
}) {
  const groupedRows = useMemo(() => groupRowsByYear(rows), [rows]);

  return (
    <section className="teamHistoryBand">
      <div className="sectionHeader">
        <h2>Choose a Season</h2>
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
        <h2>Choose a Season</h2>
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
                <LiaArchiveSolid size={23} aria-hidden />
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
                {group.rows.map((team) => {
                  const href = searchRowTeamHref(team) ?? team.href;
                  return (
                    <Link className="teamHistoryCard" key={team.id} to={href}>
                      <TeamCardIcon logoUrl={team.logoUrl} />
                      <span className="teamCardText">
                        <strong>{team.label}</strong>
                        <small>{team.summary}</small>
                      </span>
                    </Link>
                  );
                })}
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
        <LiaArchiveSolid size={23} aria-hidden />
      </span>
      <span className="teamCardText">
        <strong>All Seasons</strong>
        <small>Browse all results</small>
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

function playerByCanonicalOrLegacyKey(
  players: PublicPlayer[],
  playerKey: string,
): PublicPlayer | undefined {
  const exact = players.find((row) => row.key === playerKey);
  if (exact || !playerKey.startsWith("name-")) {
    return exact;
  }

  const legacyName = normalizeSearchText(playerKey.slice("name-".length));
  const matches = players.filter((row) => normalizeSearchText(row.name) === legacyName);
  return matches.length === 1 ? matches[0] : undefined;
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

  const player = playerByCanonicalOrLegacyKey(players.data, playerKey);
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
  const bestPositionRankSeason = [...seasons]
    .filter((season) => typeof season.positionRank === "number")
    .sort(
      (left, right) =>
        (left.positionRank ?? Number.MAX_SAFE_INTEGER) -
          (right.positionRank ?? Number.MAX_SAFE_INTEGER) ||
        right.fantasyPoints - left.fantasyPoints ||
        right.year - left.year,
    )[0];

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Home", to: "/" },
          { label: "Players", to: "/players" },
          breadcrumbYear
            ? {
                label: `${breadcrumbYear} Players`,
                to: `/players?year=${breadcrumbYear}`,
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
      </section>

      <section className="contentGrid">
        <div className="panel">
          <div className="sectionHeader">
            <h2>Summary</h2>
          </div>
          <div className="playerSummaryLayout">
            <dl className="definitionGrid">
              <div>
                <dt>Position</dt>
                <dd>{player.primaryPosition ?? "-"}</dd>
              </div>
              <div>
                <dt>Best season</dt>
                <dd>
                  {bestSeason
                    ? `${formatNumber(
                        bestSeason.fantasyPoints,
                        1,
                      )} points in ${bestSeason.year} `
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
  const replacementRows = rows
    .map((season, index) => ({ season, index }))
    .filter(({ season }) => typeof season.replacementPoints === "number");
  const starterRows = rows
    .map((season, index) => ({ season, index }))
    .filter(({ season }) => typeof season.avgStarterPoints === "number");
  const maxPoints = Math.max(
    ...rows.flatMap((row) => [
      row.fantasyPoints,
      row.replacementPoints ?? 0,
      row.avgStarterPoints ?? 0,
    ]),
    1,
  );
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
  const replacementPoints = replacementRows
    .map(
      ({ season, index }) =>
        `${xForIndex(index)},${yForPoints(season.replacementPoints ?? 0)}`,
    )
    .join(" ");
  const starterPoints = starterRows
    .map(
      ({ season, index }) =>
        `${xForIndex(index)},${yForPoints(season.avgStarterPoints ?? 0)}`,
    )
    .join(" ");
  const replacementLabel = replacementRows[replacementRows.length - 1];
  const starterLabel = starterRows[starterRows.length - 1];
  const activeTooltip = rows
    .map((season, index) => ({ season, index }))
    .find(({ season }) => season.year === activeTooltipYear);
  const tooltipWidth = 230;
  const tooltipHeight = 96;
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
        {replacementRows.length === 1 ? (
          <line
            className="chartReplacementLine"
            x1={padding.left}
            y1={yForPoints(replacementRows[0].season.replacementPoints ?? 0)}
            x2={padding.left + chartWidth}
            y2={yForPoints(replacementRows[0].season.replacementPoints ?? 0)}
          />
        ) : replacementPoints ? (
          <polyline className="chartReplacementLine" points={replacementPoints} />
        ) : null}
        {starterRows.length === 1 ? (
          <line
            className="chartStarterLine"
            x1={padding.left}
            y1={yForPoints(starterRows[0].season.avgStarterPoints ?? 0)}
            x2={padding.left + chartWidth}
            y2={yForPoints(starterRows[0].season.avgStarterPoints ?? 0)}
          />
        ) : starterPoints ? (
          <polyline className="chartStarterLine" points={starterPoints} />
        ) : null}
        {replacementLabel ? (
          <text
            className="chartReplacementLabel"
            x={padding.left + chartWidth - 6}
            y={Math.min(
              padding.top + chartHeight - 8,
              yForPoints(replacementLabel.season.replacementPoints ?? 0) + 14,
            )}
          >
            VORP
          </text>
        ) : null}
        {starterLabel ? (
          <text
            className="chartStarterLabel"
            x={padding.left + chartWidth - 6}
            y={Math.max(
              padding.top + 10,
              yForPoints(starterLabel.season.avgStarterPoints ?? 0) - 6,
            )}
          >
            Avg Starter
          </text>
        ) : null}
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
              )} points${
                typeof season.replacementPoints === "number"
                  ? `, VORP ${formatNumber(
                      season.fantasyPoints - season.replacementPoints,
                      1,
                    )}`
                  : ""
              }${
                typeof season.avgStarterPoints === "number"
                  ? `, average starter ${formatNumber(season.avgStarterPoints, 1)}`
                  : ""
              }, #${season.playerRank} overall${
                typeof season.positionRank === "number"
                  ? `, ${formatPositionRank(season)}`
                  : ""
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
        #{season.playerRank} overall
        {typeof season.positionRank === "number"
          ? `, ${formatPositionRank(season)}`
          : ""}
      </text>
      {typeof season.replacementPoints === "number" ? (
        <text x="12" y="59">
          VORP: {formatNumber(season.fantasyPoints - season.replacementPoints, 1)}
        </text>
      ) : null}
      {typeof season.avgStarterPoints === "number" ? (
        <text x="12" y="79">
          Avg starter: {formatNumber(season.avgStarterPoints, 1)}
        </text>
      ) : null}
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
  const href = searchRowDetailHref(row);
  const teamLabel = searchRowTeamLabel(row);
  const isDraftRow = row.type === "draft";
  const draftAmount =
    typeof row.bidAmount === "number" ? `$${formatNumber(row.bidAmount)}` : null;

  if (isDraftRow) {
    return (
      <article className="mobileDataCard compact">
        <div className="draftMobileTitleRow">
          <Link className="mobileCardTitle" to={href}>
            {row.playerName ?? row.label}
          </Link>
          {draftAmount ? (
            <strong className="draftMobileAmount">{draftAmount}</strong>
          ) : null}
        </div>
        {row.draftPick || teamLabel ? (
          <p className="draftMobileTeamLine">
            {row.draftPick ? `Pick ${row.draftPick}${teamLabel ? ": " : ""}` : ""}
            {teamLabel ? (
              <Link to={searchRowTeamHref(row) ?? row.href}>{teamLabel}</Link>
            ) : null}
          </p>
        ) : null}
      </article>
    );
  }

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
      <p className="mobileCardSummary">{displaySearchRowSummary(row)}</p>
      <MobileFieldGrid
        items={[
          {
            label: "Team",
            value: teamLabel ? (
              <Link to={searchRowTeamHref(row) ?? row.href}>{teamLabel}</Link>
            ) : undefined,
          },
          { label: "Pick", value: row.draftPick },
          {
            label: "Bid",
            value:
              typeof row.bidAmount === "number"
                ? `$${formatNumber(row.bidAmount)}`
                : undefined,
          },
          { label: "Action", value: displaySearchTransactionAction(row) },
          { label: "Status", value: displayTransactionStatus(row.transactionStatus) },
        ]}
      />
    </article>
  );
}

function PlayerSearchMobileCard({ row }: { row: PlayerSearchResult }) {
  const pvoa = seasonPvoa(row.season);

  return (
    <article className="mobileDataCard">
      <div className="mobileCardHeader">
        <span className="pill">{row.season.position ?? "Player"}</span>
        <span className="mobileCardKicker">{row.year}</span>
      </div>
      <Link
        className="mobileCardTitle"
        to={`/player/${row.player.key}?fromYear=${row.year}`}
      >
        {row.player.name}
      </Link>
      <MobileFieldGrid
        items={[
          { label: "NFL Team", value: row.season.nflTeam ?? "-" },
          { label: "Fantasy Team", value: <FantasyTeamLink season={row.season} /> },
          {
            label: "Draft Value",
            value: formatDraftValue(row.season.draftValue),
          },
          {
            label: "P:D",
            value: formatNumber(pointsPerDollar(row.season), 1),
          },
          {
            label: "Fantasy Points",
            value: formatNumber(row.season.fantasyPoints, 1),
          },
          {
            label: "PVOA",
            value: <span className={pvoaClassName(pvoa)}>{formatPvoa(pvoa)}</span>,
          },
          { label: "Player Rank", value: `#${row.season.playerRank}` },
          { label: "Position Rank", value: formatPositionRank(row.season) },
          { label: "Starts", value: row.season.starts },
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
  const pvoa = seasonPvoa(season);

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
            label: "Draft Value",
            value: formatDraftValue(season.draftValue),
          },
          {
            label: "P:D",
            value: formatNumber(pointsPerDollar(season), 1),
          },
          {
            label: "Fantasy Points",
            value: formatNumber(season.fantasyPoints, 1),
          },
          {
            label: "PVOA",
            value: <span className={pvoaClassName(pvoa)}>{formatPvoa(pvoa)}</span>,
          },
          {
            label: "Position Rank",
            value: formatPositionRank(season),
          },
          { label: "Fantasy Team", value: <FantasyTeamLink season={season} /> },
          { label: "NFL Team", value: season.nflTeam ?? "-" },
          { label: "Starts", value: season.starts },
        ]}
      />
    </article>
  );
}

function FantasyTeamLink({ season }: { season: PlayerSeasonReport }) {
  const label = season.fantasyTeamName || "Free Agent";

  if (season.fantasyTeamName === "Free Agent" && season.fantasyTeamKey) {
    return <Link to={teamPageHref(season.year, season.fantasyTeamKey)}>{label}</Link>;
  }

  if (!season.fantasyTeamName || season.fantasyTeamName === "Free Agent") {
    return label;
  }

  if (season.fantasyTeamKey) {
    return <Link to={teamPageHref(season.year, season.fantasyTeamKey)}>{label}</Link>;
  }

  return (
    <Link to={yearBrowseHref("team", season.year, season.fantasyTeamName)}>
      {label}
    </Link>
  );
}

function KeeperMobileCard({
  row,
  showsYear,
}: {
  row: KeeperRow;
  showsYear: boolean;
}) {
  const playerHref = row.playerKey
    ? `/player/${row.playerKey}?fromYear=${row.year}`
    : undefined;
  const metaPrefix = [showsYear ? String(row.year) : undefined, row.position]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="mobileDataCard compact">
      <div className="keeperMobileTitleRow">
        {playerHref ? (
          <Link className="mobileCardTitle" to={playerHref}>
            {row.name}
          </Link>
        ) : (
          <strong className="mobileCardTitleText">{row.name}</strong>
        )}
        <strong className="keeperMobileValue">
          {formatAuctionValue(row.auctionValue)}
        </strong>
      </div>
      <p className="keeperMobileTeamLine">
        {metaPrefix ? `${metaPrefix} · ` : ""}
        Keeper Eligible: {formatBoolean(row.keeperEligible)} ·{" "}
        {row.draftPick ? `Pick ${row.draftPick}: ` : ""}
        <KeeperTeamLink row={row} />
      </p>
    </article>
  );
}

function KeeperTeamLink({ row }: { row: KeeperRow }) {
  if (row.teamName === "Unknown" && !row.teamKey) {
    return row.teamName;
  }

  const href = row.teamKey
    ? teamPageHref(row.year, row.teamKey)
    : yearBrowseHref("team", row.year, row.teamName);

  return <Link to={href}>{row.teamName}</Link>;
}

function StandingsMobileCard({
  team,
  year,
}: {
  team: PublicTeam;
  year?: number;
}) {
  return (
    <article className="mobileDataCard">
      <div className="mobileCardHeader">
        <TeamLabel
          team={team}
          href={year ? teamPageHref(year, team.key) : undefined}
          isChampion={team.finalStanding === 1}
        />
        <span className="mobileCardKicker">
          Finish {team.finalStanding ?? "-"}
        </span>
      </div>
      <MobileFieldGrid
        items={[
          { label: "Owner", value: formatOwnerNames(team.ownerNames) },
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
  year,
}: {
  pick: DraftPick;
  teamNames: Map<string, string>;
  year: number;
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
          {
            label: "Team",
            value: pick.teamKey ? (
              <Link to={teamDraftHref(year, pick.teamKey)}>
                {teamDisplay(pick.teamKey, teamNames)}
              </Link>
            ) : (
              teamDisplay(pick.teamKey, teamNames)
            ),
          },
          {
            label: "Draft Amount",
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

function ScoreboardGrid({
  matchups,
  teams,
}: {
  matchups: Matchup[];
  teams: PublicTeam[];
}) {
  const location = useLocation();
  const routePath = `${location.pathname}${location.search}`;
  const teamsByKey = new Map(teams.map((team) => [team.key, team]));
  const scoredMatchups = matchups.filter(isScoredMatchup);

  if (!scoredMatchups.length) {
    return <p className="emptyNote">No scoreboard results found for this week.</p>;
  }

  return (
    <div className="scoreboardGrid">
      {scoredMatchups.map((matchup, index) => {
        const awayTeam = matchup.awayTeamKey
          ? teamsByKey.get(matchup.awayTeamKey)
          : undefined;
        const homeTeam = matchup.homeTeamKey
          ? teamsByKey.get(matchup.homeTeamKey)
          : undefined;
        const winnerTeam = matchup.winnerTeamKey
          ? teamsByKey.get(matchup.winnerTeamKey)
          : undefined;

        return (
          <article className="scoreGameCard" key={matchup.matchupKey}>
            <div className="scoreGameTopline">
              <span>Matchup {index + 1}</span>
              <span className="scoreGameType">{displayMatchupType(matchup)}</span>
            </div>
            <div className="scoreGameTeams">
              <ScoreboardTeamRow
                label="Away"
                score={matchup.awayScore}
                team={awayTeam}
                teamKey={matchup.awayTeamKey}
                boxScoreHref={boxScoreRouteHref(matchup.matchupKey, routePath)}
                matchupKey={matchup.matchupKey}
                isWinner={matchup.winnerTeamKey === matchup.awayTeamKey}
              />
              <ScoreboardTeamRow
                label="Home"
                score={matchup.homeScore}
                team={homeTeam}
                teamKey={matchup.homeTeamKey}
                boxScoreHref={boxScoreRouteHref(matchup.matchupKey, routePath)}
                matchupKey={matchup.matchupKey}
                isWinner={matchup.winnerTeamKey === matchup.homeTeamKey}
              />
            </div>
            <div className="scoreGameFooter">
              <span className="scoreboardWinner">
                {matchup.winnerTeamKey
                  ? `Winner: ${winnerTeam?.name ?? matchup.winnerTeamKey}`
                  : "Result pending"}
              </span>
              <strong>{scoreMarginLabel(matchup)}</strong>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ScoreboardTeamRow({
  label,
  score,
  team,
  teamKey,
  boxScoreHref,
  matchupKey,
  isWinner,
}: {
  label: "Away" | "Home";
  score?: number;
  team?: PublicTeam;
  teamKey?: string;
  boxScoreHref: string;
  matchupKey: string;
  isWinner: boolean;
}) {
  const logoUrl = archivePublicUrl(team?.logoUrl);
  const teamName = team?.name ?? teamKey ?? "Unknown team";
  const teamAbbrev = team?.abbrev ?? label;
  const content = (
    <>
      <span className="scoreboardTeamLogo">
        {logoUrl ? <img src={logoUrl} alt="" loading="lazy" /> : <Shield size={20} />}
      </span>
      <span className="scoreboardTeamText">
        <small>{label}</small>
        <strong>{teamName}</strong>
        <span>{teamAbbrev}</span>
      </span>
    </>
  );

  return (
    <div className={isWinner ? "scoreboardTeamRow winner" : "scoreboardTeamRow"}>
      {teamKey ? (
        <a
          className="scoreboardTeamIdentity"
          href={boxScoreHref}
          onClick={() => scrollToBoxScore(matchupKey)}
        >
          {content}
        </a>
      ) : (
        <span className="scoreboardTeamIdentity">{content}</span>
      )}
      <strong className="scoreboardScore">{formatNumber(score, 2)}</strong>
    </div>
  );
}

function scoreMarginLabel(matchup: Matchup): string {
  if (matchup.awayScore === undefined || matchup.homeScore === undefined) {
    return "No margin";
  }

  const margin = Math.abs(matchup.homeScore - matchup.awayScore);
  return margin === 0 ? "Tie game" : `${formatNumber(margin, 2)} margin`;
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
          { label: "Type", value: displayMatchupType(matchup) },
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
          {displayTransactionType(transaction.type)}
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
          { label: "Status", value: displayTransactionStatus(transaction.status) },
          { label: "Period", value: transaction.scoringPeriod },
        ]}
      />
    </article>
  );
}

function TeamMatchupMobileCard({
  matchup,
  year,
  teamNames,
  onShowBoxScore,
}: {
  matchup: TeamMatchupRow;
  year: number;
  teamNames: Map<string, string>;
  onShowBoxScore: (matchup: TeamMatchupRow) => void;
}) {
  return (
    <article className="mobileDataCard">
      <div className="mobileCardHeader">
        <strong className="mobileCardTitleText">{matchup.week}</strong>
        <OutcomePill outcome={matchup.outcome} />
      </div>
      <MobileFieldGrid
        items={[
          {
            label: "Opponent",
            value: matchup.opponentKey ? (
              <Link to={teamPageHref(year, matchup.opponentKey)}>
                {teamDisplay(matchup.opponentKey, teamNames)}
              </Link>
            ) : (
              matchup.opponentName
            ),
          },
          { label: "Site", value: matchup.location },
          {
            label: "Score",
            value: (
              <button
                className="linkButton"
                type="button"
                onClick={() => onShowBoxScore(matchup)}
              >
                {teamScoreline(matchup)}
              </button>
            ),
          },
          { label: "Type", value: displayMatchupType(matchup) },
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
    .map((item) =>
      item.type ? `${displayTransactionItemType(item.type)}: ${item.player}` : item.player,
    )
    .join(", ");
}

function SeasonPage() {
  const { year = "" } = useParams();
  const season = useArchiveJson<PublicSeason>(`seasons/${year}.json`);

  if (season.status === "loading") {
    return <StatusPanel label="Loading season..." />;
  }

  if (season.status === "error") {
    return <StatusPanel label="Unable to load this season." tone="danger" />;
  }

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
      cell: ({ row }) => (
        <TeamLabel
          team={row.original}
          href={teamPageHref(season.data.year, row.original.key)}
          isChampion={row.original.finalStanding === 1}
        />
      ),
    },
    {
      header: "Owner",
      accessorFn: (team) => formatOwnerNames(team.ownerNames),
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
                <small>{week.transactionCount} moves</small>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="contentBand">
        <div className="sectionHeader">
          <h2>Standings</h2>
        </div>
        <SimpleTable
          data={season.data.standings}
          columns={standingsColumns}
          mobileCard={(team) => (
            <StandingsMobileCard team={team} year={season.data.year} />
          )}
          mobileLabel="Standings cards"
        />
      </section>
    </>
  );
}

function TeamDraftPage() {
  const { year = "", teamKey = "" } = useParams();
  const season = useArchiveJson<PublicSeason>(`seasons/${year}.json`);
  const players = useArchiveJson<PublicPlayer[]>("players.json");

  if (season.status === "loading" || players.status === "loading") {
    return <StatusPanel label="Loading team draft..." />;
  }

  if (season.status === "error" || players.status === "error") {
    return <StatusPanel label="Unable to load this team draft." tone="danger" />;
  }

  if (season.status !== "loaded" || players.status !== "loaded") {
    return <StatusPanel label="Loading team draft..." />;
  }

  const team = season.data.teams.find((row) => row.key === teamKey);
  if (!team) {
    return <StatusPanel label="Team draft not found." tone="danger" />;
  }

  const draftRows = buildTeamDraftSummaryRows(
    season.data.draft
      .filter((pick) => pick.teamKey === team.key)
      .sort((left, right) => left.pick - right.pick),
    players.data,
    season.data.year,
  );

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Home", to: "/" },
          { label: "Drafts", to: "/drafts" },
          {
            label: `${season.data.year} Draft`,
            to: `/drafts?year=${season.data.year}`,
          },
          { label: team.name },
        ]}
      />
      <section className="pageIntro">
        <div>
          <p className="eyebrow">{season.data.year} draft summary</p>
          <h1>{team.name}</h1>
        </div>
      </section>

      <section className="contentBand">
        <TeamDraftSummaryTable
          title={`${team.name} Draft`}
          rows={draftRows}
          year={season.data.year}
        />
      </section>
    </>
  );
}

function TeamPage() {
  const { year = "", teamKey = "" } = useParams();
  const location = useLocation();
  const [selectedMatchup, setSelectedMatchup] = useState<TeamMatchupRow | null>(
    null,
  );
  const season = useArchiveJson<PublicSeason>(`seasons/${year}.json`);
  const players = useArchiveJson<PublicPlayer[]>("players.json");
  const weeks = useSeasonWeeks(
    year,
    season.status === "loaded" ? season.data.weeks : [],
  );
  const isWaitingForWeeks =
    season.status === "loaded" &&
    season.data.weeks.length > 0 &&
    weeks.data.length === 0 &&
    weeks.status !== "error";

  useEffect(() => {
    setSelectedMatchup(null);
  }, [teamKey, year]);

  useEffect(() => {
    if (location.hash !== "#draft-picks" || season.status !== "loaded") {
      return;
    }

    requestAnimationFrame(() => {
      document.getElementById("draft-picks")?.scrollIntoView();
    });
  }, [location.hash, season.status, teamKey]);

  const loadedSeason = season.status === "loaded" ? season.data : undefined;
  const loadedPlayers = players.status === "loaded" ? players.data : undefined;
  const team = useMemo(
    () => loadedSeason?.teams.find((row) => row.key === teamKey),
    [loadedSeason, teamKey],
  );
  const teamNames = useMemo(
    () =>
      loadedSeason
        ? teamNameMap(loadedSeason.teams)
        : new Map<string, string>(),
    [loadedSeason],
  );
  const matchupRows = useMemo(
    () =>
      loadedSeason && team
        ? buildTeamMatchupRows(team, loadedSeason, weeks.data)
        : [],
    [loadedSeason, team, weeks.data],
  );
  const draftPicks = useMemo(
    () =>
      loadedSeason && team
        ? loadedSeason.draft
            .filter((pick) => pick.teamKey === team.key)
            .sort((left, right) => left.pick - right.pick)
        : [],
    [loadedSeason, team],
  );
  const matchupColumns = useMemo<ColumnDef<TeamMatchupRow>[]>(
    () =>
      loadedSeason
        ? teamMatchupColumns(
            loadedSeason.year,
            teamNames,
            setSelectedMatchup,
          )
        : [],
    [loadedSeason, teamNames],
  );
  const draftColumns = useMemo<ColumnDef<DraftPick>[]>(
    () =>
      loadedSeason
        ? draftPickColumnsForTeam(teamNames, loadedSeason.year)
        : [],
    [loadedSeason, teamNames],
  );

  if (
    season.status === "loading" ||
    players.status === "loading" ||
    weeks.status === "idle" ||
    weeks.status === "loading" ||
    isWaitingForWeeks
  ) {
    return <StatusPanel label="Loading team report..." />;
  }

  if (
    season.status === "error" ||
    players.status === "error" ||
    weeks.status === "error"
  ) {
    return <StatusPanel label="Unable to load this team report." tone="danger" />;
  }

  if (season.status !== "loaded" || players.status !== "loaded") {
    return <StatusPanel label="Loading team report..." />;
  }

  if (!team || !loadedSeason || !loadedPlayers) {
    return <StatusPanel label="Team report not found." tone="danger" />;
  }

  const selectedBoxScore = selectedMatchup
    ? teamMatchupBoxScore(team.key, selectedMatchup, weeks.data)
    : undefined;
  const rosterSnapshot = finalRosterSnapshot(team.key, weeks.data);
  const rosterPlayers = rosterSnapshot?.players ?? team.roster ?? [];
  const positionRanks = positionRankMap(players.data, season.data.year);
  const rosterRows = rosterPlayers.length
    ? buildTeamRosterAggregateRows(
        team.key,
        rosterPlayers,
        weeks.data,
        positionRanks,
      )
    : [];
  const realScores = team.scores.filter(isRealTeamScore);
  const averageScore = average(realScores);
  const highScore = realScores.length ? Math.max(...realScores) : undefined;

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Home", to: "/" },
          { label: "Teams", to: "/browse?type=team" },
          {
            label: `${season.data.year} Teams`,
            to: `/browse?type=team&year=${season.data.year}`,
          },
          { label: team.name },
        ]}
      />
      <section className="pageIntro">
        <div>
          <p className="eyebrow">{season.data.year} team report</p>
          <h1>{team.name}</h1>
        </div>
      </section>

      <section className="contentGrid">
        <div className="panel">
          <div className="sectionHeader">
            <h2>Summary</h2>
          </div>
          <div className="teamDetailSummary">
            <TeamCardIcon logoUrl={team.logoUrl} />
            <dl className="definitionGrid">
              <div>
                <dt>Owner</dt>
                <dd>{formatOwnerNames(team.ownerNames)}</dd>
              </div>
              <div>
                <dt>Abbrev</dt>
                <dd>{team.abbrev || "-"}</dd>
              </div>
              <div>
                <dt>Division</dt>
                <dd>{team.divisionName ?? "-"}</dd>
              </div>
              <div>
                <dt>Final Finish</dt>
                <dd>{team.finalStanding ? `#${team.finalStanding}` : "-"}</dd>
              </div>
            </dl>
          </div>
        </div>
        <div className="panel">
          <div className="sectionHeader">
            <h2>Season Totals</h2>
          </div>
          <dl className="definitionGrid">
            <div>
              <dt>Points For</dt>
              <dd>{formatScore(team.pointsFor, false)}</dd>
            </div>
            <div>
              <dt>Points Against</dt>
              <dd>{formatScore(team.pointsAgainst, false)}</dd>
            </div>
            <div>
              <dt>Average score</dt>
              <dd>{formatScore(averageScore)}</dd>
            </div>
            <div>
              <dt>High score</dt>
              <dd>{formatScore(highScore)}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="contentBand">
        <div className="sectionHeader">
          <h2>Final Roster</h2>
        </div>
        {rosterRows.length ? (
          <SeasonRosterTable
            title={team.name}
            rows={rosterRows}
            year={season.data.year}
          />
        ) : (
          <p className="emptyNote">No roster was found for this team.</p>
        )}
      </section>

      <section className="contentBand">
        <div className="sectionHeader">
          <h2>Scores &amp; Matchups</h2>
          <span className="pendingNote">
            {formatNumber(matchupRows.length)} {pluralizeWeek(matchupRows.length)}
          </span>
        </div>
        <SimpleTable
          data={matchupRows}
          columns={matchupColumns}
          emptyLabel="No matchups found for this team."
          sortable={false}
          mobileCard={(matchup) => (
            <TeamMatchupMobileCard
              matchup={matchup}
              year={season.data.year}
              teamNames={teamNames}
              onShowBoxScore={setSelectedMatchup}
            />
          )}
          mobileLabel="Team matchup cards"
        />
      </section>

      <section className="contentBand" id="draft-picks">
        <div className="sectionHeader">
          <h2>Draft Picks</h2>
          <span className="pendingNote">
            {formatNumber(draftPicks.length)} {pluralizeDraftPick(draftPicks.length)}
          </span>
        </div>
        <SimpleTable
          data={draftPicks}
          columns={draftColumns}
          emptyLabel="No draft picks found for this team."
          mobileCard={(pick) => (
            <DraftPickMobileCard
              pick={pick}
              teamNames={teamNames}
              year={season.data.year}
            />
          )}
          mobileLabel="Team draft pick cards"
        />
      </section>

      {selectedMatchup ? (
        <BoxScoreModal
          boxScore={selectedBoxScore}
          matchup={selectedMatchup}
          teamNames={teamNames}
          year={season.data.year}
          onClose={() => setSelectedMatchup(null)}
        />
      ) : null}
    </>
  );
}

function WeekPage() {
  const { year = "", week = "" } = useParams();
  const location = useLocation();
  const season = useArchiveJson<PublicSeason>(`seasons/${year}.json`);
  const weekData = useArchiveJson<PublicWeek>(`seasons/${year}/weeks/${week}.json`);

  useEffect(() => {
    if (!location.hash.startsWith("#box-score-") || weekData.status !== "loaded") {
      return;
    }

    requestAnimationFrame(() => {
      document.getElementById(location.hash.slice(1))?.scrollIntoView();
    });
  }, [location.hash, weekData.status, week, year]);

  if (season.status === "loading" || weekData.status === "loading") {
    return <StatusPanel label="Loading week..." />;
  }

  if (season.status === "error" || weekData.status === "error") {
    return <StatusPanel label="Unable to load this week." tone="danger" />;
  }

  const teamNames = teamNameMap(season.data.teams);
  const scoredMatchups = weekData.data.scoreboard.filter(isScoredMatchup);

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
    {
      header: "Type",
      accessorKey: "type",
      cell: ({ row }) => displayTransactionType(row.original.type),
    },
    {
      header: "FAB",
      accessorKey: "bidAmount",
      cell: ({ row }) =>
        formatTransactionFab(row.original.type, row.original.bidAmount),
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: ({ row }) => displayTransactionStatus(row.original.status) ?? "-",
    },
    {
      header: "Players",
      accessorFn: (transaction) =>
        transaction.items
          .map((item) =>
            item.type
              ? `${displayTransactionItemType(item.type)}: ${item.player}`
              : item.player,
          )
          .join(", "),
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
      </section>

      <section className="contentBand scoreboardBand">
        <div className="sectionHeader">
          <h2>Scoreboard</h2>
          <span className="pendingNote">
            {formatNumber(scoredMatchups.length)}{" "}
            {scoredMatchups.length === 1 ? "game" : "games"}
          </span>
        </div>
        <ScoreboardGrid
          matchups={scoredMatchups}
          teams={season.data.teams}
        />
      </section>

      <section className="contentBand">
        <div className="sectionHeader">
          <h2>Box Scores</h2>
        </div>
        {weekData.data.boxScores.length ? (
          <div className="boxScoreList">
            {weekData.data.boxScores.map((boxScore) => (
              <BoxScoreCard
                boxScore={boxScore}
                key={boxScore.matchupKey}
                teamNames={teamNames}
                year={season.data.year}
              />
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
    </>
  );
}

function BoxScoreCard({
  boxScore,
  teamNames,
  year,
}: {
  boxScore: BoxScore;
  teamNames: Map<string, string>;
  year: number;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const awayTeamName = teamDisplay(boxScore.awayTeamKey, teamNames);
  const homeTeamName = teamDisplay(boxScore.homeTeamKey, teamNames);
  const title = `${awayTeamName} at ${homeTeamName}`;
  const anchorId = boxScoreAnchorId(boxScore.matchupKey);
  const contentId = `box-score-content-${boxScore.matchupKey}`;

  return (
    <article className="boxScore" id={anchorId}>
      <h3 className="boxScoreTitle">
        <button
          aria-controls={contentId}
          aria-expanded={!isCollapsed}
          className="boxScoreToggle"
          type="button"
          onClick={() => setIsCollapsed((current) => !current)}
        >
          <span>{title}</span>
          <span className="boxScoreToggleMeta">
            <span>{isCollapsed ? "Show" : "Hide"}</span>
            <ChevronDown
              aria-hidden
              className={
                isCollapsed ? "boxScoreChevron collapsed" : "boxScoreChevron"
              }
              size={18}
            />
          </span>
        </button>
      </h3>
      {!isCollapsed ? (
        <div className="lineupColumns" id={contentId}>
          <LineupTable title={awayTeamName} players={boxScore.awayLineup} year={year} />
          <LineupTable title={homeTeamName} players={boxScore.homeLineup} year={year} />
        </div>
      ) : null}
    </article>
  );
}

function boxScoreAnchorId(matchupKey: string): string {
  return `box-score-${matchupKey}`;
}

function boxScoreRouteHref(matchupKey: string, routePath: string): string {
  return `#${routePath}#${boxScoreAnchorId(matchupKey)}`;
}

function scrollToBoxScore(matchupKey: string) {
  requestAnimationFrame(() => {
    document.getElementById(boxScoreAnchorId(matchupKey))?.scrollIntoView();
  });
}

function BoxScoreModal({
  boxScore,
  matchup,
  teamNames,
  year,
  onClose,
}: {
  boxScore?: BoxScore;
  matchup: TeamMatchupRow;
  teamNames: Map<string, string>;
  year: number;
  onClose: () => void;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const titleId = "matchup-box-score-title";
  const opponentName = matchup.opponentKey
    ? teamDisplay(matchup.opponentKey, teamNames)
    : matchup.opponentName;

  return (
    <div
      className="modalBackdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="matchupModal"
        role="dialog"
      >
        <div className="modalHeader">
          <div>
            <p className="eyebrow">Week {matchup.week} box score</p>
            <h2 id={titleId}>{opponentName}</h2>
            <strong>{teamScoreline(matchup)}</strong>
          </div>
          <button
            autoFocus
            className="modalCloseButton"
            type="button"
            onClick={onClose}
            title="Close box score"
          >
            <X size={20} aria-hidden />
          </button>
        </div>
        {boxScore ? (
          <BoxScoreCard boxScore={boxScore} teamNames={teamNames} year={year} />
        ) : (
          <p className="emptyNote">Box score is not available for this matchup.</p>
        )}
      </section>
    </div>
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
              <th aria-label="Player image" />
              <th>Player</th>
              <th>Opp</th>
              <th>Proj</th>
              <th>FPTS</th>
            </tr>
          </thead>
          <tbody>
            {starterRows.length ? (
              <LineupSectionHeaderRow label="Starters" colSpan={8} />
            ) : null}
            {starterRows.map((player, index) => (
              <LineupRow player={player} year={year} key={lineupRowKey(player, index)} />
            ))}
            {starterRows.length ? (
              <LineupSummaryRow label="Starters Total" players={starterRows} />
            ) : null}
            {benchRows.length ? (
              <LineupSectionHeaderRow label="Bench" colSpan={8} />
            ) : null}
            {benchRows.map((player, index) => (
              <LineupRow player={player} year={year} key={lineupRowKey(player, index)} />
            ))}
            {benchRows.length ? (
              <LineupSummaryRow label="Bench Total" players={benchRows} />
            ) : null}
            {irRows.length ? (
              <LineupSectionHeaderRow label="IR" colSpan={8} />
            ) : null}
            {irRows.map((player, index) => (
              <LineupRow player={player} year={year} key={lineupRowKey(player, index)} />
            ))}
            {!players.length ? (
              <tr>
                <td className="emptyCell" colSpan={6}>
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

function SeasonRosterTable({
  title,
  rows,
  year,
}: {
  title: string;
  rows: TeamRosterAggregateRow[];
  year: number;
}) {
  return (
    <div className="lineupTable seasonRosterTable">
      <h4>{title}</h4>
      <div className="lineupScroll">
        <table className="boxScoreTable seasonRosterStatsTable">
          <colgroup>
            <col className="seasonRosterSlotColumn" />
            <col className="seasonRosterIconColumn" />
            <col className="seasonRosterPlayerColumn" />
            <col className="seasonRosterStatColumn" />
            <col className="seasonRosterStatColumn" />
            <col className="seasonRosterStatColumn" />
            <col className="seasonRosterStatColumn" />
            <col className="seasonRosterStatColumn" />
            <col className="seasonRosterStatColumn" />
          </colgroup>
          <thead>
            <tr>
              <th>Slot</th>
              <th aria-label="Player image" />
              <th>Player</th>
              <th>PRK</th>
              <th>GP</th>
              <th>Starts</th>
              <th>Avg Proj</th>
              <th>Avg FPTS</th>
              <th>Total FPTS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <SeasonRosterRow row={row} year={year} key={row.id} />
            ))}
            {!rows.length ? (
              <tr>
                <td className="emptyCell" colSpan={9}>
                  No roster players found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SeasonRosterRow({
  row,
  year,
}: {
  row: TeamRosterAggregateRow;
  year: number;
}) {
  const { player } = row;

  return (
    <tr className="boxScorePlayerRow">
      <td className="slotCell">{displayLineupSlot(player)}</td>
      <td className="playerIconCell">
        <LineupPlayerIcon player={player} />
      </td>
      <td className="playerCell">
        <span className="lineupPlayerName">
          {player.key ? (
            <Link to={`/player/${player.key}?fromYear=${year}`}>
              <strong>{player.name}</strong>
            </Link>
          ) : (
            <strong>{player.name}</strong>
          )}
        </span>
        <small>{player.proTeam ?? "-"}</small>
      </td>
      <td className="numberCell">{row.positionRank ?? "-"}</td>
      <td className="numberCell">{formatNumber(row.appearances)}</td>
      <td className="numberCell">{formatNumber(row.starts)}</td>
      <td className="numberCell">{formatNumber(row.averageProjected, 1)}</td>
      <td className="numberCell">{formatNumber(row.averagePoints, 1)}</td>
      <td className="numberCell">{formatNumber(row.totalPoints, 1)}</td>
    </tr>
  );
}

function TeamDraftSummaryTable({
  title,
  rows,
  year,
}: {
  title: string;
  rows: TeamDraftSummaryRow[];
  year: number;
}) {
  return (
    <div className="lineupTable seasonRosterTable">
      <h4>{title}</h4>
      <div className="lineupScroll">
        <table className="boxScoreTable teamDraftSummaryTable">
          <colgroup>
            <col className="teamDraftPickColumn" />
            <col className="teamDraftIconColumn" />
            <col className="teamDraftPlayerColumn" />
            <col className="teamDraftStatColumn" />
            <col className="teamDraftStatColumn" />
            <col className="teamDraftStatColumn" />
          </colgroup>
          <thead>
            <tr>
              <th>Pick</th>
              <th aria-label="Player image" />
              <th>Player</th>
              <th>Auction</th>
              <th>PRK</th>
              <th>Total FPTS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <TeamDraftSummaryTableRow row={row} year={year} key={row.id} />
            ))}
            {!rows.length ? (
              <tr>
                <td className="emptyCell" colSpan={6}>
                  No draft picks found for this team.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TeamDraftSummaryTableRow({
  row,
  year,
}: {
  row: TeamDraftSummaryRow;
  year: number;
}) {
  const { player } = row;

  return (
    <tr className="boxScorePlayerRow">
      <td className="slotCell">{row.pick.pick}</td>
      <td className="playerIconCell">
        <LineupPlayerIcon player={player} />
      </td>
      <td className="playerCell">
        <span className="lineupPlayerName">
          {player.key ? (
            <Link to={`/player/${player.key}?fromYear=${year}`}>
              <strong>{player.name}</strong>
            </Link>
          ) : (
            <strong>{player.name}</strong>
          )}
        </span>
        <small>{player.proTeam ?? "-"}</small>
      </td>
      <td className="numberCell">{formatAuctionValue(row.auctionValue)}</td>
      <td className="numberCell">{row.positionRank ?? "-"}</td>
      <td className="numberCell">{formatNumber(row.totalFantasyPoints, 1)}</td>
    </tr>
  );
}

function LineupSectionHeaderRow({
  label,
  colSpan = 6,
}: {
  label: string;
  colSpan?: number;
}) {
  return (
    <tr className="lineupSectionHeaderRow">
      <td colSpan={colSpan}>{label}</td>
    </tr>
  );
}

function LineupRow({
  player,
  year,
}: {
  player: LineupPlayer;
  year: number;
}) {
  const section = lineupSection(player);

  return (
    <tr className={`boxScorePlayerRow ${section}`}>
      <td className="slotCell">{displayLineupSlot(player)}</td>
      <td className="playerIconCell">
        <LineupPlayerIcon player={player} />
      </td>
      <td className="playerCell">
        <span className="lineupPlayerName">
          {player.key ? (
            <Link to={`/player/${player.key}?fromYear=${year}`}>
              <strong>{player.name}</strong>
            </Link>
          ) : (
            <strong>{player.name}</strong>
          )}
        </span>
        <small>{player.proTeam ?? "-"}</small>
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
      <td colSpan={4}>{label}</td>
      <td className="numberCell">
        {formatNumber(sumLineupValue(players, "projectedPoints"), 1)}
      </td>
      <td className="numberCell">
        {formatNumber(sumLineupValue(players, "points"), 1)}
      </td>
    </tr>
  );
}

function LineupPlayerIcon({ player }: { player: LineupPlayer }) {
  const [failedPhoto, setFailedPhoto] = useState(false);
  const [failedTeamLogo, setFailedTeamLogo] = useState(false);
  const photoUrl = !failedPhoto ? lineupPlayerPhotoUrl(player) : undefined;
  const teamLogoUrl = !failedTeamLogo ? nflTeamLogoUrl(player.proTeam) : undefined;
  const imageUrl = photoUrl ?? teamLogoUrl;
  const isTeamLogo = Boolean(!photoUrl && teamLogoUrl);

  if (!imageUrl) {
    return (
      <span className="lineupPlayerIcon placeholder" aria-hidden>
        <Shield size={18} />
      </span>
    );
  }

  return (
    <span className={isTeamLogo ? "lineupPlayerIcon teamLogo" : "lineupPlayerIcon"}>
      <img
        src={imageUrl}
        alt=""
        loading="lazy"
        onError={() => {
          if (photoUrl) {
            setFailedPhoto(true);
          } else {
            setFailedTeamLogo(true);
          }
        }}
      />
    </span>
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

function lineupPlayerPhotoUrl(player: LineupPlayer): string | undefined {
  const archivedPhotoUrl = archivePublicUrl(player.photoUrl);
  if (archivedPhotoUrl) {
    return archivedPhotoUrl;
  }

  const playerId = Number(player.playerId);
  if (Number.isInteger(playerId) && playerId > 0) {
    return `https://a.espncdn.com/i/headshots/nfl/players/full/${playerId}.png`;
  }

  return undefined;
}

function nflTeamLogoUrl(team: string | undefined): string | undefined {
  const code = nflTeamLogoCode(team);
  return code ? `https://a.espncdn.com/i/teamlogos/nfl/500/${code}.png` : undefined;
}

function nflTeamLogoCode(team: string | undefined): string | undefined {
  if (!team) {
    return undefined;
  }

  const normalized = team.toUpperCase();
  const codeMap: Record<string, string> = {
    ARI: "ari",
    ATL: "atl",
    BAL: "bal",
    BUF: "buf",
    CAR: "car",
    CHI: "chi",
    CIN: "cin",
    CLE: "cle",
    DAL: "dal",
    DEN: "den",
    DET: "det",
    GB: "gb",
    HOU: "hou",
    IND: "ind",
    JAC: "jax",
    JAX: "jax",
    KC: "kc",
    LAC: "lac",
    LAR: "lar",
    LV: "lv",
    MIA: "mia",
    MIN: "min",
    NE: "ne",
    NO: "no",
    NYG: "nyg",
    NYJ: "nyj",
    PHI: "phi",
    PIT: "pit",
    SEA: "sea",
    SF: "sf",
    TB: "tb",
    TEN: "ten",
    WSH: "wsh",
    WAS: "wsh",
  };

  return codeMap[normalized];
}

function useSeasonWeeks(
  year: string,
  weeks: PublicSeason["weeks"],
): SeasonWeeksState {
  const weekKey = weeks
    .map((week) => week.week)
    .sort((left, right) => left - right)
    .join(",");
  const weekNumbers = useMemo(
    () => (weekKey ? weekKey.split(",").map((week) => Number(week)) : []),
    [weekKey],
  );
  const requestKey = `${year}:${weekKey}`;
  const [state, setState] = useState<SeasonWeeksState>({
    status: "idle",
    data: [],
    requestKey: "",
  });

  useEffect(() => {
    if (!year || !weekNumbers.length) {
      setState({ status: "loaded", data: [], requestKey });
      return;
    }

    let cancelled = false;
    setState((current) => ({ status: "loading", data: current.data, requestKey }));

    Promise.all(
      weekNumbers.map((week) =>
        fetchArchiveJson<PublicWeek>(
          `seasons/${year}/weeks/${String(week).padStart(2, "0")}.json`,
        ),
      ),
    )
      .then((loadedWeeks) => {
        if (!cancelled) {
          setState({
            status: "loaded",
            data: loadedWeeks.sort((left, right) => left.week - right.week),
            requestKey,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState((current) => ({
            status: "error",
            data: current.data,
            requestKey,
          }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [weekKey, year]);

  if (state.requestKey !== requestKey) {
    return {
      status: weekNumbers.length ? "loading" : "loaded",
      data: [],
      requestKey,
    };
  }

  return state;
}

function useFeaturedBroadcastScore(
  year: number | undefined,
): FeaturedBroadcastScoreState {
  const [state, setState] = useState<FeaturedBroadcastScoreState>({
    status: "loading",
  });

  useEffect(() => {
    if (!year) {
      setState({ status: "loaded" });
      return;
    }

    const targetYear = year;
    let cancelled = false;
    setState({ status: "loading" });

    async function loadFeaturedScore() {
      const season = await fetchArchiveJson<PublicSeason>(
        `seasons/${targetYear}.json`,
      );
      const latestWeek = [...season.weeks]
        .sort((left, right) => left.week - right.week)
        .at(-1);

      if (!latestWeek) {
        return undefined;
      }

      const week = await fetchArchiveJson<PublicWeek>(
        `seasons/${targetYear}/weeks/${String(latestWeek.week).padStart(
          2,
          "0",
        )}.json`,
      );
      const matchup = featuredBroadcastMatchup(week.scoreboard);

      if (!matchup) {
        return undefined;
      }

      const teamsByKey = new Map(season.teams.map((team) => [team.key, team]));

      return {
        year: targetYear,
        matchup,
        homeTeam: matchup.homeTeamKey
          ? teamsByKey.get(matchup.homeTeamKey)
          : undefined,
        awayTeam: matchup.awayTeamKey
          ? teamsByKey.get(matchup.awayTeamKey)
          : undefined,
      };
    }

    loadFeaturedScore()
      .then((data) => {
        if (!cancelled) {
          setState({ status: "loaded", data });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ status: "error" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [year]);

  return state;
}

function useLeagueRecordData(years: number[]): LeagueRecordDataState {
  const yearKey = useMemo(
    () => [...years].sort((left, right) => left - right).join(","),
    [years],
  );
  const yearNumbers = useMemo(
    () => (yearKey ? yearKey.split(",").map((year) => Number(year)) : []),
    [yearKey],
  );
  const requestKey = yearKey;
  const [state, setState] = useState<LeagueRecordDataState>({
    status: "idle",
    data: [],
    requestKey: "",
  });

  useEffect(() => {
    if (!yearNumbers.length) {
      setState({ status: "loaded", data: [], requestKey });
      return;
    }

    let cancelled = false;
    setState((current) => ({ status: "loading", data: current.data, requestKey }));

    Promise.all(
      yearNumbers.map(async (year) => {
        const season = await fetchArchiveJson<PublicSeason>(`seasons/${year}.json`);
        const weeks = await Promise.all(
          season.weeks.map((week) =>
            fetchArchiveJson<PublicWeek>(
              `seasons/${year}/weeks/${String(week.week).padStart(2, "0")}.json`,
            ),
          ),
        );

        return {
          season,
          weeks: weeks.sort((left, right) => left.week - right.week),
        };
      }),
    )
      .then((loadedSeasons) => {
        if (!cancelled) {
          setState({
            status: "loaded",
            data: loadedSeasons.sort(
              (left, right) => right.season.year - left.season.year,
            ),
            requestKey,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState((current) => ({
            status: "error",
            data: current.data,
            requestKey,
          }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [requestKey, yearNumbers]);

  if (state.requestKey !== requestKey) {
    return {
      status: yearNumbers.length ? "loading" : "loaded",
      data: [],
      requestKey,
    };
  }

  return state;
}

function buildLeagueRecords(
  seasons: LeagueRecordData[],
  players: PublicPlayer[],
): LeagueRecords {
  const regularMatchupRecords: LeagueRecordCandidate[] = [];
  const teamAverageRecords: LeagueRecordCandidate[] = [];
  const weeklyPlayerRecords: LeagueRecordCandidate[] = [];
  const lowWeeklyPlayerRecords: LeagueRecordCandidate[] = [];
  const seasonPlayerRecords: LeagueRecordCandidate[] = [];
  const lowSeasonPlayerRecords: LeagueRecordCandidate[] = [];
  const ownerTotals = new Map<string, OwnerRecordRow>();
  const championRows: ChampionRecordRow[] = [];

  seasons.forEach(({ season, weeks }) => {
    const teamNames = teamNameMap(season.teams);
    const seasonStarterPlayerTotals = new Map<
      string,
      {
        value: number;
        name: string;
        position?: string;
        teamKey: string;
        playerKey?: string;
        starts: number;
      }
    >();

    season.teams.forEach((team) => {
      const owner = ownerLabel(team);
      const current =
        ownerTotals.get(owner) ??
        {
          id: owner,
          owner,
          seasons: 0,
          championships: 0,
          wins: 0,
          losses: 0,
          pointsFor: 0,
          pointsAgainst: 0,
          averagePointsFor: 0,
          averagePointsAgainst: 0,
        };

      current.seasons += 1;
      current.wins += finiteRecordValue(team.wins);
      current.losses += finiteRecordValue(team.losses);
      current.pointsFor += finiteRecordValue(team.pointsFor);
      current.pointsAgainst += finiteRecordValue(team.pointsAgainst);
      if (team.finalStanding === 1) {
        current.championships += 1;
      }
      ownerTotals.set(owner, current);

      const scores = team.scores.filter(isRealTeamScore);
      if (scores.length) {
        teamAverageRecords.push({
          value: scores.reduce((total, score) => total + score, 0) / scores.length,
          subtitle: team.name,
          meta: `${owner} · ${season.year} · ${teamRecord(team)}`,
          href: teamPageHref(season.year, team.key),
        });
      }
    });

    const champion = season.standings.find((team) => team.finalStanding === 1);
    if (champion) {
      championRows.push({
        id: `${season.year}-${champion.key}`,
        year: season.year,
        owner: ownerLabel(champion),
        teamName: champion.name,
        record: teamRecord(champion),
        pointsFor: champion.pointsFor,
        pointsAgainst: champion.pointsAgainst,
        href: teamPageHref(season.year, champion.key),
      });
    }

    weeks.forEach((week) => {
      week.scoreboard.forEach((matchup) => {
        if (!isScoredMatchup(matchup)) {
          return;
        }

        const record = {
          value: matchup.homeScore + matchup.awayScore,
          subtitle: `${teamDisplay(matchup.awayTeamKey, teamNames)} ${formatScore(
            matchup.awayScore,
          )} at ${teamDisplay(matchup.homeTeamKey, teamNames)} ${formatScore(
            matchup.homeScore,
          )}`,
          meta: `${season.year} Week ${week.week} · ${displayMatchupType(matchup)}`,
          href: weekPageHref(season.year, week.week),
        };
        if (isRegularMatchup(matchup)) {
          regularMatchupRecords.push(record);
        }
      });

      week.boxScores.forEach((boxScore) => {
        [
          { teamKey: boxScore.awayTeamKey, players: boxScore.awayLineup },
          { teamKey: boxScore.homeTeamKey, players: boxScore.homeLineup },
        ].forEach((lineup) => {
          lineup.players.forEach((player) => {
            if (!isFiniteNumber(player.points)) {
              return;
            }

            weeklyPlayerRecords.push({
              value: player.points,
              subtitle: playerAwardSubtitle(player.name, player.position),
              meta: `${season.year} Week ${week.week} · ${teamDisplay(
                lineup.teamKey,
                teamNames,
              )} · ${displayLineupSlot(player)}`,
              href: player.key
                ? `/player/${player.key}?fromYear=${season.year}`
                : weekPageHref(season.year, week.week),
            });

            if (isOffensiveSkillPosition(player.position)) {
              lowWeeklyPlayerRecords.push({
                value: player.points,
                subtitle: playerAwardSubtitle(player.name, player.position),
                meta: `${season.year} Week ${week.week} · ${teamDisplay(
                  lineup.teamKey,
                  teamNames,
                )} · ${displayLineupSlot(player)}`,
                href: player.key
                  ? `/player/${player.key}?fromYear=${season.year}`
                  : weekPageHref(season.year, week.week),
              });

              if (lineup.teamKey && lineupSection(player) === "starter") {
                const key = `${lineup.teamKey}-${player.key ?? player.name}`;
                const current = seasonStarterPlayerTotals.get(key) ?? {
                  value: 0,
                  name: player.name,
                  position: player.position,
                  teamKey: lineup.teamKey,
                  playerKey: player.key,
                  starts: 0,
                };
                current.value += player.points;
                current.starts += 1;
                seasonStarterPlayerTotals.set(key, current);
              }
            }
          });
        });
      });
    });

    seasonStarterPlayerTotals.forEach((player) => {
      if (player.starts < 3) {
        return;
      }

      lowSeasonPlayerRecords.push({
        value: player.value,
        subtitle: playerAwardSubtitle(player.name, player.position),
        meta: `${season.year} · ${teamDisplay(
          player.teamKey,
          teamNames,
        )} · ${player.starts} fantasy starts`,
        href: player.playerKey
          ? `/player/${player.playerKey}?fromYear=${season.year}`
          : teamPageHref(season.year, player.teamKey),
      });
    });
  });

  HISTORICAL_CHAMPIONS.forEach((champion) => {
    const owner = ownerTotals.get(champion.owner);
    if (owner) {
      owner.championships += 1;
    }
    championRows.push({ id: `historical-${champion.year}`, ...champion });
  });

  players.forEach((player) => {
    player.seasons.forEach((season) => {
      if (!isFiniteNumber(season.fantasyPoints) || season.appearances <= 0) {
        return;
      }

      seasonPlayerRecords.push({
        value: season.fantasyPoints,
        subtitle: playerAwardSubtitle(player.name, season.position),
        meta: `${season.year} · ${season.fantasyTeamName || "Free Agent"} · ${
          season.appearances
        } ${season.appearances === 1 ? "appearance" : "appearances"}`,
        href: `/player/${player.key}?fromYear=${season.year}`,
      });
    });
  });

  const ownerRows = [...ownerTotals.values()]
    .map((row) => ({
      ...row,
      averagePointsFor: row.seasons ? row.pointsFor / row.seasons : 0,
      averagePointsAgainst: row.seasons ? row.pointsAgainst / row.seasons : 0,
    }))
    .sort(
      (left, right) =>
        right.championships - left.championships ||
        right.pointsFor - left.pointsFor ||
        left.owner.localeCompare(right.owner),
    );

  return {
    highLowRecords: [
      recordCard(
        "highest-matchup",
        "Highest Scoring Matchup",
        maxBy(regularMatchupRecords, (record) => record.value),
      ),
      recordCard(
        "lowest-matchup",
        "Lowest Scoring Matchup",
        minBy(regularMatchupRecords, (record) => record.value),
      ),
      recordCard(
        "highest-team-average",
        "Highest Average Scoring Team",
        maxBy(teamAverageRecords, (record) => record.value),
      ),
      recordCard(
        "lowest-team-average",
        "Lowest Average Scoring Team",
        minBy(teamAverageRecords, (record) => record.value),
      ),
      recordCard(
        "highest-week-player",
        "Highest Single Week Scoring Player",
        maxBy(weeklyPlayerRecords, (record) => record.value),
      ),
      recordCard(
        "lowest-week-player",
        "Lowest Single Week Scoring Player",
        minBy(lowWeeklyPlayerRecords, (record) => record.value),
      ),
      recordCard(
        "highest-season-player",
        "Highest Season Scoring Player",
        maxBy(seasonPlayerRecords, (record) => record.value),
      ),
      recordCard(
        "lowest-season-player",
        "Lowest Season Scoring Player",
        minBy(lowSeasonPlayerRecords, (record) => record.value),
      ),
    ],
    ownerRows,
    championRows: championRows.sort((left, right) => right.year - left.year),
  };
}

function recordCard(
  id: string,
  title: string,
  candidate: LeagueRecordCandidate | undefined,
): LeagueRecordCard {
  return {
    id,
    title,
    value: candidate ? formatScore(candidate.value, false) : "-",
    subtitle: candidate?.subtitle ?? "No qualifying record found",
    meta: candidate?.meta ?? "-",
    href: candidate?.href,
  };
}

function maxBy<T>(rows: T[], valueForRow: (row: T) => number): T | undefined {
  return rows.reduce<T | undefined>(
    (best, row) =>
      best === undefined || valueForRow(row) > valueForRow(best) ? row : best,
    undefined,
  );
}

function minBy<T>(rows: T[], valueForRow: (row: T) => number): T | undefined {
  return rows.reduce<T | undefined>(
    (best, row) =>
      best === undefined || valueForRow(row) < valueForRow(best) ? row : best,
    undefined,
  );
}

function ownerLabel(team: PublicTeam): string {
  return formatOwnerNames(team.ownerNames, "Unknown owner");
}

function playerAwardSubtitle(name: string, position: string | undefined): string {
  return position ? `${position} - ${name}` : name;
}

function weekPageHref(year: number, week: number): string {
  return `/season/${year}/week/${String(week).padStart(2, "0")}`;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function finiteRecordValue(value: number | undefined): number {
  return isFiniteNumber(value) ? value : 0;
}

function teamMatchupColumns(
  year: number,
  teamNames: Map<string, string>,
  onShowBoxScore: (matchup: TeamMatchupRow) => void,
): ColumnDef<TeamMatchupRow>[] {
  return [
    {
      header: "Week",
      accessorKey: "week",
      cell: ({ row }) => row.original.week,
    },
    {
      header: "Opponent",
      accessorKey: "opponentName",
      cell: ({ row }) =>
        row.original.opponentKey ? (
          <Link to={teamPageHref(year, row.original.opponentKey)}>
            {teamDisplay(row.original.opponentKey, teamNames)}
          </Link>
        ) : (
          row.original.opponentName
        ),
    },
    {
      header: "Site",
      accessorKey: "location",
    },
    {
      header: "Result",
      accessorKey: "outcome",
      cell: ({ row }) => <OutcomePill outcome={row.original.outcome} />,
    },
    {
      header: "Score",
      accessorFn: (row) => row.teamScore ?? 0,
      cell: ({ row }) => (
        <button
          className="linkButton"
          type="button"
          onClick={() => onShowBoxScore(row.original)}
        >
          {teamScoreline(row.original)}
        </button>
      ),
    },
    {
      header: "Type",
      accessorKey: "matchupType",
      cell: ({ row }) => displayMatchupType(row.original),
    },
  ];
}

function draftPickColumnsForTeam(
  teamNames: Map<string, string>,
  year: number,
): ColumnDef<DraftPick>[] {
  return [
    {
      header: "Pick",
      accessorKey: "pick",
    },
    {
      header: "Round",
      accessorKey: "round",
      cell: ({ row }) => row.original.round ?? "-",
    },
    {
      header: "Player",
      accessorKey: "playerName",
      cell: ({ row }) =>
        row.original.playerKey ? (
          <Link to={`/player/${row.original.playerKey}?fromYear=${year}`}>
            {row.original.playerName}
          </Link>
        ) : (
          row.original.playerName
        ),
    },
    {
      header: "Team",
      accessorKey: "teamKey",
      cell: ({ row }) =>
        row.original.teamKey ? (
          <Link to={teamDraftHref(year, row.original.teamKey)}>
            {teamDisplay(row.original.teamKey, teamNames)}
          </Link>
        ) : (
          teamDisplay(row.original.teamKey, teamNames)
        ),
    },
    {
      header: "Draft Amount",
      accessorKey: "bidAmount",
      cell: ({ row }) => formatAuctionValue(row.original.bidAmount),
    },
    {
      header: "Keeper",
      accessorKey: "keeperStatus",
      cell: ({ row }) => (row.original.keeperStatus ? "Yes" : "-"),
    },
  ];
}

function buildTeamMatchupRows(
  team: PublicTeam,
  season: PublicSeason,
  weeks: PublicWeek[],
): TeamMatchupRow[] {
  const weekDataByNumber = new Map(weeks.map((week) => [week.week, week]));
  const teamByKey = new Map(season.teams.map((row) => [row.key, row]));
  const teamNames = teamNameMap(season.teams);

  return season.weeks
    .map((weekSummary, index): TeamMatchupRow => {
      const weekData = weekDataByNumber.get(weekSummary.week);
      const matchup = weekData?.scoreboard.find(
        (row) => row.homeTeamKey === team.key || row.awayTeamKey === team.key,
      );
      const isHome = matchup?.homeTeamKey === team.key;
      const isAway = matchup?.awayTeamKey === team.key;
      const opponentKey = matchup
        ? isHome
          ? matchup.awayTeamKey
          : matchup.homeTeamKey
        : team.schedule[index];
      const opponent = opponentKey ? teamByKey.get(opponentKey) : undefined;
      const teamScore = matchup
        ? isHome
          ? matchup.homeScore
          : matchup.awayScore
        : team.scores[index];
      const opponentScore = matchup
        ? isHome
          ? matchup.awayScore
          : matchup.homeScore
        : opponent?.scores[index];

      return {
        id: `${team.key}-week-${weekSummary.week}`,
        week: weekSummary.week,
        href: weekSummary.href,
        opponentKey,
        opponentName: opponent?.name ?? teamDisplay(opponentKey, teamNames),
        location: isHome ? "Home" : isAway ? "Away" : "-",
        teamScore,
        opponentScore,
        outcome: matchupOutcome(matchup, team.key) ?? team.outcomes[index],
        matchupType: matchup?.matchupType,
        isPlayoff: Boolean(matchup?.isPlayoff),
      };
    })
    .filter(isRealTeamMatchupRow);
}

function teamMatchupBoxScore(
  teamKey: string,
  matchup: TeamMatchupRow,
  weeks: PublicWeek[],
): BoxScore | undefined {
  return weeks
    .find((week) => week.week === matchup.week)
    ?.boxScores.find(
      (boxScore) =>
        boxScore.homeTeamKey === teamKey || boxScore.awayTeamKey === teamKey,
    );
}

function buildTeamRosterAggregateRows(
  teamKey: string,
  rosterPlayers: LineupPlayer[],
  weeks: PublicWeek[],
  positionRanks: Map<string, number>,
): TeamRosterAggregateRow[] {
  const aggregates = new Map<
    string,
    {
      appearances: number;
      starts: number;
      totalProjected: number;
      totalPoints: number;
    }
  >();

  weeks.forEach((week) => {
    const players = teamWeekLineup(teamKey, week);
    players.forEach((player) => {
      const key = lineupPlayerAggregateKey(player);
      const current = aggregates.get(key) ?? {
        appearances: 0,
        starts: 0,
        totalProjected: 0,
        totalPoints: 0,
      };
      current.appearances += 1;
      if (lineupSection(player) === "starter") {
        current.starts += 1;
      }
      current.totalProjected += finiteLineupValue(player.projectedPoints);
      current.totalPoints += finiteLineupValue(player.points);
      aggregates.set(key, current);
    });
  });

  return orderLineupPlayers(rosterPlayers).map((player, index) => {
    const aggregate = aggregates.get(lineupPlayerAggregateKey(player)) ?? {
      appearances: 0,
      starts: 0,
      totalProjected: 0,
      totalPoints: 0,
    };
    const appearances = aggregate.appearances;
    const totalPoints = appearances
      ? aggregate.totalPoints
      : finiteLineupValue(player.totalPoints);

    return {
      id: `${lineupPlayerAggregateKey(player)}-${index}`,
      player,
      positionRank: positionRanks.get(lineupPlayerAggregateKey(player)),
      appearances,
      starts: aggregate.starts,
      totalProjected: aggregate.totalProjected,
      totalPoints,
      averageProjected: appearances ? aggregate.totalProjected / appearances : 0,
      averagePoints: appearances ? totalPoints / appearances : 0,
    };
  });
}

function buildTeamDraftSummaryRows(
  draftPicks: DraftPick[],
  players: PublicPlayer[],
  year: number,
): TeamDraftSummaryRow[] {
  const playerByKey = new Map(players.map((player) => [player.key, player]));
  const playerById = new Map(
    players
      .filter((player) => player.playerId !== undefined)
      .map((player) => [player.playerId, player]),
  );

  return draftPicks.map((pick) => {
    const player =
      (pick.playerKey ? playerByKey.get(pick.playerKey) : undefined) ??
      (pick.playerId !== undefined ? playerById.get(pick.playerId) : undefined);
    const report = player?.seasons.find((season) => season.year === year);

    return {
      id: `${year}-${pick.pick}-${pick.playerKey ?? pick.playerId ?? pick.playerName}`,
      pick,
      player: {
        key: pick.playerKey ?? player?.key,
        playerId: pick.playerId ?? player?.playerId,
        photoUrl: player?.photoUrl,
        name: pick.playerName,
        position: report?.position ?? player?.primaryPosition,
        proTeam: report?.nflTeam,
      },
      auctionValue: pick.bidAmount,
      positionRank: report?.positionRank,
      totalFantasyPoints: report?.fantasyPoints,
    };
  });
}

function teamWeekLineup(teamKey: string, week: PublicWeek): LineupPlayer[] {
  const boxScore = week.boxScores.find(
    (row) => row.homeTeamKey === teamKey || row.awayTeamKey === teamKey,
  );
  if (boxScore?.homeTeamKey === teamKey) {
    return boxScore.homeLineup;
  }
  if (boxScore?.awayTeamKey === teamKey) {
    return boxScore.awayLineup;
  }
  return [];
}

function positionRankMap(players: PublicPlayer[], year: number): Map<string, number> {
  const ranks = new Map<string, number>();

  players.forEach((player) => {
    const season = player.seasons.find((row) => row.year === year);
    if (!season || typeof season.positionRank !== "number") {
      return;
    }
    ranks.set(player.key, season.positionRank);
    if (player.playerId !== undefined) {
      ranks.set(`player-${player.playerId}`, season.positionRank);
    }
  });

  return ranks;
}

function lineupPlayerAggregateKey(player: LineupPlayer): string {
  if (player.key) {
    return player.key;
  }
  if (player.playerId !== undefined) {
    return `player-${player.playerId}`;
  }
  return `name-${player.name.toLowerCase()}`;
}

function finiteLineupValue(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function finalRosterSnapshot(
  teamKey: string,
  weeks: PublicWeek[],
): TeamRosterSnapshot | undefined {
  for (const week of [...weeks].sort((left, right) => right.week - left.week)) {
    const boxScore = week.boxScores.find(
      (row) => row.homeTeamKey === teamKey || row.awayTeamKey === teamKey,
    );
    const players =
      boxScore?.homeTeamKey === teamKey
        ? boxScore.homeLineup
        : boxScore?.awayTeamKey === teamKey
          ? boxScore.awayLineup
          : undefined;

    if (players?.length) {
      return { week: week.week, players };
    }
  }

  return undefined;
}

function matchupOutcome(
  matchup: Matchup | undefined,
  teamKey: string,
): string | undefined {
  if (!matchup) {
    return undefined;
  }
  if (
    typeof matchup.homeScore === "number" &&
    typeof matchup.awayScore === "number" &&
    matchup.homeScore === matchup.awayScore
  ) {
    return "T";
  }
  if (!matchup.winnerTeamKey) {
    return undefined;
  }
  return matchup.winnerTeamKey === teamKey ? "W" : "L";
}

function OutcomePill({ outcome }: { outcome?: string }) {
  const label = normalizeOutcome(outcome);

  if (!label) {
    return <span className="pill">-</span>;
  }

  return <span className={`outcomePill ${outcomeClass(label)}`}>{label}</span>;
}

function normalizeOutcome(outcome: string | undefined): string | undefined {
  const normalized = outcome?.trim().toUpperCase();
  if (!normalized) {
    return undefined;
  }
  if (normalized.startsWith("W")) {
    return "W";
  }
  if (normalized.startsWith("L")) {
    return "L";
  }
  if (normalized.startsWith("T")) {
    return "T";
  }
  return normalized;
}

function outcomeClass(outcome: string): string {
  if (outcome === "W") {
    return "win";
  }
  if (outcome === "L") {
    return "loss";
  }
  if (outcome === "T") {
    return "tie";
  }
  return "neutral";
}

function displayMatchupType(matchup: { isPlayoff: boolean; matchupType?: string }): string {
  const matchupType =
    matchup.matchupType && matchup.matchupType.toUpperCase() !== "NONE"
      ? displayCodeLabel(matchup.matchupType)
      : undefined;

  if (matchup.isPlayoff) {
    return matchupType ? `Playoff: ${matchupType}` : "Playoff";
  }
  return matchupType ?? "Regular";
}

function featuredBroadcastMatchup(matchups: Matchup[]): ScoredMatchup | undefined {
  const scoredMatchups = matchups.filter(isScoredMatchup);

  return (
    scoredMatchups.find(
      (matchup) => matchup.isPlayoff && matchup.matchupType === "WINNERS_BRACKET",
    ) ??
    scoredMatchups.find((matchup) => matchup.isPlayoff) ??
    scoredMatchups[0]
  );
}

function broadcastTeamLabel(
  team: PublicTeam | undefined,
  teamKey: string | undefined,
  fallback: string,
): string {
  return team?.name.trim() || team?.abbrev || teamKey || fallback;
}

function teamScoreline(matchup: TeamMatchupRow): string {
  if (matchup.teamScore === undefined && matchup.opponentScore === undefined) {
    return "-";
  }
  return `${formatScore(matchup.teamScore)} - ${formatScore(matchup.opponentScore)}`;
}

function formatScore(value: number | undefined, useGrouping = true): string {
  if (value === undefined || Number.isNaN(value)) {
    return "-";
  }
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 1,
    useGrouping,
  });
}

function average(values: number[]): number | undefined {
  if (!values.length) {
    return undefined;
  }
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function isRealTeamScore(value: unknown): value is number {
  return isFiniteNumber(value) && value !== 0;
}

function isScoredMatchup(matchup: Matchup): matchup is ScoredMatchup {
  return isRealTeamScore(matchup.homeScore) && isRealTeamScore(matchup.awayScore);
}

function isRegularMatchup(matchup: Matchup): boolean {
  return (
    !matchup.isPlayoff &&
    (!matchup.matchupType || matchup.matchupType.toUpperCase() === "NONE")
  );
}

function isRealTeamMatchupRow(row: TeamMatchupRow): boolean {
  return (
    isRealTeamScore(row.teamScore) &&
    (row.opponentScore === undefined || isRealTeamScore(row.opponentScore))
  );
}

function isOffensiveSkillPosition(position: string | undefined): boolean {
  return position === "QB" || position === "RB" || position === "WR" || position === "TE";
}

function teamRecord(team: PublicTeam): string {
  return `${team.wins}-${team.losses}-${team.ties}`;
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

function TeamLabel({
  team,
  href,
  isChampion = false,
}: {
  team: PublicTeam;
  href?: string;
  isChampion?: boolean;
}) {
  const logoUrl = archivePublicUrl(team.logoUrl);
  const content = (
    <>
      {logoUrl ? <img src={logoUrl} alt="" loading="lazy" /> : null}
      <span>
        <span className="teamNameLine">
          <strong>{team.name}</strong>
          {isChampion ? (
            <LiaTrophySolid className="championTrophy" aria-label="Champion" />
          ) : null}
        </span>
        <small>{team.abbrev}</small>
      </span>
    </>
  );

  if (href) {
    return (
      <Link className="teamLabel" to={href}>
        {content}
      </Link>
    );
  }

  return (
    <span className="teamLabel">
      {content}
    </span>
  );
}

function teamNameMap(teams: PublicTeam[]): Map<string, string> {
  return new Map(teams.map((team) => [team.key, team.name]));
}

function TeamSearchLink({ row }: { row: SearchRow }) {
  const label = searchRowTeamLabel(row);

  if (!label) {
    return "-";
  }

  return <Link to={searchRowTeamHref(row) ?? row.href}>{label}</Link>;
}

function searchRowTeamLabel(row: SearchRow): string | undefined {
  return row.teamName ?? row.teamKey;
}

function searchRowDetailHref(row: SearchRow): string {
  return (
    playerDetailHref(row) ??
    (row.type === "team" ? searchRowTeamHref(row) : undefined) ??
    row.href
  );
}

function searchRowTeamHref(row: SearchRow): string | undefined {
  if (row.teamKey) {
    return row.type === "draft"
      ? teamDraftHref(row.year, row.teamKey)
      : teamPageHref(row.year, row.teamKey);
  }
  return undefined;
}

function teamPageHref(year: number, teamKey: string): string {
  return `/season/${year}/team/${encodeURIComponent(teamKey)}`;
}

function teamDraftHref(year: number, teamKey: string): string {
  return `${teamPageHref(year, teamKey)}/draft`;
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
      cell: ({ row }) => <KeeperTeamLink row={row.original} />,
    },
    {
      header: "Keeper Eligible",
      accessorKey: "keeperEligible",
      cell: ({ row }) => formatBoolean(row.original.keeperEligible),
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

function formatDraftValue(value: number | undefined): string {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? formatAuctionValue(value)
    : "-";
}

function seasonPvoa(season: PlayerSeasonReport): number | undefined {
  return typeof season.avgStarterPoints === "number"
    ? season.fantasyPoints - season.avgStarterPoints
    : undefined;
}

function pointsPerDollar(season: PlayerSeasonReport): number | undefined {
  return typeof season.draftValue === "number" && season.draftValue > 0
    ? season.fantasyPoints / season.draftValue
    : undefined;
}

function formatPvoa(value: number | undefined): string {
  const formatted = formatNumber(value, 1);
  return typeof value === "number" && value > 0 ? `+${formatted}` : formatted;
}

function formatPositionRank(season: PlayerSeasonReport): string {
  return typeof season.positionRank === "number"
    ? `#${season.positionRank}${season.position ? ` ${season.position}` : ""}`
    : "-";
}

function pvoaClassName(value: number | undefined): string {
  if (typeof value !== "number" || value === 0) {
    return "numberText pvoaNumber";
  }

  return `numberText pvoaNumber ${value > 0 ? "positive" : "negative"}`;
}

function formatBoolean(value: boolean): string {
  return value ? "Yes" : "No";
}

function keeperEligibilityByRowId(rows: SearchRow[]): Map<string, boolean> {
  const yearsByPlayer = new Map<string, Set<number>>();

  rows.forEach((row) => {
    const key = keeperIdentityKey(row);
    if (!key) {
      return;
    }

    const years = yearsByPlayer.get(key) ?? new Set<number>();
    years.add(row.year);
    yearsByPlayer.set(key, years);
  });

  return new Map(
    rows.flatMap((row) => {
      const key = keeperIdentityKey(row);
      const years = key ? yearsByPlayer.get(key) : undefined;
      if (!key || !years) {
        return [];
      }

      let consecutiveYears = 1;
      for (let year = row.year - 1; years.has(year); year -= 1) {
        consecutiveYears += 1;
      }

      return [[row.id, consecutiveYears < 3]];
    }),
  );
}

function keeperIdentityKey(row: SearchRow): string | undefined {
  if (row.type !== "draft" || !row.keeperStatus) {
    return undefined;
  }

  return row.playerKey ?? normalizeSearchText(row.playerName ?? row.label);
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

function displaySearchTransactionAction(row: SearchRow): string | undefined {
  if (
    row.type !== "transaction" &&
    !row.transactionType &&
    !row.transactionItemType &&
    !row.transactionActionType
  ) {
    return undefined;
  }

  return displayTransactionAction(
    row.transactionType,
    row.transactionItemType,
    row.transactionActionType,
  );
}

function displayTransactionAction(
  type?: string,
  itemType?: string,
  actionType?: string,
): string {
  const parts = [
    displayTransactionType(type, ""),
    displayTransactionItemType(itemType, ""),
  ].filter(Boolean);

  if (parts.length) {
    return parts.join(" ");
  }

  if (!actionType) {
    return "Transaction";
  }

  return (
    actionType
      .split(/\s+/)
      .filter(Boolean)
      .map(
        (part) =>
          displayTransactionType(part, "") ||
          displayTransactionItemType(part, "") ||
          displayCodeLabel(part),
      )
      .join(" ") || "Transaction"
  );
}

function displayTransactionType(type?: string, fallback = "Transaction"): string {
  return displayEnumCode(TransactionTypeLabel, type) ?? fallback;
}

function displayTransactionStatus(status?: string): string | undefined {
  return displayEnumCode(TransactionStatusLabel, status);
}

function displayTransactionItemType(itemType?: string, fallback = ""): string {
  return displayEnumCode(TransactionItemTypeLabel, itemType) ?? fallback;
}

function displayEnumCode(
  labels: Record<string, string>,
  value?: string,
): string | undefined {
  if (!value) {
    return undefined;
  }
  return labels[value.toUpperCase()] ?? displayCodeLabel(value);
}

function displayCodeLabel(value: string): string {
  return value
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function displaySearchRowSummary(row: SearchRow): string {
  if (row.type !== "transaction") {
    return row.summary;
  }

  const parts = [displayTransactionStatus(row.transactionStatus)];
  if (
    typeof row.bidAmount === "number" &&
    Number.isFinite(row.bidAmount) &&
    row.bidAmount > 0
  ) {
    parts.push(`$${formatNumber(row.bidAmount)}`);
  }

  return parts.filter(Boolean).join(", ") || row.summary || "Transaction";
}

function resultColumnsForType(
  type: BrowserFilterType,
  showsYear: boolean,
): ColumnDef<SearchRow>[] {
  const columns =
    type === "draft"
      ? draftSearchColumns
      : type === "transaction"
        ? transactionSearchColumns
        : searchColumns;

  if (!showsYear) {
    return columns.filter((column) => column.header !== "Season");
  }

  return columns;
}

function sortSearchRows(rows: SearchRow[]): SearchRow[] {
  return [...rows].sort(compareSearchRows);
}

function sortDraftSearchRows(rows: SearchRow[]): SearchRow[] {
  return [...rows].sort((left, right) => {
    const leftAmount = Number.isFinite(left.bidAmount) ? left.bidAmount! : -1;
    const rightAmount = Number.isFinite(right.bidAmount) ? right.bidAmount! : -1;
    if (leftAmount !== rightAmount) {
      return rightAmount - leftAmount;
    }

    return compareSearchRows(left, right);
  });
}

function compareSearchRows(left: SearchRow, right: SearchRow): number {
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
    return <LiaUsersSolid size={23} aria-hidden />;
  }
  if (type === "week") {
    return <LiaCalendarAltSolid size={23} aria-hidden />;
  }
  if (type === "transaction") {
    return <LiaExchangeAltSolid size={23} aria-hidden />;
  }
  if (type === "draft") {
    return <LiaClipboardListSolid size={23} aria-hidden />;
  }
  if (type === "season") {
    return <LiaArchiveSolid size={23} aria-hidden />;
  }
  if (type === "player") {
    return <LiaFootballBallSolid size={23} aria-hidden />;
  }
  return <LiaSearchSolid size={23} aria-hidden />;
}

function browserBreadcrumbItems(filters: BrowserFilters): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [{ label: "Home", to: "/" }];

  if (filters.type !== "all") {
    const typeLabel =
      recordTypeOptions.find((option) => option.value === filters.type)?.label ??
      filters.type;
    items.push({
      label: typeLabel,
      to: typeBrowseHref(filters.type, filters.query),
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
  const params = new URLSearchParams({
    year: String(year),
  });
  const normalizedQuery = query.trim();

  if (normalizedQuery) {
    params.set("q", normalizedQuery);
  }

  return `/players?${params.toString()}`;
}

function draftYearBrowseHref(year: number, query: string): string {
  const params = new URLSearchParams({
    year: String(year),
  });
  const normalizedQuery = query.trim();

  if (normalizedQuery) {
    params.set("q", normalizedQuery);
  }

  return `/drafts?${params.toString()}`;
}

function yearBrowseHref(type: SearchType, year: number, query: string): string {
  if (type === "draft") {
    return draftYearBrowseHref(year, query);
  }
  if (type === "player") {
    return playerYearBrowseHref(year, query);
  }

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

function typeBrowseHref(type: SearchType, query: string): string {
  if (type === "draft") {
    const params = new URLSearchParams();
    const normalizedQuery = query.trim();

    if (normalizedQuery) {
      params.set("q", normalizedQuery);
    }

    return params.size ? `/drafts?${params.toString()}` : "/drafts";
  }
  if (type === "player") {
    const params = new URLSearchParams();
    const normalizedQuery = query.trim();

    if (normalizedQuery) {
      params.set("q", normalizedQuery);
    }

    return params.size ? `/players?${params.toString()}` : "/players";
  }

  const params = new URLSearchParams({ type });
  const normalizedQuery = query.trim();

  if (normalizedQuery) {
    params.set("q", normalizedQuery);
  }

  return `/browse?${params.toString()}`;
}

function allSeasonsBrowseHref(type: SearchType, query: string): string {
  if (type === "draft") {
    const params = new URLSearchParams({ view: "all" });
    const normalizedQuery = query.trim();

    if (normalizedQuery) {
      params.set("q", normalizedQuery);
    }

    return `/drafts?${params.toString()}`;
  }
  if (type === "player") {
    const params = new URLSearchParams({ view: "all" });
    const normalizedQuery = query.trim();

    if (normalizedQuery) {
      params.set("q", normalizedQuery);
    }

    return `/players?${params.toString()}`;
  }

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

function draftsHrefFromFilters(filters: BrowserFilters): string {
  const params = draftParamsFromFilters({ ...filters, type: "draft" });
  return params.size ? `/drafts?${params.toString()}` : "/drafts";
}

function playersHrefFromFilters(filters: BrowserFilters): string {
  const params = playerParamsFromFilters({ ...filters, type: "player" });
  return params.size ? `/players?${params.toString()}` : "/players";
}

function draftParamsFromFilters(filters: BrowserFilters): URLSearchParams {
  const params = paramsFromFilters({ ...filters, type: "draft" });
  params.delete("type");
  return params;
}

function playerParamsFromFilters(filters: BrowserFilters): URLSearchParams {
  const params = paramsFromFilters({ ...filters, type: "player" });
  params.delete("type");
  return params;
}

function searchPlaceholder(filters: BrowserFilters): string {
  if (filters.type === "player") {
    return filters.year === "all"
      ? "Search players"
      : "Search players, NFL teams, fantasy teams";
  }
  return "Search teams, matchups, transactions";
}

function matchesSearchRowQuery(
  row: SearchRow,
  query: string,
): boolean {
  if (!query) {
    return true;
  }

  const haystack = [
    row.year,
    row.label,
    row.summary,
    row.playerName,
    row.teamName,
    row.transactionActionType,
    row.transactionStatus,
    displaySearchTransactionAction(row),
    displayTransactionStatus(row.transactionStatus),
    displaySearchRowSummary(row),
  ]
    .filter(Boolean)
    .join(" ");

  return includesSearchText(haystack, query);
}

function matchesDraftSearchRowQuery(row: SearchRow, query: string): boolean {
  if (!query) {
    return true;
  }

  return includesSearchText(row.playerName ?? row.label, query);
}

function draftSearchRowPosition(
  row: SearchRow,
  playerByKey: Map<string, PublicPlayer>,
): string | undefined {
  const player = row.playerKey ? playerByKey.get(row.playerKey) : undefined;
  const season = player?.seasons.find((playerSeason) => playerSeason.year === row.year);
  return season?.position ?? player?.primaryPosition;
}

function matchesPositionFilter(
  position: string | undefined,
  filter: PositionFilter | "",
): boolean {
  if (!filter) {
    return position !== "HC";
  }
  if (filter === "OP") {
    return isOffensiveSkillPosition(position);
  }
  return position === filter;
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

  return includesSearchText(haystack, query);
}

function matchesPlayerQuery(player: PublicPlayer, query: string): boolean {
  return includesSearchText(player.name, query);
}

function filtersFromSearchParams(searchParams: URLSearchParams): BrowserFilters {
  const type = searchParams.get("type");

  return normalizeFilters({
    query: searchParams.get("q") ?? "",
    type: isBrowserFilterType(type) ? type : "all",
    year: searchParams.get("year") ?? "all",
    view: searchParams.get("view") === "all" ? "all" : "picker",
    position: normalizePositionFilter(searchParams.get("pos")),
  });
}

function normalizePositionFilter(value: unknown): PositionFilter | "" {
  return typeof value === "string" && isPositionFilter(value) ? value : "";
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
  if (normalizedFilters.position) {
    params.set("pos", normalizedFilters.position);
  }

  return params;
}

function normalizeFilters(filters: BrowserFilters): BrowserFilters {
  const query = filters.query.trim();
  const type = isBrowserFilterType(filters.type) ? filters.type : "all";
  const year =
    filters.year === "all" || /^\d{4}$/.test(filters.year) ? filters.year : "all";
  const position = normalizePositionFilter(filters.position);
  const view =
    query && year === "all"
      ? "all"
      : filters.view === "all"
        ? "all"
        : "picker";

  return { query, type, year, view, position };
}

function clearedBrowserFilters(
  filters: BrowserFilters,
  type = filters.type,
): BrowserFilters {
  const view =
    filters.year === "all" && (filters.query || filters.position)
      ? "all"
      : filters.view;
  return normalizeFilters({ ...filters, query: "", type, view });
}

function isBrowserFilterType(value: unknown): value is BrowserFilterType {
  return (
    typeof value === "string" &&
    recordTypeOptions.some((option) => option.value === value)
  );
}

function isPositionFilter(value: string): value is PositionFilter {
  return positionFilterOptions.some((position) => position === value);
}

function filtersMatch(left: BrowserFilters, right: BrowserFilters): boolean {
  const normalizedLeft = normalizeFilters(left);
  const normalizedRight = normalizeFilters(right);

  return (
    normalizedLeft.query === normalizedRight.query &&
    normalizedLeft.type === normalizedRight.type &&
    normalizedLeft.year === normalizedRight.year &&
    normalizedLeft.view === normalizedRight.view &&
    normalizedLeft.position === normalizedRight.position
  );
}

function yearsSinceLeagueOrigin(today = new Date()): number {
  const years = today.getFullYear() - LEAGUE_ORIGIN_DATE.year;
  const anniversaryPassed =
    today.getMonth() > LEAGUE_ORIGIN_DATE.monthIndex ||
    (today.getMonth() === LEAGUE_ORIGIN_DATE.monthIndex &&
      today.getDate() >= LEAGUE_ORIGIN_DATE.day);

  return anniversaryPassed ? years : years - 1;
}

export default App;
