import assert from "node:assert/strict";
import test from "node:test";

import {
  createMonthGrid,
  startOfWorkspaceWeek,
  toWorkspaceDateKey,
  utcDateKey,
} from "./dates";

test("converts UTC timestamps to the workspace calendar date", () => {
  assert.equal(toWorkspaceDateKey("2026-07-18T01:30:00.000Z"), "2026-07-17");
  assert.equal(toWorkspaceDateKey("2026-07-18T03:30:00.000Z"), "2026-07-18");
});

test("creates a complete July 2026 month grid", () => {
  const grid = createMonthGrid(2026, 6);
  assert.equal(grid.length, 35);
  assert.equal(utcDateKey(grid[0].date), "2026-06-28");
  assert.equal(utcDateKey(grid.at(-1)!.date), "2026-08-01");
  assert.equal(grid.filter((cell) => cell.inMonth).length, 31);
});

test("finds Monday for a workspace week", () => {
  assert.equal(
    utcDateKey(startOfWorkspaceWeek(new Date("2026-07-19T12:00:00.000Z"))),
    "2026-07-13",
  );
});
