#!/bin/bash
set -e

# Dependencies first. A partial install is the single most common cause of
# "[plugin:vite:import-analysis] Failed to resolve import ..." in the dev
# preview: the lockfile has the package, node_modules does not.
pnpm install --frozen-lockfile

# The Drizzle schema is still empty and the app runs on mock data, so there is
# nothing to push and no database is provisioned in most environments.
# drizzle.config.ts throws when DATABASE_URL is unset, and `set -e` would turn
# that into a failed post-merge hook — which used to abort this script before
# anyone noticed the install had also been cut short.
if [ -n "$DATABASE_URL" ]; then
  pnpm --filter @workspace/db push
else
  echo "post-merge: DATABASE_URL not set — skipping 'db push' (app is mock-data only)."
fi
