// Surat Tugas & SPD API client — mengikuti pola api/beritaAcara.js.
import { authHeaders } from "../context/AuthContext";

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND}/api`;

const jsonHeaders = () => ({ "Content-Type": "application/json", ...authHeaders() });

// "detail" dari FastAPI bisa berupa teks atau daftar kesalahan validasi (422).
const pesanError = (d, status) => {
  if (d && typeof d.detail === "string") return d.detail;
  if (d && Array.isArray(d.detail)) {
    return d.detail
      .map((x) => (x && x.msg ? `${(x.loc || []).slice(1).join(".")} ${x.msg}`.trim() : String(x)))
      .join("; ");
  }
  return (d && d.message) || `HTTP ${status}`;
};

const handle = async (res) => {
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const d = await res.json();
      msg = pesanError(d, res.status);
    } catch (_e) {
      /* abaikan */
    }
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
};

const berkasUrl = (stored) => (stored ? `${BACKEND}/uploads/${stored}` : null);

// Bentuk berkas untuk tampilan: { name, size, url, existing: true } atau null.
const berkasUi = (stored, name, size) =>
  stored ? { name: name || "berkas", size: size || 0, url: berkasUrl(stored), existing: true } : null;

// Data dari server -> bentuk yang dipakai halaman.
// namaKey: "pejabatList" (halaman Ketua) atau "pegawaiList" (halaman Sekretaris).
const toUi = (it, namaKey) => ({
  ...it,
  [namaKey]: it.namaList || [],
  fileLaporan: berkasUi(it.laporanFile, it.laporanFileName, it.laporanFileSize),
  fileTandaTerima: berkasUi(it.tandaTerimaFile, it.tandaTerimaFileName, it.tandaTerimaFileSize),
});

const uploadBerkas = async (id, jenis, file) => {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API}/surat-tugas/${id}/berkas/${jenis}`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
  return handle(res);
};

const hapusBerkas = async (id, jenis) => {
  const res = await fetch(`${API}/surat-tugas/${id}/berkas/${jenis}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return handle(res);
};

export const suratTugasApi = {
  async list(bagian, namaKey) {
    const q = bagian ? `?bagian=${encodeURIComponent(bagian)}` : "";
    const res = await fetch(`${API}/surat-tugas${q}`, { headers: authHeaders() });
    const items = await handle(res);
    return items.map((it) => toUi(it, namaKey));
  },

  // Simpan data (baru kalau id kosong, ubah kalau ada id) lalu sinkronkan dua berkasnya:
  //  - File baru dipilih            -> diunggah
  //  - Berkas lama dibuang di form  -> dihapus dari server
  //  - Berkas lama dibiarkan        -> tidak diubah
  // Kalau data tersimpan tapi berkas gagal, kegagalannya dikembalikan di "gagal".
  async save(id, payload, files = {}) {
    const res = await fetch(id ? `${API}/surat-tugas/${id}` : `${API}/surat-tugas`, {
      method: id ? "PUT" : "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(payload),
    });
    const saved = await handle(res);

    const gagal = [];
    const daftar = [
      ["laporan", files.laporan, saved.laporanFile],
      ["tanda-terima", files.tandaTerima, saved.tandaTerimaFile],
    ];
    for (const [jenis, file, sudahAda] of daftar) {
      try {
        if (file instanceof File) await uploadBerkas(saved.id, jenis, file);
        else if (!file && sudahAda) await hapusBerkas(saved.id, jenis);
      } catch (e) {
        gagal.push(e.message || `Gagal memproses berkas ${jenis}`);
      }
    }
    return { saved, gagal };
  },

  async remove(id) {
    const res = await fetch(`${API}/surat-tugas/${id}`, { method: "DELETE", headers: authHeaders() });
    return handle(res);
  },
};

export const spdApi = {
  async list(bagian) {
    const q = bagian ? `?bagian=${encodeURIComponent(bagian)}` : "";
    const res = await fetch(`${API}/spd${q}`, { headers: authHeaders() });
    return handle(res);
  },

  // Tambah satu atau beberapa SPD sekaligus. Semuanya tersimpan atau tidak sama sekali.
  async createBatch(items) {
    const res = await fetch(`${API}/spd/batch`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ items }),
    });
    return handle(res);
  },

  async update(id, payload) {
    const res = await fetch(`${API}/spd/${id}`, {
      method: "PUT",
      headers: jsonHeaders(),
      body: JSON.stringify(payload),
    });
    return handle(res);
  },

  async remove(id) {
    const res = await fetch(`${API}/spd/${id}`, { method: "DELETE", headers: authHeaders() });
    return handle(res);
  },
};