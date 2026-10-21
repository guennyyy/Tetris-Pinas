FROM node:22-alpine
WORKDIR /app
COPY --chown=node:node package.json server.cjs multiplayer-engine.cjs tetris-core.js ./
COPY --chown=node:node *.html *.css *.js *.svg *.jfif ./
COPY --chown=node:node Assets/ ./Assets/
RUN mkdir -p /app/data && chown node:node /app /app/data
ENV NODE_ENV=production
ENV PORT=3000
ENV ACCOUNT_FILE=/app/data/accounts.json
EXPOSE 3000
USER node
CMD ["node", "server.cjs"]
