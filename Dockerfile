# syntax=docker/dockerfile:1
# ---------------------------------------------------------
# ESTÁGIO 1: build (dependências completas + compilação)
# ---------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /usr/src/app

ENV PUPPETEER_SKIP_DOWNLOAD=true
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --quiet

COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ---------------------------------------------------------
# ESTÁGIO 2: dependências de produção apenas
# ---------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /usr/src/app
ENV PUPPETEER_SKIP_DOWNLOAD=true
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund --quiet && npm cache clean --force

# ---------------------------------------------------------
# ESTÁGIO 3: imagem final
# v5.0.0-13.4.1 / 15.2.3: só o código compilado e as dependências de produção.
# Sem código-fonte TypeScript, testes, .git, .env ou ferramentas de build.
# ---------------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /usr/src/app

ENV NODE_ENV=production \
    TZ=America/Sao_Paulo \
    PORT=3001

COPY --from=deps --chown=node:node /usr/src/app/node_modules ./node_modules
COPY --from=build --chown=node:node /usr/src/app/dist ./dist
COPY --chown=node:node package.json ./

# v5.0.0-15.2.5: o processo roda sem privilégios de root.
USER node
EXPOSE 3001

CMD ["node", "dist/main"]
