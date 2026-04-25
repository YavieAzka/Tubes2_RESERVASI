# Tubes2_RESERVASI

> Tugas Besar 2 IF2211 Strategi Algoritma — Semester II 2025/2026  
> **Pemanfaatan Algoritma BFS dan DFS dalam Mekanisme Penelusuran CSS pada Pohon Document Object Model**

---

## Deskripsi Singkat

Aplikasi web berbasis **Next.js + TypeScript** yang melakukan penelusuran elemen HTML pada struktur pohon **Document Object Model (DOM)** menggunakan algoritma **Breadth-First Search (BFS)** dan **Depth-First Search (DFS)** berdasarkan CSS Selector yang diberikan pengguna.

---

## Algoritma

### Breadth-First Search (BFS)
BFS menelusuri pohon DOM secara **melebar** (level by level). Dimulai dari node root, algoritma mengunjungi semua node pada kedalaman yang sama sebelum berpindah ke kedalaman berikutnya. BFS menggunakan struktur data **queue (antrian)** untuk menyimpan node yang akan dikunjungi. Algoritma ini cocok digunakan ketika hasil yang diinginkan berada dekat dengan root, karena BFS menjamin jalur terpendek dalam hal jumlah edge.

### Depth-First Search (DFS)
DFS menelusuri pohon DOM secara **mendalam** (node demi node hingga daun) sebelum kembali dan menelusuri cabang lainnya. DFS menggunakan struktur data **stack** (atau rekursi) untuk menyimpan node yang akan dikunjungi. Algoritma ini cocok digunakan ketika hasil yang diinginkan berada jauh di dalam struktur pohon, karena DFS langsung menuju kedalaman maksimum sebelum mengeksplorasi cabang lain.

---

## Fitur Aplikasi

- Input URL website atau teks HTML secara langsung
- Pilihan algoritma traversal: **BFS** atau **DFS**
- Input CSS Selector (tag, class, id, universal, combinator)
- Pilihan jumlah hasil: top-n atau semua kemunculan
- Visualisasi pohon DOM beserta kedalaman maksimum
- Highlight jalur traversal algoritma
- Informasi waktu pencarian dan jumlah node yang dikunjungi
- Penyimpanan **traversal log** dari setiap sesi pencarian

---

## Tech Stack

| Komponen | Teknologi |
|---|---|
| Frontend | Next.js 15, TypeScript, Tailwind CSS |
| Backend | Next.js API Routes (TypeScript) |
| Containerization | Docker |
| Deployment | Microsoft Azure App Service |

---

## Requirement

- **Node.js** v20 atau lebih baru
- **npm** v9 atau lebih baru
- **Docker** (opsional, untuk menjalankan via container)

---

## Instalasi & Menjalankan Aplikasi

### Cara 1 — Tanpa Docker (Development)

```bash
# 1. Clone repository
git clone https://github.com/<username>/Tubes2_RESERVASI.git
cd Tubes2_RESERVASI/reservasi-web

# 2. Install dependensi
npm install

# 3. Jalankan aplikasi
npm run dev
```

Aplikasi dapat diakses di `http://localhost:3000`

---

### Cara 2 — Dengan Docker

```bash
# 1. Clone repository
git clone https://github.com/<username>/Tubes2_RESERVASI.git
cd Tubes2_RESERVASI/reservasi-web

# 2. Build Docker image
docker build -t reservasi-web .

# 3. Jalankan container
docker run -p 3000:3000 reservasi-web
```

Aplikasi dapat diakses di `http://localhost:3000`

Atau menggunakan Docker Compose:

```bash
docker compose up
```

---

### Cara 3 — Build untuk Production

```bash
# Build aplikasi
npm run build

# Jalankan hasil build
npm start
```

---

## Akses Aplikasi (Deployed)

Aplikasi telah di-deploy dan dapat diakses secara publik di:

```
https://tubes2-reservasi.azurewebsites.net
```

---

## Checklist Spesifikasi

| No | Poin | Ya | Tidak |
|---|---|---|---|
| 1 | Aplikasi berhasil di kompilasi tanpa kesalahan | ✓ | |
| 2 | Aplikasi berhasil dijalankan | ✓ | |
| 3 | Aplikasi dapat menerima input URL web, pilihan algoritma, CSS selector, dan jumlah hasil | ✓ | |
| 4 | Aplikasi dapat melakukan scraping terhadap web pada input | ✓ | |
| 5 | Aplikasi dapat menampilkan visualisasi pohon DOM | ✓ | |
| 6 | Aplikasi dapat menelusuri pohon DOM dan menampilkan hasil penelusuran | ✓ | |
| 7 | Aplikasi dapat menandai jalur tempuh oleh algoritma | ✓ | |
| 8 | Aplikasi dapat menyimpan jalur yang ditempuh algoritma dalam traversal log | ✓ | |
| 9 | [Bonus] Membuat video | ✓ | |
| 10 | [Bonus] Deploy aplikasi | ✓ | |
| 11 | [Bonus] Implementasi animasi pada penelusuran pohon | ✓ | |
| 12 | [Bonus] Implementasi multithreading | | ✓ |
| 13 | [Bonus] Implementasi LCA Binary Lifting |  ✓| |

> Sesuaikan checklist di atas dengan fitur yang sudah diimplementasikan.

---

## Author

| Nama | NIM |
|---|---|
| Yavie Azka Putra Araly | 13524077 |
| Angelina Andra Alanna | 13524079 |
| Kholida Rezki Khoiriah | 13222071 |
