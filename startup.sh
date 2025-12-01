
#!/bin/sh

cd /app


# Warn if JWT_SECRET is unset or insecure
if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "changeme" ] || [ "$JWT_SECRET" = "dev-secret-will-be-replaced-by-setup" ]; then
  echo "[WARN] JWT_SECRET environment variable is not set or is insecure! Edge Runtime JWT verification will fail."
fi

# Wait for database and run migrations
npm_root="./node_modules"
# Ensure dependencies are installed in the container (safe to run even if compose already installed them)
# If the expected binaries are missing from node_modules/.bin (empty named volume case),
# run `npm ci` to install dependencies. This avoids an empty `node_modules` directory
# created by Docker volumes that looks present but doesn't contain installed packages.
if [ ! -x "$npm_root/.bin/prisma" ] || [ ! -x "$npm_root/.bin/next" ]; then
  echo "[startup] Required node binaries missing — running npm ci --legacy-peer-deps"
  npm ci --legacy-peer-deps
fi

# Prefer the locally installed prisma binary to avoid npx fetching a different major version
if [ -x "$npm_root/.bin/prisma" ]; then
  echo "[startup] Using local prisma to generate client"
  "$npm_root/.bin/prisma" generate || true
else
  echo "[startup] Local prisma not found — falling back to npx prisma generate"
  npx prisma generate || true
fi

echo "[startup] Running migrations (prisma migrate deploy)"
if npx prisma migrate deploy; then
  echo "[startup] Migrations applied"
else
  echo "[startup] prisma migrate deploy failed — attempting prisma db push"
  if npx prisma db push; then
    echo "[startup] prisma db push applied schema"
  else
    echo "[startup] ERROR: Both prisma migrate deploy and prisma db push failed"
    echo "[startup] Continuing startup so you can inspect logs; the app may error if the schema is missing"
  fi
fi

# Start the application with JWT_SECRET environment variable
npm run dev
