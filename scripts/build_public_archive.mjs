#!/usr/bin/env node

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const sourceDir = path.join(rootDir, "data", "espn");
const outputDir = path.join(rootDir, "public", "archive");

const TRANSACTION_TYPE_LABELS = Object.freeze({
  FREEAGENT: "Free Agent",
  ROSTER: "Roster",
  TRADE_ACCEPT: "Trade",
  TRADE_PROPOSAL: "Trade",
  WAIVER: "Waiver",
});

const TRANSACTION_STATUS_LABELS = Object.freeze({
  CANCELED: "Canceled",
  EXECUTED: "Executed",
  FAILED_AUCTIONBUDGETEXCEEDED: "Failed: Auction Budget Exceeded",
  FAILED_INVALIDPLAYERSOURCE: "Failed: Invalid Player Source",
  FAILED_IRSLOT: "Failed: IR Slot",
  FAILED_MATCHUPACQUISITIONLIMIT: "Failed: Matchup Acquisition Limit",
  FAILED_PLAYERALREADYDROPPED: "Failed: Player Already Dropped",
  FAILED_POSITIONLIMIT: "Failed: Position Limit",
  FAILED_ROSTERLIMIT: "Failed: Roster Limit",
  FAILED_ROSTERLOCK: "Failed: Roster Lock",
  PENDING: "Pending",
});

const TRANSACTION_ITEM_TYPE_LABELS = Object.freeze({
  ADD: "Add",
  DROP: "Drop",
  LINEUP: "Lineup",
  TRADE: "Trade",
});

const FIXED_STARTER_SLOTS = new Set(["QB", "RB", "WR", "TE", "K", "D/ST", "HC"]);
const FLEX_STARTER_SLOTS = Object.freeze({
  "RB/WR": ["RB", "WR"],
  "RB/WR/TE": ["RB", "WR", "TE"],
  OP: ["QB", "RB", "WR", "TE"],
});
const FREE_AGENT_TEAM_NAME = "Free Agent";
const ESPN_POSITION_LABELS = Object.freeze({
  1: "QB",
  2: "RB",
  3: "WR",
  4: "TE",
  5: "K",
  14: "HC",
  16: "D/ST",
});
const ESPN_PRO_TEAM_LABELS = Object.freeze({
  0: "None",
  1: "ATL",
  2: "BUF",
  3: "CHI",
  4: "CIN",
  5: "CLE",
  6: "DAL",
  7: "DEN",
  8: "DET",
  9: "GB",
  10: "TEN",
  11: "IND",
  12: "KC",
  13: "LV",
  14: "LAR",
  15: "MIA",
  16: "MIN",
  17: "NE",
  18: "NO",
  19: "NYG",
  20: "NYJ",
  21: "PHI",
  22: "ARI",
  23: "PIT",
  24: "LAC",
  26: "SEA",
  27: "TB",
  28: "WSH",
  29: "CAR",
  30: "JAX",
  33: "BAL",
  34: "HOU",
});

function readJson(filePath) {
  return readFile(filePath, "utf8").then((text) => JSON.parse(text));
}

