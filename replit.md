# PatchWork

A mobile-first civic-tech pothole reporting app. Community members can see road problems on a live map, report new ones, confirm existing reports (location-gated), and explore hotspot streets — all powered by in-memory mock data with no backend required.

## Run & Operate

- `pnpm --filter @workspace/pothole-reporter run dev` — run the web app (port 21017, preview path `/`)
- `VITE_MAP_STYLE_URL=/offline-style.json pnpm --filter @workspace/pothole-reporter run dev` — run against the bundled blank style, for offline/air-gapped work
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, preview path `/api`)
- `CORS_ALLOWED_ORIGINS=https://example.com,...` — origins allowed to call the API from a browser in production. Unset is fine while web and API share one origin; only a separately hosted front end needs it
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS v4, framer-motion, vaul (bottom sheets), wouter (routing)
- Maps: MapLibre GL (web) + MapLibre React Native (mobile). Tiles from OpenFreeMap, geocoding from Nominatim — both keyless and free
- Fonts: Outfit (UI) + Space Mono (data/numbers)
- API: Express 5
- DB: PostgreSQL + Drizzle ORM (not yet used — the API still keeps potholes in memory)
- API codegen: Orval (from OpenAPI spec)

## Where things live

- `artifacts/pothole-reporter/src/` — main web app
  - `pages/MapPage.tsx` — full-screen map view (home route `/`)
  - `pages/HotspotsPage.tsx` — ranked hotspot streets (`/hotspots`)
  - `components/MapCanvas.tsx` — MapLibre map: severity markers, heatmap layer, zoom/recentre controls
  - `lib/map-config.ts` — tile style + geocoder URLs (env-overridable)
  - `lib/geocode.ts` — Nominatim reverse geocoding for new reports
  - `components/PotholeDetailSheet.tsx` — bottom sheet for selected marker detail + proximity confirm
  - `components/ReportSheet.tsx` — report flow with 50m duplicate-nudge logic
  - `components/FloatingNav.tsx` — pill nav bar (Map / Hotspots)
  - `store/PotholeContext.tsx` — app state on top of the generated API hooks: shared pothole list, GPS, add/confirm, loading and error flags
  - `lib/types.ts` — aliases of the generated contract types + haversine distance helper
  - `lib/utils/ui-helpers.ts` — severity colour helpers
- `artifacts/api-server/src/` — Express API server (health + full pothole CRUD/confirm routes)
  - `lib/cors.ts` — CORS allowlist policy (`CORS_ALLOWED_ORIGINS`)
- `lib/api-spec/openapi.yaml` — OpenAPI contract
- `artifacts/patchwork-mobile/` — Expo/React Native client (real GPS, MapLibre, wired to the API)
  - `app/(tabs)/index.tsx` — map screen
  - `constants/map.ts` — tile style URLs + confirm radius

## Architecture decisions

- **Real slippy maps via MapLibre**, deliberately not Google. OpenFreeMap serves vector tiles with no API key and no billing account, so both clients work out of the box. Override with `VITE_MAP_STYLE_URL` (web) or `EXPO_PUBLIC_MAP_STYLE_URL` (mobile) to point at MapTiler, Protomaps, a self-hosted style, or Google.
- **Real GPS on both clients.** The confirm gate is the app's trust model — you may only confirm a pothole you are physically near — so a hardcoded coordinate makes it meaningless. Web uses `navigator.geolocation.watchPosition`; mobile uses `expo-location`.
- **All proximity math is client-side** (haversine in `lib/types.ts`): confirm gate at 100m on web, 50m on mobile (`CONFIRM_RADIUS_M`), duplicate-report nudge at 50m. These thresholds still disagree between clients — worth unifying.
- **Reverse geocoding fills in street names.** Hotspots ranks by street, so a report without one never reaches the app's main output. Web uses Nominatim (`lib/geocode.ts`), mobile uses `expo-location`'s built-in geocoder. Both fall back to 'Unknown Street' rather than losing the report.
- **Both clients share one data layer.** `pothole-reporter` and `patchwork-mobile` both go through the generated hooks in `@workspace/api-client-react` (`useListPotholes`, `useCreatePothole`, `useConfirmPothole`), and both validate against the same `@workspace/api-zod` schemas the server uses. The web app's localStorage store and local mock seed are gone: a report made in one browser is visible in every other one, which is what makes Hotspots mean anything. The server's seed is now the only seed, so a first-run user outside San Francisco sees the SF cluster rather than potholes around them — that goes away when the API gets a database.
- **The web app degrades loudly, not silently.** An unreachable API leaves the map empty, which looks identical to a city with no potholes. Map and Hotspots both carry explicit loading and "can't reach the server" states instead.
- **Reverse geocoding happens before the POST**, not after. `streetName` and `neighborhood` are required by the contract, so the old "submit now, patch the name in later" path is gone. A failed lookup still submits with `UNKNOWN_PLACE`.
- **No database writes yet** — the API keeps potholes in module scope, so every restart re-seeds and each autoscale instance holds its own truth. See `GO-LIVE.md`.
- **CORS is allowlisted in production, open in development** (`api-server/src/lib/cors.ts`). Requests with no `Origin` — native mobile, curl, server-to-server — always pass, because CORS is a browser mechanism and protects nothing there. An unconfigured production deploy still works: web and API sit on one origin behind Replit's router, and same-origin requests never consult CORS. `credentials` stays off deliberately; the mobile client authenticates with a bearer token, and reflecting an origin with credentials enabled is how CORS mistakes become account takeover. Note this constrains browsers only — it does nothing about the unauthenticated write routes (see `GO-LIVE.md`).

