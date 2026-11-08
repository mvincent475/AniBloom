import assert from "node:assert/strict";
import test from "node:test";
import { PRODUCTION_CATALOG_IDS, validateCatalog, validateLogoAsset, validateManifest, validateProduction } from "../scripts/validate-production.mjs";

test("current-season production validation requires at least one external provider identity", () => {
  assert.throws(() => validateCatalog({
    metas: [{ id: "anilist:212653", type: "series", extra: { anilistId: 212653 } }],
  }, "current_season"), /no external provider identities/);
  assert.equal(validateCatalog({
    metas: [{ id: "mal:5114", type: "series", extra: { malId: 5114 } }],
  }, "current_season"), true);
});

test("production logo validation requires same-origin PNG bytes and image/png content type", async () => {
  const png = new Uint8Array(24);
  png.set([137, 80, 78, 71, 13, 10, 26, 10]);
  const view = new DataView(png.buffer);
  view.setUint32(16, 192);
  view.setUint32(20, 192);
  const ok = async () => new Response(png, { status: 200, headers: { "content-type": "image/png" } });
  assert.equal(await validateLogoAsset("https://example.test", "/assets/anibloom-icon.png", ok), true);
  await assert.rejects(validateLogoAsset("https://example.test", "https://other.test/logo.png", ok), /addon origin/);
  await assert.rejects(validateLogoAsset("https://example.test", "/assets/logo.png", async () => new Response(png, { status: 200, headers: { "content-type": "text/plain" } })), /content type/);
  await assert.rejects(validateLogoAsset("https://example.test", "/assets/logo.png", async () => new Response("not a png", { status: 200, headers: { "content-type": "image/png" } })), /valid PNG/);
});

test("production validator accepts canonical AniList fallback identities for series and movies", () => {
  assert.equal(validateCatalog({
    metas: [{ id: "anilist:212653", type: "series", extra: { anilistId: 212653 } }],
  }, "upcoming_season"), true);
  assert.equal(validateCatalog({
    metas: [{ id: "anilist:31970593", type: "movie", extra: { anilistId: 31970593 } }],
  }, "current_season_movies"), true);
  assert.throws(() => validateCatalog({
    metas: [{ id: "anilist:31970593", type: "series", extra: { anilistId: 31970593 } }],
  }, "current_season_movies"), /not a movie/);
});


test("production validator accepts Kitsu fallback identities for series and movies", () => {
  assert.equal(validateCatalog({
    metas: [{ id: "kitsu:50965", type: "series", extra: { identityProvider: "kitsu" } }],
  }, "current_season"), true);
  assert.equal(validateCatalog({
    metas: [{ id: "kitsu:50965", type: "movie", extra: { identityProvider: "kitsu" } }],
  }, "current_season_movies"), true);
  assert.throws(() => validateCatalog({
    metas: [{ id: "kitsu:0", type: "series", extra: { identityProvider: "kitsu" } }],
  }, "current_season"), /invalid catalog identity/);
});

test("legacy production manifest is accepted only for explicit dry-run compatibility", () => {
  const ids = ["upcoming_season", "current_season", "previous_season", "upcoming_3_days", "previous_3_days"];
  const manifest = {
    version: "1.120.0",
    id: "com.marki.nuvio.anime-releases",
    identityMode: "provider",
    resources: [{ name: "catalog", types: ["series"] }],
    types: ["series"],
    catalogs: ids.map((id) => ({ id, type: "series", pageSize: 50 })),
  };
  assert.throws(() => validateManifest(manifest, "1.120.0"), /catalog contract/);
  assert.equal(validateManifest(manifest, "1.120.0", { allowLegacy: true }), true);
});

test("historical eight-catalog manifest requires explicit legacy mode and correct movie/series types", () => {
  const ids = ["upcoming_season", "current_season", "previous_season", "upcoming_season_movies", "current_season_movies", "previous_season_movies", "upcoming_3_days", "previous_3_days"];
  const manifest = {
    version: "1.121.0",
    id: "com.marki.nuvio.anime-releases",
    identityMode: "provider",
    resources: [{ name: "catalog", types: ["series", "movie"] }],
    types: ["series", "movie"],
    catalogs: ids.map((id) => ({ id, type: id.endsWith("_movies") ? "movie" : "series", pageSize: 50 })),
  };
  assert.throws(() => validateManifest(manifest, "1.121.0"), /catalog contract/);
  assert.equal(validateManifest(manifest, "1.121.0", { allowLegacy: true }), true);
  assert.throws(() => validateManifest({ ...manifest, catalogs: manifest.catalogs.map((c) => c.id === "current_season_movies" ? { ...c, type: "series" } : c) }, "1.121.0", { allowLegacy: true }), /catalog types/);
});


