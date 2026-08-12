# frontend/Dockerfile

# Étape 1 : Build avec Node
FROM node:18-alpine AS build
WORKDIR /app

# Copier les fichiers package.json d'abord
COPY frontend/package*.json ./

# Installer les dépendances
RUN npm ci

# Copier le reste du code frontend
COPY frontend/ ./

# Corriger les permissions pour node_modules/.bin
RUN chmod +x ./node_modules/.bin/*

# Build avec augmentation de la mémoire
RUN NODE_OPTIONS="--max-old-space-size=4096" npm run build

# Étape 2 : Serve avec nginx
FROM nginx:stable-alpine

# Copier votre configuration nginx corrigée
COPY nginx-1.27.4/conf/nginx.conf /etc/nginx/nginx.conf

# Copier les fichiers build
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
