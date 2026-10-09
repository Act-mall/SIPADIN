// Visibilitas kategori Arsip & Dokumen (tampil/sembunyikan oleh admin).
import { authHeaders } from "../context/AuthContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const jsonHeaders = () => ({ "Content-Type": "application/json", ...authHeaders() });

const handle = async (res) => {
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const d = await res.json();
      msg = d.detail || d.message || msg;
    } catch (_e) { /* ignore */ }
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
};

export const arsipVisibilityApi = {
  // Visibilitas efektif untuk pengguna yang sedang login (dipakai sidebar & Dokumen Internal).
  async effective() {
    const res = await fetch(`${API}/arsip-visibility`, { headers: authHeaders() });
    return handle(res);
  },
  // Nilai toggle admin yang sebenarnya (dipakai halaman Hak Akses).
  async getSettings() {
    const res = await fetch(`${API}/arsip-visibility/settings`, { headers: authHeaders() });
    return handle(res);
  },
  async updateSettings(payload) {
    const res = await fetch(`${API}/arsip-visibility/settings`, {
      method: "PUT",
      headers: jsonHeaders(),
      body: JSON.stringify(payload),
    });
    return handle(res);
  },
    // Daftar kategori Arsip = subbagian (nama & urutan dari Master Data), tampil/sembunyi sesuai pengguna ini.
  async kategori() {
    const res = await fetch(`${API}/arsip-kategori`, { headers: authHeaders() });
    return handle(res);
  },
  // Nilai tampil/sembunyi yang tersimpan (halaman Hak Akses, admin).
  async kategoriSettings() {
    const res = await fetch(`${API}/arsip-kategori/settings`, { headers: authHeaders() });
    return handle(res);
  },
  async setKategori(id, tampil) {
    const res = await fetch(`${API}/arsip-kategori/${id}`, {
      method: "PUT",
      headers: jsonHeaders(),
      body: JSON.stringify({ tampil }),
    });
    return handle(res);
  },
};

export default arsipVisibilityApi;