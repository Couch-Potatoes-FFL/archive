export type SearchType =
  | "season"
  | "team"
  | "week"
  | "matchup"
  | "transaction"
  | "draft"
  | "player";

export const OWNER_DISPLAY_NAMES = {
  mjmac222: "Matt M",
  Bisstits: "Nate B",
  James_Gang777: "Ethan J",
  The_Fitzgeralds: "Evan M",
  AMurray248: "Andy M",
  whaddupgangstahh: "Jordan P",
  NotNate: "Nate S",
  jcherry14: "George B",
  "George Bissell": "George B",
  patsfan421: "Mark M",
  JMarcG333: "Marc G",
  "Mr.Ricci": "Joey R",
  johnth7847664: "John H",
  ESPNFAN7070151013: "George B",
  XxMrPigxX: "Gabe M",
} as const;

export type OwnerKey = keyof typeof OWNER_DISPLAY_NAMES;
export type OwnerDisplayName = (typeof OWNER_DISPLAY_NAMES)[OwnerKey];
export type OwnerDisplayNameMap = typeof OWNER_DISPLAY_NAMES;

export type ArchiveManifest = {
  exportedAt: string;
  seasons: Array<{
    year: number;
    teamCount: number;
    weekCount: number;
    matchupCount: number;
    playerCount: number;
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
  teamName?: string;
  logoUrl?: string;
  playerKey?: string;
  playerName?: string;
  transactionType?: string;
  transactionItemType?: string;
  transactionActionType?: string;
  transactionStatus?: string;
  label: string;
  summary: string;
  href: string;
  draftPick?: number;
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
  roster?: LineupPlayer[];
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
  playerKey?: string;
  playerId?: number;
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
  key?: string;
  playerId?: number;
  photoUrl?: string;
  name: string;
  position?: string;
  lineupSlot?: string;
  slotPosition?: string;
  proTeam?: string;
  proOpponent?: string;
  points?: number;
  projectedPoints?: number;
  totalPoints?: number;
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
  items: Array<{ type?: string; playerKey?: string; playerId?: number; player: string }>;
};

export type PlayerSeasonReport = {
  year: number;
  position?: string;
  nflTeam?: string;
  fantasyTeamKey?: string;
  fantasyTeamName: string;
  fantasyPoints: number;
  draftValue?: number;
  replacementPoints?: number;
  avgStarterPoints?: number;
  playerRank: number;
  positionRank?: number;
  gamesPlayed: number;
  starts: number;
  appearances: number;
};

export type PublicPlayer = {
  key: string;
  playerId?: number;
  photoUrl?: string;
  name: string;
  primaryPosition?: string;
  seasons: PlayerSeasonReport[];
  totalFantasyPoints: number;
  bestSeason?: PlayerSeasonReport;
  latestSeason?: PlayerSeasonReport;
};

export type PublicWeek = {
  year: number;
  week: number;
  scoreboard: Matchup[];
  boxScores: BoxScore[];
  transactions: Transaction[];
};
