// Public relay for the dashboard's "Refresh Data" button. Holds the GitHub
// token privately (Worker secret, never sent to the browser) and does one
// thing: trigger the deploy.yml workflow_dispatch, which pulls fresh sheet
// data, commits it, rebuilds, and redeploys to GitHub Pages.
//
// Deploy: wrangler deploy
// Set the secret once: wrangler secret put GITHUB_TOKEN

export interface Env {
  REFRESH_STATE: KVNamespace;
  GITHUB_TOKEN: string;
  GITHUB_REPO: string;
  GITHUB_WORKFLOW_FILE: string;
  ALLOWED_ORIGIN: string;
  COOLDOWN_SECONDS: string;
}

function corsHeaders(env: Env): HeadersInit {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(body: unknown, status: number, headers: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const headers = corsHeaders(env);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    const url = new URL(request.url);

    // GET /status — lets the button poll "is a refresh currently cooling down"
    // without triggering one.
    if (request.method === "GET" && url.pathname === "/status") {
      const cooldownUntil = await env.REFRESH_STATE.get("cooldown_until");
      const remaining = cooldownUntil ? Number(cooldownUntil) - Date.now() : 0;
      return json({ cooling: remaining > 0, remainingMs: Math.max(0, remaining) }, 200, headers);
    }

    if (request.method !== "POST" || url.pathname !== "/trigger") {
      return json({ ok: false, error: "not found" }, 404, headers);
    }

    const cooldownUntil = await env.REFRESH_STATE.get("cooldown_until");
    const remaining = cooldownUntil ? Number(cooldownUntil) - Date.now() : 0;
    if (remaining > 0) {
      return json(
        { ok: false, error: "cooling_down", remainingMs: remaining },
        429,
        headers,
      );
    }

    const cooldownMs = Number(env.COOLDOWN_SECONDS) * 1000;
    await env.REFRESH_STATE.put("cooldown_until", String(Date.now() + cooldownMs), {
      expirationTtl: Number(env.COOLDOWN_SECONDS),
    });

    const dispatchRes = await fetch(
      `https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/${env.GITHUB_WORKFLOW_FILE}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "terraslate-ceo-dashboard-refresh-worker",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ref: "main" }),
      },
    );

    if (dispatchRes.status === 204) {
      return json({ ok: true }, 200, headers);
    }

    const errorText = await dispatchRes.text();
    return json({ ok: false, error: errorText, status: dispatchRes.status }, 502, headers);
  },
};
