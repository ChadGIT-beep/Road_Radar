# PatchWork

A mobile-first civic-tech pothole reporting app. Community members can see road problems on a live map, report new ones, confirm existing reports (location-gated), and explore hotspot streets — all powered by in-memory mock data with no backend required.

## Run & Operate

- `pnpm --filter @workspace/pothole-reporter run dev` — run the web app (port 21017, preview path `/`)
- `VITE_MAP_STYLE_URL=/offline-style.json pnpm --filter @workspace/pothole-reporter run dev` — run against the bundled blank style, for offline/air-gapped work
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, preview path `/api`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS v4, framer-motion, vaul (bottom sheets), wouter (routing)
- Maps: MapLibre GL (web) + MapLibre React Native (mobile). Tiles from OpenFreeMap, geocoding from Nominatim — both keyless and free
- Fonts: Outfit (UI) + Space Mono (data/numbers)
- API: Express 5
- DB: PostgreSQL + Drizzle ORM (not yet used — app is mock-data only)
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
  - `store/PotholeContext.tsx` — app state: 50 seeded potholes, add/confirm actions, persisted to localStorage
  - `lib/mock-data.ts` — 50 seeded mock potholes with clusters, generated around a given centre
  - `lib/types.ts` — shared types + haversine distance helper
  - `lib/utils/ui-helpers.ts` — severity colour helpers
- `artifacts/api-server/src/` — Express API server (health + full pothole CRUD/confirm routes)
- `lib/api-spec/openapi.yaml` — OpenAPI contract
- `artifacts/patchwork-mobile/` — Expo/React Native client (real GPS, MapLibre, wired to the API)
  - `app/(tabs)/index.tsx` — map screen
  - `constants/map.ts` — tile style URLs + confirm radius

## Architecture decisions

- **Real slippy maps via MapLibre**, deliberately not Google. OpenFreeMap serves vector tiles with no API key and no billing account, so both clients work out of the box. Override with `VITE_MAP_STYLE_URL` (web) or `EXPO_PUBLIC_MAP_STYLE_URL` (mobile) to point at MapTiler, Protomaps, a self-hosted style, or Google.
- **Real GPS on both clients.** The confirm gate is the app's trust model — you may only confirm a pothole you are physically near — so a hardcoded coordinate makes it meaningless. Web uses `navigator.geolocation.watchPosition`; mobile uses `expo-location`.
- **All proximity math is client-side** (haversine in `lib/types.ts`): confirm gate at 100m on web, 50m on mobile (`CONFIRM_RADIUS_M`), duplicate-report nudge at 50m. These thresholds still disagree between clients — worth unifying.
- **Reverse geocoding fills in street names.** Hotspots ranks by street, so a report without one never reaches the app's main output. Web uses Nominatim (`lib/geocode.ts`), mobile uses `expo-location`'s built-in geocoder. Both fall back to 'Unknown Street' rather than losing the report.
- **Mock data is seeded deterministically** (see `lib/mock-data.ts`) and persisted to `localStorage` under `patchwork.potholes.v1`, so reports and confirmations survive a reload. Unreadable or malformed storage falls back to a fresh seed. The seed is generated around the user's *real* position on first run, so the demo is never empty outside San Francisco. ph-demo-1 sits ~38m away to demonstrate the duplicate nudge on first open.
- **The web app is still localStorage-only.** The API server implements `GET/POST /api/potholes` and `POST /api/potholes/:id/confirm`, and `patchwork-mobile` already consumes them via `@workspace/api-client-react` — but `pothole-reporter` does not. Until it does, the two clients show different data and the web heatmap reflects only that browser.
- **No database writes yet** — designed for future expansion with the API server + Drizzle schema.

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

- `maplibre-gl.css` sets `.maplibregl-map { position: relative }`, which beats Tailwind's `absolute`. A container styled only with `absolute inset-0` collapses to **zero height** and the map renders blank — always give it explicit `h-full w-full`.
- Never put positioning `transform` on an element a library animates. MapLibre's `anchor: 'bottom'` handles pin placement now; the old hand-rolled canvas had markers silently mis-anchored ~250m because framer-motion overwrote their `translate`.
- MapLibre heatmaps need `OES_texture_half_float_linear`. Headless Chromium on SwiftShader lacks it, so heatmaps render nothing in CI/containers while working fine on real devices — don't chase it as a bug.
- `@maplibre/maplibre-react-native` is native-only and needs a **development build** (`expo prebuild`); it does not run in Expo Go. Web is stubbed in `metro.config.js`.
- MapLibre RN v11 renamed things: `Map` (not `MapView`), `Marker` with `lngLat` (not `coordinate`), `GeoJSONSource` (not `ShapeSource`), `Layer type="heatmap"` (not `HeatmapLayer`), and `Camera` uses `flyTo`/`zoomTo` (no `setCamera`).
- Vaul Drawer needs `portal` wrapping; omitting it causes z-index issues with the map.
- Do not add leaf workspace packages to root `tsconfig.json` references.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
