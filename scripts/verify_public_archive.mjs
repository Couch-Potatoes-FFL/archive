#!/usr/bin/env node

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const archiveDir = path.join(rootDir, "public", "archive");

const blockedKeys = new Set([
  "notificationSettings",
  "espn_s2",
  "ESPN_S2",
  "swid",
  "ESPN_SWID",
  "raw_league",
  "raw_weeks",
  "league_id",
  "leagueId",
  "ownerId",
  "memberId",
]);

async function jsonFiles(dir) {
  const entries = await readdir(dir);
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const info = await stat(fullPath);
    if (info.isDirectory()) {
      files.push(...(await jsonFiles(fullPath)));
    } else if (entry.endsWith(".json")) {
      files.push(fullPath);
    }
  }
  return files;
}

function verifyValue(value, trail, failures) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => verifyValue(item, `${trail}[${index}]`, failures));
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    const nextTrail = `${trail}.${key}`;
    if (blockedKeys.has(key)) {
      failures.push(`Blocked key ${nextTrail}`);
    }
    if (
      key === "ownerNames" &&
      Array.isArray(child) &&
      child.some((name) => typeof name !== "string")
    ) {
      failures.push(`Invalid ownerNames value at ${nextTrail}`);
    }
    verifyValue(child, nextTrail, failures);
  }
}

async function main() {
  const files = await jsonFiles(archiveDir);
  const failures = [];
  for (const file of files) {
    const payload = JSON.parse(await readFile(file, "utf8"));
    verifyValue(payload, path.relative(rootDir, file), failures);
  }

  if (failures.length) {
    for (const failure of failures) {
      console.error(failure);
    }
    throw new Error(`Public archive verification failed with ${failures.length} issue(s).`);
  }

  console.log(`Verified ${files.length} public archive JSON files.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