test("production validation inspects every catalog page for duplicate identities", async () => {
  const catalogIds = ["upcoming_season", "current_season", "previous_season", "upcoming_season_movies", "current_season_movies", "previous_season_movies", "upcoming_3_days", "previous_3_days"];
  const manifest = {
    id: "com.marki.nuvio.anime-releases",
    version: "1.109.0",
    logo: "https://example.test/assets/anibloom-icon.png",
    identityMode: "provider",
    resources: [{ name: "catalog", types: ["series", "movie"] }],
    types: ["series", "movie"],
    catalogs: catalogIds.map((id) => ({ id, type: id.endsWith("_movies") ? "movie" : "series", pageSize: 50 })),
  };
  const firstPage = Array.from({ length: 50 }, (_, index) => ({
    id: `tmdb:${10000 + index}`,
    type: "series",
    extra: {},
  }));
  const secondPage = [{
    id: firstPage[0].id,
    type: "series",
    extra: {},
  }];
  const requests = [];
  const fetchImpl = async (url) => {
    const parsed = new URL(url);
    requests.push(parsed.pathname + parsed.search);
    if (parsed.pathname === "/manifest.json") {
      return new Response(JSON.stringify(manifest), { status: 200 });
    }
    if (parsed.pathname === "/assets/anibloom-icon.png") {
      const png = new Uint8Array(24);
      png.set([137, 80, 78, 71, 13, 10, 26, 10]);
      const view = new DataView(png.buffer);
      view.setUint32(16, 192);
      view.setUint32(20, 192);
      return new Response(png, { status: 200, headers: { "content-type": "image/png" } });
    }
    if (parsed.pathname === "/meta/series/mal%3A39535.json" || parsed.pathname === "/meta/series/mal:39535.json") {
      return new Response("{}", { status: 404 });
    }
    const catalogId = parsed.pathname.split("/").pop().replace(/\.json$/, "");
    const skip = Number(parsed.searchParams.get("skip") || 0);
    const metas = catalogId === "current_season"
      ? (skip === 0 ? firstPage : secondPage)
      : catalogId === "current_season_movies"
        ? [{ id: "tmdb:1236857", type: "movie", extra: {} }]
        : [];
    return new Response(JSON.stringify({ metas }), { status: 200 });
  };

  await assert.rejects(
    validateProduction("https://example.test", "1.109.0", fetchImpl, { allowLegacy: true }),
    /current_season: duplicate catalog identity across pages/,
  );
  assert.ok(requests.includes("/catalog/series/current_season.json?skip=50"));
});

test("retired catalog ids are never included in the default production validator contract", () => {
  assert.equal(PRODUCTION_CATALOG_IDS.length, 9);
  assert.ok(!PRODUCTION_CATALOG_IDS.includes("airing_today"));
  assert.ok(!PRODUCTION_CATALOG_IDS.includes("upcoming_7_days"));
  assert.equal(PRODUCTION_CATALOG_IDS.at(-1), "top_season");
});


test("production validation retries briefly stale manifest versions after a deployment", async () => {
  const ids = [
    "upcoming_season", "current_season", "previous_season",
    "upcoming_season_movies", "current_season_movies", "previous_season_movies",
    "upcoming_3_days", "previous_3_days", "top_season",
  ];
  const manifest = {
    id: "com.marki.nuvio.anime-releases",
    version: "2.19.0",
    logo: "https://example.test/assets/anibloom-icon.png",
    identityMode: "provider",
    resources: [{ name: "catalog", types: ["series", "movie"] }],
    types: ["series", "movie"],
    catalogs: ids.map(id => ({ id, type: id.endsWith("_movies") ? "movie" : "series", pageSize: 50 })),
  };
  const png = new Uint8Array(24);
  png.set([137, 80, 78, 71, 13, 10, 26, 10]);
  new DataView(png.buffer).setUint32(16, 192);
  new DataView(png.buffer).setUint32(20, 192);
  let manifestReads = 0;
  const fetchedPaths = [];
  const stubFetch = async (url) => {
    const pathname = new URL(url).pathname;
    fetchedPaths.push(pathname);
    if (pathname === "/manifest.json") {
      manifestReads += 1;
      return new Response(JSON.stringify({
        ...manifest,
        version: manifestReads === 1 ? "2.18.0" : "2.19.0",
      }), { status: 200 });
    }
    if (pathname === "/assets/anibloom-icon.png") {
      return new Response(png, { status: 200, headers: { "content-type": "image/png" } });
    }
    if (pathname.startsWith("/meta/")) return new Response("{}", { status: 404 });
    if (pathname.startsWith("/catalog/")) {
      const metas = pathname.endsWith("/current_season.json")
        ? [{ id: "mal:5114", type: "series" }] : [];
      return new Response(JSON.stringify({ metas }), { status: 200 });
    }
    throw new Error("Unexpected production validation request: " + pathname);
  };
  assert.equal(await validateProduction("https://example.test", "2.19.0", stubFetch, {
    manifestRetryDelayMs: 0,
  }), true);
  assert.equal(manifestReads, 2);
  assert.equal(fetchedPaths.filter(path => path === "/catalog/series/current_season.json").length, 1,
    "a temporarily stale manifest must not duplicate catalog validation requests");
});

