import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { BASE_URL, REPOSITORY_URL } from "../api/config.js";

test("personal deployment ledger records deployment facts without impersonating upstream releases", async () => {
  const file = new URL("../ops/personal-deployment-state.json", import.meta.url);
  const raw = await readFile(file, "utf8");
  const state = JSON.parse(raw);
  const current = state.latestProductionDeployment;

  assert.equal(state.schemaVersion, 1);
  assert.equal(state.scope, "personal");
  assert.equal(state.repository, REPOSITORY_URL);
  assert.equal(state.productionDomain, BASE_URL);
  assert.equal(state.vercelProject, "anibloom-personal");
  assert.match(state.vercelProjectId, /^prj_[A-Za-z0-9]+$/);
  assert.ok(Number.isInteger(state.verifiedProductionDeploymentCount) && state.verifiedProductionDeploymentCount > 0);
  for (const deployment of [state.importedBaseline, current]) {
    assert.match(deployment.deploymentId, /^dpl_[A-Za-z0-9]+$/);
    assert.match(deployment.gitCommitSha, /^[a-f0-9]{40}$/);
  }
  assert.notEqual(current.deploymentId, state.importedBaseline.deploymentId);
  assert.equal(current.state, "READY");
  assert.equal(current.target, "production");
  assert.equal(current.gitBranch, "main");
  assert.match(current.manifestVersion, /^\d+\.\d+\.\d+$/);
  assert.equal(current.releaseTag, null, "bootstrap deployment is not an invented release tag");
  for (const check of ["mainCi", "historySecretScan", "codeQl"]) {
    assert.equal(current.checks[check].result, "success");
    assert.ok(Number.isInteger(current.checks[check].runId) && current.checks[check].runId > 0);
  }
  assert.ok(["not_tested", "public", "protected"].includes(current.smokeTest.anonymousAccess));
  assert.ok(current.smokeTest.endpoints.length >= 3);
  assert.ok(current.smokeTest.endpoints.some(x => x.path === "/manifest.json" && x.status === 200));
  assert.ok(current.smokeTest.endpoints.every(x => x.path.startsWith("/") && x.status >= 100 && x.status <= 599));
  assert.ok(!/AniBloomHQ/.test(raw), "the personal ledger must not copy upstream repository metadata");
  assert.ok(!/API_KEY|PRIVATE_KEY|REDIS_URL|REST_TOKEN/.test(raw), "the deployment ledger must never contain credential fields");
});
