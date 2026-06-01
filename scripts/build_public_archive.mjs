#!/usr/bin/env node

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const sourceDir = path.join(rootDir, "data", "espn");
const outputDir = path.join(rootDir, "public", "archive");

function readJson(filePath) {
  return readFile(filePath, "utf8").then((text) => JSON.parse(text));
}

function loadDotenv(filePath) {
  return readFile(filePath, "utf8")
    .then((text) => {
      for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#") || !line.includes("=")) {
          continue;
        }

        const [rawKey, ...rawValueParts] = line.split("=");
        const key = rawKey.trim();
        const value = rawValueParts.join("=").trim().replace(/^['"]|['"]$/g, "");
        if (key && !process.env[key]) {
          process.env[key] = value;
        }
      }
    })
    .catch((error) => {
      if (error.code !== "ENOENT") {
        throw error;
      }
    });
}

async function writeJson(relativePath, payload) {
  const destination = path.join(outputDir, relativePath);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(payload, null, 2)}\n`);
}

async function writeBinary(relativePath, payload) {
  const destination = path.join(outputDir, relativePath);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, payload);
}

function teamKey(year, teamId) {
  if (teamId === undefined || teamId === null || teamId === "") {
    return undefined;
  }
  const numeric = Number(teamId);
  if (Number.isFinite(numeric)) {
    return `${year}-t${String(numeric).padStart(2, "0")}`;
  }
  return `${year}-t${String(teamId).replace(/[^a-zA-Z0-9]/g, "")}`;
}

function ownerNames(owners) {
  if (!Array.isArray(owners)) {
    return [];
  }
  return owners
    .map((owner) => owner?.displayName || owner?.firstName || owner?.lastName)
    .filter(Boolean);
}

function finiteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function optionalFiniteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function slugify(value) {
  const slug = String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "unknown";
}

function playerKeyFromParts(playerId, name) {
  if (playerId !== undefined && playerId !== null && playerId !== "") {
    return `espn-${String(playerId).replace(/[^a-zA-Z0-9-]/g, "")}`;
  }
  return `name-${slugify(name)}`;
}

function playerKey(player) {
  return playerKeyFromParts(player?.player_id ?? player?.playerId, player?.name);
}

function firstString(...values) {
  return values.find((value) => typeof value === "string" && value.trim())?.trim();
}

function playerPhotoUrl(player) {
  return firstString(
    player?.photo_url,
    player?.photoUrl,
    player?.headshot,
    player?.headshotUrl,
    player?.avatar,
    player?.avatarUrl,
    player?.image,
    player?.imageUrl,
  );
}

function espnPlayerPhotoUrl(playerId) {
  const numeric = Number(playerId);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    return undefined;
  }
  return `https://a.espncdn.com/i/headshots/nfl/players/full/${numeric}.png`;
}

function publicPlayer(player) {
  if (!player || typeof player !== "object") {
    return undefined;
  }
  const key = playerKey(player);
  return {
    key,
    playerId: player.player_id ?? undefined,
    name: player.name || "Unknown player",
    photoUrl: playerPhotoUrl(player),
    position: player.position || undefined,
    lineupSlot: player.lineup_slot || undefined,
    slotPosition: player.slot_position || undefined,
    proTeam: player.pro_team || undefined,
    proOpponent: player.pro_opponent || undefined,
    points:
      player.points === undefined || player.points === null
        ? undefined
        : finiteNumber(player.points),
    projectedPoints:
      player.projected_points === undefined || player.projected_points === null
        ? undefined
        : finiteNumber(player.projected_points),
    injuryStatus: player.injury_status || undefined,
  };
}

function espnCookieHeader() {
  const swid = process.env.ESPN_SWID?.trim();
  const espnS2 = process.env.ESPN_S2?.trim();
  return swid && espnS2 ? `SWID=${swid}; espn_s2=${espnS2}` : undefined;
}

function shouldCacheLogo(logoUrl) {
  return typeof logoUrl === "string" && logoUrl.includes("mystique-api.fantasy.espn.com");
}