test("production validation fails closed when the manifest remains at an older version", async () => {
  let manifestReads = 0;
  const fetchStub = async () => {
    manifestReads += 1;
    return new Response(JSON.stringify({ version: "2.18.0" }), { status: 200 });
  };
  await assert.rejects(validateProduction("https://example.test", "2.19.0", fetchStub, {
    manifestRetryDelayMs: 0,
  }), /Manifest version 2[.]18[.]0 does not match expected 2[.]19[.]0/);
  assert.ok(manifestReads >= 2 && manifestReads <= 12, "manifest retry budget must be finite");
});


function createRollingCatalogSnapshotMock({ stabilizes }) {
  const ids = [
    "upcoming_season", "current_season", "previous_season",
    "upcoming_season_movies", "current_season_movies", "previous_season_movies",
    "upcoming_3_days", "previous_3_days", "top_season",
  ];
  const manifest = {
    id: "com.marki.nuvio.anime-releases",
    version: "2.19.0",
    logo: "https://example.test/assets/anibloom-icon.png",
    identityMode: "provider",
    resources: [{ name: "catalog", types: ["series", "movie"] }],
    types: ["series", "movie"],
    catalogs: ids.map(id => ({ id, type: id.endsWith("_movies") ? "movie" : "series", pageSize: 2 })),
  };
  const png = new Uint8Array(24);
  png.set([137, 80, 78, 71, 13, 10, 26, 10]);
  new DataView(png.buffer).setUint32(16, 192);
  new DataView(png.buffer).setUint32(20, 192);
  const reads = [];
  let secondPageReads = 0;
  const series = (id) => ({ id, type: "series" });
  const fetchImpl = async (url) => {
    const parsed = new URL(url);
    reads.push(parsed.pathname + parsed.search);
    if (parsed.pathname === "/manifest.json") return new Response(JSON.stringify(manifest), { status: 200 });
    if (parsed.pathname === "/assets/anibloom-icon.png") {
      return new Response(png, { status: 200, headers: { "content-type": "image/png" } });
    }
    if (parsed.pathname.startsWith("/meta/")) return new Response("{}", { status: 404 });
    if (parsed.pathname.startsWith("/catalog/")) {
      const skip = Number(parsed.searchParams.get("skip") || "0");
      let metas = [];
      if (parsed.pathname.endsWith("/current_season.json") && skip === 0) {
        metas = [series("mal:5114")];
      } else if (parsed.pathname.endsWith("/previous_3_days.json")) {
        if (skip === 0) metas = [series("mal:100"), series("mal:101")];
        if (skip === 2) {
          secondPageReads += 1;
          metas = stabilizes && secondPageReads > 1
            ? [series("mal:102"), series("mal:103")]
            : [series("mal:101"), series("mal:102")];
        }
      }
      return new Response(JSON.stringify({ metas }), { status: 200 });
    }
    throw new Error("Unexpected live validation request " + parsed.pathname);
  };
  return { fetchImpl, reads };
}

test("rolling production validation rechecks a shifting page boundary, then requires a clean full snapshot", async () => {
  const { fetchImpl, reads } = createRollingCatalogSnapshotMock({ stabilizes: true });
  assert.equal(await validateProduction("https://example.test", "2.19.0", fetchImpl, {
    rollingRetryDelayMs: 0,
  }), true);
  assert.equal(reads.filter(path => path === "/catalog/series/previous_3_days.json?skip=0").length, 2);
  assert.equal(reads.filter(path => path === "/catalog/series/current_season.json?skip=0").length, 1,
    "unrelated catalogs must not be recrawled after a transient rolling-page overlap");
});

test("rolling production validation still rejects persistent cross-page duplicates after bounded attempts", async () => {
  const { fetchImpl, reads } = createRollingCatalogSnapshotMock({ stabilizes: false });
  await assert.rejects(validateProduction("https://example.test", "2.19.0", fetchImpl, {
    rollingRetryDelayMs: 0,
  }), /previous_3_days: duplicate catalog identity across pages: mal:101/);
  const attempts = reads.filter(path => path === "/catalog/series/previous_3_days.json?skip=0").length;
  assert.ok(attempts > 1 && attempts <= 3, "rolling retries must be finite and only affect the rolling catalog");
});
