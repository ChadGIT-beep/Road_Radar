# PatchWork

A mobile-first civic-tech pothole reporting app. Community members can see road problems on a live map, report new ones, confirm existing reports (location-gated), and explore hotspot streets — all powered by in-memory mock data with no backend required.

## Run & Operate

- `pnpm --filter @workspace/pothole-reporter run dev` — run the web app (port 21017, preview path `/`)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, preview path `/api`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS v4, framer-motion, vaul (bottom sheets), wouter (routing)
- Fonts: Outfit (UI) + Space Mono (data/numbers)
- API: Express 5
- DB: PostgreSQL + Drizzle ORM (not yet used — app is mock-data only)
- API codegen: Orval (from OpenAPI spec)

## Where things live

- `artifacts/pothole-reporter/src/` — main web app
  - `pages/MapPage.tsx` — full-screen map view (home route `/`)
  - `pages/HotspotsPage.tsx` — ranked hotspot streets (`/hotspots`)
  - `components/MapCanvas.tsx` — custom draggable map with severity markers + heatmap halos
  - `components/PotholeDetailSheet.tsx` — bottom sheet for selected marker detail + proximity confirm
  - `components/ReportSheet.tsx` — report flow with 50m duplicate-nudge logic
  - `components/FloatingNav.tsx` — pill nav bar (Map / Hotspots)
  - `store/PotholeContext.tsx` — in-memory state: 50 seeded potholes, add/confirm actions
  - `lib/mock-data.ts` — 50 seeded mock potholes around SF with clusters
  - `lib/types.ts` — shared types + haversine distance helper
  - `lib/utils/ui-helpers.ts` — severity colour helpers
- `artifacts/api-server/src/` — Express API server (health route only; pothole routes pending)
- `lib/api-spec/openapi.yaml` — OpenAPI contract (health only; ready to expand)

## Architecture decisions

- **Map is a custom draggable canvas** (framer-motion, not Leaflet/Mapbox) so no map tiles API key is needed. Scale: 18000 px/degree so 0.02° ≈ 360px — potholes visible across the viewport at a useful density.
- **All proximity math is client-side** (haversine in `lib/types.ts`): confirm gate at 100m, duplicate-report nudge at 50m.
- **Mock data is in-memory** with seeded deterministic random (see `lib/mock-data.ts`). ph-demo-1 is placed 30m from the mock user location to demonstrate the duplicate nudge on first open.
- **No database writes yet** — designed for future expansion with the API server + Drizzle schema.

## Product

- Full-screen draggable map centred on user's mock GPS location (SF)
- 50 seeded potholes with severity (minor/moderate/severe), status, confirmation counts
- Red hotspot halos appear around high-confirmation markers
- Tap a marker → detail bottom sheet with distance, severity badge, proximity-gated Confirm button
- FAB (orange +) → report flow; if within 50m of existing report, shows duplicate nudge first
- Hotspots page: ranked streets by severity score with breakdown pills and animated bars

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Map SCALE is 18000 px/deg. If mock data range changes (`±0.02 deg`) update SCALE to match.
- The `constraintsRef` div must be larger than the canvas to allow free dragging — currently `CANVAS_SIZE + viewport` on each side.
- Vaul Drawer needs `portal` wrapping; omitting it causes z-index issues with the map.
- Do not add leaf workspace packages to root `tsconfig.json` references.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
