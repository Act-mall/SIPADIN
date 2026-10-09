import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, Save, Loader2, Building } from "lucide-react";
import { subbagianApi } from "../../api/master";
import { ModalShell, ConfirmDeleteDialog, Field, inputCls, btnPrimary, btnGhost } from "./MasterHelpers";

const empty = () => ({ code: "", name: "", kepala: "", angka: "", deskripsi: "" });

function SubbagianForm({ open, initial, onClose, onSaved }) {
  const isEdit = !!initial?.id;
  const [form, setForm] = useState(empty());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(initial ? { code: initial.code, name: initial.name, kepala: initial.kepala || "", angka: initial.angka ?? "", deskripsi: initial.deskripsi || "" } : empty());
  }, [open, initial]);
  const submit = async (e) => {
    e.preventDefault();
    const err = {};
    if (!form.code.trim()) err.code = "Kode wajib diisi";
    if (!form.name.trim()) err.name = "Nama wajib diisi";
    setErrors(err);
    if (Object.keys(err).length) return;
    setSaving(true);
    try {
      const payload = { ...form, angka: form.angka === "" ? null : Number(form.angka) };
      const saved = isEdit ? await subbagianApi.update(initial.id, payload) : await subbagianApi.create(payload);
      toast.success(isEdit ? "Subbagian diperbarui" : "Subbagian ditambahkan");
      onSaved(saved);
    } catch (e2) {
      if (e2.status === 409) setErrors((p) => (String(e2.message).includes("Angka") ? { ...p, angka: e2.message } : { ...p, code: e2.message }));
      else toast.error(e2.message);
    } finally { setSaving(false); }
  };
  return (
    <ModalShell open={open} title={isEdit ? "Edit Subbagian" : "Tambah Subbagian"} onClose={onClose} testid="subbagian-form-modal">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Kode" required error={errors.code}>
          <input data-testid="subbagian-field-code" type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className={`${inputCls} font-mono`} placeholder="Contoh: SUB-KUL" />
        </Field>
        <Field label="Nama Subbagian" required error={errors.name}>
          <input data-testid="subbagian-field-name" type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="Contoh: Subbagian Keuangan, Umum dan Logistik" />
        </Field>
        <Field label="Kepala">
          <input data-testid="subbagian-field-kepala" type="text" value={form.kepala} onChange={(e) => setForm({ ...form, kepala: e.target.value })} className={inputCls} placeholder="Nama kepala subbagian" />
        </Field>
        <Field label="Angka di Nomor Surat" error={errors.angka}>
          <input data-testid="subbagian-field-angka" type="number" min="1" step="1" value={form.angka} onChange={(e) => setForm({ ...form, angka: e.target.value })} className={inputCls} placeholder="Contoh: 1 (kosongkan jika tanpa angka)" />
          <p className="text-[10px] text-slate-400 mt-1">Angka ini masuk ke nomor surat dan menentukan urutan di dropdown.</p>
        </Field>
        <Field label="Deskripsi Arsip">
          <textarea data-testid="subbagian-field-deskripsi" rows={2} value={form.deskripsi} onChange={(e) => setForm({ ...form, deskripsi: e.target.value })} className={inputCls} placeholder="Contoh: Laporan anggaran, SPJ, dan pengadaan barang (tampil di menu Arsip)" />
        </Field>  
        <div className="flex justify-end gap-2 pt-3 border-t">
          <button type="button" onClick={onClose} className={btnGhost}>Batal</button>
          <button type="submit" disabled={saving} className={btnPrimary} data-testid="subbagian-modal-submit">
            <Save className="w-3.5 h-3.5 mr-1.5" />{saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

export default function SubbagianTab({ isTabActive, showAddModal, setShowAddModal }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const load = async () => {
    setLoading(true);
    try { setList(await subbagianApi.list()); }
    catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (isTabActive) load(); }, [isTabActive]);

  const onSaved = () => { setShowAddModal(false); setEditing(null); load(); };
  const doDelete = async () => {
    try { await subbagianApi.remove(deleting.id); toast.success("Subbagian dihapus"); }
    catch (e) { toast.error(e.message); }
    finally { setDeleting(null); load(); }
  };

  return (
    <div data-testid="subbagian-tab-content" className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Daftar Subbagian</h3>
          <span data-testid="subbagian-count" className="text-[10px] font-semibold text-red-900 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">{list.length} data</span>
        </div>
        {loading ? (
          <div className="py-10 text-center text-slate-400 text-xs"><Loader2 className="w-4 h-4 animate-spin inline-block mr-2" />Memuat...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5">
            {list.length === 0 && <div className="col-span-full text-center text-slate-400 italic text-xs py-8">Belum ada subbagian.</div>}
            {list.map((s) => (
              <div key={s.id} data-testid={`subbagian-card-${s.code}`} className="border border-slate-200 rounded-lg p-4 hover:border-red-200 transition-colors flex flex-col">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-[10px] font-mono font-bold text-red-900 bg-red-50 border border-red-200 rounded px-2 py-0.5">{s.code}</span>
                  <div className="flex gap-2">
                    <button data-testid={`subbagian-edit-${s.code}`} onClick={() => setEditing(s)} className="text-slate-500 hover:text-red-900" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button data-testid={`subbagian-delete-${s.code}`} onClick={() => setDeleting(s)} className="text-slate-500 hover:text-red-900" title="Hapus"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                <h4 className="text-sm font-bold text-slate-900 mb-1">{s.name}</h4>
                {s.kepala && <p className="text-[11px] text-slate-500">Kepala: <span className="font-medium text-slate-700">{s.kepala}</span></p>}
                <p className="text-[11px] text-slate-500">Angka nomor surat: <span className="font-medium text-slate-700">{s.angka ?? "-"}</span></p>
                <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] flex items-center justify-between font-semibold">
                  <span className="text-slate-500 inline-flex items-center gap-1"><Building className="w-3 h-3" />Jumlah Pegawai Aktif</span>
                  <span className="text-red-900">{s.pegawai_count || 0}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <SubbagianForm open={showAddModal || !!editing} initial={editing} onClose={() => { setShowAddModal(false); setEditing(null); }} onSaved={onSaved} />
      <ConfirmDeleteDialog open={!!deleting} title="Hapus Subbagian?"
        message="Subbagian yang masih dipakai pegawai tidak dapat dihapus."
        item={deleting ? { Kode: deleting.code, Nama: deleting.name } : null}
        onClose={() => setDeleting(null)} onConfirm={doDelete} />
    </div>
  );
}
