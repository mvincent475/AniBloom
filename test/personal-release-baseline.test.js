import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  validateLastDeploymentMetadata,
  validateVersionConsistency,
} from "../scripts/release-integrity.mjs";

const loadJson = async path => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));

test("an independently deployed personal baseline is not represented as a GitHub release", async () => {
  const state = await loadJson("../ops/release-state.json");
  const ledger = await loadJson("../ops/personal-deployment-state.json");
  const personal = ledger.latestProductionDeployment;

  // Once a real personal GitHub tag has been created, current release-state
  // intentionally advances while the bootstrap ledger remains immutable.
  if (state.releaseHistoryStarted === true) {
    assert.match(state.lastDeploymentTag, /^v\d+\.\d+\.\d+$/);
    assert.equal(state.lastDeployment.tag, state.lastDeploymentTag);
    assert.ok(state.totalDeployments >= ledger.verifiedProductionDeploymentCount);
    assert.equal(state.lastDeployment.sha, state.lastDeploymentSha);
    return;
  }

  assert.equal(ledger.repository, "https://github.com/mvincent475/AniBloom");
  assert.equal(state.releaseHistoryStarted, false);
  assert.equal(state.lastDeploymentSha, personal.gitCommitSha);
  assert.equal(state.lastDeploymentId, personal.deploymentId);
  assert.equal(state.lastDeploymentVersion, personal.manifestVersion);
  assert.equal(state.lastDeploymentTag, null);
  assert.equal(state.lastDeployment.tag, null);
  assert.equal(state.lastDeployment.releasedAt, null);
  assert.equal(state.lastDeployment.ciRunId, null);
  assert.equal(state.lastDeployment.ciRunUrl, null);
  assert.equal(state.totalDeployments, ledger.verifiedProductionDeploymentCount);
  assert.equal(state.deploymentsSincePause, ledger.verifiedProductionDeploymentCount);
  assert.equal(state.paused, false);
  assert.deepEqual(state.supersededReleaseVersions, []);
  assert.equal(state.lastDeployment.smokeTest, "passed");
  assert.doesNotMatch(JSON.stringify(state), /AniBloomHQ/);
});

test("validation accepts a verified untagged deployment and forbids pretend release tags", () => {
  const values = {
    addonVersion: "2.15.0",
    packageVersion: "2.15.0",
    productionVersion: "2.15.0",
    productionTag: null,
    releaseHistoryStarted: false,
    nextReleaseVersion: "2.16.0",
    deploymentsSincePause: 2,
    deploymentLimit: 10,
    paused: false,
  };
  assert.equal(validateVersionConsistency(values), true);
  assert.throws(() => validateVersionConsistency({ ...values, productionTag: "v2.15.0" }),
    /untagged|tag/i);
  assert.throws(() => validateVersionConsistency({ ...values, releaseHistoryStarted: true }),
    /tag/i);

  const deployment = {
    lastDeploymentVersion: "2.15.0",
    lastDeploymentSha: "1dff6bb2f32917bad3b34cfee81c6cc7a31f54a3",
    lastDeploymentId: "dpl_9Pn9Q2jFBkcjPxgkUZKGhCtYHxAm",
    lastDeploymentTag: null,
    releaseHistoryStarted: false,
    lastDeployment: {
      version: "2.15.0",
      sha: "1dff6bb2f32917bad3b34cfee81c6cc7a31f54a3",
      vercelDeploymentId: "dpl_9Pn9Q2jFBkcjPxgkUZKGhCtYHxAm",
      tag: null,
      releasedAt: null,
      ciRunId: null,
      ciRunUrl: null,
      smokeTest: "passed",
    },
  };
  assert.equal(validateLastDeploymentMetadata(deployment), true);
  assert.throws(() => validateLastDeploymentMetadata({
    ...deployment,
    lastDeployment: { ...deployment.lastDeployment, tag: "v2.15.0" },
  }), /untagged|tag/i);
  assert.throws(() => validateLastDeploymentMetadata({
    ...deployment,
    lastDeployment: { ...deployment.lastDeployment, ciRunId: "1234" },
  }), /untagged|CI|release/i);
});

test("tagged releases after bootstrap require the matching version and tag", () => {
  const state = {
    releaseHistoryStarted: true,
    lastDeploymentVersion: "2.16.0",
    lastDeploymentSha: "dde8839d7f2364f16a35d155baae6a9c30337fbf",
    lastDeploymentId: "dpl_3ZPqAVyRSLTJ1fXJ3YXNPtxWCAvc",
    lastDeploymentTag: "v2.16.0",
    lastDeployment: {
      version: "2.16.0",
      sha: "dde8839d7f2364f16a35d155baae6a9c30337fbf",
      vercelDeploymentId: "dpl_3ZPqAVyRSLTJ1fXJ3YXNPtxWCAvc",
      tag: "v2.16.0",
      releasedAt: "2026-11-07T00:00:00.000Z",
      ciRunId: "9999",
      ciRunUrl: "https://github.com/mvincent475/AniBloom/actions/runs/9999",
      smokeTest: "passed",
    },
  };
  assert.equal(validateLastDeploymentMetadata(state), true);
  assert.throws(() => validateLastDeploymentMetadata({
    ...state, lastDeploymentTag: null, lastDeployment: { ...state.lastDeployment, tag: null },
  }), /tag/i);
});

test("first personal release notes start after the verified personal deployment, not the imported history", async () => {
  const workflow = await readFile(new URL("../.github/workflows/sync-version.yml", import.meta.url), "utf8");
  assert.match(workflow, /git merge-base --is-ancestor/);
  assert.match(workflow, /lastDeploymentSha/);
  assert.doesNotMatch(workflow, /range="\$target"/);
  assert.match(workflow, /state\["releaseHistoryStarted"\] = True/);
});

test("production workflow cannot resolve another Vercel project and cannot deploy stale main", async () => {
  const workflow = await readFile(new URL("../.github/workflows/sync-version.yml", import.meta.url), "utf8");
  assert.match(workflow, /RELEASE_TARGET_SHA.*git rev-parse origin\/main/);
  assert.match(workflow, /VERCEL_TEAM_SLUG: vincentmelgo475-1530/);
  assert.match(workflow, /VERCEL_PROJECT_NAME: anibloom-personal/);
  assert.match(workflow, /curl --config - --fail/);
});
