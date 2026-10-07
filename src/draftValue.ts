import type { PublicPlayer, PublicSeason } from "./types";

export type DraftValueRow = {
  id: string;
  year: number;
  playerKey: string;
  playerName: string;
  position?: string;
  bidAmount: number;
  fantasyPoints: number;
  pointsPerDollar: number;
  draftedTeamName: string;
  keeperStatus: boolean;
};

export function buildDraftValueRows(
  season: PublicSeason,
  players: PublicPlayer[],
): DraftValueRow[] {
  const playerByKey = new Map(players.map((player) => [player.key, player]));
  const teamNameByKey = new Map(season.teams.map((team) => [team.key, team.name]));

  return season.draft.flatMap((pick): DraftValueRow[] => {
    const player = pick.playerKey ? playerByKey.get(pick.playerKey) : undefined;
    const report = player?.seasons.find((row) => row.year === season.year);
    const position = report?.position ?? player?.primaryPosition;
    const bidAmount = pick.bidAmount;
    const fantasyPoints = report?.fantasyPoints;
    if (
      !player ||
      !report ||
      position === "HC" ||
      typeof bidAmount !== "number" ||
      !Number.isFinite(bidAmount) ||
      bidAmount <= 0 ||
      typeof fantasyPoints !== "number" ||
      !Number.isFinite(fantasyPoints) ||
      fantasyPoints < 0
    ) {
      return [];
    }

    return [{
      id: `${season.year}-${pick.pick}`,
      year: season.year,
      playerKey: player.key,
      playerName: player.name,
      position,
      bidAmount,
      fantasyPoints,
      pointsPerDollar: fantasyPoints / bidAmount,
      draftedTeamName: pick.teamKey
        ? teamNameByKey.get(pick.teamKey) ?? pick.teamKey
        : "Unknown",
      keeperStatus: pick.keeperStatus ?? false,
    }];
  });
}
