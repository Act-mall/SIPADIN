// Arsip & Dokumen - daftar arsip gabungan (Surat Masuk, Surat Keluar,
// Berita Acara, SK) per kategori subbagian.
import { authHeaders } from "../context/AuthContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const handle = async (res) => {
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const d = await res.json();
      msg = typeof d.detail === "string" ? d.detail : Array.isArray(d.detail) ? d.detail.map((x) => x.msg).join("; ") : d.message || msg;
    } catch (_e) { /* ignore */ }
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return res.json();
};

export const arsipDokumenApi = {
  async list(kategori) {
    const res = await fetch(`${API}/arsip-dokumen?kategori=${encodeURIComponent(kategori)}`, {
      headers: authHeaders(),
    });
    return handle(res);
  },
  fileUrl(filename) {
    return filename ? `${process.env.REACT_APP_BACKEND_URL}/uploads/${filename}` : null;
  },
    // Alamat unduhan langsung: server mengirim berkas sebagai unduhan dengan nama yang rapi.
  unduhUrl(filename, judul) {
    if (!filename) return null;
    const nama = judul ? `?nama=${encodeURIComponent(judul)}` : "";
    return `${API}/arsip-file/${encodeURIComponent(filename)}${nama}`;
  },
    // ---- Folder buatan sendiri ----
  async folders(kategori) {
    const res = await fetch(`${API}/arsip-folder?kategori=${encodeURIComponent(kategori)}`, {
      headers: authHeaders(),
    });
    return handle(res);
  },
  async createFolder(kategori, nama) {
    const res = await fetch(`${API}/arsip-folder`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ kategori, nama }),
    });
    return handle(res);
  },
  async renameFolder(id, nama) {
    const res = await fetch(`${API}/arsip-folder/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ nama }),
    });
    return handle(res);
  },
  async deleteFolder(id) {
    const res = await fetch(`${API}/arsip-folder/${id}`, { method: "DELETE", headers: authHeaders() });
    return handle(res);
  },
  // ---- Dokumen unggahan ----
  async upload(isian, file) {
    const form = new FormData();
    Object.entries(isian).forEach(([k, v]) => form.append(k, v));
    form.append("file", file);
    const res = await fetch(`${API}/arsip-unggahan`, { method: "POST", headers: authHeaders(), body: form });
    return handle(res);
  },
  async updateUpload(id, isian, file) {
    const form = new FormData();
    Object.entries(isian).forEach(([k, v]) => form.append(k, v));
    if (file) form.append("file", file);
    const res = await fetch(`${API}/arsip-unggahan/${id}`, { method: "PUT", headers: authHeaders(), body: form });
    return handle(res);
  },
  async deleteUpload(id) {
    const res = await fetch(`${API}/arsip-unggahan/${id}`, { method: "DELETE", headers: authHeaders() });
    return handle(res);
  },
};

export default arsipDokumenApi;