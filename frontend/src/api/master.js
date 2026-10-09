// Master data API client (pegawai, subbagian, pejabat, wilayah, jenis-naskah).
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

const crud = (path, { unique = "code" } = {}) => ({
  async list(params = {}) {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "" && v !== "Semua") q.set(k, v);
    });
    const res = await fetch(`${API}/${path}?${q.toString()}`, { headers: authHeaders() });
    return handle(res);
  },
  async create(payload) {
    const res = await fetch(`${API}/${path}`, { method: "POST", headers: jsonHeaders(), body: JSON.stringify(payload) });
    return handle(res);
  },
  async update(id, payload) {
    const res = await fetch(`${API}/${path}/${id}`, { method: "PUT", headers: jsonHeaders(), body: JSON.stringify(payload) });
    return handle(res);
  },
  async remove(id) {
    const res = await fetch(`${API}/${path}/${id}`, { method: "DELETE", headers: authHeaders() });
    return handle(res);
  },
  _unique: unique,
});

export const pegawaiApi = {
  ...crud("pegawai"),
  async resetPassword(id, password) {
    const res = await fetch(`${API}/pegawai/${id}/password`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ password }),
    });
    return handle(res);
  },
};
export const subbagianApi = crud("subbagian");
export const pejabatApi = crud("pejabat");
export const wilayahApi = crud("wilayah");
export const jenisNaskahApi = crud("jenis-naskah");
