import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../src/scheduleLuck.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const module = { exports: {} };
new Function("module", "exports", outputText)(module, module.exports);
const { buildScheduleLuckRows } = module.exports;

const matchup = (homeTeamKey, awayTeamKey, homeScore, awayScore, isPlayoff = false) => ({
  homeTeamKey, awayTeamKey, homeScore, awayScore, isPlayoff,
});
const season = {
  settings: { regSeasonCount: 3 },
  teams: ["a", "b", "c", "d"].map((key) => ({ key, name: key, ownerNames: [key] })),
};
const weeks = [
  { week: 1, scoreboard: [
    { ...matchup("a", "b", 100, 100), winnerTeamKey: "a" },
    matchup("c", "d", 90, 80),
  ] },
  { week: 2, scoreboard: [matchup("a", "b", 120, 110)] },
  { week: 3, scoreboard: [matchup("a", "b", 130, 120, true), matchup("c", "d", 110, 100, true)] },
  { week: 4, scoreboard: [matchup("a", "b", 130, 120), matchup("c", "d", 110, 100)] },
];
const rows = buildScheduleLuckRows(season, weeks);
const a = rows.find((row) => row.teamKey === "a");
const c = rows.find((row) => row.teamKey === "c");
assert.deepEqual(
  [a.weeks, a.actualWins, a.actualLosses, a.actualTies, a.allPlayWins, a.allPlayLosses, a.allPlayTies, a.pointsFor],
  [1, 0, 0, 1, 2, 0, 1, 100],
);
assert.equal(a.expectedWins, 5 / 6);
assert.ok(Math.abs(a.winsAboveExpected + 1 / 3) < 1e-10);
assert.deepEqual(
  [c.weeks, c.actualWins, c.actualLosses, c.allPlayWins, c.allPlayLosses, c.expectedWins],
  [1, 1, 0, 1, 2, 1 / 3],
);
assert.ok(Math.abs(c.winsAboveExpected - 2 / 3) < 1e-10);

const archive = (path) => JSON.parse(readFileSync(new URL(`../public/archive/${path}`, import.meta.url), "utf8"));
const actualSeason = archive("seasons/2025.json");
const firstWeek = archive("seasons/2025/weeks/01.json");
const firstWeekRows = buildScheduleLuckRows(actualSeason, [firstWeek]);
const t13 = firstWeekRows.find((row) => row.teamKey === "2025-t13");
assert.equal(t13.actualWins, 1);
assert.equal(t13.expectedWins, 2 / 9);
assert.equal(t13.winsAboveExpected, 7 / 9);

const allWeeks = actualSeason.weeks.map(({ week }) =>
  archive(`seasons/2025/weeks/${String(week).padStart(2, "0")}.json`),
);
const fullSeasonRows = buildScheduleLuckRows(actualSeason, allWeeks);
const t11 = fullSeasonRows.find((row) => row.teamKey === "2025-t11");
assert.deepEqual([t11.weeks, t11.actualWins, t11.actualLosses], [14, 10, 4]);
assert.ok(Math.abs(t11.expectedWins - 67 / 9) < 1e-10);
assert.ok(Math.abs(t11.winsAboveExpected - 23 / 9) < 1e-10);
assert.ok(Math.abs(fullSeasonRows.reduce((sum, row) => sum + row.winsAboveExpected, 0)) < 1e-10);
console.log("Schedule luck check passed");
