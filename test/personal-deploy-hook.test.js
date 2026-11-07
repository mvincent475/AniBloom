import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { validatePersonalDeployHookUrl } from "../scripts/validate-personal-deploy-hook.mjs";

const sampleToken = "ExamplePlaceholder12345678";

test("personal deployment hook validator accepts only the verified Vercel project", async () => {
  const ledger = JSON.parse(await readFile(new URL("../ops/personal-deployment-state.json", import.meta.url), "utf8"));
  const valid = `https://api.vercel.com/v1/integrations/deploy/${ledger.vercelProjectId}/${sampleToken}`;
  assert.equal(validatePersonalDeployHookUrl(valid, ledger.vercelProjectId), true);
  const wrong = valid.replace(ledger.vercelProjectId, "prj_OriginalPublicProjectFake");
  assert.throws(() => validatePersonalDeployHookUrl(wrong, ledger.vercelProjectId), /project|hook/i);

  for (const malformed of [
    "",
    "invalid-url",
    "http://api.vercel.com/v1/integrations/deploy/" + ledger.vercelProjectId + "/" + sampleToken,
    "https://evil.example/v1/integrations/deploy/" + ledger.vercelProjectId + "/" + sampleToken,
    valid + "?buildCache=false",
    valid + "#redirect",
    valid.replace("/v1/integrations/deploy/", "/v1/other/deploy/"),
    valid.replace(sampleToken, ""),
  ]) {
    assert.throws(() => validatePersonalDeployHookUrl(malformed, ledger.vercelProjectId), /hook|URL|project/i);
  }
});

test("invalid deployment hook errors never echo secret-bearing URLs", () => {
  const secret = "ExampleSecretValueNeverLog123456";
  try {
    validatePersonalDeployHookUrl("https://api.vercel.com/v1/integrations/deploy/prj_wrong/" + secret, "prj_expected");
    assert.fail("invalid project must be rejected");
  } catch (error) {
    assert.doesNotMatch(String(error), new RegExp(secret));
  }
});

test("release workflow validates personal hook before making an HTTP request", async () => {
  const workflow = await readFile(new URL("../.github/workflows/sync-version.yml", import.meta.url), "utf8");
  const validationPosition = workflow.indexOf("node scripts/validate-personal-deploy-hook.mjs");
  const requestPosition = workflow.indexOf("curl --config -");
  assert.ok(validationPosition > 0);
  assert.ok(requestPosition > validationPosition);
});
