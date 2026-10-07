import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

function loadTs(path, dependencies = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", outputText)(
    (name) => dependencies[name],
    module,
    module.exports,
  );
  return module.exports;
}

const types = loadTs("../src/types.ts");
const { buildRivalryGames, summarizeRivalry } = loadTs("../src/rivalries.ts", {
  "./types": types,
});
const season = {
  year: 2012,
  teams: [
    { key: "a", name: "A Team", ownerNames: ["jcherry14", "George Bissell", "ESPNFAN7070151013"] },
    { key: "b", name: "B Team", ownerNames: ["Bisstits"] },
  ],
};
const weeks = [
  { week: 1, scoreboard: [{ matchupKey: "one", homeTeamKey: "a", awayTeamKey: "b", homeScore: 100, awayScore: 90, isPlayoff: false }] },
  { week: 15, scoreboard: [{ matchupKey: "two", homeTeamKey: "b", awayTeamKey: "a", homeScore: 110, awayScore: 95, isPlayoff: true }] },
  { week: 16, scoreboard: [{ matchupKey: "tie", homeTeamKey: "a", awayTeamKey: "b", homeScore: 101, awayScore: 101, isPlayoff: true }] },
  { week: 17, scoreboard: [{ matchupKey: "bye", homeTeamKey: "a", awayTeamKey: "b", homeScore: 0, awayScore: 80, isPlayoff: true }] },
];

const games = buildRivalryGames([{ season, weeks }]);
assert.deepEqual(games.map((game) => game.matchupKey), ["tie", "two", "one"]);
assert.equal(games[0].href, "/season/2012/week/16");
assert.equal(games[0].homeOwner, "George B");
assert.equal(games[1].awayOwner, "George B");
assert.deepEqual(
  summarizeRivalry(games, "jcherry14", "Nate B"),
  { games, winsA: 1, winsB: 1, ties: 1, pointsA: 296, pointsB: 301 },
);
console.log("Rivalry check passed");
