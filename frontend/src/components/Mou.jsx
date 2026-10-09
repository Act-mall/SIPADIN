import React, { useEffect, useMemo, useState } from "react";
import { AppLayout } from "./AppLayout";
import { mouApi } from "../api/mou";
import {
  Handshake,
  AlertTriangle,
  Hash,
  Search,
  RotateCcw,
  Save,
  ChevronDown,
  ChevronUp,
  FileText,
  Calendar,
  Building2,
  UploadCloud,
  Paperclip,
  ExternalLink,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

const CURRENT_YEAR = new Date().getFullYear();

// Menyusun nomor MOU otomatis: "{noUrut} TAHUN {tahun}", tahun diambil langsung dari field Tanggal.
const buildNomorMou = ({ noUrut, tanggal }) => {
  if (!noUrut || !tanggal) return "";
  const tahun = new Date(tanggal).getFullYear();
  if (!tahun || Number.isNaN(tahun)) return "";
  return `${noUrut} TAHUN ${tahun}`;
};

const emptyForm = () => ({
  noUrut: "",
  tanggal: new Date().toISOString().split("T")[0],
  perihal: "",
  instansi: "",
  lampiranFileName: "",
  rawFile: null,
});

const formatTgl = (iso) => {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  } catch (_e) {
    return iso;
  }
};

