// Kode subbagian "Teknis Penyelenggaraan Pemilu, Partisipasi dan Hukum".
// Dipakai untuk membatasi akses menu SK dan visibilitas arsip kategori
// Teknis Pemilu & Hukum. Harus SAMA PERSIS dengan kode subbagian di
// Master Data (backend/master.py memakai konstanta yang sama).
export const TEKNIS_HUKUM_SUBBAG_CODE = "SUB-TEKNIS&HUKUM";

// Angka subbagian yang dipasang ke nomor surat (Surat Keluar, Nota Dinas,
// Berita Acara) - segmen ini muncul sebelum Tahun kalau surat punya field
// sub bagian. Kalau kode subbagian di Master Data berubah, perbarui juga
// key di sini.
export const SUBBAG_NOMOR_CODE = {
  "SUB-KUL": "1",
  [TEKNIS_HUKUM_SUBBAG_CODE]: "2",
  "SUB-RENDATIN": "3",
  "SUB-SDM": "4",
};

// Urutan tampil dropdown sub bagian mengikuti urutan angka di atas (KUL, TEKNIS, RENDATIN, SDM).
// Kode yang tidak dikenal ditaruh paling akhir.
export const urutkanSubbag = (list = []) => {
  const urutan = Object.keys(SUBBAG_NOMOR_CODE);
  const idx = (s) => {
    const i = urutan.indexOf(s.code);
    return i === -1 ? urutan.length : i;
  };
  return [...list].sort((a, b) => idx(a) - idx(b));
};