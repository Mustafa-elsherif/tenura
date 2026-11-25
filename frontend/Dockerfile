# Tenura dashboard — build static assets, serve with nginx
FROM node:20-alpine AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
# For the containerised full stack the app talks to the backend service.
ARG VITE_API_BASE=http://localhost:8000
ARG VITE_BASE=/
ENV VITE_API_BASE=$VITE_API_BASE VITE_BASE=$VITE_BASE
RUN npm run build

FROM nginx:1.27-alpine
COPY infra/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
