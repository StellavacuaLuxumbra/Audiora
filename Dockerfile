# ---------- 构建阶段 ----------
FROM oven/bun:1 AS builder
WORKDIR /app

# 先复制依赖清单, 利用 Docker 层缓存
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
# 构建生产包: package.json 的 build 脚本会生成 .next/standalone
# 并把 .next/static 与 public 一并复制进去
RUN bun run build

# ---------- 运行阶段 ----------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup -S nodejs -g 1001 && adduser -S nextjs -u 1001

# standalone 目录已包含 server.js、编译产物与静态资源
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
