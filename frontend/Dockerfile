# ============================
#   FRONTEND REACT (VITE)
# ============================

# Étape 1 : Build avec Node
FROM node:20-alpine AS build

WORKDIR /app

# Copier uniquement les fichiers de dépendances pour tirer parti du cache Docker
COPY package*.json ./
COPY tsconfig*.json ./
COPY vite.config.ts .
COPY tailwind.config.ts .
COPY postcss.config.js .
COPY package-lock.json .

# Installer les dépendances
RUN npm install

COPY . .

RUN npm run build

EXPOSE 8080

# Sert le build avec le serveur intégré de Vite
CMD ["npm", "start"]
