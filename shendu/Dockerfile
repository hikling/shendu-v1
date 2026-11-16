FROM node:24-alpine AS ui-build
WORKDIR /build
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY components.json jsconfig.json vite.config.js ./
COPY ui ./ui
COPY public/finance-domain.js ./public/finance-domain.js
COPY scripts/ui-licenses.mjs ./scripts/ui-licenses.mjs
COPY scripts/prepare-ocr.mjs ./scripts/prepare-ocr.mjs
RUN npm run build

FROM node:24-alpine AS runtime
RUN apk add --no-cache tini tzdata su-exec
WORKDIR /app
COPY package.json server.mjs finance-ledger.mjs finance-receipts.mjs ./
COPY scripts ./scripts
COPY public ./public
COPY --from=ui-build /build/public/ui ./public/ui
COPY --from=ui-build /build/public/ocr ./public/ocr
RUN mkdir -p /app/data /app/tmp \
  && chmod +x /app/scripts/docker-entrypoint.sh \
  && chown -R node:node /app/data /app/tmp
ARG SHENDU_SOURCE_TREE=development
LABEL io.shendu.source-tree=$SHENDU_SOURCE_TREE
ENV NODE_ENV=production SHENDU_PORT=3000 SHENDU_DATA_DIR=/app/data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
ENTRYPOINT ["/sbin/tini", "--", "/app/scripts/docker-entrypoint.sh"]
CMD ["node", "server.mjs"]
