FROM node:22-slim
ENV CI=true
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile --filter @openphysio/server...
ENV DATA_DIR=/data PORT=8787
EXPOSE 8787
CMD ["pnpm", "--filter", "@openphysio/server", "start"]
