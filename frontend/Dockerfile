FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY backend/prisma backend/prisma
COPY frontend/package.json frontend/package.json
RUN npm ci

COPY frontend frontend
ARG VITE_API_BASE_URL=/api/sidebar
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build --workspace frontend

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf.template /etc/nginx/templates/default.conf.template
EXPOSE 80