function readOptionalJson(filePath) {
  return readJson(filePath).catch((error) => {
    if (error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  });
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

function canonicalPlayerKey(playerKeyValue, aliases) {
  return aliases.get(playerKeyValue) || playerKeyValue;
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

function publicPlayer(player, { includeTotalPoints = false } = {}) {
  if (!player || typeof player !== "object") {
    return undefined;
  }
  const key = playerKey(player);
  const row = {
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
  if (includeTotalPoints && player.total_points !== undefined && player.total_points !== null) {
    row.totalPoints = finiteNumber(player.total_points);
  }
  return row;
}

function rawMatchupRosterPlayer(entry) {
  const player = entry?.playerPoolEntry?.player;
  if (!player) {
    return undefined;
  }
  const position = ESPN_POSITION_LABELS[player.defaultPositionId];
  return {
    player_id: entry.playerId ?? entry.playerPoolEntry?.id ?? player.id,
    name: player.fullName || [player.firstName, player.lastName].filter(Boolean).join(" "),
    position,
    lineup_slot: position,
    slot_position: position,
    pro_team: ESPN_PRO_TEAM_LABELS[player.proTeamId],
    points: entry.playerPoolEntry?.appliedStatTotal,
    injury_status: entry.injuryStatus || player.injuryStatus,
  };
}

function espnCookieHeader() {
  const swid = process.env.ESPN_SWID?.trim();
  const espnS2 = process.env.ESPN_S2?.trim();
  return swid && espnS2 ? `SWID=${swid}; espn_s2=${espnS2}` : undefined;
}

function chunk(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function actualSeasonStat(player, year) {
  return (player?.stats || []).find(
    (stat) =>
      Number(stat.seasonId) === Number(year) &&
      Number(stat.statSourceId) === 0 &&
      Number(stat.statSplitTypeId) === 0 &&
      Number(stat.scoringPeriodId) === 0,
  );
}

function playerPoolBackfill(entry, year) {
  const player = entry?.player;
  if (!player) {
    return undefined;
  }

  const actualStat = actualSeasonStat(player, year);
  return {
    playerId: entry.id ?? player.id,
    name: player.fullName || [player.firstName, player.lastName].filter(Boolean).join(" "),
    position: ESPN_POSITION_LABELS[player.defaultPositionId],
    nflTeam: ESPN_PRO_TEAM_LABELS[player.proTeamId],
    photoUrl: espnPlayerPhotoUrl(entry.id ?? player.id),
    fantasyPoints: optionalFiniteNumber(actualStat?.appliedTotal),
  };
}

async function fetchPlayerPoolBackfills(year, leagueId, playerIds) {
  const cookie = espnCookieHeader();
  if (!cookie || !leagueId) {
    return new Map();
  }

  const rows = new Map();
  const url =
    Number(year) >= 2018
      ? `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/segments/0/leagues/${leagueId}?view=kona_player_info`
      : `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/leagueHistory/${leagueId}?seasonId=${year}&view=kona_player_info`;
  const uniquePlayerIds = playerIds?.length ? [...new Set(playerIds)] : undefined;
  const filters = uniquePlayerIds
    ? chunk(uniquePlayerIds, 50).map((playerIdChunk) => ({
        filterIds: { value: playerIdChunk },
        limit: playerIdChunk.length,
        sortPercOwned: { sortAsc: false, sortPriority: 1 },
      }))
    : undefined;

  for (let offset = 0; ; offset += 500) {
    const playersFilter = filters?.shift() || {
      limit: 500,
      offset,
      sortPercOwned: { sortAsc: false, sortPriority: 1 },
    };
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Cookie: cookie,
        "User-Agent": "cpffl-public-archive/1.0",
        "x-fantasy-filter": JSON.stringify({
          players: playersFilter,
        }),
      },
    });

    if (!response.ok) {
      console.warn(
        `Unable to backfill ${year} player stats: ${response.status} ${response.statusText}`,
      );
      continue;
    }

    const payload = await response.json();
    const leaguePayload = Array.isArray(payload) ? payload[0] : payload;
    const entries = leaguePayload?.players || [];
    entries.forEach((entry) => {
      const row = playerPoolBackfill(entry, year);
      if (row?.playerId) {
        rows.set(Number(row.playerId), row);
      }
    });

    if (filters) {
      if (!filters.length) {
        break;
      }
      continue;
    }
    if (entries.length < playersFilter.limit) {
      break;
    }
  }

  return rows;
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
    roster: Array.isArray(team.roster)
      ? team.roster
          .map((player) => publicPlayer(player, { includeTotalPoints: true }))
          .filter(Boolean)
      : [],
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

function remapTeamRosterPlayerKeys(team, aliases) {
  if (!team.roster?.length) {
    return team;
  }
  return {
    ...team,
    roster: team.roster.map((player) => ({
      ...player,
      key: canonicalPlayerKey(player.key, aliases),
    })),
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

function remapDraftPlayerKeys(draft, aliases) {
  return draft.map((pick) => ({
    ...pick,
    playerKey: canonicalPlayerKey(pick.playerKey, aliases),
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

function remapBoxScorePlayerKeys(boxScore, aliases) {
  return {
    ...boxScore,
    homeLineup: boxScore.homeLineup.map((player) => ({
      ...player,
      key: canonicalPlayerKey(player.key, aliases),
    })),
    awayLineup: boxScore.awayLineup.map((player) => ({
      ...player,
      key: canonicalPlayerKey(player.key, aliases),
    })),
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
          fromTeamKey: teamKey(year, item.from_team_id),
          toTeamKey: teamKey(year, item.to_team_id),
        }))
      : [],
  };
}

function remapTransactionPlayerKeys(transaction, aliases) {
  return {
    ...transaction,
    items: transaction.items.map((item) => ({
      ...item,
      playerKey: canonicalPlayerKey(item.playerKey, aliases),
    })),
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

function displayCodeLabel(value) {
  return String(value)
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function displayEnumCode(labels, value) {
  return value ? labels[String(value).toUpperCase()] || displayCodeLabel(value) : undefined;
}

function displayTransactionType(type) {
  return displayEnumCode(TRANSACTION_TYPE_LABELS, type);
}

function displayTransactionStatus(status) {
  return displayEnumCode(TRANSACTION_STATUS_LABELS, status);
}

function displayTransactionItemType(itemType) {
  return displayEnumCode(TRANSACTION_ITEM_TYPE_LABELS, itemType);
}

function transactionActionType(transaction, item) {
  const type = displayTransactionType(transaction.type);
  const itemType = displayTransactionItemType(item?.type);
  if (type?.startsWith("Trade")) {
    return type;
  }
  return (
    [type, itemType].filter(Boolean).join(" ") || "Transaction"
  );
}

function transactionSearchSummary(transaction) {
  const parts = [];
  if (transaction.status) {
    parts.push(displayTransactionStatus(transaction.status));
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
    fantasyTeamName: FREE_AGENT_TEAM_NAME,
    acquisitionTeamCounts: new Map(),
    acquisitionTeamNames: new Map(),
    lineupTeamCounts: new Map(),
    lineupTeamNames: new Map(),
    rosterTotalPoints: undefined,
    draftValue: undefined,
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

function mergeCounts(target, source) {
  source.forEach((count, value) => {
    target.set(value, (target.get(value) || 0) + count);
  });
}

function mergePlayerSeason(target, source) {
  if (source.name && target.name === "Unknown player") {
    target.name = source.name;
  }
  target.photoUrl = target.photoUrl || source.photoUrl;
  target.latestNflTeam = target.latestNflTeam || source.latestNflTeam;
  if (!target.fantasyTeamKey && source.fantasyTeamKey) {
    target.fantasyTeamKey = source.fantasyTeamKey;
    target.fantasyTeamName = source.fantasyTeamName;
  }
  mergeCounts(target.positionCounts, source.positionCounts);
  mergeCounts(target.nflTeamCounts, source.nflTeamCounts);
  mergeCounts(target.acquisitionTeamCounts, source.acquisitionTeamCounts);
  mergeCounts(target.lineupTeamCounts, source.lineupTeamCounts);
  source.acquisitionTeamNames.forEach((name, key) => {
    if (!target.acquisitionTeamNames.has(key)) {
      target.acquisitionTeamNames.set(key, name);
    }
  });
  source.lineupTeamNames.forEach((name, key) => {
    if (!target.lineupTeamNames.has(key)) {
      target.lineupTeamNames.set(key, name);
    }
  });
  if (source.rosterTotalPoints !== undefined) {
    target.rosterTotalPoints =
      target.rosterTotalPoints === undefined
        ? source.rosterTotalPoints
        : Math.max(target.rosterTotalPoints, source.rosterTotalPoints);
  }
  target.draftValue ??= source.draftValue;
  target.lineupPoints += source.lineupPoints;
  source.weeks.forEach((week) => target.weeks.add(week));
  target.starts += source.starts;
  target.appearances += source.appearances;
}

function canonicalizePlayerSeasons(players) {
  const idRowsByName = new Map();
  players.forEach((season) => {
    if (!season.playerId) {
      return;
    }
    const nameKey = slugify(season.name);
    idRowsByName.set(nameKey, [...(idRowsByName.get(nameKey) || []), season]);
  });

  const aliases = new Map();
  players.forEach((season) => {
    if (season.playerId || !season.key.startsWith("name-")) {
      return;
    }
    const candidates = idRowsByName.get(slugify(season.name)) || [];
    if (candidates.length !== 1) {
      return;
    }
    const target = candidates[0];
    mergePlayerSeason(target, season);
    aliases.set(season.key, target.key);
    players.delete(season.key);
  });
  return aliases;
}

function applyPlayerPoolBackfill(season, backfill) {
  if (!season || !backfill) {
    return;
  }

  if (backfill.name && season.name === "Unknown player") {
    season.name = backfill.name;
  }
  season.photoUrl = season.photoUrl || backfill.photoUrl;
  incrementCount(season.positionCounts, backfill.position);
  incrementCount(season.nflTeamCounts, backfill.nflTeam);
  if (backfill.nflTeam && backfill.nflTeam !== "None") {
    season.latestNflTeam = backfill.nflTeam;
  }
  if (backfill.fantasyPoints !== undefined) {
    season.rosterTotalPoints =
      season.rosterTotalPoints === undefined
        ? backfill.fantasyPoints
        : Math.max(season.rosterTotalPoints, backfill.fantasyPoints);
  }
}

async function importPlayerPoolSeasons(year, leagueId, players) {
  const backfills = await fetchPlayerPoolBackfills(year, leagueId);
  backfills.forEach((backfill) => {
    const season = getPlayerSeason(players, year, {
      player_id: backfill.playerId,
      name: backfill.name,
      photoUrl: backfill.photoUrl,
    });
    applyPlayerPoolBackfill(season, backfill);
  });
}

function recordAcquisitionTeam(season, teamKeyValue, teamNameValue) {
  if (!teamKeyValue) {
    return;
  }
  incrementCount(season.acquisitionTeamCounts, teamKeyValue);
  season.acquisitionTeamNames.set(teamKeyValue, teamNameValue || teamKeyValue);
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

function recordLineupPlayer(players, year, week, player, team) {
  const season = getPlayerSeason(players, year, player);
  const points = optionalFiniteNumber(player?.points);
  if (points !== undefined) {
    season.lineupPoints += points;
  }
  if (team?.key) {
    incrementCount(season.lineupTeamCounts, team.key);
    season.lineupTeamNames.set(team.key, team.name || team.key);
  }
  season.weeks.add(week);
  season.appearances += 1;
  if (isStarter(player)) {
    season.starts += 1;
  }
}

function recordDraftPlayer(players, year, pick, names) {
  const season = getPlayerSeason(players, year, {
    player_id: pick.playerId,
    name: pick.playerName || pick.player?.name || "Unknown player",
  });
  season.draftValue = optionalFiniteNumber(pick.bidAmount ?? pick.bid_amount);
  recordAcquisitionTeam(season, pick.teamKey, teamName(names, pick.teamKey));
}

function recordTransactionPlayer(players, year, transaction, item, names) {
  if (!item?.player) {
    return;
  }
  const season = getPlayerSeason(players, year, {
    player_id: item.player_id,
    name: item.player,
  });
  if (item.type === "ADD") {
    const transactionTeamKey = teamKey(year, transaction.team_id);
    recordAcquisitionTeam(season, transactionTeamKey, teamName(names, transactionTeamKey));
  }
}

function finalizePlayerSeasons(players) {
  const rows = [...players.values()].map((season) => {
    const position = mostCommonValue(season.positionCounts);
    const nflTeam = season.latestNflTeam || mostCommonValue(season.nflTeamCounts);
    const lineupTeamKey = mostCommonValue(season.lineupTeamCounts);
    const acquisitionTeamKey = mostCommonValue(season.acquisitionTeamCounts);
    const fantasyTeamKey = season.fantasyTeamKey ?? lineupTeamKey ?? acquisitionTeamKey;
    const fantasyPoints = Math.max(season.rosterTotalPoints ?? 0, season.lineupPoints);
    return {
      key: season.key,
      playerId: season.playerId,
      name: season.name,
      photoUrl: season.photoUrl,
      year: season.year,
      position,
      nflTeam,
      fantasyTeamKey,
      fantasyTeamName:
        season.fantasyTeamName !== FREE_AGENT_TEAM_NAME
          ? season.fantasyTeamName
          : lineupTeamKey
            ? season.lineupTeamNames.get(lineupTeamKey)
            : FREE_AGENT_TEAM_NAME,
      fantasyPoints,
      draftValue: season.draftValue,
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
    if (!row.position) {
      return;
    }
    byPosition.set(row.position, [...(byPosition.get(row.position) || []), row]);
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

function draftPickPlayerRow(rowByKey, pick) {
  return (
    rowByKey.get(pick.playerKey) ||
    rowByKey.get(playerKeyFromParts(pick.playerId, pick.playerName)) ||
    rowByKey.get(`name-${slugify(pick.playerName)}`)
  );
}

function sortedRowsByPosition(rows) {
  const byPosition = new Map();
  rows.forEach((row) => {
    if (!row.position) {
      return;
    }
    byPosition.set(row.position, [...(byPosition.get(row.position) || []), row]);
  });

  byPosition.forEach((positionRows, position) => {
    byPosition.set(
      position,
      [...positionRows].sort(
        (left, right) =>
          right.fantasyPoints - left.fantasyPoints || left.name.localeCompare(right.name),
      ),
    );
  });
  return byPosition;
}

function averageFantasyPoints(rows) {
  return (
    Math.round(
      (rows.reduce((total, row) => total + row.fantasyPoints, 0) / rows.length) * 100,
    ) / 100
  );
}

function starterSlotEligibility(slot) {
  const normalized = String(slot || "").toUpperCase();
  if (FIXED_STARTER_SLOTS.has(normalized)) {
    return [normalized];
  }
  return FLEX_STARTER_SLOTS[normalized] || [];
}

function starterCountsByPosition(rowsByPosition, settings) {
  const teamCount = settings.teamCount;
  const starterCounts = new Map();
  const flexSlots = [];

  (settings.rosterSlots || []).forEach(({ slot, count }) => {
    const eligibility = starterSlotEligibility(slot);
    const leagueCount = count * teamCount;
    if (!eligibility.length || !leagueCount) {
      return;
    }
    if (eligibility.length === 1) {
      starterCounts.set(
        eligibility[0],
        (starterCounts.get(eligibility[0]) || 0) + leagueCount,
      );
      return;
    }
    flexSlots.push({ eligibility, count: leagueCount });
  });

  flexSlots
    .sort((left, right) => left.eligibility.length - right.eligibility.length)
    .forEach(({ eligibility, count }) => {
      for (let index = 0; index < count; index += 1) {
        const position = eligibility
          .map((candidate) => ({
            position: candidate,
            row: rowsByPosition.get(candidate)?.[starterCounts.get(candidate) || 0],
          }))
          .filter(({ row }) => row)
          .sort(
            (left, right) =>
              right.row.fantasyPoints - left.row.fantasyPoints ||
              left.position.localeCompare(right.position),
          )[0]?.position;
        if (!position) {
          return;
        }
        starterCounts.set(position, (starterCounts.get(position) || 0) + 1);
      }
    });

  return starterCounts;
}

function addPlayerBaselines(rows, draft, settings) {
  if (!settings.teamCount) {
    return rows;
  }

  const rowByKey = new Map();
  rows.forEach((row) => {
    rowByKey.set(row.key, row);
    rowByKey.set(playerKeyFromParts(row.playerId, row.name), row);
    rowByKey.set(`name-${slugify(row.name)}`, row);
  });

  const rowsByPosition = sortedRowsByPosition(rows);

  const draftedByPosition = new Map();
  draft.forEach((pick) => {
    const position = draftPickPlayerRow(rowByKey, pick)?.position;
    incrementCount(draftedByPosition, position);
  });

  const starterCounts = starterCountsByPosition(rowsByPosition, settings);

  rowsByPosition.forEach((positionRows, position) => {
    const draftedCount = draftedByPosition.get(position) || 0;
    const replacementRows = positionRows.slice(
      draftedCount,
      draftedCount + settings.teamCount,
    );
    const starterRows = positionRows.slice(0, starterCounts.get(position) || 0);
    const replacementPoints = replacementRows.length
      ? averageFantasyPoints(replacementRows)
      : undefined;
    const avgStarterPoints = starterRows.length
      ? averageFantasyPoints(starterRows)
      : undefined;

    if (replacementPoints === undefined && avgStarterPoints === undefined) {
      return;
    }

    positionRows.forEach((row) => {
      row.replacementPoints = replacementPoints;
      row.avgStarterPoints = avgStarterPoints;
    });
  });

  return rows;
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
      draftValue: season.draftValue,
      replacementPoints: season.replacementPoints,
      avgStarterPoints: season.avgStarterPoints,
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
  const weekPayloads = [];
  const searchRows = [];
  const trades = [];
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
    weekPayloads.push(weekPayload);

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

    (week.transactions?.data || []).forEach((transaction) => {
      (transaction.items || []).forEach((item) =>
        recordTransactionPlayer(playerSeasons, year, transaction, item, names),
      );
    });

    (week.box_scores?.data || []).forEach((boxScore) => {
      const homeTeamKey = teamKey(year, boxScore.home_team_id);
      const awayTeamKey = teamKey(year, boxScore.away_team_id);
      (boxScore.home_lineup || []).forEach((player) =>
        recordLineupPlayer(playerSeasons, year, week.week, player, {
          key: homeTeamKey,
          name: teamName(names, homeTeamKey),
        }),
      );
      (boxScore.away_lineup || []).forEach((player) =>
        recordLineupPlayer(playerSeasons, year, week.week, player, {
          key: awayTeamKey,
          name: teamName(names, awayTeamKey),
        }),
      );
    });

    if (!(week.box_scores?.data || []).length) {
      const rawWeekPath = path.join(
        sourceDir,
        "seasons",
        String(year),
        "weeks",
        `${String(week.week).padStart(2, "0")}.json`,
      );
      const rawWeek = await readOptionalJson(rawWeekPath);
      (rawWeek?.schedule || []).forEach((matchup) => {
        ["home", "away"].forEach((side) => {
          const team = matchup[side];
          const rawTeamKey = teamKey(year, team?.teamId);
          (team?.rosterForMatchupPeriod?.entries || []).forEach((entry) => {
            const player = rawMatchupRosterPlayer(entry);
            if (!player) {
              return;
            }
            recordLineupPlayer(playerSeasons, year, week.week, player, {
              key: rawTeamKey,
              name: teamName(names, rawTeamKey),
            });
          });
        });
      });
    }
  }

  let draft = compactDraft(year, source.draft || []);
  draft.forEach((pick) => recordDraftPlayer(playerSeasons, year, pick, names));
  await importPlayerPoolSeasons(
    year,
    source.league_id || process.env.ESPN_LEAGUE_ID,
    playerSeasons,
  );
  const playerKeyAliases = canonicalizePlayerSeasons(playerSeasons);
  teams = teams.map((team) => remapTeamRosterPlayerKeys(team, playerKeyAliases));
  standings = standings.map((team) => remapTeamRosterPlayerKeys(team, playerKeyAliases));
  draft = remapDraftPlayerKeys(draft, playerKeyAliases);

  for (const weekPayload of weekPayloads) {
    const boxScores = weekPayload.boxScores.map((boxScore) =>
      remapBoxScorePlayerKeys(boxScore, playerKeyAliases),
    );
    const transactions = weekPayload.transactions.map((transaction) =>
      remapTransactionPlayerKeys(transaction, playerKeyAliases),
    );
    const weekFile = `seasons/${year}/weeks/${String(weekPayload.week).padStart(
      2,
      "0",
    )}.json`;
    await writeJson(weekFile, { ...weekPayload, boxScores, transactions });

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
            `/season/${year}/week/${String(weekPayload.week).padStart(2, "0")}`,
            {
              week: weekPayload.week,
              teamKey: transaction.teamKey,
              teamName: transactionTeamName,
              playerKey: item?.playerKey,
              playerName: item?.player,
              transactionType: transaction.type,
              transactionItemType: item?.type,
              transactionActionType: actionType,
              transactionStatus: displayTransactionStatus(transaction.status),
              bidAmount: transaction.bidAmount,
            },
          ),
        );
      });
    });

    transactions
      .filter(
        (transaction) =>
          (transaction.type === "TRADE_ACCEPT" && transaction.status === "EXECUTED") ||
          (transaction.type === "TRADE_PROPOSAL" && transaction.status === "PENDING"),
      )
      .forEach((transaction) => {
        transaction.items
          .filter((item) => item.type === "TRADE")
          .forEach((item, index) => {
            trades.push({
              tradeKey: `${transaction.transactionKey}-i${String(index + 1).padStart(2, "0")}`,
              transactionKey: transaction.transactionKey,
              year,
              week: weekPayload.week,
              date: transaction.date,
              playerKey: item.playerKey,
              playerId: item.playerId,
              player: item.player,
              fromTeamKey: item.fromTeamKey,
              fromTeamName: teamName(names, item.fromTeamKey),
              toTeamKey: item.toTeamKey,
              toTeamName: teamName(names, item.toTeamKey),
            });
          });
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
              weekPayload.week
            }`,
            `/player/${player.key}`,
            { week: weekPayload.week, playerKey: player.key, playerName: player.name },
          ),
        );
      });
    });
  }

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

  const playerSeasonRows = addPlayerBaselines(
    finalizePlayerSeasons(playerSeasons),
    draft,
    seasonPayload.settings,
  );

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
    trades,
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
  const trades = [];
  for (const year of years) {
    const result = await buildSeason(year);
    publicSeasons.push(result.season);
    searchRows.push(...result.searchRows);
    playerSeasons.push(...result.playerSeasons);
    trades.push(...result.trades);
  }

  await writeJson("manifest.json", {
    exportedAt: new Date().toISOString(),
    seasons: publicSeasons,
  });
  await writeJson(
    "search-index.json",
    searchRows.sort((a, b) => b.year - a.year || a.type.localeCompare(b.type)),
  );
  await writeJson(
    "trades.json",
    trades.sort((left, right) => right.date - left.date || right.year - left.year),
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
