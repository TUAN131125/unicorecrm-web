FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_RUNTIME_MODE=demo
ARG VITE_AUTH_ADAPTER=development
ARG VITE_ALLOW_PRODUCTION_DEMO=true

ENV VITE_RUNTIME_MODE=${VITE_RUNTIME_MODE}
ENV VITE_AUTH_ADAPTER=${VITE_AUTH_ADAPTER}
ENV VITE_ALLOW_PRODUCTION_DEMO=${VITE_ALLOW_PRODUCTION_DEMO}

RUN npm run build

FROM nginx:stable-alpine

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]