/**
 * Hypertune "Report a problem" relay.
 *
 * The app can't hold a GitHub token — anyone can unpack the build and read it —
 * so problem reports POST here instead. This Worker keeps the token as a
 * Cloudflare secret and files a GitHub issue on the app's behalf.
 *
 * Deploy + secrets: see report-worker/README.md.
 *   GITHUB_TOKEN  (secret)   fine-grained PAT, "Issues: Read and write" on the repo
 *   APP_SECRET    (secret)   optional; if set, requests must send the same value
 *                            in the x-hypertune-key header (basic anti-spam)
 *   REPO          (var)      optional override of the target "owner/repo"
 *
 * Abuse hardening (the endpoint URL is public inside the app bundle):
 *   - Origin allowlist: a POST from a browser on any other site is rejected.
 *     (A hand-rolled curl can still spoof Origin — this only stops drive-by and
 *     embedded abuse, not a determined attacker. The rate limit below is the
 *     real cap.)
 *   - Per-IP rate limit: OPTIONAL. Add a "Rate limiting" binding named
 *     REPORT_RATELIMIT in the Cloudflare dashboard (Worker → Settings →
 *     Bindings), e.g. 5 requests / 60s. When present it is enforced; when
 *     absent this is a no-op so reports still flow.
 *   - Body-size cap so a huge payload can't be used to burn quota.
 */

const DEFAULT_REPO = "AJJBB/hypertune-reports";

// Origins allowed to file reports. Add the production domain here when hosting
// moves off Vercel (e.g. hypertune.gg).
const ALLOWED_ORIGINS = new Set([
  "https://hypertune-mouse-control.vercel.app",
  "https://hypertune.gg",
  "https://www.hypertune.gg",
  "http://localhost:5173",
  "http://localhost:4173",
]);

// A legitimate report is well under 60 KB (device dump is clamped to 40 KB);
// anything far larger is abuse, not a report.
const MAX_BODY_BYTES = 200_000;

function corsHeaders(origin) {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : "null";
  return {
    "Access-Control-Allow-Origin": allow,
    Vary: "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-hypertune-key",
    "Access-Control-Max-Age": "86400",
  };
}

function json(status, body, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

function clamp(value, max) {
  return String(value ?? "").slice(0, max);
}

// Neutralize GitHub @mentions and #refs in free-text fields so a report can't
// ping people or cross-link issues. A zero-width space after the sigil breaks
// the autolink without visibly changing the text.
function neutralize(value) {
  return String(value ?? "").replace(/([@#])/g, "$1\u200b");
}

// Wrap untrusted text in a code fence long enough that no backtick run inside
// can close it early, so the device dump can't break out into arbitrary markup.
function fence(value) {
  const text = String(value ?? "");
  let longest = 0;
  for (const run of text.match(/`+/g) || []) longest = Math.max(longest, run.length);
  const ticks = "`".repeat(Math.max(3, longest + 1));
  return `${ticks}\n${text}\n${ticks}`;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders(origin) });
    if (request.method !== "POST") return json(405, { error: "Method not allowed" }, origin);

    // A browser on another site (or an embed) is rejected. A missing Origin
    // (non-browser caller) is allowed through to the rate limit rather than
    // risk dropping a legitimate report.
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return json(403, { error: "Forbidden origin" }, origin);
    }

    // Optional hard per-IP rate limit (see header). No-op when the binding
    // isn't configured; fails open on a misconfigured binding so reports flow.
    if (env.REPORT_RATELIMIT) {
      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      try {
        const { success } = await env.REPORT_RATELIMIT.limit({ key: ip });
        if (!success) return json(429, { error: "Too many reports — please wait a moment and try again." }, origin);
      } catch {
        /* binding misconfigured — don't drop the report */
      }
    }

    // Cheap early reject on the declared size.
    const declaredLength = Number(request.headers.get("Content-Length") || 0);
    if (declaredLength > MAX_BODY_BYTES) return json(413, { error: "Report too large" }, origin);

    if (env.APP_SECRET && request.headers.get("x-hypertune-key") !== env.APP_SECRET) {
      return json(401, { error: "Unauthorized" }, origin);
    }
    if (!env.GITHUB_TOKEN) return json(500, { error: "Server is not configured" }, origin);

    // Hard cap on the bytes actually read — Content-Length can be absent on a
    // chunked request, so the check above is not enough on its own.
    const raw = await request.arrayBuffer();
    if (raw.byteLength > MAX_BODY_BYTES) return json(413, { error: "Report too large" }, origin);

    let report;
    try {
      report = JSON.parse(new TextDecoder().decode(raw));
    } catch {
      return json(400, { error: "Invalid JSON" }, origin);
    }
    if (!report || typeof report !== "object") return json(400, { error: "Invalid report" }, origin);

    const category = clamp(report.category, 80) || "Something else";
    const deviceName = clamp(report.deviceName, 120) || "(none connected)";
    const description = clamp(report.description, 4000) || "(no description provided)";
    const contact = clamp(report.contact, 200);
    const discordId = clamp(report.discordId, 80);
    const otherSoftware = clamp(report.otherSoftware, 120);
    const appVersion = clamp(report.appVersion, 120);
    const platform = clamp(report.platform, 400);
    const deviceDump = clamp(report.deviceDump, 40000);

    const title = `[Report] ${category} — ${deviceName}`;
    const body = [
      `**Issue:** ${neutralize(category)}`,
      `**Device:** ${neutralize(deviceName)}`,
      `**App version:** ${neutralize(appVersion) || "unknown"}`,
      `**Other software running:** ${neutralize(otherSoftware) || "(not answered)"}`,
      `**Discord:** ${neutralize(discordId) || "(none)"}`,
      `**Contact:** ${neutralize(contact) || "(none)"}`,
      "",
      "### Description",
      neutralize(description),
      "",
      "### Device info",
      fence(deviceDump || "(device info unavailable)"),
      "",
      `<sub>Platform: ${neutralize(platform) || "unknown"}</sub>`,
    ].join("\n");

    const repo = env.REPO || DEFAULT_REPO;
    const ghResponse = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "hypertune-report-worker",
        "Content-Type": "application/json",
      },
      // Unknown label names are created automatically on first use.
      body: JSON.stringify({ title, body, labels: ["app-report"] }),
    });

    if (!ghResponse.ok) {
      const detail = await ghResponse.text().catch(() => "");
      console.error("GitHub issue creation failed:", ghResponse.status, detail.slice(0, 500));
      return json(502, { error: "Could not file the issue" }, origin);
    }

    const issue = await ghResponse.json();
    return json(200, { ok: true, url: issue.html_url, number: issue.number }, origin);
  },
};
