FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV PORT=4000
EXPOSE 4000
CMD ["npm", "start"]
