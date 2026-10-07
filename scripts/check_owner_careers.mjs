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
const { buildOwnerCareers } = loadTs("../src/ownerCareers.ts", { "./types": types });
const readSeason = (year) => JSON.parse(readFileSync(new URL(`../public/archive/seasons/${year}.json`, import.meta.url)));
const season2012 = readSeason(2012);
const season2026 = readSeason(2026);
const ownerNamesBefore = [...season2012.teams.find((team) => team.key === "2012-t01").ownerNames];
const careers = buildOwnerCareers([season2026, season2012], [
  { year: 2006, owner: "jcherry14", teamName: "Steve Smith Raptors" },
  { year: 2005, owner: "Archive-only", teamName: "Old Champion" },
]);

const george = careers.find((career) => career.name === "George B");
assert.deepEqual(season2012.teams.find((team) => team.key === "2012-t01").ownerNames, ownerNamesBefore);
assert.equal(george.seasons.filter((season) => season.year === 2012).length, 1);
assert.equal(george.seasons.find((season) => season.year === 2012).wins, 9);
assert.deepEqual(george.titles, [
  { year: 2012, teamName: "The Big Gronkowski", href: "/season/2012/team/2012-t01" },
  { year: 2006, teamName: "Steve Smith Raptors" },
]);

const currentSeasons = careers.flatMap((career) => career.seasons.filter((season) => season.year === 2026));
assert.equal(currentSeasons.length, season2026.teams.length);
assert.equal(currentSeasons.every((season) => !("finalStanding" in season)), true);
assert.equal(careers.every((career) => career.titles.every((title) => title.year !== 2026)), true);
assert.equal(currentSeasons.find((season) => season.teamKey === "2026-t10").teamName, "Tokyo Swift");
assert.deepEqual(careers.find((career) => career.name === "Archive-only"), {
  name: "Archive-only", seasons: [], titles: [{ year: 2005, teamName: "Old Champion" }],
  wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0,
});
assert.deepEqual(careers.map((career) => career.name), [...careers.map((career) => career.name)].sort());
console.log("Owner careers check passed");
