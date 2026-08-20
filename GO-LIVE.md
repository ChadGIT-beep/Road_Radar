# PatchWork — go-live readiness

Status as of this branch: **the demo is solid, the product is not yet multi-user.**
Everything below was verified against the running app, not inferred.

## What is already working

- `pnpm run typecheck` passes across all 10 workspace packages.
- `pothole-reporter` builds and runs; map, markers, heatmap toggle, report flow,
  detail sheet and the Hotspots ranking all render on a real device viewport.
- Tile failures degrade gracefully — the app shows "Map tiles unavailable —
  reports still work" and keeps the markers.
- `api-server` starts and answers `GET /api/healthz`, `GET /api/potholes`,
  `POST /api/potholes` (with Zod validation and a coordinate sanity check) and
  `POST /api/potholes/:id/confirm` (404s an unknown id, refuses a fixed one).

## Blockers — must land before real users

(#1 and #4 are done on this branch; #2 and #3 are open.)

### 1. The web app is single-player — ~~blocker~~ **done**

`pothole-reporter` read and wrote `localStorage` only, seeding 50 potholes per
browser. Two people saw two unrelated maps.

`store/PotholeContext.tsx` now runs on the same generated hooks
`patchwork-mobile` uses — `useListPotholes`, `useCreatePothole`,
`useConfirmPothole` from `@workspace/api-client-react` — with writes
invalidating the shared list. The localStorage cache and `lib/mock-data.ts`
are gone; the server's seed is the only seed. `lib/types.ts` no longer defines
its own `Pothole`, it aliases the generated contract type, so the duplicate
definition that let the clients drift apart is gone too.

Verified with two independent browser contexts: one confirms a pothole, the
other reloads and sees the count go 313 → 314.

Two consequences worth knowing:

- **The app now needs the API to show anything.** Map and Hotspots have
  explicit loading and "can't reach the server" states rather than rendering an
  empty city as though it were a clean one.
- **The seed is the server's, centred on San Francisco.** The old per-browser
  seed was generated around the user's real GPS so the demo was never empty
  anywhere. Real shared data replaces that, which is correct — but until #2
  gives the API a database, a first-run user outside SF sees a distant cluster
  rather than potholes around them.

Reverse geocoding moved *before* the POST, because `streetName` and
`neighborhood` are required by the contract; a failed lookup still submits with
`UNKNOWN_PLACE` rather than losing the report.

### 2. Nothing is persisted server-side

`api-server/src/routes/potholes.ts` holds `const potholes: Pothole[]` in module
scope and re-seeds on every process start. The deployment target is `autoscale`,
so that means several instances each holding a different truth, and every report
lost on the next cold start. `lib/db/src/schema/index.ts` is still the empty
template — the Drizzle wiring exists but no table does.

Needs: a `potholes` table, Drizzle queries behind the existing routes, and a
provisioned `DATABASE_URL`.

### 3. Anyone can forge the data

- Both write routes are unauthenticated and unrate-limited.
- `POST /potholes/:id/confirm` just increments a counter — one caller in a
  `curl` loop can push any street to the top of Hotspots.
- The proximity gate ("you may only confirm a pothole you are standing near")
  is **client-side only**. The server never sees the confirmer's location, so
  the app's entire trust model is decorative against anyone using the API
  directly.

Minimum: identity (even anonymous device tokens), per-device rate limits,
one-confirm-per-device-per-pothole, and move the distance check server-side by
sending the confirmer's coordinates with the request.

### 4. CORS is fully open — ~~blocker~~ **done**

`app.use(cors())` accepted every origin. The policy now lives in
`api-server/src/lib/cors.ts`:

- requests with no `Origin` (native mobile, curl, server-to-server) pass — CORS
  is a browser mechanism and has nothing to protect there;
- in development any origin is reflected, so the Vite dev server just works;
- in production only origins on the allowlist get CORS headers back.

The allowlist is `CORS_ALLOWED_ORIGINS` (comma-separated) plus Replit's own
`REPLIT_DEV_DOMAIN` / `REPLIT_DOMAINS` when the platform supplies them. An
unconfigured production deploy is not a startup failure: web and API share one
origin behind Replit's router, and same-origin requests never consult CORS. A
*separately hosted* front end has to be named explicitly. Rejected origins are
logged once each, so a misconfigured allowlist shows up in the server log rather
than only as an opaque error in someone's browser console.

Two things this deliberately does not do: enable `credentials` (reflecting an
origin with credentials on is how CORS mistakes become account takeover — the
mobile client uses a bearer token instead), and allow methods beyond
`GET`/`POST`/`OPTIONS`, which is all the OpenAPI contract has.

Note that CORS only constrains *browsers*. It does nothing about #3 — a direct
API client is unaffected — so it narrows the attack surface without closing it.

## Should fix before launch

### 5. Both third-party services are demo-tier

- **Tiles:** the public OpenFreeMap endpoint — no key, no SLA, community funded.
  Fine for a demo, not something to point launch traffic at. `VITE_MAP_STYLE_URL`
  / `EXPO_PUBLIC_MAP_STYLE_URL` already exist to swap in MapTiler, Protomaps or
  a self-hosted style; this is a budget decision, not a code one.
- **Geocoding:** the public Nominatim instance allows roughly 1 req/s and its
  usage policy forbids heavy use and requires every caller to identify itself.
  A browser physically cannot do that — `User-Agent` is a forbidden header, so
  the header this repo used to send was silently dropped (removed on this
  branch). Identification has to come from a server-side geocoding proxy, which
  is also where caching and the self-hosted instance belong.

### 6. The two clients disagree on the rules

Confirm radius is 100 m on web (`PotholeDetailSheet.tsx`) and 50 m on mobile
(`constants/map.ts`, `CONFIRM_RADIUS_M`). Whichever is right, it should be one
number, and once #3 is done it should live on the server. The clients now share
a data layer and a type contract, so this threshold and the 50 m duplicate-report
nudge are the last pieces of product logic still duplicated by hand.

### 7. No tests, no CI

There is not a single test file and no `.github/` workflow. Nothing catches a
regression before it reaches the preview. At minimum: unit tests for the
haversine/severity helpers and the API routes, plus a workflow running
`pnpm run typecheck` and `pnpm run build` on every PR.

### 8. The mobile app has no ship path yet

`@maplibre/maplibre-react-native` is native-only — it needs `expo prebuild` and
a development build, and will never run in Expo Go. To reach a store: EAS build
config, a real bundle identifier, icons and splash, location-permission usage
strings, and a privacy policy URL.

## Worth deciding before launch

- **Photos.** `expo-image-picker` is already a dependency but the report flow
  never captures an image. A photo is what makes a pothole report actionable to
  a road authority — and it brings moderation and storage costs with it.
- **Who marks a pothole fixed?** The `fixed` status exists in the model with no
  workflow behind it. Without a council/authority integration or a trusted-user
  role, the map only ever accumulates.
- **Privacy.** Precise GPS plus timestamps is personal data. A public civic app
  needs a privacy policy, a retention decision, and — depending on where this
  launches — a GDPR/POPIA position, before the first real report.
- **Moderation.** No way to flag a bogus or abusive report.
- **Monitoring.** No error tracking, uptime checks or analytics on either client.

## Housekeeping

- `mockup-sandbox` is deleted. It was Replit's empty component-preview canvas
  (its generated module map was literally `{}`), not part of the product.
- Deleting it exposed a latent split: the catalog asked for `@types/react`
  `^19.2.0` while `patchwork-mobile` pinned `~19.1.10` for Expo, so the
  workspace carried two copies and *which one pnpm hoisted depended on how many
  packages voted for each*. Removing one voter flipped it and broke the web
  app's typecheck with "two different types with this name exist". The catalog
  now pins 19.1.x to match the pinned `react: 19.1.0`, so there is one copy.
- `pnpm run build` at the repo root still needs `PORT` and `BASE_PATH`, and
  `patchwork-mobile`'s build additionally needs a deployment domain
  (`REPLIT_DEV_DOMAIN` or similar) and network access to Metro. Replit supplies
  all of these; it only bites locally.
- The web bundle is now split (`app ~591 kB`, `maplibre ~942 kB`) so a deploy no
  longer invalidates MapLibre in everyone's cache. Further splitting the map
  route behind a dynamic import would cut first paint again.
