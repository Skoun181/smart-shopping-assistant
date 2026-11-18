FROM node:24-alpine AS build
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run check && npm run build && npm prune --omit=dev

FROM node:24-alpine
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DATABASE_PATH=/data/shopping.db BODY_SIZE_LIMIT=6M
WORKDIR /app
RUN apk add --no-cache libstdc++ tesseract-ocr tesseract-ocr-data-deu tesseract-ocr-data-eng poppler-utils && addgroup -S shopping && adduser -S shopping -G shopping && mkdir -p /data && chown shopping:shopping /data
COPY --from=build --chown=shopping:shopping /app/build ./build
COPY --from=build --chown=shopping:shopping /app/node_modules ./node_modules
COPY --from=build --chown=shopping:shopping /app/scripts ./scripts
COPY --from=build --chown=shopping:shopping /app/package.json ./package.json
USER shopping
EXPOSE 3000 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","scripts/server.mjs"]
