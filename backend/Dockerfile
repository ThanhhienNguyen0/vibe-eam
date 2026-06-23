FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY backend/prisma backend/prisma
COPY frontend/package.json frontend/package.json
RUN npm ci

COPY backend backend
RUN npm run db:generate --workspace backend && npm run build --workspace backend

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/backend/package.json backend/package.json
COPY --from=build /app/frontend/package.json frontend/package.json
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/backend/dist backend/dist
COPY --from=build /app/backend/prisma backend/prisma
COPY --from=build /app/backend/src backend/src

EXPOSE 4000
CMD ["sh", "-c", "npm run db:migrate --workspace backend && npm run db:seed --workspace backend && npm run start --workspace backend"]
