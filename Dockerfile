FROM node:20-alpine
WORKDIR /app
COPY server/package*.json ./
RUN npm install --production || true
COPY server ./server
EXPOSE 3000
CMD ["node","server/server.js"]