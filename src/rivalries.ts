import { OWNER_DISPLAY_NAMES, type OwnerKey, type PublicSeason, type PublicWeek } from "./types";

export type RivalryGame = {
  matchupKey: string;
  year: number;
  week: number;
  homeOwner: string;
  awayOwner: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  isPlayoff: boolean;
  href: string;
};

export type RivalrySeason = { season: PublicSeason; weeks: PublicWeek[] };

function ownerName(name: string): string {
  return OWNER_DISPLAY_NAMES[name as OwnerKey] ?? name;
}

export function buildRivalryGames(seasons: RivalrySeason[]): RivalryGame[] {
  const games: RivalryGame[] = [];

  for (const { season, weeks } of seasons) {
    const teams = new Map(season.teams.map((team) => [team.key, team]));

    for (const week of weeks) {
      for (const matchup of week.scoreboard) {
        const home = teams.get(matchup.homeTeamKey ?? "");
        const away = teams.get(matchup.awayTeamKey ?? "");
        const { homeScore, awayScore } = matchup;
        if (
          !home ||
          !away ||
          typeof homeScore !== "number" ||
          typeof awayScore !== "number" ||
          !Number.isFinite(homeScore) ||
          !Number.isFinite(awayScore) ||
          homeScore <= 0 ||
          awayScore <= 0
        ) {
          continue;
        }

        const homeOwners = new Set(home.ownerNames.map(ownerName).filter(Boolean));
        const awayOwners = new Set(away.ownerNames.map(ownerName).filter(Boolean));
        for (const homeOwner of homeOwners) {
          for (const awayOwner of awayOwners) {
            if (homeOwner === awayOwner) continue;
            games.push({
              matchupKey: matchup.matchupKey,
              year: season.year,
              week: week.week,
              homeOwner,
              awayOwner,
              homeTeamName: home.name,
              awayTeamName: away.name,
              homeScore,
              awayScore,
              isPlayoff: matchup.isPlayoff,
              href: `/season/${season.year}/week/${String(week.week).padStart(2, "0")}`,
            });
          }
        }
      }
    }
  }

  return games.sort((a, b) => b.year - a.year || b.week - a.week);
}

export function summarizeRivalry(games: RivalryGame[], ownerA: string, ownerB: string) {
  const a = ownerName(ownerA);
  const b = ownerName(ownerB);
  const between = games.filter(
    (game) =>
      (game.homeOwner === a && game.awayOwner === b) ||
      (game.homeOwner === b && game.awayOwner === a),
  );
  let winsA = 0;
  let winsB = 0;
  let ties = 0;
  let pointsA = 0;
  let pointsB = 0;

  for (const game of between) {
    const scoreA = game.homeOwner === a ? game.homeScore : game.awayScore;
    const scoreB = game.homeOwner === a ? game.awayScore : game.homeScore;
    pointsA += scoreA;
    pointsB += scoreB;
    if (scoreA > scoreB) winsA++;
    else if (scoreA < scoreB) winsB++;
    else ties++;
  }

  return { games: between, winsA, winsB, ties, pointsA, pointsB };
}
