import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BASE_URL, ADDON_DOMAIN, REPOSITORY_URL } from "../api/config.js";
import homeHandler from "../api/home-selector.js";
import { validateLoadTestConfig } from "../scripts/load-probe.mjs";

test("personal addon endpoints and branding are consistent", () => {
  assert.equal(ADDON_DOMAIN, "anibloom-personal.vercel.app");
  assert.equal(BASE_URL, "https://" + ADDON_DOMAIN);
  assert.equal(REPOSITORY_URL, "https://github.com/mvincent475/AniBloom");
  let html = "";
  const res = { status() { return this; }, setHeader() {}, send(value) { html = value; return value; } };
  homeHandler({}, res);
  assert.ok(html.includes(BASE_URL + "/manifest.json"));
  assert.ok(html.includes("nuvio://" + ADDON_DOMAIN + "/manifest.json"));
  assert.ok(html.includes("const origin=" + JSON.stringify(BASE_URL) + ";"));
});

test("load probe accepts only personal production and preview targets", () => {
  const base = { path: "/manifest.json", requests: 1, concurrency: 1, timeoutMs: 2000, allowProduction: true };
  assert.equal(validateLoadTestConfig({ ...base, target: BASE_URL }).target, BASE_URL);
  assert.equal(validateLoadTestConfig({ ...base, target: "https://anibloom-personal-preview123-vincentmelgo475-1530.vercel.app" }).target,
    "https://anibloom-personal-preview123-vincentmelgo475-1530.vercel.app");
  const originalHost = ["anibloom", "vercel", "app"].join(".");
  assert.throws(() => validateLoadTestConfig({ ...base, target: "https://" + originalHost }), /Target must be/);
});

test("no first-party text source refers to the original production host", async () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const originalHost = ["anibloom", "vercel", "app"].join(".");
  const textExtensions = new Set([".js", ".mjs", ".json", ".yml", ".yaml", ".md", ".txt", ".html", ".css", ".svg"]);
  const exclude = new Set(["node_modules", ".git", ".vercel"]);
  const bad = [];
  async function walk(directory) {
    for (const item of await readdir(directory, { withFileTypes: true })) {
      if (exclude.has(item.name)) continue;
      const path = join(directory, item.name);
      if (item.isDirectory()) await walk(path);
      else if (item.isFile() && textExtensions.has(extname(item.name))) {
        const contents = await readFile(path, "utf8");
        if (contents.includes(originalHost)) bad.push(path.slice(root.length));
      }
    }
  }
  await walk(root);
  assert.deepEqual(bad, []);
});

test("copied GitHub automation remains opt-in and targets this repository", async () => {
  const [ci, release, vercel] = await Promise.all([
    readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/sync-version.yml", import.meta.url), "utf8"),
    readFile(new URL("../vercel.json", import.meta.url), "utf8"),
  ]);

  assert.ok(ci.includes("vars.PERSONAL_VERSION_AUTOMATION_ENABLED == 'true'"),
    "automatic version bumps need explicit opt-in");
  assert.ok(release.includes("vars.PERSONAL_RELEASES_ENABLED == 'true'"),
    "production release workflow needs explicit opt-in");
  for (const workflow of [ci, release]) {
    assert.ok(workflow.includes("owner: ${{ github.repository_owner }}"),
      "GitHub App access must be scoped to the current repository owner");
    assert.ok(!workflow.includes("owner: AniBloomHQ"),
      "personal automation must not authenticate against upstream");
  }
  assert.equal(JSON.parse(vercel).git?.deploymentEnabled, false,
    "Git-based deployment must stay disabled until CI deployment gating is designed");
});

