# syntax=docker/dockerfile:1

# ---- build the SPA -----------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /build

# Dependencies first so a source-only change reuses the install layer.
COPY web/package.json web/package-lock.json ./web/
RUN --mount=type=cache,target=/root/.npm npm ci --prefix web

# The question bank and the exhibit screenshots live in web/public and are copied verbatim
# into dist by Vite; they are generated ahead of time by `npm run data`.
COPY web/ ./web/
RUN npm --prefix web run build


# ---- runtime -----------------------------------------------------------------
FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    PORT=8080
WORKDIR /app

# The server has no dependencies, so there is nothing to install here.
COPY server/ ./server/
COPY --from=build /build/web/dist ./public/

# Cloud Run runs containers as an arbitrary UID; node:alpine's `node` user works fine and
# keeps the filesystem read-only to the process.
USER node

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
