import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Edit2, Trash2, Save, Loader2 } from "lucide-react";
import { pejabatApi } from "../../api/master";
import { ModalShell, ConfirmDeleteDialog, Field, inputCls, btnPrimary, btnGhost } from "./MasterHelpers";

const empty = () => ({ name: "", jabatan: "", tmt: "", is_active: true });

function PejabatForm({ open, initial, onClose, onSaved }) {
  const isEdit = !!initial?.id;
  const [form, setForm] = useState(empty());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(initial ? { name: initial.name, jabatan: initial.jabatan, tmt: initial.tmt || "", is_active: initial.is_active !== false } : empty());
  }, [open, initial]);
  const submit = async (e) => {
    e.preventDefault();
    const err = {};
    if (!form.name.trim()) err.name = "Nama wajib diisi";
    if (!form.jabatan.trim()) err.jabatan = "Jabatan wajib diisi";
    setErrors(err);
    if (Object.keys(err).length) return;
    setSaving(true);
    try {
      const payload = { ...form, tmt: form.tmt || null };
      const saved = isEdit ? await pejabatApi.update(initial.id, payload) : await pejabatApi.create(payload);
      toast.success(isEdit ? "Pejabat diperbarui" : "Pejabat ditambahkan");
      onSaved(saved);
    } catch (e2) { toast.error(e2.message); }
    finally { setSaving(false); }
  };
  return (
    <ModalShell open={open} title={isEdit ? "Edit Pejabat" : "Tambah Pejabat"} onClose={onClose} testid="pejabat-form-modal">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Nama Lengkap & Gelar" required error={errors.name}>
          <input data-testid="pejabat-field-name" type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Jabatan" required error={errors.jabatan}>
          <input data-testid="pejabat-field-jabatan" type="text" value={form.jabatan} onChange={(e) => setForm({ ...form, jabatan: e.target.value })} className={inputCls} placeholder="Contoh: Ketua KPU Kota Banjarmasin" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tanggal Mulai Tugas (TMT)">
            <input data-testid="pejabat-field-tmt" type="date" value={form.tmt} onChange={(e) => setForm({ ...form, tmt: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Status">
            <label className="flex items-center gap-2 h-[38px] px-3 border border-slate-300 rounded-md">
              <input data-testid="pejabat-field-active" type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="w-4 h-4 rounded border-slate-300 text-red-900 focus:ring-red-900" />
              <span className="text-xs font-medium text-slate-700">Aktif</span>
            </label>
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t">
          <button type="button" onClick={onClose} className={btnGhost}>Batal</button>
          <button type="submit" disabled={saving} className={btnPrimary} data-testid="pejabat-modal-submit">
            <Save className="w-3.5 h-3.5 mr-1.5" />{saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

export default function PejabatTab({ isTabActive, showAddModal, setShowAddModal }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const load = async () => {
    setLoading(true);
    try { setList(await pejabatApi.list()); }
    catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (isTabActive) load(); }, [isTabActive]);
  const onSaved = () => { setShowAddModal(false); setEditing(null); load(); };
  const doDelete = async () => {
    try { await pejabatApi.remove(deleting.id); toast.success("Pejabat dihapus"); }
    catch (e) { toast.error(e.message); }
    finally { setDeleting(null); load(); }
  };
  return (
    <div data-testid="pejabat-tab-content" className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Komisioner & Pejabat Struktural</h3>
          <span data-testid="pejabat-count" className="text-[10px] font-semibold text-red-900 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">{list.length} data</span>
        </div>
        {loading ? (
          <div className="py-10 text-center text-slate-400 text-xs"><Loader2 className="w-4 h-4 animate-spin inline-block mr-2" />Memuat...</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {list.length === 0 && <div className="text-center text-slate-400 italic text-xs py-8">Belum ada pejabat.</div>}
            {list.map((p) => (
              <div key={p.id} data-testid={`pejabat-row-${p.id}`} className={`px-6 py-4 flex items-center justify-between hover:bg-slate-50 ${!p.is_active ? 'opacity-60' : ''}`}>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{p.name}</h4>
                  <p className="text-xs text-red-900 font-medium mt-0.5">{p.jabatan}</p>
                  {p.tmt && <span className="text-[10px] text-slate-400 font-mono">TMT: {p.tmt}</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${p.is_active ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                    {p.is_active ? "Aktif" : "Nonaktif"}
                  </span>
                  <button onClick={() => setEditing(p)} className="text-slate-500 hover:text-red-900" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setDeleting(p)} className="text-slate-500 hover:text-red-900" title="Hapus"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <PejabatForm open={showAddModal || !!editing} initial={editing} onClose={() => { setShowAddModal(false); setEditing(null); }} onSaved={onSaved} />
      <ConfirmDeleteDialog open={!!deleting} title="Hapus Pejabat?"
        item={deleting ? { Nama: deleting.name, Jabatan: deleting.jabatan } : null}
        onClose={() => setDeleting(null)} onConfirm={doDelete} />
    </div>
  );
}
