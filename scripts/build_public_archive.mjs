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

function publicPlayer(player) {
  if (!player || typeof player !== "object") {
    return undefined;
  }
  return {
    name: player.name || "Unknown player",
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

    const response = await fetch(team.logoUrl, {
      headers: {
        Accept: "image/*,*/*",
        Cookie: cookie,
        "User-Agent": "cpffl-public-archive/1.0",
      },
    });
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
            `/season/${year}/week/${String(week.week).padStart(2, "0")}`,
            { week: week.week, playerName: player.name },
          ),
        );
      });
    });
  }

  const draft = compactDraft(year, source.draft || []);
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
        `/season/${year}`,
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

  return {
    season: {
      year,
      teamCount: teams.length,
      weekCount: weeks.length,
      matchupCount: weeks.reduce((total, week) => total + week.scoreboardCount, 0),
      hasBoxScores: weeks.some((week) => week.hasBoxScores),
      hasTransactions: weeks.some((week) => week.hasTransactions),
    },
    searchRows,
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
  for (const year of years) {
    const result = await buildSeason(year);
    publicSeasons.push(result.season);
    searchRows.push(...result.searchRows);
  }

  await writeJson("manifest.json", {
    exportedAt: new Date().toISOString(),
    seasons: publicSeasons,
  });
  await writeJson(
    "search-index.json",
    searchRows.sort((a, b) => b.year - a.year || a.type.localeCompare(b.type)),
  );

  console.log(
    `Built public archive for ${publicSeasons.length} seasons and ${searchRows.length} searchable rows.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
