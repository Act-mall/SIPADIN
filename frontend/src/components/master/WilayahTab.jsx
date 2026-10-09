import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Edit2, Trash2, Save, Loader2 } from "lucide-react";
import { wilayahApi } from "../../api/master";
import { ModalShell, ConfirmDeleteDialog, Field, inputCls, btnPrimary, btnGhost } from "./MasterHelpers";

const empty = () => ({ kode: "", kecamatan: "", kelurahan_count: 0 });

function WilayahForm({ open, initial, onClose, onSaved }) {
  const isEdit = !!initial?.id;
  const [form, setForm] = useState(empty());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(initial ? { kode: initial.kode, kecamatan: initial.kecamatan, kelurahan_count: initial.kelurahan_count || 0 } : empty());
  }, [open, initial]);
  const submit = async (e) => {
    e.preventDefault();
    const err = {};
    if (!form.kode.trim()) err.kode = "Kode wajib diisi";
    if (!form.kecamatan.trim()) err.kecamatan = "Kecamatan wajib diisi";
    setErrors(err);
    if (Object.keys(err).length) return;
    setSaving(true);
    try {
      const payload = { ...form, kelurahan_count: Number(form.kelurahan_count) || 0 };
      const saved = isEdit ? await wilayahApi.update(initial.id, payload) : await wilayahApi.create(payload);
      toast.success(isEdit ? "Wilayah diperbarui" : "Wilayah ditambahkan");
      onSaved(saved);
    } catch (e2) {
      if (e2.status === 409) setErrors((p) => ({ ...p, kode: e2.message }));
      else toast.error(e2.message);
    } finally { setSaving(false); }
  };
  return (
    <ModalShell open={open} title={isEdit ? "Edit Kode Wilayah" : "Tambah Kode Wilayah"} onClose={onClose} testid="wilayah-form-modal">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Kode" required error={errors.kode}>
          <input data-testid="wilayah-field-kode" type="text" value={form.kode} onChange={(e) => setForm({ ...form, kode: e.target.value })} className={`${inputCls} font-mono`} placeholder="Contoh: 63.71.01" />
        </Field>
        <Field label="Kecamatan" required error={errors.kecamatan}>
          <input data-testid="wilayah-field-kecamatan" type="text" value={form.kecamatan} onChange={(e) => setForm({ ...form, kecamatan: e.target.value })} className={inputCls} placeholder="Contoh: Banjarmasin Selatan" />
        </Field>
        <Field label="Jumlah Kelurahan">
          <input data-testid="wilayah-field-kelurahan-count" type="number" min="0" value={form.kelurahan_count} onChange={(e) => setForm({ ...form, kelurahan_count: e.target.value })} className={inputCls} />
        </Field>
        <div className="flex justify-end gap-2 pt-3 border-t">
          <button type="button" onClick={onClose} className={btnGhost}>Batal</button>
          <button type="submit" disabled={saving} className={btnPrimary} data-testid="wilayah-modal-submit">
            <Save className="w-3.5 h-3.5 mr-1.5" />{saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

export default function WilayahTab({ isTabActive, showAddModal, setShowAddModal }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const load = async () => {
    setLoading(true);
    try { setList(await wilayahApi.list()); }
    catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (isTabActive) load(); }, [isTabActive]);
  const onSaved = () => { setShowAddModal(false); setEditing(null); load(); };
  const doDelete = async () => {
    try { await wilayahApi.remove(deleting.id); toast.success("Wilayah dihapus"); }
    catch (e) { toast.error(e.message); }
    finally { setDeleting(null); load(); }
  };
  return (
    <div data-testid="wilayah-tab-content" className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Daftar Kode Wilayah</h3>
          <span data-testid="wilayah-count" className="text-[10px] font-semibold text-red-900 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">{list.length} data</span>
        </div>
        {loading ? (
          <div className="py-10 text-center text-slate-400 text-xs"><Loader2 className="w-4 h-4 animate-spin inline-block mr-2" />Memuat...</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {list.length === 0 && <div className="text-center text-slate-400 italic text-xs py-8">Belum ada wilayah.</div>}
            {list.map((w) => (
              <div key={w.id} data-testid={`wilayah-row-${w.kode}`} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50">
                <div className="flex items-center gap-4">
                  <span className="font-mono text-[11px] text-slate-500">{w.kode}</span>
                  <span className="text-sm font-bold text-slate-900">Kecamatan {w.kecamatan}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-slate-600 font-medium">{w.kelurahan_count} Kelurahan</span>
                  <button onClick={() => setEditing(w)} className="text-slate-500 hover:text-red-900" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setDeleting(w)} className="text-slate-500 hover:text-red-900" title="Hapus"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <WilayahForm open={showAddModal || !!editing} initial={editing} onClose={() => { setShowAddModal(false); setEditing(null); }} onSaved={onSaved} />
      <ConfirmDeleteDialog open={!!deleting} title="Hapus Kode Wilayah?"
        item={deleting ? { Kode: deleting.kode, Kecamatan: deleting.kecamatan } : null}
        onClose={() => setDeleting(null)} onConfirm={doDelete} />
    </div>
  );
}
