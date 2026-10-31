FROM node:22-alpine
WORKDIR /app
COPY . .
ENV PORT=3000 DB_PATH=/data/navigo.db COOKIE_SECURE=1
VOLUME /data
EXPOSE 3000
CMD ["node","server.js"]
