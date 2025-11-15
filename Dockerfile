FROM node:20-alpine
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN apk add --no-cache libc6-compat openssl && \
    npm install --legacy-peer-deps

# Copy source
COPY . .

# Set build-time environment variables
ENV SKIP_ENV_VALIDATION=1
ENV DATABASE_URL="file:./dev.db"

# Generate Prisma Client and build Next.js
RUN npx prisma generate && \
    npm run build

# Copy static files for standalone mode
RUN cp -r .next/static .next/standalone/.next/static && \
    cp -r public .next/standalone/public

# Switch to standalone directory
WORKDIR /app/.next/standalone

ENV NODE_ENV=production
EXPOSE 3000

CMD ["sh", "-c", "cd /app && npx prisma migrate deploy && cd /app/.next/standalone && node server.js"]
