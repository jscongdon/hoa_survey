
#!/bin/sh

cd /app


# Warn if JWT_SECRET is unset or insecure
if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "changeme" ] || [ "$JWT_SECRET" = "dev-secret-will-be-replaced-by-setup" ]; then
  echo "[WARN] JWT_SECRET environment variable is not set or is insecure! Edge Runtime JWT verification will fail."
fi

# Wait for database and run migrations
npx prisma generate

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

# Run member data encryption migration
echo "[startup] Running member data encryption migration"
if npx ts-node --compiler-options '{"module":"CommonJS","target":"ES2020"}' scripts/encrypt-member-data.ts; then
  echo "[startup] Member data encryption completed"
else
  echo "[startup] Member data encryption failed or no data to encrypt"
fi

# Try to load JWT secret from database
JWT_SECRET=$(node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

prisma.systemConfig.findUnique({ where: { id: 'system' } })
  .then(config => {
    if (config && config.jwtSecret) {
      console.log(config.jwtSecret);
    } else {
      // Use fallback if no config yet
      console.log('dev-secret-will-be-replaced-by-setup');
    }
  })
  .catch(() => {
    console.log('dev-secret-will-be-replaced-by-setup');
  })
  .finally(() => prisma.\$disconnect());
" 2>/dev/null)

# Start the application with JWT_SECRET environment variable
JWT_SECRET="$JWT_SECRET" npm run dev
