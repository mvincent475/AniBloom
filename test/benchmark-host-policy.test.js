import test from "node:test";
import assert from "node:assert/strict";
import { isHostedAniBloomHost } from "../lib/benchmark-host-policy.js";

test("offline benchmark forbids original, personal, and preview AniBloom production hosts", () => {
  const original = ["anibloom", "vercel", "app"].join(".");
  for (const hostname of [
    original,
    "anibloom-personal.vercel.app",
    "anibloom-personal-c8tuhkvza-vincentmelgo475-1530.vercel.app",
    "anibloom-test-preview.vercel.app",
    "ANIBLOOM-PERSONAL.VERCEL.APP.",
  ]) assert.equal(isHostedAniBloomHost(hostname), true, hostname);

  for (const hostname of [
    "idmapper.vercel.app", "www.vercel.app", "api.github.com",
    ["fakeanibloom", "vercel", "app"].join("."),
    original + ".attacker.test",
    "", null,
  ]) assert.equal(isHostedAniBloomHost(hostname), false, String(hostname));
});
