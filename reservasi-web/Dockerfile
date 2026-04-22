# 1. Gunakan base image Node.js versi 18 yang ringan (Alpine Linux)
FROM node:20-alpine

# 2. Tentukan direktori kerja di dalam container
WORKDIR /app

# 3. Salin file package.json dan package-lock.json terlebih dahulu
COPY package*.json ./

# 4. Instal semua dependensi aplikasi
RUN npm install

# 5. Salin seluruh sisa source code dari komputer lokal ke dalam container
COPY . .

# 6. Jalankan proses build Next.js
RUN npm run build

# 7. Beri tahu Docker bahwa aplikasi ini akan berjalan di port 3000
EXPOSE 3000

# 8. Perintah utama untuk menjalankan aplikasi saat container dinyalakan
CMD ["npm", "start"]