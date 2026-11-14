FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY vendor ./vendor
COPY tsconfig.json ./
RUN npm ci
COPY prisma ./prisma/
RUN npx prisma generate
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
COPY vendor ./vendor
RUN npm ci --only=production
COPY prisma ./prisma/
RUN npx prisma generate
COPY --from=builder /app/dist ./dist/
EXPOSE 8080
CMD ["node", "dist/index.js"]

# Fail closed on built content and resolved runtime bindings before the app starts.
COPY --chown=1001:1001 vendor/omevision-release-guard-1.0.0.tgz /tmp/release-guard.tgz
COPY .release-guard.json /app/.release-guard.json
RUN mkdir -p /app/.release-guard && tar -xzf /tmp/release-guard.tgz -C /app/.release-guard && rm /tmp/release-guard.tgz && node /app/.release-guard/package/cli.mjs --phase artifacts --path /app/dist
ENTRYPOINT ["node", "/app/.release-guard/package/launch.mjs"]
CMD ["node", "dist/index.js"]
