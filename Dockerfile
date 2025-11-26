FROM node:20-bullseye-slim

# Install wget
RUN apt-get update && apt-get install -y wget && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files early to install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps

# Copy the rest of the source
COPY . .

# Generate Prisma client if available
RUN npx prisma generate || true

EXPOSE 3000

# Default command; overridden by docker-compose.dev.yml
CMD ["npm", "run", "dev"]
