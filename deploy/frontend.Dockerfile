# Build the Vite SPA, then serve it with Nginx (which also proxies /api and
# serves /uploads). Multi-arch: works on Oracle Ampere (arm64) and x86.
# Build-time VITE_* vars are baked into the bundle, so pass them as build args.

FROM node:20-alpine AS build
WORKDIR /app
ARG VITE_API_BASE_URL=/api
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
COPY frontend/package*.json ./frontend/
WORKDIR /app/frontend
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM nginx:1.27-alpine AS runtime
RUN rm /etc/nginx/conf.d/default.conf
COPY deploy/nginx.conf /etc/nginx/conf.d/app.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
