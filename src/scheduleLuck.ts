import type { PublicSeason, PublicWeek } from "./types";

export type ScheduleLuckRow = {
  teamKey: string;
  teamName: string;
  ownerNames: string[];
  logoUrl?: string;
  weeks: number;
  actualWins: number;
  actualLosses: number;
  actualTies: number;
  allPlayWins: number;
  allPlayLosses: number;
  allPlayTies: number;
  expectedWins: number;
  winsAboveExpected: number;
  pointsFor: number;
};

export function buildScheduleLuckRows(season: PublicSeason, weeks: PublicWeek[]): ScheduleLuckRow[] {
  const rows = season.teams.map((team) => ({
    teamKey: team.key,
    teamName: team.name,
    ownerNames: [...team.ownerNames],
    logoUrl: team.logoUrl,
    weeks: 0,
    actualWins: 0,
    actualLosses: 0,
    actualTies: 0,
    allPlayWins: 0,
    allPlayLosses: 0,
    allPlayTies: 0,
    expectedWins: 0,
    winsAboveExpected: 0,
    pointsFor: 0,
  }));
  const byKey = new Map(rows.map((row) => [row.teamKey, row]));
  if (byKey.size !== rows.length || rows.length < 2) return rows;

  for (const week of weeks) {
    if (week.week < 1 || week.week > (season.settings.regSeasonCount ?? Infinity)) continue;

    const scores = new Map<string, number>();
    const matchups: Array<[string, string, number, number]> = [];
    let repeatedTeam = false;
    for (const matchup of week.scoreboard) {
      const { homeTeamKey, awayTeamKey, homeScore, awayScore } = matchup;
      if (
        matchup.isPlayoff ||
        !homeTeamKey ||
        !awayTeamKey ||
        !byKey.has(homeTeamKey) ||
        !byKey.has(awayTeamKey) ||
        typeof homeScore !== "number" ||
        typeof awayScore !== "number" ||
        !Number.isFinite(homeScore) ||
        !Number.isFinite(awayScore) ||
        homeScore <= 0 ||
        awayScore <= 0
      ) continue;

      if (scores.has(homeTeamKey) || scores.has(awayTeamKey) || homeTeamKey === awayTeamKey) {
        repeatedTeam = true;
        break;
      }
      scores.set(homeTeamKey, homeScore);
      scores.set(awayTeamKey, awayScore);
      matchups.push([homeTeamKey, awayTeamKey, homeScore, awayScore]);
    }
    if (repeatedTeam || scores.size !== rows.length) continue;

    for (const [homeKey, awayKey, homeScore, awayScore] of matchups) {
      const home = byKey.get(homeKey)!;
      const away = byKey.get(awayKey)!;
      if (homeScore > awayScore) {
        home.actualWins++;
        away.actualLosses++;
      } else if (homeScore < awayScore) {
        home.actualLosses++;
        away.actualWins++;
      } else {
        home.actualTies++;
        away.actualTies++;
      }
    }

    for (const [teamKey, score] of scores) {
      const row = byKey.get(teamKey)!;
      row.weeks++;
      row.pointsFor += score;
      let weekWins = 0;
      let weekTies = 0;
      for (const [otherKey, otherScore] of scores) {
        if (teamKey === otherKey) continue;
        if (score > otherScore) {
          row.allPlayWins++;
          weekWins++;
        } else if (score < otherScore) row.allPlayLosses++;
        else {
          row.allPlayTies++;
          weekTies++;
        }
      }
      row.expectedWins += (weekWins + 0.5 * weekTies) / (scores.size - 1);
    }
  }

  for (const row of rows) {
    row.winsAboveExpected = row.actualWins + 0.5 * row.actualTies - row.expectedWins;
  }
  return rows;
}
