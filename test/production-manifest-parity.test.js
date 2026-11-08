import assert from "node:assert/strict";
import test from "node:test";
import { buildManifest } from "../api/resolver-manifest.js";
import { ADDON_VERSION } from "../api/version.js";
import { PRODUCTION_CATALOG_IDS, validateManifest } from "../scripts/validate-production.mjs";

const seasons = {
  ongoing: { season: "FALL", year: 2026 },
  previous: { season: "SUMMER", year: 2026 },
  upcoming: { season: "WINTER", year: 2027 },
};

test("production validator canonical IDs stay synchronized with the live manifest builder", () => {
  const actual = buildManifest(seasons);
  assert.deepEqual(PRODUCTION_CATALOG_IDS, actual.catalogs.map(({ id }) => id));
  assert.equal(actual.catalogs.length, 9);
  assert.equal(validateManifest(actual, ADDON_VERSION), true);
});

test("production validator rejects incomplete or duplicate canonical catalogs", () => {
  const actual = buildManifest(seasons);
  const eightCatalogs = { ...actual, catalogs: actual.catalogs.slice(0, 8) };
  assert.throws(() => validateManifest(eightCatalogs, ADDON_VERSION), /catalog contract/);
  assert.throws(() => validateManifest({
    ...actual, catalogs: [...actual.catalogs, actual.catalogs.at(-1)],
  }, ADDON_VERSION), /catalog contract/);
  assert.throws(() => validateManifest({
    ...actual, catalogs: [...actual.catalogs].reverse(),
  }, ADDON_VERSION), /catalog contract/);
  assert.throws(() => validateManifest({
    ...actual, catalogs: actual.catalogs.map(c => c.id === "top_season" ? { ...c, type: "movie" } : c),
  }, ADDON_VERSION), /catalog types/);
});

test("historical eight-catalog manifest remains valid only in explicit legacy mode", () => {
  const actual = buildManifest(seasons);
  const eightCatalogs = { ...actual, catalogs: actual.catalogs.slice(0, 8) };
  assert.equal(validateManifest(eightCatalogs, ADDON_VERSION, { allowLegacy: true }), true);
});

test("retired same-day and seven-day manifests are rejected in production but supported for historical dry-runs", () => {
  const actual = buildManifest(seasons);
  const oldEleven = {
    ...actual,
    catalogs: [
      ...actual.catalogs.slice(0, 8),
      { type: "series", id: "airing_today" },
      { type: "series", id: "upcoming_7_days" },
      ...actual.catalogs.slice(8),
    ],
  };
  assert.throws(() => validateManifest(oldEleven, ADDON_VERSION), /catalog contract/);
  assert.equal(validateManifest(oldEleven, ADDON_VERSION, { allowLegacy: true }), true);
  const corrupted = { ...oldEleven, catalogs: oldEleven.catalogs.map(c => c.id === "airing_today" ? { ...c, type: "movie" } : c) };
  assert.throws(() => validateManifest(corrupted, ADDON_VERSION, { allowLegacy: true }), /catalog types/);
});
