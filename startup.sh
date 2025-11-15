#!/bin/sh

# Wait for database and run migrations
npx prisma generate
npx prisma migrate deploy || true
npx prisma db push || true

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
