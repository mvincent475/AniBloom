import { readFileSync } from "node:fs";

export function validatePersonalDeployHookUrl(value, expectedProjectId) {
  if (!/^prj_[A-Za-z0-9]+$/.test(String(expectedProjectId ?? ""))) {
    throw new Error("Verified personal Vercel project ID is missing.");
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid personal Vercel deploy hook URL.");
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (url.origin !== "https://api.vercel.com" ||
      url.username || url.password || url.search || url.hash ||
      parts.length !== 5 ||
      parts[0] !== "v1" || parts[1] !== "integrations" || parts[2] !== "deploy" ||
      parts[3] !== expectedProjectId ||
      !/^[A-Za-z0-9_-]{10,}$/.test(parts[4]) ||
      url.pathname !== `/v1/integrations/deploy/${expectedProjectId}/${parts[4]}`) {
    // A deploy-hook URL is a bearer credential. Never interpolate it into errors.
    throw new Error("Vercel deploy hook does not match the verified personal project.");
  }
  return true;
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  const ledger = JSON.parse(readFileSync(new URL("../ops/personal-deployment-state.json", import.meta.url), "utf8"));
  validatePersonalDeployHookUrl(process.env.VERCEL_DEPLOY_HOOK_URL, ledger.vercelProjectId);
  console.log("Personal Vercel deploy hook project verified.");
}