## Product

- Full-screen slippy map (pan/zoom/rotate) centred on the user's real GPS location
- Heatmap toggle showing report density weighted by confirmations
- 50 seeded potholes with severity (minor/moderate/severe), status, confirmation counts
- Tap a marker → detail bottom sheet with distance, severity badge, proximity-gated Confirm button
- FAB (orange +) → report flow; if within 50m of existing report, shows duplicate nudge first
- Hotspots page: ranked streets by severity score with breakdown pills and animated bars

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- **`Failed to resolve import "maplibre-gl"` (or any other dep) in the Vite
  overlay almost always means a half-finished install, not a missing package.**
  The lockfile has it, `node_modules` does not. Run `pnpm install
  --frozen-lockfile` and restart the dev server. `scripts/post-merge.sh` does
  this automatically after a merge, but it used to be capped at 20s in
  `.replit` — far too short for a cold ~1100-package install, so it was killed
  midway and left a broken tree. The cap is now 600s.
- The web app talks to the API through **relative** URLs (`/api/...`). In production and in the Replit preview that resolves because the platform router puts both on one origin; a bare local `vite dev` relies on the `/api` proxy in `vite.config.ts` (override with `API_PROXY_TARGET`), and a separately hosted API needs `VITE_API_BASE_URL`.
- **`@types/react` must stay on one version across the workspace.** Expo pins `react: 19.1.0`, so the catalog pins the types to 19.1.x to match. When the catalog said `^19.2.0` the workspace held two copies, and which one pnpm hoisted into `.pnpm/node_modules` depended on how many packages asked for each — deleting an unrelated package flipped it and broke the web typecheck with "two different types with this name exist".
- `maplibre-gl.css` sets `.maplibregl-map { position: relative }`, which beats Tailwind's `absolute`. A container styled only with `absolute inset-0` collapses to **zero height** and the map renders blank — always give it explicit `h-full w-full`.
- Never put positioning `transform` on an element a library animates. MapLibre's `anchor: 'bottom'` handles pin placement now; the old hand-rolled canvas had markers silently mis-anchored ~250m because framer-motion overwrote their `translate`.
- MapLibre heatmaps need `OES_texture_half_float_linear`. Headless Chromium on SwiftShader lacks it, so heatmaps render nothing in CI/containers while working fine on real devices — don't chase it as a bug.
- `@maplibre/maplibre-react-native` is native-only and needs a **development build** (`expo prebuild`); it does not run in Expo Go. Web is stubbed in `metro.config.js`.
- MapLibre RN v11 renamed things: `Map` (not `MapView`), `Marker` with `lngLat` (not `coordinate`), `GeoJSONSource` (not `ShapeSource`), `Layer type="heatmap"` (not `HeatmapLayer`), and `Camera` uses `flyTo`/`zoomTo` (no `setCamera`).
- Vaul Drawer needs `portal` wrapping; omitting it causes z-index issues with the map.
- Do not add leaf workspace packages to root `tsconfig.json` references.

## Pointers

- `GO-LIVE.md` — what still stands between this and real users (multi-user data, persistence, abuse controls)
- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
