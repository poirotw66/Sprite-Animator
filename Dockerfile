# Web-only image for the Sprite Animator SPA (no LINE factory / Python upload toolchain).
# Build:  docker build -t sprite-animator .
# Run:   docker run --rm -p 8080:8080 sprite-animator
# Then open http://localhost:8080/

FROM node:20-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
# SPA fallback for HashRouter is not required (hash never hits the server),
# but keep a simple nginx config with gzip for static assets.
RUN printf '%s\n' \
  'server {' \
  '  listen 8080;' \
  '  server_name _;' \
  '  root /usr/share/nginx/html;' \
  '  gzip on;' \
  '  location / {' \
  '    try_files $uri $uri/ /index.html;' \
  '  }' \
  '}' > /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
