import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { X, AlertTriangle, Trash2, Save } from "lucide-react";
import { klasifikasiApi } from "../api/klasifikasi";

const inputCls =
  "w-full px-3 py-2 border border-slate-300 rounded-md text-xs bg-white focus:ring-1 focus:ring-red-900 focus:outline-none placeholder-slate-400";

const emptyForm = () => ({
  kategori: "Substantif",
  bidang: "",
  kode: "",
  uraian: "",
  level: 0,
});

export function KlasifikasiFormModal({ open, onClose, onSaved, initial }) {
  const isEdit = Boolean(initial && initial.id);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open) {
      setErrors({});
      if (initial) {
        setForm({
          kategori: initial.kategori,
          bidang: initial.bidang || "",
          kode: initial.kode || "",
          uraian: initial.uraian || "",
          level: initial.level ?? 0,
        });
      } else {
        setForm(emptyForm());
      }
    }
  }, [open, initial]);

  if (!open) return null;

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.kategori) e.kategori = "Kategori wajib dipilih";
    if (!form.kode.trim()) e.kode = "Kode wajib diisi";
    if (!form.uraian.trim()) e.uraian = "Uraian wajib diisi";
    if (!form.bidang.trim()) e.bidang = "Bidang wajib diisi";
    if (form.level === "" || form.level === null || isNaN(Number(form.level)))
      e.level = "Level harus berupa angka";
    else if (Number(form.level) < 0) e.level = "Level tidak boleh negatif";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = { ...form, level: Number(form.level), kode: form.kode.trim() };
      const saved = isEdit
        ? await klasifikasiApi.update(initial.id, payload)
        : await klasifikasiApi.create(payload);
      toast.success(isEdit ? "Klasifikasi berhasil diperbarui" : "Klasifikasi berhasil ditambahkan");
      onSaved(saved);
    } catch (err) {
      if (err.status === 409) {
        setErrors((e) => ({ ...e, kode: err.message }));
        // field-level error already shown; skip toast to avoid duplicate messaging
      } else {
        toast.error(err.message || "Gagal menyimpan klasifikasi");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      data-testid="klasifikasi-form-modal"
      className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4"
    >
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="text-base font-bold text-slate-900">
            {isEdit ? "Edit Klasifikasi Arsip" : "Tambah Klasifikasi Arsip"}
          </h3>
          <button
            data-testid="klasifikasi-modal-close"
            onClick={onClose}
            type="button"
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Kategori <span className="text-red-800">*</span>
            </label>
            <select
              data-testid="klasifikasi-field-kategori"
              value={form.kategori}
              onChange={(e) => setField("kategori", e.target.value)}
              className={inputCls}
            >
              <option value="Substantif">Substantif</option>
              <option value="Fasilitatif">Fasilitatif</option>
            </select>
            {errors.kategori && <p className="text-[11px] text-red-800 mt-1">{errors.kategori}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Bidang <span className="text-red-800">*</span>
            </label>
            <input
              data-testid="klasifikasi-field-bidang"
              type="text"
              value={form.bidang}
              onChange={(e) => setField("bidang", e.target.value)}
              placeholder="Contoh: PP - Persiapan Pemilu atau Pemilihan"
              className={inputCls}
            />
            {errors.bidang && <p className="text-[11px] text-red-800 mt-1">{errors.bidang}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Kode <span className="text-red-800">*</span>
              </label>
              <input
                data-testid="klasifikasi-field-kode"
                type="text"
                value={form.kode}
                onChange={(e) => setField("kode", e.target.value)}
                placeholder="Contoh: PP.01.1"
                className={`${inputCls} font-mono`}
              />
              {errors.kode && <p className="text-[11px] text-red-800 mt-1">{errors.kode}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Level <span className="text-red-800">*</span>
              </label>
              <input
                data-testid="klasifikasi-field-level"
                type="number"
                min="0"
                max="10"
                value={form.level}
                onChange={(e) => setField("level", e.target.value)}
                className={inputCls}
              />
              {errors.level && <p className="text-[11px] text-red-800 mt-1">{errors.level}</p>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Uraian <span className="text-red-800">*</span>
            </label>
            <textarea
              data-testid="klasifikasi-field-uraian"
              rows={3}
              value={form.uraian}
              onChange={(e) => setField("uraian", e.target.value)}
              placeholder="Deskripsi lengkap klasifikasi..."
              className={inputCls}
            />
            {errors.uraian && <p className="text-[11px] text-red-800 mt-1">{errors.uraian}</p>}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              data-testid="klasifikasi-modal-cancel"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md text-xs font-medium hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              data-testid="klasifikasi-modal-submit"
              className="inline-flex items-center px-4 py-2 bg-red-900 text-white rounded-md text-xs font-semibold hover:bg-red-800 disabled:opacity-60"
            >
              <Save className="w-3.5 h-3.5 mr-1.5" />
              {saving ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Simpan Klasifikasi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function KlasifikasiDeleteModal({ open, item, onClose, onDeleted }) {
  const [busy, setBusy] = useState(false);
  if (!open || !item) return null;

  const handleDelete = async () => {
    setBusy(true);
    try {
      const res = await klasifikasiApi.remove(item.id);
      if (res.status === "soft_deleted") {
        toast.warning(res.message);
      } else {
        toast.success(res.message || "Klasifikasi berhasil dihapus");
      }
      onDeleted(res);
    } catch (err) {
      toast.error(err.message || "Gagal menghapus klasifikasi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-testid="klasifikasi-delete-modal"
      className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4"
    >
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-800" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Hapus Klasifikasi Arsip?</h3>
            <p className="text-xs text-slate-500 mt-1">
              Apakah Anda yakin ingin menghapus klasifikasi ini? Jika sudah digunakan pada surat/arsip, sistem otomatis akan menonaktifkan (soft delete).
            </p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1">
          <div>
            <span className="text-slate-500">Kode:</span>{" "}
            <span className="font-mono font-bold text-slate-900">{item.kode}</span>
          </div>
          <div>
            <span className="text-slate-500">Kategori:</span>{" "}
            <span className="font-semibold text-slate-900">{item.kategori}</span>
          </div>
          <div>
            <span className="text-slate-500">Uraian:</span>{" "}
            <span className="text-slate-800">{item.uraian}</span>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            data-testid="klasifikasi-delete-cancel"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md text-xs font-medium hover:bg-slate-50"
          >
            Batal
          </button>
          <button
            type="button"
            data-testid="klasifikasi-delete-confirm"
            onClick={handleDelete}
            disabled={busy}
            className="inline-flex items-center px-4 py-2 bg-red-900 text-white rounded-md text-xs font-semibold hover:bg-red-800 disabled:opacity-60"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            {busy ? "Menghapus..." : "Ya, Hapus"}
          </button>
        </div>
      </div>
    </div>
  );
}
