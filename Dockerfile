FROM node:20-alpine
WORKDIR /app

# Install dependencies including docker CLI
COPY package.json package-lock.json* ./
RUN apk add --no-cache libc6-compat git openssl docker-cli \
  && npm install --legacy-peer-deps

# Copy source
COPY . .

RUN npx prisma generate || true

ENV NODE_ENV=production
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy --preview-feature || true && npm run start"]
