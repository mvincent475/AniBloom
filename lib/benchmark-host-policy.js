/** Keep offline provider benchmarking away from both AniBloom deployments. */
export function isHostedAniBloomHost(hostname) {
  const host = String(hostname || "").trim().toLowerCase().replace(/\.$/, "");
  // Includes official, personal and generated Vercel preview hostnames.
  // Provider services such as idmapper.vercel.app remain reachable.
  return /^anibloom(?:-[a-z0-9-]+)?\.vercel\.app$/.test(host);
}
