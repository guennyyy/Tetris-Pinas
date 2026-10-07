FROM node:22-alpine
WORKDIR /app
COPY package.json server.cjs multiplayer-engine.cjs ./
COPY index.html style.css app.css game.js app.js online.js background.jfif bg-fiesta.svg ./
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
USER node
CMD ["node", "server.cjs"]
