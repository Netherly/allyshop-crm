# Backend: Express + Prisma
FROM node:22-alpine

WORKDIR /app

# Зависимости отдельным слоем для кэша
COPY package.json package-lock.json* ./
RUN npm install

# Исходники
COPY . .

# Генерация Prisma Client
RUN npx prisma generate

EXPOSE 4000

CMD ["npm", "run", "dev"]
