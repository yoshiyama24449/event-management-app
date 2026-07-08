# 1. ビルドステージ
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build  # ここでnpx/ビルドが走る

# 2. 実行用ステージ
FROM node:20-alpine AS runner
WORKDIR /app
# ビルド済みのファイルだけをコピーしてくる
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

CMD ["npm", "start"]