const Field = ({ label, required, children, testid }) => (
  <div data-testid={testid} className="space-y-1">
    <label className="block text-xs font-medium text-slate-700">
      {label}
      {required && <span className="text-red-800 ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

const inputCls =
  "w-full px-3 py-2 border border-slate-300 rounded-md text-xs bg-white focus:ring-1 focus:ring-red-900 focus:outline-none placeholder-slate-400";

// No Urut - boleh melompat, tapi diberi peringatan kalau bentrok dengan nomor lain di tahun yang sama.
const NomorUrutPicker = ({ value, onChange, taken, inputCls }) => {
  const takenSet = useMemo(() => new Set(taken), [taken]);
  const isTaken = value !== "" && takenSet.has(Number(value));
  const suggestion = useMemo(() => {
    let n = 1;
    while (takenSet.has(n)) n += 1;
    return n;
  }, [takenSet]);
  return (
    <div className="space-y-1">
      <input
        data-testid="form-no-urut"
        type="number"
        min="1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Contoh: ${suggestion}`}
        className={`${inputCls} ${isTaken ? "border-red-500 focus:ring-red-500" : ""}`}
      />
      {isTaken ? (
        <p className="text-[10px] text-red-700">
          Nomor {value} sudah dipakai. Nomor {suggestion} masih kosong.
        </p>
      ) : (
        <p className="text-[10px] text-slate-400">Boleh melompati nomor. Nomor berikut yang masih kosong: {suggestion}.</p>
      )}
    </div>
  );
};

export default function MOU() {
  const [dataList, setDataList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  // Filter Tahun di tabel - murni untuk menyaring tampilan, tahun diambil dari Tanggal tiap data.
  const [filterTahun, setFilterTahun] = useState(String(new Date().getFullYear()));

  // Tahun untuk No Urut & nomor otomatis diambil langsung dari field Tanggal yang sedang diisi.
  const formYear = useMemo(() => {
    const y = new Date(form.tanggal).getFullYear();
    return Number.isNaN(y) ? CURRENT_YEAR : y;
  }, [form.tanggal]);
  
  // Tabel ikut tahun dari Tanggal di form.
  useEffect(() => {
    setFilterTahun(String(formYear));
  }, [formYear]);

  // Pilihan tahun: semua tahun yang ada datanya + tahun berjalan + tahun di form, terbaru dulu.
  const yearOptions = useMemo(() => {
    const set = new Set([CURRENT_YEAR, formYear]);
    dataList.forEach((it) => {
      const y = Number((it.tanggal || "").slice(0, 4));
      if (y) set.add(y);
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [dataList, formYear]);

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await mouApi.list();
      setDataList(list);
    } catch (e) {
      toast.error(e.message || "Gagal memuat data MOU dari server");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleReset = () => {
    setForm(emptyForm());
    setEditingId(null);
    toast.info("Form telah direset");
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setForm((f) => ({ ...f, lampiranFileName: file.name, rawFile: file }));
  };

  const handleEdit = (it) => {
    setEditingId(it.id);
    setForm({
      noUrut: it.noUrut,
      tanggal: it.tanggal,
      perihal: it.perihal,
      instansi: it.instansi,
      lampiranFileName: "",
      rawFile: null,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (it) => {
    if (!window.confirm(`Hapus data MOU nomor ${it.nomorMou}?`)) return;
    try {
      await mouApi.remove(it.id);
      toast.success("Data MOU berhasil dihapus");
      await loadData();
    } catch (e) {
      toast.error(e.message || "Gagal menghapus data MOU");
    }
  };

  // No Urut yang sudah dipakai pada tahun dari Tanggal yang sedang diisi (nomor kembali ke 1 tiap tahun).
  const nomorTerpakai = useMemo(
    () => dataList.filter((it) => (it.tanggal || "").startsWith(`${formYear}`) && it.id !== editingId).map((it) => it.noUrut),
    [dataList, formYear, editingId],
  );

  const generatedNomor = useMemo(() => buildNomorMou(form), [form]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const required = ["noUrut", "tanggal", "perihal", "instansi"];
    for (const k of required) {
      if (!form[k]) {
        toast.error("Mohon lengkapi seluruh field yang wajib diisi");
        return;
      }
    }
    const nomorMou = buildNomorMou(form);
    if (!nomorMou) {
      toast.error("Nomor MOU belum bisa dibentuk, pastikan No Urut & Tanggal sudah terisi");
      return;
    }
    // Tahun dari Tanggal yang diisi bukan tahun berjalan (susulan/arsip lama) -> minta konfirmasi dulu.
    if (!editingId && formYear !== CURRENT_YEAR) {
      const ok = window.confirm(
        `Tanggal yang Anda isi berada di tahun ${formYear}, bukan tahun berjalan (${CURRENT_YEAR}). Lanjutkan menyimpan?`,
      );
      if (!ok) return;
    }
    setSubmitting(true);
    try {
      const payload = {
        noUrut: Number(form.noUrut),
        tanggal: form.tanggal,
        perihal: form.perihal,
        instansi: form.instansi,
      };
      let saved;
      if (editingId) {
        saved = await mouApi.update(editingId, payload);
        toast.success("Data MOU berhasil diperbarui");
      } else {
        saved = await mouApi.create(payload);
        toast.success("Data MOU berhasil disimpan");
      }
      if (form.rawFile) {
        try {
          await mouApi.uploadLampiran(saved.id, form.rawFile);
        } catch (e) {
          toast.error(e.message || "Data tersimpan, tapi gagal mengunggah lampiran");
        }
      }
      setForm(emptyForm());
      setEditingId(null);
      await loadData();
    } catch (e) {
      toast.error(e.message || "Gagal menyimpan data MOU");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return dataList
      .filter((it) => {
        if (filterTahun !== "Semua" && !(it.tanggal || "").startsWith(`${filterTahun}`)) return false;
        if (!q) return true;
        const hay = `${it.nomorMou} ${it.perihal} ${it.instansi}`.toLowerCase();
        return hay.includes(q);
      })
      // Urut naik berdasarkan No Urut, supaya lompatan nomor tetap tampil sesuai urutan angkanya.
      .sort((a, b) => Number(a.noUrut) - Number(b.noUrut));
  }, [dataList, searchQuery, filterTahun]);

  return (
    <AppLayout activePage="mou">
      <div data-testid="mou-container" className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-start gap-4">
            <div className="hidden sm:flex w-11 h-11 rounded-lg bg-red-900 items-center justify-center shadow-sm shrink-0">
              <Handshake className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-900 border border-red-200 mb-1.5 uppercase tracking-wide">
                Buku Agenda
              </span>
              <h1 data-testid="page-title-mou" className="text-2xl font-bold text-slate-900 tracking-tight">
                MOU
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">Pencatatan Memorandum of Understanding dengan instansi mitra.</p>
            </div>
          </div>
        </div>

        {/* Inline Add Form */}
        <form
          onSubmit={handleSubmit}
          data-testid="form-tambah-mou"
          className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center gap-2">
            <FileText className="w-4 h-4 text-red-900" />
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">Tambah Data MOU</h2>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="No Urut" required testid="field-no-urut">
              <NomorUrutPicker value={form.noUrut} onChange={(v) => setField("noUrut", v)} taken={nomorTerpakai} inputCls={inputCls} />
            </Field>

            <Field label="Tanggal" required testid="field-tanggal">
              <input
                data-testid="form-tanggal"
                type="date"
                value={form.tanggal}
                onChange={(e) => setField("tanggal", e.target.value)}
                className={inputCls}
              />
              {formYear !== CURRENT_YEAR ? (
                <p className="text-[10px] text-amber-700 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> No Urut & nomor akan memakai tahun {formYear} (bukan tahun berjalan, {CURRENT_YEAR}).
                </p>
              ) : (
                <p className="text-[10px] text-slate-400 mt-1">No Urut & nomor memakai tahun {formYear}.</p>
              )}
            </Field>

            <Field label="Instansi" required testid="field-instansi">
              <input
                data-testid="form-instansi"
                type="text"
                value={form.instansi}
                onChange={(e) => setField("instansi", e.target.value)}
                placeholder="Contoh: Universitas Lambung Mangkurat"
                className={inputCls}
              />
            </Field>

            <div className="md:col-span-2 lg:col-span-3">
              <div data-testid="preview-nomor-mou" className="flex items-start gap-2.5 px-4 py-3 rounded-md border border-red-100 bg-red-50/60">
                <Hash className="w-3.5 h-3.5 text-red-900 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-semibold text-red-900 uppercase tracking-wide">Nomor MOU (Otomatis)</p>
                  {generatedNomor ? (
                    <p className="text-sm font-mono font-bold text-slate-900 mt-0.5">{generatedNomor}</p>
                  ) : (
                    <p className="text-xs text-slate-400 mt-0.5">Lengkapi No Urut & Tanggal untuk membentuk nomor.</p>
                  )}
                  <p className="text-[10px] text-slate-400 mt-1">Format: No Urut TAHUN Tahun (dari Tanggal)</p>
                </div>
              </div>
            </div>

            <div className="md:col-span-2 lg:col-span-3">
              <Field label="Perihal" required testid="field-perihal">
                <textarea
                  data-testid="form-perihal"
                  rows={2}
                  value={form.perihal}
                  onChange={(e) => setField("perihal", e.target.value)}
                  placeholder="Uraikan perihal MOU..."
                  className={inputCls}
                />
              </Field>
            </div>

            <div className="md:col-span-2 lg:col-span-3">
              <Field label="Lampiran (Opsional)" testid="field-lampiran">
                <label
                  htmlFor="mou-file-input"
                  className="w-full flex items-center justify-between px-3 py-2 border border-dashed border-slate-300 rounded-md text-xs bg-slate-50/50 hover:bg-slate-50 cursor-pointer max-w-xl"
                >
                  <span className="flex items-center gap-2 text-slate-500 truncate">
                    <UploadCloud className="w-3.5 h-3.5 shrink-0" />
                    {form.lampiranFileName ? (
                      <span className="text-slate-800 font-medium truncate">{form.lampiranFileName}</span>
                    ) : (
                      "Pilih dokumen MOU (PDF/JPG/PNG)..."
                    )}
                  </span>
                </label>
                <input
                  id="mou-file-input"
                  data-testid="form-lampiran"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </Field>
            </div>
          </div>

          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
            <button
              type="button"
              data-testid="btn-reset-form"
              onClick={handleReset}
              className="inline-flex items-center justify-center px-4 py-2 border border-slate-300 text-slate-700 rounded-md text-xs font-semibold hover:bg-white transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              {editingId ? "Batal" : "Reset"}
            </button>
            <button
              type="submit"
              data-testid="btn-simpan-mou"
              disabled={submitting}
              className="inline-flex items-center justify-center px-5 py-2 bg-red-900 hover:bg-red-800 text-white rounded-md text-xs font-semibold shadow-sm transition-colors disabled:opacity-60"
            >
              <Save className="w-3.5 h-3.5 mr-1.5" />
              {submitting ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Simpan MOU"}
            </button>
          </div>
        </form>

        {/* Data section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Handshake className="w-4 h-4 text-red-900" />
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">Data MOU</h2>
            </div>
            <span
              data-testid="data-count-badge"
              className="text-[10px] font-semibold text-red-900 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full"
            >
              {filtered.length} data
            </span>
          </div>

          {/* Filter Bar */}
          <div className="p-4 border-b border-slate-200 bg-slate-50/40 flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="w-3.5 h-3.5 text-slate-400" />
              </span>
              <input
                data-testid="filter-search"
                type="text"
                placeholder="Cari nomor / perihal / instansi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-red-900"
              />
            </div>
            <select
              data-testid="filter-tahun"
              value={filterTahun}
              onChange={(e) => setFilterTahun(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-md text-xs"
            >
              <option value="Semua">Semua Tahun</option>
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Desktop table */}
          <div className="hidden lg:block overflow-x-auto">
            <table data-testid="mou-table" className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">No. Urut</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nomor MOU</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tanggal</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Perihal</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Instansi</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Lampiran</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200 text-xs">
                {loading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                      <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Memuat data...
                    </td>
                  </tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400 italic">
                      Tidak ada data MOU yang cocok dengan filter.
                    </td>
                  </tr>
                )}
                {!loading && filtered.map((it) => (
                  <tr key={it.id} data-testid={`row-${it.id}`} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-900">{it.noUrut}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-700">{it.nomorMou}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-700">{formatTgl(it.tanggal)}</td>
                    <td className="px-4 py-3 text-slate-700 max-w-[240px] truncate" title={it.perihal}>
                      {it.perihal}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800 max-w-[200px] truncate" title={it.instansi}>
                      {it.instansi}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {mouApi.lampiranUrl(it.lampiranFile) ? (
                        <a
                          href={mouApi.lampiranUrl(it.lampiranFile)}
                          target="_blank"
                          rel="noreferrer"
                          data-testid={`link-lampiran-${it.id}`}
                          className="inline-flex items-center text-[10px] font-semibold text-emerald-700 hover:underline"
                        >
                          <Paperclip className="w-3.5 h-3.5 mr-1" /> Lihat <ExternalLink className="w-3 h-3 ml-1" />
                        </a>
                      ) : (
                        <span className="inline-flex items-center text-[10px] font-semibold text-slate-400">- Belum -</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          data-testid={`btn-edit-${it.id}`}
                          onClick={() => handleEdit(it)}
                          className="w-7 h-7 rounded-md border border-slate-200 flex items-center justify-center text-slate-500 hover:text-red-900 hover:border-red-200 hover:bg-red-50 transition-colors"
                          aria-label="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          data-testid={`btn-delete-${it.id}`}
                          onClick={() => handleDelete(it)}
                          className="w-7 h-7 rounded-md border border-slate-200 flex items-center justify-center text-slate-500 hover:text-red-700 hover:border-red-200 hover:bg-red-50 transition-colors"
                          aria-label="Hapus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile / Tablet cards */}
          <div className="lg:hidden divide-y divide-slate-100">
            {loading && (
              <div className="py-10 text-center text-slate-400 text-xs">
                <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Memuat data...
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="py-10 text-center text-slate-400 italic text-xs">
                Tidak ada data MOU yang cocok dengan filter.
              </div>
            )}
            {!loading && filtered.map((it) => {
              const isOpen = expandedId === it.id;
              return (
                <div key={it.id} data-testid={`card-${it.id}`} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[10px] font-mono font-semibold text-red-900 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
                          {it.nomorMou}
                        </span>
                        {mouApi.lampiranUrl(it.lampiranFile) && (
                          <a
                            href={mouApi.lampiranUrl(it.lampiranFile)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center text-[10px] font-semibold text-emerald-700"
                          >
                            <Paperclip className="w-3 h-3 mr-0.5" /> Lampiran
                          </a>
                        )}
                      </div>
                      <div className="text-sm font-semibold text-slate-900 leading-snug">{it.perihal}</div>
                      <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                        <Building2 className="w-3 h-3" /> {it.instansi}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {formatTgl(it.tanggal)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        data-testid={`btn-edit-${it.id}`}
                        onClick={() => handleEdit(it)}
                        className="w-8 h-8 rounded-md border border-slate-200 flex items-center justify-center text-slate-500 hover:text-red-900 hover:border-red-200 hover:bg-red-50 transition-colors"
                        aria-label="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        data-testid={`btn-delete-${it.id}`}
                        onClick={() => handleDelete(it)}
                        className="w-8 h-8 rounded-md border border-slate-200 flex items-center justify-center text-slate-500 hover:text-red-700 hover:border-red-200 hover:bg-red-50 transition-colors"
                        aria-label="Hapus"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        data-testid={`btn-expand-${it.id}`}
                        onClick={() => setExpandedId(isOpen ? null : it.id)}
                        className="w-8 h-8 rounded-md border border-slate-200 flex items-center justify-center text-slate-500 hover:text-red-900 hover:border-red-200 hover:bg-red-50 transition-colors"
                        aria-label="Toggle detail"
                      >
                        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div
                      data-testid={`detail-${it.id}`}
                      className="mt-3 pt-3 border-t border-dashed border-slate-200 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]"
                    >
                      <div>
                        <div className="text-slate-400 uppercase tracking-wide text-[9px] font-semibold">No. Urut</div>
                        <div className="text-slate-800 font-semibold">{it.noUrut}</div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}