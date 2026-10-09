import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, KeyRound, Search, Loader2, ShieldCheck, User, Save } from "lucide-react";
import { pegawaiApi, subbagianApi } from "../../api/master";
import { ModalShell, ConfirmDeleteDialog, Field, inputCls, btnPrimary, btnGhost } from "./MasterHelpers";

const emptyForm = () => ({
  nip: "",
  name: "",
  jabatan: "",
  subbag_id: "",
  role: "pegawai",
  is_active: true,
  password: "",
  permissions: { surat_edit: false, surat_delete: false, surat_approve: false },
});

function PegawaiFormModal({ open, initial, subbags, onClose, onSaved }) {
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState(emptyForm());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(initial ? {
      nip: initial.nip,
      name: initial.name,
      jabatan: initial.jabatan || "",
      subbag_id: initial.subbag_id || "",
      role: initial.role || "pegawai",
      is_active: initial.is_active !== false,
      password: "",
      permissions: {
        surat_edit: !!initial.permissions?.surat_edit,
        surat_delete: !!initial.permissions?.surat_delete,
        surat_approve: !!initial.permissions?.surat_approve,
      },
    } : emptyForm());
  }, [open, initial]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    const err = {};
    if (!form.nip.trim()) err.nip = "NIP wajib diisi";
    else if (form.nip.trim().length < 3) err.nip = "NIP minimal 3 karakter";
    if (!form.name.trim()) err.name = "Nama wajib diisi";
    if (!isEdit && !form.password) err.password = "Password wajib diisi (min. 6 karakter)";
    if (form.password && form.password.length < 6) err.password = "Password minimal 6 karakter";
    setErrors(err);
    if (Object.keys(err).length) return;
    setSaving(true);
    try {
      const payload = {
        nip: form.nip.trim(),
        name: form.name.trim(),
        jabatan: form.jabatan.trim(),
        subbag_id: form.subbag_id || null,
        role: form.role,
        is_active: form.is_active,
        // Gabung dengan izin lain yang sudah ada (mis. akses menu Dokumen Internal)
        // supaya tidak tertimpa - hanya 3 izin surat ini yang diedit dari form ini.
        permissions: { ...(initial?.permissions || {}), ...form.permissions },
      };
      if (!isEdit) payload.password = form.password;
      const saved = isEdit
        ? await pegawaiApi.update(initial.id, payload)
        : await pegawaiApi.create(payload);
      toast.success(isEdit ? "Pegawai diperbarui" : "Pegawai berhasil ditambahkan");
      onSaved(saved);
    } catch (e2) {
      if (e2.status === 409) setErrors((p) => ({ ...p, nip: e2.message }));
      else toast.error(e2.message || "Gagal menyimpan pegawai");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell open={open} title={isEdit ? "Edit Pegawai" : "Tambah Pegawai"} onClose={onClose} testid="pegawai-form-modal">
      <form onSubmit={submit} className="space-y-3">
        <Field label="NIP" required error={errors.nip}>
          <input data-testid="pegawai-field-nip" type="text" value={form.nip} onChange={(e) => set("nip", e.target.value)} className={`${inputCls} font-mono`} placeholder="Contoh: 199502011..." />
        </Field>
        <Field label="Nama Lengkap & Gelar" required error={errors.name}>
          <input data-testid="pegawai-field-name" type="text" value={form.name} onChange={(e) => set("name", e.target.value)} className={inputCls} />
        </Field>
        <Field label="Jabatan">
          <input data-testid="pegawai-field-jabatan" type="text" value={form.jabatan} onChange={(e) => set("jabatan", e.target.value)} className={inputCls} placeholder="Contoh: Staf Administrasi Umum" />
        </Field>
        <Field label="Subbagian">
          <select data-testid="pegawai-field-subbag" value={form.subbag_id || ""} onChange={(e) => set("subbag_id", e.target.value)} className={inputCls}>
            <option value="">— Tanpa Subbagian —</option>
            {subbags.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Role" required>
            <select data-testid="pegawai-field-role" value={form.role} onChange={(e) => set("role", e.target.value)} className={inputCls}>
              <option value="pegawai">Pegawai</option>
              <option value="admin">Admin</option>
            </select>
          </Field>
          <Field label="Status">
            <label className="flex items-center gap-2 h-[38px] px-3 border border-slate-300 rounded-md">
              <input data-testid="pegawai-field-active" type="checkbox" checked={form.is_active} onChange={(e) => set("is_active", e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-red-900 focus:ring-red-900" />
              <span className="text-xs font-medium text-slate-700">Aktif</span>
            </label>
          </Field>
        </div>
        <Field label="Hak Akses Surat Masuk & Surat Keluar">
          <div className="space-y-2 border border-slate-200 rounded-md p-3 bg-slate-50">
            <label className="flex items-center gap-2">
              <input
                data-testid="pegawai-field-perm-surat-edit"
                type="checkbox"
                checked={form.permissions.surat_edit}
                onChange={(e) => set("permissions", { ...form.permissions, surat_edit: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 text-red-900 focus:ring-red-900"
              />
              <span className="text-xs text-slate-700">Boleh <b>edit</b> data surat masuk & keluar (tabel)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                data-testid="pegawai-field-perm-surat-delete"
                type="checkbox"
                checked={form.permissions.surat_delete}
                onChange={(e) => set("permissions", { ...form.permissions, surat_delete: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 text-red-900 focus:ring-red-900"
              />
              <span className="text-xs text-slate-700">Boleh <b>hapus</b> data surat masuk & keluar (tabel)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                data-testid="pegawai-field-perm-surat-approve"
                type="checkbox"
                checked={form.permissions.surat_approve}
                onChange={(e) => set("permissions", { ...form.permissions, surat_approve: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 text-red-900 focus:ring-red-900"
              />
              <span className="text-xs text-slate-700">Boleh <b>approve (srikandi)</b> surat sub-bagiannya sendiri</span>
            </label>
            <p className="text-[11px] text-slate-400 pt-1">
              Izin approve hanya berlaku untuk surat yang disposisinya sama dengan Subbagian pegawai ini di atas.
            </p>
          </div>
        </Field>
        {!isEdit && (
          <Field label="Password Login" required error={errors.password}>
            <input data-testid="pegawai-field-password" type="password" value={form.password} onChange={(e) => set("password", e.target.value)} className={inputCls} placeholder="Minimal 6 karakter" autoComplete="new-password" />
          </Field>
        )}
        <div className="flex justify-end gap-2 pt-3 border-t">
          <button type="button" onClick={onClose} className={btnGhost}>Batal</button>
          <button type="submit" disabled={saving} className={btnPrimary} data-testid="pegawai-modal-submit">
            <Save className="w-3.5 h-3.5 mr-1.5" />
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function ResetPasswordModal({ open, item, onClose, onDone }) {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { if (open) { setPw(""); setErr(""); } }, [open]);
  const submit = async (e) => {
    e.preventDefault();
    if (pw.length < 6) { setErr("Password minimal 6 karakter"); return; }
    setBusy(true);
    try {
      await pegawaiApi.resetPassword(item.id, pw);
      toast.success(`Password ${item.name} berhasil di-reset`);
      onDone();
    } catch (e2) {
      toast.error(e2.message);
    } finally { setBusy(false); }
  };
  return (
    <ModalShell open={open && !!item} title={`Reset Password: ${item?.name || ""}`} onClose={onClose} testid="reset-password-modal">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Password Baru" required error={err}>
          <input data-testid="reset-password-input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} className={inputCls} placeholder="Minimal 6 karakter" autoComplete="new-password" />
        </Field>
        <div className="flex justify-end gap-2 pt-3 border-t">
          <button type="button" onClick={onClose} className={btnGhost}>Batal</button>
          <button type="submit" disabled={busy} className={btnPrimary} data-testid="reset-password-submit">
            <KeyRound className="w-3.5 h-3.5 mr-1.5" />
            {busy ? "Menyimpan..." : "Reset Password"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

export default function PegawaiTab({ isTabActive, showAddModal, setShowAddModal }) {
  const [list, setList] = useState([]);
  const [subbags, setSubbags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("Semua");
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [resetting, setResetting] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [p, s] = await Promise.all([
        pegawaiApi.list({ search: search.trim() || undefined, role: roleFilter === "Semua" ? undefined : roleFilter }),
        subbagianApi.list(),
      ]);
      setList(p);
      setSubbags(s);
    } catch (e) {
      toast.error(e.message || "Gagal memuat pegawai");
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (!isTabActive) return;
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTabActive, search, roleFilter]);

  const filtered = useMemo(() => list, [list]);

  const onSaved = () => { setShowAddModal(false); setEditing(null); load(); };
  const onDeleted = async () => {
    try { await pegawaiApi.remove(deleting.id); toast.success("Pegawai dihapus"); }
    catch (e) { toast.error(e.message); }
    finally { setDeleting(null); load(); }
  };
  const toggleActive = async (p) => {
    try {
      await pegawaiApi.update(p.id, { is_active: !p.is_active });
      toast.success(`Pegawai ${!p.is_active ? "diaktifkan" : "dinonaktifkan"}`);
      load();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div data-testid="pegawai-tab-content" className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative md:col-span-2">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute top-2.5 left-3" />
          <input data-testid="pegawai-search" type="text" placeholder="Cari NIP / nama / jabatan..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-red-900" />
        </div>
        <select data-testid="pegawai-filter-role" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={inputCls}>
          <option value="Semua">Semua Role</option>
          <option value="admin">Admin</option>
          <option value="pegawai">Pegawai</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Daftar Pegawai KPU Kota Banjarmasin</h3>
          <span data-testid="pegawai-count" className="text-[10px] font-semibold text-red-900 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">{filtered.length} pegawai</span>
        </div>
        {loading ? (
          <div className="py-10 text-center text-slate-400 text-xs"><Loader2 className="w-4 h-4 animate-spin inline-block mr-2" />Memuat...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">NIP & Nama</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Jabatan</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Subbagian</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Role</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100 text-xs">
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400 italic">Belum ada pegawai.</td></tr>
                )}
                {filtered.map((p) => (
                  <tr key={p.id} data-testid={`pegawai-row-${p.nip}`} className={`hover:bg-slate-50 ${!p.is_active ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{p.name}</div>
                      <div className="text-slate-400 font-mono text-[11px] mt-0.5">{p.nip}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{p.jabatan || "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{p.subbag_name || "-"}</td>
                    <td className="px-4 py-3 text-center">
                      {p.role === "admin" ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-red-50 text-red-900 border border-red-200">
                          <ShieldCheck className="w-3 h-3 mr-1" />Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          <User className="w-3 h-3 mr-1" />Pegawai
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button data-testid={`pegawai-toggle-${p.nip}`} onClick={() => toggleActive(p)}
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded border transition-colors ${p.is_active ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100' : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'}`}>
                        {p.is_active ? "Aktif" : "Nonaktif"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button data-testid={`pegawai-reset-pw-${p.nip}`} onClick={() => setResetting(p)} title="Reset password" className="text-slate-500 hover:text-red-900 mr-2 inline-block"><KeyRound className="w-3.5 h-3.5" /></button>
                      <button data-testid={`pegawai-edit-${p.nip}`} onClick={() => setEditing(p)} title="Edit" className="text-slate-600 hover:text-red-900 mr-2 inline-block"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button data-testid={`pegawai-delete-${p.nip}`} onClick={() => setDeleting(p)} title="Hapus" className="text-slate-500 hover:text-red-900 inline-block"><Trash2 className="w-3.5 h-3.5" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PegawaiFormModal open={showAddModal || !!editing} initial={editing} subbags={subbags}
        onClose={() => { setShowAddModal(false); setEditing(null); }} onSaved={onSaved} />
      <ResetPasswordModal open={!!resetting} item={resetting} onClose={() => setResetting(null)} onDone={() => setResetting(null)} />
      <ConfirmDeleteDialog
        open={!!deleting} title="Hapus Pegawai?"
        message="Data pegawai akan dihapus permanen. Admin terakhir tidak dapat dihapus."
        item={deleting ? { NIP: deleting.nip, Nama: deleting.name, Role: deleting.role } : null}
        onClose={() => setDeleting(null)} onConfirm={onDeleted} />
    </div>
  );
}
