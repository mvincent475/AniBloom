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
  assert.equal(actual.catalogs.length, 11);
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
