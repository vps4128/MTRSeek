# syntax=docker/dockerfile:1
#
# RouteLens, as a container.
#
# Three stages, because the three jobs have nothing in common: installing the
# dependency tree, compiling the app, and running it. Only the last one becomes
# the image, so the compilers, the dev dependencies and the source never ship.
#
# `libc6-compat` is on every stage because Alpine's musl is not glibc, and some
# of the packages in this tree carry prebuilt binaries that expect glibc. It is
# a few kilobytes against a build that fails on a platform nobody tested.
#
# ## Why the runner is `node server.js` and not `next start`
#
# `next.config.ts` sets `output: "standalone"`, which emits `.next/standalone`
# — a server plus exactly the `node_modules` files the trace reached, and
# nothing else. Copying that directory in and running its own entry point is
# what keeps the image small; `next start` would need the full dependency tree
# and the `.next` build directory beside it.
#
# ## What this image does not contain
#
# The MaxMind databases. They are tens of megabytes, licensed to whoever
# downloaded them rather than to this repository, and republished weekly, so
# they are deployment data and not something an image should carry a stale copy
# of. The IP lookup tool reads them at runtime from the paths in
# `MAXMIND_ASN_DB_PATH` and `MAXMIND_CITY_DB_PATH`; without a volume mounted at
# those paths the tool reports that the database is unavailable, which is the
# honest answer rather than a wrong one. The same is true of
# `NEXT_PUBLIC_MAP_STYLE_URL`, which is inlined at build time and therefore
# absent here unless it is passed as a build argument.

# ---------------------------------------------------------------------------
# base — the runtime everything else is built on.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# ---------------------------------------------------------------------------
# deps — the dependency tree, on its own layer.
# ---------------------------------------------------------------------------
# Only the manifest and the lockfile are copied first, so that editing a source
# file does not invalidate the installed tree. `npm ci` rather than `npm
# install`: it installs exactly what the lockfile pins and fails if the two
# disagree, which is what makes this build reproducible.
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# builder — the compiled application.
# ---------------------------------------------------------------------------
# `npm run build` compiles the app, type-checks it, and writes both `.next` and
# the `.next/standalone` tree the runner copies. Dev dependencies are present
# here and are what makes that possible.
FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1

# How many workers `next build` may use. Left empty, Next's own default applies
# — one per CPU, which is what a CI runner wants. Set it to 1 when building on
# something small: `os.cpus()` inside a container reports the *host's* core
# count rather than the machine's, so a modest virtual machine starts far more
# workers than it has memory for and the build is killed part-way. See
# `NEXT_BUILD_CPUS` in `next.config.ts`.
ARG BUILD_CPUS=
ENV NEXT_BUILD_CPUS=$BUILD_CPUS

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------------------------------------------------------------------------
# runner — the image.
# ---------------------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME="0.0.0.0"

# A user with no privileges and no home directory. Nothing in this image writes
# to disk, so there is no reason for the process to be able to.
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --ingroup nodejs nextjs

# The three pieces of the standalone output. `.next/static` is not inside
# `.next/standalone` — Next leaves it beside it, so it is copied separately and
# lands where the server looks for it. There is no `public/` in this project;
# the icons are metadata files the router serves, and they are already in the
# standalone tree.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
