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
