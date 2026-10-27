import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../src/keepers.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext },
});
const { isKeeperRecord, keeperEligibility, unmatchedAnnouncedKeepers } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

const draft = (year, playerKey, keeperStatus) => ({
  id: `${year}-${playerKey}`,
  type: "draft",
  year,
  playerKey,
  playerName: playerKey,
  label: playerKey,
  summary: "",
  href: "",
  keeperStatus,
});

const eligible = keeperEligibility([
  draft(2024, "three-seasons", true),
  draft(2025, "three-seasons", true),
  draft(2026, "three-seasons", true),
  draft(2024, "gap", false),
  draft(2025, "gap", false),
  draft(2026, "gap", true),
  draft(2025, "two-seasons", true),
  draft(2026, "two-seasons", true),
]);

assert.equal(eligible(2026, "three-seasons", "three-seasons"), false);
assert.equal(eligible(2025, "three-seasons", "three-seasons"), true);
assert.equal(eligible(2026, "gap", "gap"), true);
assert.equal(eligible(2026, "two-seasons", "two-seasons"), true);

const archive = JSON.parse(readFileSync(new URL("../public/archive/search-index.json", import.meta.url)));
const archiveEligible = keeperEligibility(archive);
const teamOwners = new Map(
  archive.filter((row) => row.type === "team").map((row) => [row.teamKey, row.ownerNames]),
);
assert(archive.filter(isKeeperRecord).every((row) => teamOwners.has(row.teamKey)));
assert.deepEqual(teamOwners.get("2026-t03"), ["AMurray248"]);
assert.equal(unmatchedAnnouncedKeepers(archive).length, 0);
assert.equal(archive.filter((row) => row.year === 2024 && isKeeperRecord(row)).length, 30);
assert.equal(archiveEligible(2026, "espn-4430737", "Kyren Williams"), false);
assert.equal(archiveEligible(2026, "espn-4361741", "Brock Purdy"), false);
assert.equal(archiveEligible(2026, "espn-4430807", "Bijan Robinson"), true);
assert.deepEqual(
  archive
    .filter((row) => row.year === 2026 && isKeeperRecord(row) &&
      !archiveEligible(row.year, row.playerKey, row.playerName))
    .map((row) => row.playerName)
    .sort(),
  [
    "Brock Purdy", "CeeDee Lamb", "De'Von Achane", "Drake London",
    "Jahmyr Gibbs", "Kyren Williams", "Nico Collins", "Puka Nacua", "Rashee Rice",
  ],
);

console.log("Keeper eligibility checks passed.");
