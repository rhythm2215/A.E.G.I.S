FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Accept Railway build-time API and WebSocket URLs (with defaults)
ARG VITE_API_URL=https://backend-production-ad11.up.railway.app
ARG VITE_WS_URL=wss://backend-production-ad11.up.railway.app/ws
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx config as a template (uses ${PORT})
COPY nginx.conf /etc/nginx/conf.d/default.conf.template

# At runtime, substitute ${PORT} (fallback 80) and launch nginx
CMD ["/bin/sh", "-c", "export PORT=${PORT:-80} && envsubst '${PORT}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
