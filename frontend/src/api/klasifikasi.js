// Klasifikasi Arsip API client — single source of truth from backend.
// All UI that needs klasifikasi arsip data MUST use these functions,
// not any hardcoded array.
import { authHeaders } from "../context/AuthContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const adminHeaders = () => ({
  "Content-Type": "application/json",
  ...authHeaders(),
});

const handle = async (res) => {
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      msg = data.detail || data.message || msg;
    } catch (_e) {
      // ignore
    }
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return res.json();
};

export const klasifikasiApi = {
  async list({ kategori, bidang, search, activeOnly = true } = {}) {
    const params = new URLSearchParams();
    if (kategori && kategori !== "Semua") params.set("kategori", kategori);
    if (bidang && bidang !== "Semua") params.set("bidang", bidang);
    if (search) params.set("search", search);
    params.set("active_only", activeOnly ? "true" : "false");
    const res = await fetch(`${API}/klasifikasi-arsip?${params.toString()}`);
    return handle(res);
  },

  async stats() {
    const res = await fetch(`${API}/klasifikasi-arsip/meta/stats`);
    return handle(res);
  },

  async bidangList(kategori) {
    const params = new URLSearchParams();
    if (kategori && kategori !== "Semua") params.set("kategori", kategori);
    const res = await fetch(`${API}/klasifikasi-arsip/meta/bidang?${params.toString()}`);
    return handle(res);
  },

  async create(payload) {
    const res = await fetch(`${API}/klasifikasi-arsip`, {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify(payload),
    });
    return handle(res);
  },

  async update(id, payload) {
    const res = await fetch(`${API}/klasifikasi-arsip/${id}`, {
      method: "PUT",
      headers: adminHeaders(),
      body: JSON.stringify(payload),
    });
    return handle(res);
  },

  async remove(id) {
    const res = await fetch(`${API}/klasifikasi-arsip/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    return handle(res);
  },
};

export default klasifikasiApi;
