import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../src/draftValue.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const module = { exports: {} };
new Function("module", "exports", outputText)(module, module.exports);
const { buildDraftValueRows } = module.exports;

const archive = (path) => JSON.parse(
  readFileSync(new URL(`../public/archive/${path}`, import.meta.url), "utf8"),
);
const players = archive("players.json");
const rowsFor = (year) => buildDraftValueRows(archive(`seasons/${year}.json`), players);
const named = (rows, name) => rows.find((row) => row.playerName === name);

assert.equal(rowsFor(2012).length, 0);
assert.equal(rowsFor(2023).length, 0);
assert.deepEqual(
  (({ bidAmount, fantasyPoints, pointsPerDollar, keeperStatus }) =>
    ({ bidAmount, fantasyPoints, pointsPerDollar, keeperStatus }))(
    named(rowsFor(2015), "Devonta Freeman"),
  ),
  { bidAmount: 1, fantasyPoints: 322, pointsPerDollar: 322, keeperStatus: false },
);
const hopkins = named(rowsFor(2018), "DeAndre Hopkins");
assert.equal(hopkins.bidAmount, 57);
assert.equal(hopkins.fantasyPoints, 356); // 2018 reports have zero appearances.
const rows2025 = rowsFor(2025);
assert.equal(named(rows2025, "Puka Nacua").keeperStatus, true);
assert.equal(named(rows2025, "Puka Nacua").pointsPerDollar, 401 / 22);
assert.equal(named(rows2025, "De'Von Achane").pointsPerDollar, 343.8);
assert.equal(named(rows2025, "Steelers Coach"), undefined);
assert.equal(rows2025.filter((row) => row.keeperStatus).length, 28);
const picks2026 = archive("seasons/2026.json").draft;
assert.equal(picks2026.length, 180);
assert.deepEqual(picks2026.map((pick) => pick.pick), Array.from({ length: 180 }, (_, index) => index + 1));
assert.equal(archive("search-index.json").filter((row) => row.year === 2026 && row.type === "draft").length, 180);

console.log("Draft value check passed");
