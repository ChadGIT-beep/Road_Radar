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

### 1. The web app is single-player

`pothole-reporter` reads and writes `localStorage` only
(`store/PotholeContext.tsx`, key `patchwork.potholes.v1`). The 50 seeded
potholes are generated *per browser*, around that browser's own GPS fix. Two
people open PatchWork and see two unrelated maps; your report is invisible to
your neighbour, and the Hotspots page ranks nothing but your own session.

`patchwork-mobile` already talks to the API through
`@workspace/api-client-react`, so the web client is the odd one out. Port it to
the same hooks and delete the localStorage seed path (or keep it strictly as an
offline cache).

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

### 4. CORS is fully open

`app.use(cors())` in `api-server/src/app.ts` accepts every origin. Pin it to the
deployed web origin before the API is public.

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

Confirm radius is 100 m on web (`PotholeDetailSheet.tsx:29`) and 50 m on mobile
(`constants/map.ts`, `CONFIRM_RADIUS_M`). Whichever is right, it should be one
number, and once #3 is done it should live on the server.

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

- `pnpm run build` at the repo root fails unless `PORT` and `BASE_PATH` are set,
  because `mockup-sandbox`'s vite config throws without them. Replit supplies
  them on deploy, so this only bites locally — but `mockup-sandbox` is scaffolding
  and is probably worth deleting.
- The web bundle is now split (`app ~591 kB`, `maplibre ~942 kB`) so a deploy no
  longer invalidates MapLibre in everyone's cache. Further splitting the map
  route behind a dynamic import would cut first paint again.
