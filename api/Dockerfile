FROM node:20-alpine

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

ENV PRISMA_CLI_BINARY_TARGETS=linux-musl-openssl-3.0.x

# Install deps first (cached layer when only source changes)
COPY package*.json ./
RUN npm ci --fetch-retry-maxtimeout=60000 --fetch-retries=5

# Copy all source (including prisma schema) before generating client
COPY . .
RUN npx prisma generate
RUN rm -f tsconfig.tsbuildinfo
RUN npm run build

EXPOSE 4000

CMD ["node", "dist/main.js"]
