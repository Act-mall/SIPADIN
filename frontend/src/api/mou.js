// MOU (Nota Kesepahaman) API client — mirrors the conventions in api/surat.js.
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

export const mouApi = {
  async list(params = {}) {
    const res = await fetch(`${API}/mou?${buildQuery(params)}`, { headers: authHeaders() });
    return handle(res);
  },
  async get(id) {
    const res = await fetch(`${API}/mou/${id}`, { headers: authHeaders() });
    return handle(res);
  },
  async nomorTerpakai() {
    const res = await fetch(`${API}/mou/nomor-terpakai`, { headers: authHeaders() });
    return handle(res);
  },
  async create(payload) {
    const res = await fetch(`${API}/mou`, { method: "POST", headers: jsonHeaders(), body: JSON.stringify(payload) });
    return handle(res);
  },
  async update(id, payload) {
    const res = await fetch(`${API}/mou/${id}`, { method: "PUT", headers: jsonHeaders(), body: JSON.stringify(payload) });
    return handle(res);
  },
  async remove(id) {
    const res = await fetch(`${API}/mou/${id}`, { method: "DELETE", headers: authHeaders() });
    return handle(res);
  },
  async uploadLampiran(id, file) {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API}/mou/${id}/lampiran`, {
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

export default mouApi;
