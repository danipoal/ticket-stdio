# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Build: exporta la app como web estatica.
# app.json ya define web.output = "static", asi que expo-router genera
# un HTML por ruta ademas del bundle JS.
# ---------------------------------------------------------------------------
FROM node:20 AS build

WORKDIR /app

# Las EXPO_PUBLIC_* se incrustan en el bundle en tiempo de build,
# por eso .env.local tiene que entrar en el contexto (ver .dockerignore).
# npm ci: instalacion reproducible desde package-lock.json (el CI de GitHub
# usa el mismo comando). .npmrc trae legacy-peer-deps=true y hace falta para
# resolver el arbol de dependencias.
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund

COPY . .

RUN npx expo export --platform web --output-dir dist

# ---------------------------------------------------------------------------
# Runtime: solo nginx + los estaticos. Sin Node, sin Metro, sin watchers.
# ---------------------------------------------------------------------------
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8081
