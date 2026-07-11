# Deterministic build for Railway — avoids Nixpacks engine/caching ambiguity.
# Alpine (musl) runtime → Prisma client engine linux-musl-openssl-3.0.x
# (present in schema binaryTargets). The full node_modules is carried from the
# build stage so BOTH the generated client engine AND the prisma CLI (needed by
# `migrate:deploy` at start) are available at runtime.
FROM node:20-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
EXPOSE 3000
# Railway's railway.json startCommand overrides this (runs migrate:deploy first).
CMD ["node", "dist/main.js"]
