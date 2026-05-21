export type SearchType =
  | "season"
  | "team"
  | "week"
  | "matchup"
  | "transaction"
  | "draft"
  | "player";

export type ArchiveManifest = {
  exportedAt: string;
  seasons: Array<{
    year: number;
    teamCount: number;
    weekCount: number;
    hasBoxScores: boolean;
    hasTransactions: boolean;
  }>;
};

export type SearchRow = {
  id: string;
  type: SearchType;
  year: number;
  week?: number;
  teamKey?: string;
  playerName?: string;
  label: string;
  summary: string;
  href: string;
  bidAmount?: number;
  keeperStatus?: boolean;
};

export type PublicTeam = {
  key: string;
  abbrev: string;
  name: string;
  divisionId?: number;
  divisionName?: string;
  ownerNames: string[];
  logoUrl?: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  standing?: number;
  finalStanding?: number;
  scores: number[];
  outcomes: string[];
  mov: number[];
  schedule: string[];
  transactions: {
    acquisitions: number;
    acquisitionBudgetSpent: number;
    drops: number;
    trades: number;
    moveToIr: number;
  };
};

export type DraftPick = {
  pick: number;
  round?: number;
  roundPick?: number;
  teamKey?: string;
  nominatingTeamKey?: string;
  playerName: string;
  bidAmount?: number;
  keeperStatus?: boolean;
};

export type WeekSummary = {
  week: number;
  href: string;
  scoreboardCount: number;
  boxScoreCount: number;
  transactionCount: number;
  hasBoxScores: boolean;
  hasTransactions: boolean;
};

export type PublicSeason = {
  year: number;
  exportedAt: string;
  settings: {
    name: string;
    teamCount: number;
    regSeasonCount?: number;
    playoffTeamCount?: number;
    scoringType?: string;
    divisions: string[];
    rosterSlots: Array<{ slot: string; count: number }>;
    scoringRules: Array<{ abbr?: string; label: string; points: number }>;
  };
  teams: PublicTeam[];
  standings: PublicTeam[];
  draft: DraftPick[];
  weeks: WeekSummary[];
};

export type Matchup = {
  matchupKey: string;
  homeTeamKey?: string;
  awayTeamKey?: string;
  homeScore?: number;
  awayScore?: number;
  homeProjected?: number;
  awayProjected?: number;
  winnerTeamKey?: string;
  matchupType?: string;
  isPlayoff: boolean;
};

export type LineupPlayer = {
  name: string;
  position?: string;
  lineupSlot?: string;
  slotPosition?: string;
  proTeam?: string;
  proOpponent?: string;
  points?: number;
  projectedPoints?: number;
  injuryStatus?: string;
};

export type BoxScore = Matchup & {
  homeLineup: LineupPlayer[];
  awayLineup: LineupPlayer[];
};

export type Transaction = {
  transactionKey: string;
  teamKey?: string;
  type?: string;
  status?: string;
  scoringPeriod?: number;
  date?: number;
  bidAmount?: number;
  items: Array<{ type?: string; player: string }>;
};

export type PublicWeek = {
  year: number;
  week: number;
  scoreboard: Matchup[];
  boxScores: BoxScore[];
  transactions: Transaction[];
};
