# Usa a imagem oficial do Node.js
FROM node:20-alpine

# Cria o diretório de trabalho dentro do container
WORKDIR /usr/src/app

# Copia os arquivos de dependências
COPY package*.json ./

# Instala as dependências
RUN npm install --no-audit --no-fund --quiet

# Copia o restante do código
COPY . .

# Compila o projeto NestJS
RUN npm run build

# Expõe a porta que o NestJS usa (geralmente 3000)
EXPOSE 3000

# Comando para rodar a aplicação
CMD ["npm", "run", "start:prod"]