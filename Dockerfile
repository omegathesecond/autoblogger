FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY tsconfig.json ./
RUN npm ci
COPY prisma ./prisma/
RUN npx prisma generate
COPY src ./src/
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY prisma ./prisma/
RUN npx prisma generate
COPY --from=builder /app/dist ./dist/
EXPOSE 8080
CMD ["node", "dist/index.js"]
