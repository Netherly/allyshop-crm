# Backend: Express + Prisma
FROM node:22-alpine

WORKDIR /app

# Зависимости отдельным слоем для кэша.
# Схему Prisma копируем ДО install — postinstall (prisma generate) её ищет.
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm install

# Исходники
COPY . .

EXPOSE 4000

CMD ["npm", "run", "dev"]
