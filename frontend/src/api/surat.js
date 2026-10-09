// Surat Masuk & Surat Keluar API client — single source of truth from backend.
// Mirrors the conventions in api/master.js and api/klasifikasi.js.
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

const buildQuery = (params = {}) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  });
  return q.toString();
};

export const suratMasukApi = {
  async list(params = {}) {
    const res = await fetch(`${API}/surat-masuk?${buildQuery(params)}`, { headers: authHeaders() });
    return handle(res);
  },
  async get(id) {
    const res = await fetch(`${API}/surat-masuk/${id}`, { headers: authHeaders() });
    return handle(res);
  },
  async nomorTerpakai() {
    const res = await fetch(`${API}/surat-masuk/nomor-terpakai`, { headers: authHeaders() });
    return handle(res);
  },
  async create(payload) {
    const res = await fetch(`${API}/surat-masuk`, { method: "POST", headers: jsonHeaders(), body: JSON.stringify(payload) });
    return handle(res);
  },
  async update(id, payload) {
    const res = await fetch(`${API}/surat-masuk/${id}`, { method: "PUT", headers: jsonHeaders(), body: JSON.stringify(payload) });
    return handle(res);
  },
  async remove(id) {
    const res = await fetch(`${API}/surat-masuk/${id}`, { method: "DELETE", headers: authHeaders() });
    return handle(res);
  },
  async approve(id) {
    const res = await fetch(`${API}/surat-masuk/${id}/approve`, { method: "POST", headers: authHeaders() });
    return handle(res);
  },
  async unapprove(id) {
    const res = await fetch(`${API}/surat-masuk/${id}/unapprove`, { method: "POST", headers: authHeaders() });
    return handle(res);
  },
  async uploadLampiran(id, file) {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API}/surat-masuk/${id}/lampiran`, {
      method: "POST",
      headers: authHeaders(), // no Content-Type: let the browser set the multipart boundary
      body: form,
    });
    return handle(res);
  },
  lampiranUrl(filename) {
    return filename ? `${process.env.REACT_APP_BACKEND_URL}/uploads/${filename}` : null;
  },
};

export const suratKeluarApi = {
  async list(params = {}) {
    const res = await fetch(`${API}/surat-keluar?${buildQuery(params)}`, { headers: authHeaders() });
    return handle(res);
  },
  async get(id) {
    const res = await fetch(`${API}/surat-keluar/${id}`, { headers: authHeaders() });
    return handle(res);
  },
  async nomorTerpakai() {
    const res = await fetch(`${API}/surat-keluar/nomor-terpakai`, { headers: authHeaders() });
    return handle(res);
  },
  async create(payload) {
    const res = await fetch(`${API}/surat-keluar`, { method: "POST", headers: jsonHeaders(), body: JSON.stringify(payload) });
    return handle(res);
  },
  async update(id, payload) {
    const res = await fetch(`${API}/surat-keluar/${id}`, { method: "PUT", headers: jsonHeaders(), body: JSON.stringify(payload) });
    return handle(res);
  },
  async remove(id) {
    const res = await fetch(`${API}/surat-keluar/${id}`, { method: "DELETE", headers: authHeaders() });
    return handle(res);
  },
  async approve(id) {
    const res = await fetch(`${API}/surat-keluar/${id}/approve`, { method: "POST", headers: authHeaders() });
    return handle(res);
  },
  async unapprove(id) {
    const res = await fetch(`${API}/surat-keluar/${id}/unapprove`, { method: "POST", headers: authHeaders() });
    return handle(res);
  },
  async uploadLampiran(id, file) {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API}/surat-keluar/${id}/lampiran`, {
      method: "POST",
      headers: authHeaders(), // no Content-Type: let the browser set the multipart boundary
      body: form,
    });
    return handle(res);
  },
  lampiranUrl(filename) {
    return filename ? `${process.env.REACT_APP_BACKEND_URL}/uploads/${filename}` : null;
  },
};

export const pejabatPenandatanganApi = {
  async list() {
    const res = await fetch(`${API}/pejabat/penandatangan`, { headers: authHeaders() });
    return handle(res);
  },
};