FROM node:20-alpine
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN apk add --no-cache libc6-compat openssl wget && \
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
RUN cp -r .next/static .next/standalone/.next/static


# Switch to standalone directory
WORKDIR /app/.next/standalone

ENV NODE_ENV=production
EXPOSE 3000

# Copy startup script into the image
COPY startup.sh /app/startup.sh
RUN chmod +x /app/startup.sh

# Set startup.sh as the default command
CMD ["/app/startup.sh"]
