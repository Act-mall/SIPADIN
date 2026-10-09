import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Edit2, Trash2, Save, Loader2 } from "lucide-react";
import { jenisNaskahApi } from "../../api/master";
import { ModalShell, ConfirmDeleteDialog, Field, inputCls, btnPrimary, btnGhost } from "./MasterHelpers";

const empty = () => ({ kode: "", nama: "", ket: "" });

function NaskahForm({ open, initial, onClose, onSaved }) {
  const isEdit = !!initial?.id;
  const [form, setForm] = useState(empty());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(initial ? { kode: initial.kode, nama: initial.nama, ket: initial.ket || "" } : empty());
  }, [open, initial]);
  const submit = async (e) => {
    e.preventDefault();
    const err = {};
    if (!form.kode.trim()) err.kode = "Kode wajib diisi";
    if (!form.nama.trim()) err.nama = "Nama wajib diisi";
    setErrors(err);
    if (Object.keys(err).length) return;
    setSaving(true);
    try {
      const saved = isEdit ? await jenisNaskahApi.update(initial.id, form) : await jenisNaskahApi.create(form);
      toast.success(isEdit ? "Jenis naskah diperbarui" : "Jenis naskah ditambahkan");
      onSaved(saved);
    } catch (e2) {
      if (e2.status === 409) setErrors((p) => ({ ...p, kode: e2.message }));
      else toast.error(e2.message);
    } finally { setSaving(false); }
  };
  return (
    <ModalShell open={open} title={isEdit ? "Edit Jenis Naskah" : "Tambah Jenis Naskah"} onClose={onClose} testid="naskah-form-modal">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Kode" required error={errors.kode}>
          <input data-testid="naskah-field-kode" type="text" value={form.kode} onChange={(e) => setForm({ ...form, kode: e.target.value })} className={`${inputCls} font-mono`} placeholder="Contoh: ND" />
        </Field>
        <Field label="Nama" required error={errors.nama}>
          <input data-testid="naskah-field-nama" type="text" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} className={inputCls} placeholder="Contoh: Nota Dinas" />
        </Field>
        <Field label="Keterangan">
          <textarea data-testid="naskah-field-ket" rows={2} value={form.ket} onChange={(e) => setForm({ ...form, ket: e.target.value })} className={inputCls} placeholder="Deskripsi jenis naskah..." />
        </Field>
        <div className="flex justify-end gap-2 pt-3 border-t">
          <button type="button" onClick={onClose} className={btnGhost}>Batal</button>
          <button type="submit" disabled={saving} className={btnPrimary} data-testid="naskah-modal-submit">
            <Save className="w-3.5 h-3.5 mr-1.5" />{saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

export default function NaskahTab({ isTabActive, showAddModal, setShowAddModal }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const load = async () => {
    setLoading(true);
    try { setList(await jenisNaskahApi.list()); }
    catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (isTabActive) load(); }, [isTabActive]);
  const onSaved = () => { setShowAddModal(false); setEditing(null); load(); };
  const doDelete = async () => {
    try { await jenisNaskahApi.remove(deleting.id); toast.success("Jenis naskah dihapus"); }
    catch (e) { toast.error(e.message); }
    finally { setDeleting(null); load(); }
  };
  return (
    <div data-testid="naskah-tab-content" className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Daftar Jenis Naskah Dinas</h3>
          <span data-testid="naskah-count" className="text-[10px] font-semibold text-red-900 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">{list.length} data</span>
        </div>
        {loading ? (
          <div className="py-10 text-center text-slate-400 text-xs"><Loader2 className="w-4 h-4 animate-spin inline-block mr-2" />Memuat...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
            {list.length === 0 && <div className="col-span-full text-center text-slate-400 italic text-xs py-8">Belum ada jenis naskah.</div>}
            {list.map((n) => (
              <div key={n.id} data-testid={`naskah-card-${n.kode}`} className="border border-slate-200 rounded-lg p-4 flex flex-col hover:border-red-200 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <span className="font-mono text-[11px] font-bold text-red-900 bg-red-50 border border-red-200 rounded px-2 py-0.5">{n.kode}</span>
                  <div className="flex gap-2">
                    <button onClick={() => setEditing(n)} className="text-slate-500 hover:text-red-900" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setDeleting(n)} className="text-slate-500 hover:text-red-900" title="Hapus"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                <h4 className="text-sm font-bold text-slate-900">{n.nama}</h4>
                {n.ket && <p className="text-[11px] text-slate-500 mt-1">{n.ket}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      <NaskahForm open={showAddModal || !!editing} initial={editing} onClose={() => { setShowAddModal(false); setEditing(null); }} onSaved={onSaved} />
      <ConfirmDeleteDialog open={!!deleting} title="Hapus Jenis Naskah?"
        item={deleting ? { Kode: deleting.kode, Nama: deleting.nama } : null}
        onClose={() => setDeleting(null)} onConfirm={doDelete} />
    </div>
  );
}
