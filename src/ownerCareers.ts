import { OWNER_DISPLAY_NAMES, type OwnerKey, type PublicSeason } from "./types";

export type OwnerSeason = {
  year: number;
  teamKey: string;
  teamName: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  finalStanding?: number;
};

export type OwnerTitle = { year: number; teamName: string; href?: string };

export type OwnerCareer = {
  name: string;
  seasons: OwnerSeason[];
  titles: OwnerTitle[];
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
};

export type HistoricalChampion = { year: number; owner: string; teamName: string };

function displayName(name: string): string {
  return OWNER_DISPLAY_NAMES[name as OwnerKey] ?? name;
}

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export function buildOwnerCareers(
  seasons: PublicSeason[],
  historicalChampions: readonly HistoricalChampion[],
): OwnerCareer[] {
  const careers = new Map<string, OwnerCareer>();
  const getCareer = (name: string): OwnerCareer => {
    let career = careers.get(name);
    if (!career) {
      career = {
        name,
        seasons: [],
        titles: [],
        wins: 0,
        losses: 0,
        ties: 0,
        pointsFor: 0,
        pointsAgainst: 0,
      };
      careers.set(name, career);
    }
    return career;
  };

  for (const season of seasons) {
    for (const team of season.teams) {
      const ownerSeason: OwnerSeason = {
        year: season.year,
        teamKey: team.key,
        teamName: team.name.trim(),
        wins: finite(team.wins),
        losses: finite(team.losses),
        ties: finite(team.ties),
        pointsFor: finite(team.pointsFor),
        pointsAgainst: finite(team.pointsAgainst),
        ...(typeof team.finalStanding === "number" &&
        Number.isFinite(team.finalStanding) && team.finalStanding > 0
          ? { finalStanding: team.finalStanding }
          : {}),
      };

      for (const name of new Set(team.ownerNames.map(displayName).filter(Boolean))) {
        const career = getCareer(name);
        career.seasons.push({ ...ownerSeason });
        career.wins += ownerSeason.wins;
        career.losses += ownerSeason.losses;
        career.ties += ownerSeason.ties;
        career.pointsFor += ownerSeason.pointsFor;
        career.pointsAgainst += ownerSeason.pointsAgainst;
        if (team.finalStanding === 1) {
          career.titles.push({
            year: season.year,
            teamName: team.name.trim(),
            href: `/season/${season.year}/team/${team.key}`,
          });
        }
      }
    }
  }

  for (const { year, owner, teamName } of historicalChampions) {
    getCareer(displayName(owner)).titles.push({ year, teamName });
  }

  return [...careers.values()]
    .map((career) => ({
      ...career,
      seasons: career.seasons.sort((a, b) => b.year - a.year || a.teamKey.localeCompare(b.teamKey)),
      titles: career.titles.sort((a, b) => b.year - a.year),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
