// Vercel Edge Middleware — gatekeeper for the hosted app.
//
// Serves the app only to:
//   1) the desktop shell, which sends an "x-hypertune-shell" header
//      (see hypertune-desktop/main.js) matching SHELL_TOKEN, or
//   2) a browser that arrived via a keyed link (…/?k=ACCESS_KEY), which sets a
//      cookie so the rest of the session works; or already has that cookie.
// Everyone else gets a 404.
//
// Enforcement is env-gated: active once SHELL_TOKEN and/or ACCESS_KEY are set on
// Vercel, and a no-op (the app is served normally) when neither is set.

export const config = {
  // Gate only page navigations, not static assets. The app's hashed JS/CSS
  // (/assets/) and product art (/devices/) aren't secret, and anything with a
  // file extension (sw.js, favicon.ico, manifest, images) is a static file —
  // running the gate on every one of them multiplied Edge Middleware
  // invocations ~15x. index.html is served at "/" and at every client route
  // (no file extension), which still matches here, so app access continues to
  // require the cookie; the ungated assets are useless without that entry point.
  matcher: "/((?!_vercel/|assets/|devices/|.*\\.[a-zA-Z0-9]+$).*)",
};

const COOKIE = "ht_access";

export default function middleware(request) {
  // Health check: confirms the gatekeeper is actually executing on the host.
  if (new URL(request.url).pathname === "/__gatecheck") {
    return new Response("gate-alive", { status: 200, headers: { "content-type": "text/plain" } });
  }
  const shellToken = process.env.SHELL_TOKEN;
  const accessKey = process.env.ACCESS_KEY;
  if (!shellToken && !accessKey) return; // unconfigured → allow (nothing breaks)

  // 1) Desktop shell handshake header.
  if (shellToken && request.headers.get("x-hypertune-shell") === shellToken) return;

  if (accessKey) {
    // 2a) Cookie already set from a previous keyed-link visit.
    const cookies = request.headers.get("cookie") || "";
    if (cookies.split(/;\s*/).some((c) => c === `${COOKIE}=${accessKey}`)) return;

    // 2b) Keyed link (…/?k=CODE): set the cookie, then redirect to a clean URL
    //     so the code doesn't linger in the address bar or history.
    const url = new URL(request.url);
    if (url.searchParams.get("k") === accessKey) {
      url.searchParams.delete("k");
      return new Response(null, {
        status: 302,
        headers: {
          location: url.pathname + (url.search || ""),
          "set-cookie": `${COOKIE}=${accessKey}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`,
        },
      });
    }
  }

  return new Response("Not found", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