test("personal standard and extended manifest aliases retain all eleven catalog IDs across title variants", async () => {
  const { default: manifestHandler } = await import("../api/resolver-manifest.js");
  const { ADDON_VERSION } = await import("../api/version.js");
  const { rewrites } = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
  const standardIds = [
    "upcoming_season", "current_season", "previous_season",
    "upcoming_season_movies", "current_season_movies", "previous_season_movies",
    "upcoming_3_days", "previous_3_days",
  ];

  for (const prefix of ["", "/romaji", "/native"]) {
    for (const extended of [false, true]) {
      const path = prefix + (extended ? "/extended" : "") + "/manifest.json";
      let manifest;
      manifestHandler({ method: "GET", url: path, query: {} }, {
        status(code) { assert.equal(code, 200); return this; },
        setHeader() {},
        json(payload) { manifest = payload; return payload; },
      });

      assert.equal(manifest.version, ADDON_VERSION, path);
      assert.equal(manifest.logo, BASE_URL + "/assets/anibloom-icon.png", path);
      assert.deepEqual(manifest.catalogs.slice(0, 8).map(item => item.id), standardIds, path);
      assert.deepEqual(
        manifest.catalogs.slice(8).map(item => item.id),
        ["airing_today", "upcoming_7_days", "top_season"],
        path,
      );

      const rewrite = rewrites.find(item => item.source === path);
      assert.ok(rewrite, "Missing Vercel rewrite for " + path);
      const destination = new URL(rewrite.destination, BASE_URL);
      assert.equal(destination.pathname, "/api/resolver-manifest", path);
      assert.equal(destination.searchParams.get("titleMode"), prefix ? prefix.slice(1) : null, path);
      assert.equal(destination.searchParams.get("extended"), extended ? "1" : null, path);
    }
  }
});

test("personal ranked aliases expose eleven catalog IDs without default artwork filters", async () => {
  const { default: manifestHandler } = await import("../api/resolver-manifest.js");
  const { ADDON_VERSION } = await import("../api/version.js");
  const { rewrites } = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
  for (const prefix of ["", "/romaji", "/native"]) {
    for (const extended of [false, true]) {
      const path = prefix + (extended ? "/extended" : "") + "/ranked/manifest.json";
      let result;
      manifestHandler({ method: "GET", url: path, query: {} }, {
        status(code) { assert.equal(code, 200); return this; },
        setHeader() {},
        json(value) { result = value; return value; },
      });
      assert.equal(result.version, ADDON_VERSION, path);
      assert.equal(result.logo, BASE_URL + "/assets/anibloom-icon.png", path);
      assert.equal(result.catalogs.length, 11, path);
      assert.equal(result.catalogs.at(-1).id, "top_season", path);
      assert.deepEqual(result.catalogs.slice(8, -1).map(c => c.id),
        ["airing_today", "upcoming_7_days"], path);
      assert.equal(result.catalogs[0].extra.some(x => x.name === "artwork"), false, path);
      const rewrite = rewrites.find(r => r.source === path);
      assert.ok(rewrite, "Missing Vercel rewrite for " + path);
      const destination = new URL(rewrite.destination, BASE_URL);
      assert.equal(destination.pathname, "/api/resolver-manifest", path);
      assert.equal(destination.searchParams.get("titleMode"), prefix ? prefix.slice(1) : null, path);
      assert.equal(destination.searchParams.get("ranked"), "1", path);
      assert.equal(destination.searchParams.get("extended"), extended ? "1" : null, path);
    }
  }
});

test("personal default manifest and poster provider aliases retain isolated routes and no credentials", async () => {
  const { default: manifestHandler } = await import("../api/resolver-manifest.js");
  const { rewrites } = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
  const expected = [
    "upcoming_season", "current_season", "previous_season",
    "upcoming_season_movies", "current_season_movies", "previous_season_movies",
    "upcoming_3_days", "previous_3_days", "airing_today", "upcoming_7_days", "top_season",
  ];
  for (const prefix of ["", "/romaji", "/native"]) {
    for (const route of ["/manifest.json", "/betterposters/manifest.json", "/postersplus/manifest.json"]) {
      const path = prefix + route;
      let result;
      manifestHandler({ method: "GET", url: path, query: {} }, {
        status(code) { assert.equal(code, 200); return this; },
        setHeader() {},
        json(value) { result = value; return value; },
      });
      assert.deepEqual(result.catalogs.map(c => c.id), expected, path);
      assert.equal(result.logo, BASE_URL + "/assets/anibloom-icon.png", path);
      assert.equal(result.catalogs.some(c => c.extra.some(x => x.name === "artwork")), false, path);
      const rewrite = rewrites.find(r => r.source === path);
      assert.ok(rewrite, "Missing provider manifest rewrite " + path);
      const dest = new URL(rewrite.destination, BASE_URL);
      assert.equal(dest.pathname, "/api/resolver-manifest", path);
      assert.equal(dest.searchParams.get("titleMode"), prefix ? prefix.slice(1) : null, path);
      const provider = route === "/manifest.json" ? null : route.split("/")[1];
      assert.equal(dest.searchParams.get("artwork"), provider, path);
      assert.doesNotMatch(rewrite.destination, /(?:token|access_key|password|secret)=/i);
    }
  }
});
