import type { CorsOptions } from "cors";
import { logger } from "./logger";

/**
 * CORS policy for the PatchWork API.
 *
 * The rules, in the order they are applied:
 *
 *  1. **No `Origin` header → allowed.** Native mobile clients, curl and
 *     server-to-server calls do not send one, and CORS has nothing to protect
 *     there — it is a browser mechanism.
 *  2. **Development → any origin is reflected**, so the Vite dev server on
 *     whatever port it landed on just works.
 *  3. **Production → only origins on the allowlist.** Anything else gets no
 *     CORS headers back, which is what makes the browser refuse the response.
 *
 * The allowlist comes from `CORS_ALLOWED_ORIGINS` (comma-separated, e.g.
 * `https://patchwork.example,https://www.patchwork.example`), plus Replit's
 * own domains when the platform supplies them.
 *
 * An empty allowlist in production is deliberately *not* a startup failure:
 * the web app and the API are served from one origin behind Replit's
 * application router (`/` and `/api`), and same-origin requests never consult
 * CORS at all. Refusing to boot would break that working default in order to
 * fix a problem it does not have. What it does mean is that a *separately
 * hosted* front end has to be named explicitly before it can call this API.
 */

function normalize(origin: string): string {
  return origin.trim().toLowerCase().replace(/\/+$/, "");
}

function readAllowedOrigins(): Set<string> {
  const origins = new Set<string>();

  for (const entry of (process.env["CORS_ALLOWED_ORIGINS"] ?? "").split(",")) {
    const normalized = normalize(entry);
    if (normalized) origins.add(normalized);
  }

  // Replit hands the deployment its own hostnames. Trusting them saves having
  // to re-set CORS_ALLOWED_ORIGINS every time a preview URL changes.
  for (const key of ["REPLIT_DEV_DOMAIN", "REPLIT_DOMAINS"] as const) {
    for (const domain of (process.env[key] ?? "").split(",")) {
      const host = domain.trim();
      if (host) origins.add(normalize(`https://${host}`));
    }
  }

  return origins;
}

// One warning per rejected origin, so a misconfigured allowlist is visible in
// the logs instead of surfacing only as an opaque CORS error in someone's
// browser console. Capped so a scanner cannot grow it without bound.
const MAX_WARNED_ORIGINS = 100;
const warnedOrigins = new Set<string>();

function warnOnce(origin: string): void {
  if (warnedOrigins.has(origin)) return;
  if (warnedOrigins.size < MAX_WARNED_ORIGINS) warnedOrigins.add(origin);

  logger.warn(
    { origin },
    "Blocked a cross-origin request. Add the origin to CORS_ALLOWED_ORIGINS if it is yours.",
  );
}

export function buildCorsOptions(): CorsOptions {
  const isProduction = process.env["NODE_ENV"] === "production";
  const allowedOrigins = readAllowedOrigins();

  if (isProduction) {
    logger.info(
      { allowedOrigins: [...allowedOrigins] },
      allowedOrigins.size > 0
        ? "CORS restricted to the configured origins"
        : "CORS allowlist is empty — only same-origin and non-browser callers can reach the API",
    );
  }

  return {
    origin(requestOrigin, callback) {
      // Rule 1: not a browser cross-origin request.
      if (!requestOrigin) {
        callback(null, true);
        return;
      }

      // Rule 2: local development.
      if (!isProduction) {
        callback(null, true);
        return;
      }

      // Rule 3: production allowlist.
      const allowed = allowedOrigins.has(normalize(requestOrigin));
      if (!allowed) warnOnce(requestOrigin);

      // `false` means "send no CORS headers" rather than "fail the request" —
      // the browser then blocks the response, and a non-browser caller that
      // happened to send an Origin still gets its answer.
      callback(null, allowed);
    },
    // The OpenAPI contract only has reads and writes; there is nothing to
    // PUT, PATCH or DELETE yet.
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Accept", "Authorization", "Content-Type"],
    // No cookie auth today, and reflecting an origin with credentials enabled
    // is how CORS misconfigurations turn into account takeover. The mobile
    // client sends a bearer token, which needs no credentials mode.
    credentials: false,
    maxAge: 86_400,
  };
}
