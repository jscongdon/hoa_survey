
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

# Start the application with JWT_SECRET environment variable
npm run dev

# Optionally seed the database in dev if PRISMA_SEED=true and no admin exists
if [ "${PRISMA_SEED:-false}" = "true" ]; then
  echo "[startup] Checking if DB needs seeding..."
  node -e "const {PrismaClient} = require('@prisma/client'); const prisma = new PrismaClient(); (async ()=>{try{const c=await prisma.admin.count(); // if zero, exit 1 so we run seed
    if(c===0){ console.log('[startup] No admin found; seeding database'); process.exit(1); } else { console.log('[startup] Admin already exists, skipping seed'); process.exit(0); } }catch(e){ console.error(e); process.exit(0);} finally { await prisma.$disconnect();}})();"
  if [ $? -ne 0 ]; then
    echo "[startup] Seeding database..."
    npm run prisma:seed || echo "[startup] Seed failed or already run"
  else
    echo "[startup] Seed not required"
  fi
fi