function logoExtension(contentType) {
  if (contentType.includes("svg")) {
    return ".svg";
  }
  if (contentType.includes("png")) {
    return ".png";
  }
  if (contentType.includes("webp")) {
    return ".webp";
  }
  if (contentType.includes("gif")) {
    return ".gif";
  }
  return ".jpg";
}

async function cacheTeamLogos(year, teams) {
  const cookie = espnCookieHeader();
  const cache = new Map();

  for (const team of teams) {
    if (!shouldCacheLogo(team.logoUrl) || cache.has(team.logoUrl)) {
      continue;
    }

    if (!cookie) {
      console.warn(
        `Skipping authenticated logo for ${team.key}; ESPN_SWID and ESPN_S2 are required.`,
      );
      continue;
    }

    let response;
    try {
      response = await fetch(team.logoUrl, {
        headers: {
          Accept: "image/*,*/*",
          Cookie: cookie,
          "User-Agent": "cpffl-public-archive/1.0",
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Unable to cache logo for ${team.key}: ${message}`);
      continue;
    }
    const contentType = response.headers.get("content-type") || "";

    if (!response.ok || !contentType.startsWith("image/")) {
      console.warn(
        `Unable to cache logo for ${team.key}: ${response.status} ${contentType}`,
      );
      continue;
    }

    const extension = logoExtension(contentType);
    const relativePath = `assets/team-logos/${year}/${team.key}${extension}`;
    await writeBinary(relativePath, Buffer.from(await response.arrayBuffer()));
    cache.set(team.logoUrl, `archive/${relativePath}`);
  }

  return (team) => ({
    ...team,
    logoUrl: cache.get(team.logoUrl) || team.logoUrl,
  });
}

function compactTeam(year, team) {
  const transactions = team.transactions || {};
  return {
    key: teamKey(year, team.team_id),
    abbrev: team.abbrev || "",
    name: team.name || "Unknown team",
    divisionId: team.division_id,
    divisionName: team.division_name || undefined,
    ownerNames: ownerNames(team.owners),
    logoUrl: team.logo_url || undefined,
    wins: finiteNumber(team.wins),
    losses: finiteNumber(team.losses),
    ties: finiteNumber(team.ties),
    pointsFor: finiteNumber(team.points_for),
    pointsAgainst: finiteNumber(team.points_against),
    standing: team.standing,
    finalStanding: team.final_standing,
    scores: Array.isArray(team.scores) ? team.scores.map((score) => finiteNumber(score)) : [],
    outcomes: Array.isArray(team.outcomes) ? team.outcomes.filter(Boolean) : [],
    mov: Array.isArray(team.mov) ? team.mov.map((score) => finiteNumber(score)) : [],
    schedule: Array.isArray(team.schedule)
      ? team.schedule.map((opponent) => teamKey(year, opponent)).filter(Boolean)
      : [],
    transactions: {
      acquisitions: finiteNumber(transactions.acquisitions),
      acquisitionBudgetSpent: finiteNumber(transactions.acquisition_budget_spent),
      drops: finiteNumber(transactions.drops),
      trades: finiteNumber(transactions.trades),
      moveToIr: finiteNumber(transactions.move_to_ir),
    },
  };
}

function seasonSettings(settings = {}) {
  const rosterSlots = Object.entries(settings.position_slot_counts || {})
    .map(([slot, count]) => ({ slot: slot || "Unknown", count: finiteNumber(count) }))
    .filter((entry) => entry.count > 0);
  const scoringRules = Array.isArray(settings.scoring_format)
    ? settings.scoring_format.map((rule) => ({
        abbr: rule.abbr || undefined,
        label: rule.label || rule.abbr || "Rule",
        points: finiteNumber(rule.points),
      }))
    : [];

  return {
    name: settings.name || "CPFFL",
    teamCount: finiteNumber(settings.team_count),
    regSeasonCount: settings.reg_season_count,
    playoffTeamCount: settings.playoff_team_count,
    scoringType: settings.scoring_type || undefined,
    divisions: Object.values(settings.division_map || {}).filter(Boolean),
    rosterSlots,
    scoringRules,
  };
}

function compactDraft(year, draft = []) {
  return draft.map((pick, index) => ({
    pick: index + 1,
    round: pick.round_num,
    roundPick: pick.round_pick,
    teamKey: teamKey(year, pick.team),
    nominatingTeamKey: teamKey(year, pick.nominatingTeam),
    playerKey: playerKeyFromParts(pick.playerId, pick.playerName || pick.player?.name),
    playerId: pick.playerId,
    playerName: pick.playerName || pick.player?.name || "Unknown player",
    bidAmount: pick.bid_amount,
    keeperStatus: Boolean(pick.keeper_status),
  }));
}

function compactMatchup(year, weekNumber, matchup, index) {
  const homeTeam = teamKey(year, matchup.home_team_id);
  const awayTeam = teamKey(year, matchup.away_team_id);
  const homeScore = matchup.home_score;
  const awayScore = matchup.away_score;
  let winnerTeam;
  if (homeScore !== undefined && awayScore !== undefined) {
    if (homeScore > awayScore) {
      winnerTeam = homeTeam;
    } else if (awayScore > homeScore) {
      winnerTeam = awayTeam;
    }
  }

  return {
    matchupKey: `${year}-w${String(weekNumber).padStart(2, "0")}-m${String(
      index + 1,
    ).padStart(2, "0")}`,
    homeTeamKey: homeTeam,
    awayTeamKey: awayTeam,
    homeScore:
      homeScore === undefined || homeScore === null ? undefined : finiteNumber(homeScore),
    awayScore:
      awayScore === undefined || awayScore === null ? undefined : finiteNumber(awayScore),
    winnerTeamKey: winnerTeam,
    matchupType: matchup.matchup_type || undefined,
    isPlayoff: Boolean(matchup.is_playoff),
  };
}

function compactBoxScore(year, weekNumber, boxScore, index) {
  return {
    ...compactMatchup(year, weekNumber, boxScore, index),
    homeProjected:
      boxScore.home_projected === undefined || boxScore.home_projected === null
        ? undefined
        : finiteNumber(boxScore.home_projected),
    awayProjected:
      boxScore.away_projected === undefined || boxScore.away_projected === null
        ? undefined
        : finiteNumber(boxScore.away_projected),
    homeLineup: Array.isArray(boxScore.home_lineup)
      ? boxScore.home_lineup.map(publicPlayer).filter(Boolean)
      : [],
    awayLineup: Array.isArray(boxScore.away_lineup)
      ? boxScore.away_lineup.map(publicPlayer).filter(Boolean)
      : [],
  };
}

function compactTransaction(year, weekNumber, transaction, index) {
  return {
    transactionKey: `${year}-w${String(weekNumber).padStart(2, "0")}-x${String(
      index + 1,
    ).padStart(4, "0")}`,
    teamKey: teamKey(year, transaction.team_id),
    type: transaction.type || undefined,
    status: transaction.status || undefined,
    scoringPeriod: transaction.scoring_period,
    date: transaction.date,
    bidAmount: transaction.bid_amount,
    items: Array.isArray(transaction.items)
      ? transaction.items.map((item) => ({
          type: item.type || undefined,
          playerKey: playerKeyFromParts(item.player_id, item.player),
          playerId: item.player_id,
          player: item.player || "Unknown player",
        }))
      : [],
  };
}

function weekSummary(week) {
  const scoreboard = week.scoreboard?.data || [];
  const boxScores = week.box_scores?.data || [];
  const transactions = week.transactions?.data || [];
  return {
    week: week.week,
    href: `/season/${week.year}/week/${String(week.week).padStart(2, "0")}`,
    scoreboardCount: scoreboard.length,
    boxScoreCount: boxScores.length,
    transactionCount: transactions.length,
    hasBoxScores: boxScores.length > 0,
    hasTransactions: transactions.length > 0,
  };
}

function searchRow(id, type, year, label, summary, href, extra = {}) {
  return {
    id,
    type,
    year,
    label,
    summary,
    href,
    ...extra,
  };
}

function teamNameLookup(teams) {
  return new Map(teams.map((team) => [team.key, team.name]));
}

function teamName(teamNames, key) {
  return key ? teamNames.get(key) || key : "Unknown";
}

function draftSearchSummary(teamNames, pick) {
  const parts = [`Pick ${pick.pick}`, teamName(teamNames, pick.teamKey)];
  if (typeof pick.bidAmount === "number" && Number.isFinite(pick.bidAmount)) {
    parts.push(`$${pick.bidAmount}`);
  }
  if (pick.keeperStatus) {
    parts.push("Keeper");
  }
  return parts.join(", ");
}

function transactionActionType(transaction, item) {
  return [transaction.type, item?.type].filter(Boolean).join(" ") || "Transaction";
}

function transactionSearchSummary(transaction) {
  const parts = [];
  if (transaction.status) {
    parts.push(transaction.status);
  }
  if (
    typeof transaction.bidAmount === "number" &&
    Number.isFinite(transaction.bidAmount) &&
    transaction.bidAmount > 0
  ) {
    parts.push(`$${transaction.bidAmount}`);
  }
  return parts.join(", ") || "Transaction";
}

function rawLineupSlot(player) {
  return player.lineup_slot || player.lineupSlot || player.slot_position || "";
}

function isStarter(player) {
  const slot = rawLineupSlot(player).toUpperCase();
  return Boolean(slot) && slot !== "BE" && slot !== "BENCH" && slot !== "IR";
}

function playerSeasonSeed(year, key, player) {
  return {
    key,
    playerId: player?.player_id ?? player?.playerId,
    name: player?.name || "Unknown player",
    year,
    positionCounts: new Map(),
    nflTeamCounts: new Map(),
    photoUrl: playerPhotoUrl(player),
    latestNflTeam: undefined,
    fantasyTeamKey: undefined,
    fantasyTeamName: "FA",
    rosterTotalPoints: undefined,
    lineupPoints: 0,
    weeks: new Set(),
    starts: 0,
    appearances: 0,
  };
}

function incrementCount(map, value) {
  if (!value) {
    return;
  }
  map.set(value, (map.get(value) || 0) + 1);
}

function mostCommonValue(map) {
  return [...map.entries()].sort(
    ([leftValue, leftCount], [rightValue, rightCount]) =>
      rightCount - leftCount || String(leftValue).localeCompare(String(rightValue)),
  )[0]?.[0];
}

function getPlayerSeason(players, year, player) {
  const key = playerKey(player);
  if (!players.has(key)) {
    players.set(key, playerSeasonSeed(year, key, player));
  }
  const season = players.get(key);
  if (player?.name && season.name === "Unknown player") {
    season.name = player.name;
  }
  if (player?.player_id !== undefined && season.playerId === undefined) {
    season.playerId = player.player_id;
  }
  season.photoUrl = season.photoUrl || playerPhotoUrl(player);
  incrementCount(season.positionCounts, player?.position);
  incrementCount(season.nflTeamCounts, player?.pro_team);
  if (player?.pro_team) {
    season.latestNflTeam = player.pro_team;
  }
  return season;
}

function recordRosterPlayer(players, year, player, team) {
  const season = getPlayerSeason(players, year, player);
  season.fantasyTeamKey = team.key;
  season.fantasyTeamName = team.name;
  const totalPoints = optionalFiniteNumber(player?.total_points);
  if (totalPoints !== undefined) {
    season.rosterTotalPoints =
      season.rosterTotalPoints === undefined
        ? totalPoints
        : Math.max(season.rosterTotalPoints, totalPoints);
  }
}

function recordLineupPlayer(players, year, week, player) {
  const season = getPlayerSeason(players, year, player);
  const points = optionalFiniteNumber(player?.points);
  if (points !== undefined) {
    season.lineupPoints += points;
  }
  season.weeks.add(week);
  season.appearances += 1;
  if (isStarter(player)) {
    season.starts += 1;
  }
}

function recordDraftPlayer(players, year, pick) {
  getPlayerSeason(players, year, {
    player_id: pick.playerId,
    name: pick.playerName || pick.player?.name || "Unknown player",
  });
}

function recordTransactionPlayer(players, year, item) {
  if (!item?.player) {
    return;
  }
  getPlayerSeason(players, year, {
    player_id: item.player_id,
    name: item.player,
  });
}

function finalizePlayerSeasons(players) {
  const rows = [...players.values()].map((season) => {
    const position = mostCommonValue(season.positionCounts);
    const nflTeam = season.latestNflTeam || mostCommonValue(season.nflTeamCounts);
    const fantasyPoints = Math.max(season.rosterTotalPoints ?? 0, season.lineupPoints);
    return {
      key: season.key,
      playerId: season.playerId,
      name: season.name,
      photoUrl: season.photoUrl,
      year: season.year,
      position,
      nflTeam,
      fantasyTeamKey: season.fantasyTeamKey,
      fantasyTeamName: season.fantasyTeamName,
      fantasyPoints,
      gamesPlayed: season.weeks.size,
      starts: season.starts,
      appearances: season.appearances,
    };
  });

  const rankedRows = [...rows].sort(
    (left, right) =>
      right.fantasyPoints - left.fantasyPoints || left.name.localeCompare(right.name),
  );
  rankedRows.forEach((row, index) => {
    row.playerRank = index + 1;
  });

  const byPosition = new Map();
  rows.forEach((row) => {
    const position = row.position || "UNK";
    byPosition.set(position, [...(byPosition.get(position) || []), row]);
  });
  byPosition.forEach((positionRows) => {
    [...positionRows]
      .sort(
        (left, right) =>
          right.fantasyPoints - left.fantasyPoints || left.name.localeCompare(right.name),
      )
      .forEach((row, index) => {
        row.positionRank = index + 1;
      });
  });

  return rows.sort((left, right) => left.name.localeCompare(right.name));
}

function mergePlayerSeasons(seasons) {
  const players = new Map();
  seasons.forEach((season) => {
    if (!players.has(season.key)) {
      players.set(season.key, {
        key: season.key,
        playerId: season.playerId,
        name: season.name,
        photoUrl: season.photoUrl,
        primaryPosition: season.position,
        seasons: [],
      });
    }
    const player = players.get(season.key);
    player.photoUrl = player.photoUrl || season.photoUrl;
    player.seasons.push({
      year: season.year,
      position: season.position,
      nflTeam: season.nflTeam,
      fantasyTeamKey: season.fantasyTeamKey,
      fantasyTeamName: season.fantasyTeamName,
      fantasyPoints: season.fantasyPoints,
      playerRank: season.playerRank,
      positionRank: season.positionRank,
      gamesPlayed: season.gamesPlayed,
      starts: season.starts,
      appearances: season.appearances,
    });
  });

  return [...players.values()]
    .map((player) => {
      const seasons = player.seasons.sort((left, right) => right.year - left.year);
      const positionCounts = seasons.reduce((counts, season) => {
        incrementCount(counts, season.position);
        return counts;
      }, new Map());
      const totalFantasyPoints = seasons.reduce(
        (total, season) => total + season.fantasyPoints,
        0,
      );
      const bestSeason = [...seasons].sort(
        (left, right) =>
          right.fantasyPoints - left.fantasyPoints || right.year - left.year,
      )[0];
      return {
        ...player,
        photoUrl: player.photoUrl || espnPlayerPhotoUrl(player.playerId),
        primaryPosition: mostCommonValue(positionCounts) || player.primaryPosition,
        seasons,
        totalFantasyPoints,
        bestSeason,
        latestSeason: seasons[0],
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

async function buildSeason(year) {
  const sourcePath = path.join(sourceDir, "seasons", String(year), "structured.json");
  const source = await readJson(sourcePath);
  let teams = (source.teams || []).map((team) => compactTeam(year, team));
  const standingsSource = source.standings?.data?.length
    ? source.standings.data
    : source.teams || [];
  let standings = standingsSource.map((team) => compactTeam(year, team));
  const localizeLogo = await cacheTeamLogos(year, teams);
  teams = teams.map(localizeLogo);
  standings = standings.map(localizeLogo);
  const weeks = [];
  const searchRows = [];
  const names = teamNameLookup(teams);
  const playerSeasons = new Map();

  (source.teams || []).forEach((sourceTeam) => {
    const compactedTeam = teams.find(
      (team) => team.key === teamKey(year, sourceTeam.team_id),
    );
    (sourceTeam.roster || []).forEach((player) =>
      recordRosterPlayer(playerSeasons, year, player, compactedTeam || {
        key: teamKey(year, sourceTeam.team_id),
        name: sourceTeam.name || "Unknown team",
      }),
    );
  });

  for (const week of source.weeks || []) {
    const scoreboard = (week.scoreboard?.data || []).map((matchup, index) =>
      compactMatchup(year, week.week, matchup, index),
    );
    const boxScores = (week.box_scores?.data || []).map((boxScore, index) =>
      compactBoxScore(year, week.week, boxScore, index),
    );
    const transactions = (week.transactions?.data || []).map((transaction, index) =>
      compactTransaction(year, week.week, transaction, index),
    );
    const weekPayload = {
      year,
      week: week.week,
      scoreboard,
      boxScores,
      transactions,
    };
    const weekFile = `seasons/${year}/weeks/${String(week.week).padStart(2, "0")}.json`;
    await writeJson(weekFile, weekPayload);

    weeks.push({
      ...weekSummary({ ...week, year }),
      href: `/season/${year}/week/${String(week.week).padStart(2, "0")}`,
    });
    searchRows.push(
      searchRow(
        `${year}-week-${week.week}`,
        "week",
        year,
        `Week ${week.week}`,
        `${scoreboard.length} games, ${transactions.length} transactions`,
        `/season/${year}/week/${String(week.week).padStart(2, "0")}`,
        { week: week.week },
      ),
    );

    scoreboard.forEach((matchup, index) => {
      searchRows.push(
        searchRow(
          `${year}-week-${week.week}-matchup-${index + 1}`,
          "matchup",
          year,
          `${teamName(names, matchup.awayTeamKey)} at ${teamName(
            names,
            matchup.homeTeamKey,
          )}`,
          `${matchup.awayScore ?? "-"} to ${matchup.homeScore ?? "-"}`,
          `/season/${year}/week/${String(week.week).padStart(2, "0")}`,
          { week: week.week },
        ),
      );
    });

    transactions.forEach((transaction) => {
      const transactionItems = transaction.items.length ? transaction.items : [undefined];
      const transactionTeamName = teamName(names, transaction.teamKey);

      transactionItems.forEach((item, itemIndex) => {
        const actionType = transactionActionType(transaction, item);
        searchRows.push(
          searchRow(
            `${transaction.transactionKey}-i${String(itemIndex + 1).padStart(2, "0")}`,
            "transaction",
            year,
            item?.player || actionType,
            transactionSearchSummary(transaction),
            `/season/${year}/week/${String(week.week).padStart(2, "0")}`,
            {
              week: week.week,
              teamKey: transaction.teamKey,
              teamName: transactionTeamName,
              playerKey: item?.playerKey,
              playerName: item?.player,
              transactionType: transaction.type,
              transactionItemType: item?.type,
              transactionActionType: actionType,
              transactionStatus: transaction.status,
              bidAmount: transaction.bidAmount,
            },
          ),
        );
      });
    });

    (week.transactions?.data || []).forEach((transaction) => {
      (transaction.items || []).forEach((item) =>
        recordTransactionPlayer(playerSeasons, year, item),
      );
    });

    (week.box_scores?.data || []).forEach((boxScore) => {
      [...(boxScore.home_lineup || []), ...(boxScore.away_lineup || [])].forEach(
        (player) => recordLineupPlayer(playerSeasons, year, week.week, player),
      );
    });

    boxScores.forEach((boxScore) => {
      [...boxScore.homeLineup, ...boxScore.awayLineup].forEach((player, index) => {
        searchRows.push(
          searchRow(
            `${boxScore.matchupKey}-player-${index}-${player.name}`,
            "player",
            year,
            player.name,
            `${player.position || "Player"} scored ${player.points ?? "-"} in Week ${
              week.week
            }`,
            `/player/${player.key}`,
            { week: week.week, playerKey: player.key, playerName: player.name },
          ),
        );
      });
    });
  }

  const draft = compactDraft(year, source.draft || []);
  (source.draft || []).forEach((pick) => recordDraftPlayer(playerSeasons, year, pick));
  draft.forEach((pick) => {
    searchRows.push(
      searchRow(
        `${year}-draft-${pick.pick}`,
        "draft",
        year,
        pick.playerName,
        draftSearchSummary(names, pick),
        `/season/${year}`,
        {
          draftPick: pick.pick,
          playerKey: pick.playerKey,
          playerName: pick.playerName,
          teamKey: pick.teamKey,
          teamName: teamName(names, pick.teamKey),
          bidAmount: pick.bidAmount,
          keeperStatus: pick.keeperStatus,
        },
      ),
    );
  });

  teams.forEach((team) => {
    searchRows.push(
      searchRow(
        team.key,
        "team",
        year,
        team.name,
        `${team.wins}-${team.losses}-${team.ties}, ${team.ownerNames.join(", ")}`,
        `/season/${year}/team/${encodeURIComponent(team.key)}`,
        { teamKey: team.key, logoUrl: team.logoUrl },
      ),
    );
  });

  searchRows.push(
    searchRow(
      `${year}-season`,
      "season",
      year,
      `${year} Season`,
      `${teams.length} teams, ${weeks.length} weeks`,
      `/season/${year}`,
    ),
  );

  const seasonPayload = {
    year,
    exportedAt: source.exported_at || "",
    settings: seasonSettings(source.settings),
    teams,
    standings,
    draft,
    weeks,
  };
  await writeJson(`seasons/${year}.json`, seasonPayload);

  const playerSeasonRows = finalizePlayerSeasons(playerSeasons);

  return {
    season: {
      year,
      teamCount: teams.length,
      weekCount: weeks.length,
      matchupCount: weeks.reduce((total, week) => total + week.scoreboardCount, 0),
      playerCount: playerSeasonRows.length,
      hasBoxScores: weeks.some((week) => week.hasBoxScores),
      hasTransactions: weeks.some((week) => week.hasTransactions),
    },
    searchRows,
    playerSeasons: playerSeasonRows,
  };
}

async function main() {
  await loadDotenv(path.join(rootDir, ".env"));
  const manifest = await readJson(path.join(sourceDir, "manifest.json"));
  const years = manifest.seasons
    .filter((season) => season.ok && season.paths?.structured)
    .map((season) => season.year)
    .sort((a, b) => b - a);

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  const publicSeasons = [];
  const searchRows = [];
  const playerSeasons = [];
  for (const year of years) {
    const result = await buildSeason(year);
    publicSeasons.push(result.season);
    searchRows.push(...result.searchRows);
    playerSeasons.push(...result.playerSeasons);
  }

  await writeJson("manifest.json", {
    exportedAt: new Date().toISOString(),
    seasons: publicSeasons,
  });
  await writeJson(
    "search-index.json",
    searchRows.sort((a, b) => b.year - a.year || a.type.localeCompare(b.type)),
  );
  await writeJson("players.json", mergePlayerSeasons(playerSeasons));

  console.log(
    `Built public archive for ${publicSeasons.length} seasons and ${searchRows.length} searchable rows.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
