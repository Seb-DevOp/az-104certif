# Plain Dockerfile syntax on purpose: Cloud Build's default builder runs the legacy Docker
# engine, where BuildKit-only features (RUN --mount=type=cache, heredocs) fail outright.

# ---- build the SPA -----------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /build/web

# Dependencies first so a source-only change reuses the install layer.
COPY web/package.json web/package-lock.json ./
RUN npm ci

# The question bank (web/public/data/questions.json) and the exhibit screenshots
# (web/public/img) are generated from AZ-104_dump.pdf by `npm run data` and are NOT in git,
# because the dump forbids redistribution. They must exist in the build context: build from
# a working copy where `npm run data` has been run, not from a bare clone of the repo.
# web/scripts/check-data.mjs runs as npm's prebuild hook and stops here with instructions
# if they are missing.
COPY web/ ./
RUN npm run build


# ---- runtime -----------------------------------------------------------------
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=8080
WORKDIR /app

# The server has no dependencies, so there is nothing to install here.
COPY server/ ./server/
COPY --from=build /build/web/dist ./public/

# Cloud Run runs containers as an arbitrary UID; node:alpine's `node` user works fine and
# keeps the filesystem read-only to the process.
USER node

EXPOSE 8080

# Cloud Run uses its own probes and ignores this; it is here for local `docker run`.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
