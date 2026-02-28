FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src/ ./src/
COPY public/ ./public/
EXPOSE 8080
CMD ["node", "src/app.js"]
