import React, { useEffect, useMemo, useState } from "react";
import { AppLayout } from "./AppLayout";
import { MOCK_DATA } from "../mock";
import { subbagianApi } from "../api/master";
import { skApi } from "../api/sk";
import {
  Award,
  Lock,
  AlertTriangle,
  Hash,
  Search,
  RotateCcw,
  Save,
  ChevronDown,
  ChevronUp,
  FileText,
  Calendar,
  UploadCloud,
  Paperclip,
  ExternalLink,
  Building2,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

const CURRENT_YEAR = new Date().getFullYear();

// Menyusun nomor SK otomatis: "{noUrut} TAHUN {tahun}", tahun diambil langsung dari field Tanggal.
const buildNomorSk = ({ noUrut, tanggal }) => {
  if (!noUrut || !tanggal) return "";
  const tahun = new Date(tanggal).getFullYear();
  if (!tahun || Number.isNaN(tahun)) return "";
  return `${noUrut} TAHUN ${tahun}`;
};

const emptyForm = () => ({
  noUrut: "",
  tanggal: new Date().toISOString().split("T")[0],
  perihal: "",
  skOleh: "",
  subbagId: "",
  arsipFileName: "",
  arsipFileUrl: "",
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

export default function SK() {
  const [dataList, setDataList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const [subbags, setSubbags] = useState(MOCK_DATA.masterDataSubbagian || []);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterOleh, setFilterOleh] = useState("Semua");
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
      const list = await skApi.list();
      setDataList(list);
      setAccessDenied(false);
    } catch (e) {
      if (e.status === 403) {
        setAccessDenied(true);
      } else {
        toast.error(e.message || "Gagal memuat data SK dari server");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const s = await subbagianApi.list();
        setSubbags(s);
      } catch (e) {
        toast.error("Gagal memuat data Subbagian dari server, memakai data sementara");
      }
    })();
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subbagLabel = (idOrCode) => {
    const found = subbags.find((s) => (s.id || s.code) === idOrCode);
    return found ? found.name : idOrCode || "-";
  };

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleReset = () => {
    if (form.arsipFileUrl) URL.revokeObjectURL(form.arsipFileUrl);
    setForm(emptyForm());
    setEditingId(null);
    toast.info("Form telah direset");
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (form.arsipFileUrl) URL.revokeObjectURL(form.arsipFileUrl);
    const blobUrl = URL.createObjectURL(file);
    setForm((f) => ({ ...f, arsipFileName: file.name, arsipFileUrl: blobUrl, rawFile: file }));
  };

  const handleEdit = (it) => {
    setEditingId(it.id);
    setForm({
      noUrut: it.noUrut,
      tanggal: it.tanggal,
      perihal: it.perihal,
      skOleh: it.skOleh,
      subbagId: it.subbagId,
      arsipFileName: "",
      arsipFileUrl: "",
      rawFile: null,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (it) => {
    if (!window.confirm(`Hapus data SK nomor ${it.nomorSk}?`)) return;
    try {
      await skApi.remove(it.id);
      toast.success("Data SK berhasil dihapus");
      await loadData();
    } catch (e) {
      toast.error(e.message || "Gagal menghapus data SK");
    }
  };

  // No Urut yang sudah dipakai pada tahun dari Tanggal yang sedang diisi (nomor kembali ke 1 tiap tahun).
  const nomorTerpakai = useMemo(
    () => dataList.filter((it) => (it.tanggal || "").startsWith(`${formYear}`) && it.id !== editingId).map((it) => it.noUrut),
    [dataList, formYear, editingId],
  );

  const generatedNomor = useMemo(() => buildNomorSk(form), [form]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const required = ["noUrut", "tanggal", "perihal", "skOleh", "subbagId"];
    for (const k of required) {
      if (!form[k]) {
        toast.error("Mohon lengkapi seluruh field yang wajib diisi");
        return;
      }
    }
    const nomorSk = buildNomorSk(form);
    if (!nomorSk) {
      toast.error("Nomor SK belum bisa dibentuk, pastikan No Urut & Tanggal sudah terisi");
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
        skOleh: form.skOleh,
        subbagId: form.subbagId,
      };
      let saved;
      if (editingId) {
        saved = await skApi.update(editingId, payload);
        toast.success("Data SK berhasil diperbarui");
      } else {
        saved = await skApi.create(payload);
        toast.success("Data SK berhasil disimpan");
      }
      if (form.rawFile) {
        try {
          await skApi.uploadArsip(saved.id, form.rawFile);
        } catch (e) {
          toast.error(e.message || "Data tersimpan, tapi gagal mengunggah arsip");
        }
      }
      if (form.arsipFileUrl) URL.revokeObjectURL(form.arsipFileUrl);
      setForm(emptyForm());
      setEditingId(null);
      await loadData();
    } catch (e) {
      toast.error(e.message || "Gagal menyimpan data SK");
    } finally {
      setSubmitting(false);
    }
  };

  // Tabel disaring dengan filter Tahun (murni tampilan, tidak terkait form).
  const dataListForYear = useMemo(
    () => dataList.filter((it) => filterTahun === "Semua" || (it.tanggal || "").startsWith(`${filterTahun}`)),
    [dataList, filterTahun],
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return dataListForYear.filter((it) => {
      if (q) {
        const hay = `${it.nomorSk} ${it.perihal} ${subbagLabel(it.subbagId)}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filterOleh !== "Semua" && it.skOleh !== filterOleh) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataListForYear, searchQuery, filterOleh, subbags]);

  if (accessDenied) {
    return (
      <AppLayout activePage="sk">
        <div data-testid="sk-container" className="bg-white rounded-xl shadow-sm border border-slate-200 p-10 text-center">
          <Lock className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-slate-800">Akses Ditolak</h1>
          <p className="text-sm text-slate-500 mt-1">
            Halaman SK hanya bisa diakses oleh admin atau pegawai Subbagian Teknis Penyelenggaraan Pemilu, Partisipasi dan Hukum.
          </p>
        </div>
      </AppLayout>
    );
  }

  if (loading) {
    return (
      <AppLayout activePage="sk">
        <div data-testid="sk-container" className="bg-white rounded-xl shadow-sm border border-slate-200 p-10 text-center text-sm text-slate-500">
          Memuat data SK...
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout activePage="sk">
      <div data-testid="sk-container" className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-start gap-4">
            <div className="hidden sm:flex w-11 h-11 rounded-lg bg-red-900 items-center justify-center shadow-sm shrink-0">
              <Award className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-900 border border-red-200 mb-1.5 uppercase tracking-wide">
                Buku Agenda
              </span>
              <h1 data-testid="page-title-sk" className="text-2xl font-bold text-slate-900 tracking-tight">
                SK (Surat Keputusan)
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Pencatatan Surat Keputusan Ketua/Sekretaris beserta arsipnya.
              </p>
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          data-testid="form-tambah-sk"
          className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center gap-2">
            <FileText className="w-4 h-4 text-red-900" />
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">Tambah Data SK</h2>
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

            <div className="md:col-span-2">
              <div data-testid="preview-nomor-sk" className="flex items-start gap-2.5 px-4 py-3 rounded-md border border-red-100 bg-red-50/60">
                <Hash className="w-3.5 h-3.5 text-red-900 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-semibold text-red-900 uppercase tracking-wide">Nomor SK (Otomatis)</p>
                  {generatedNomor ? (
                    <p className="text-sm font-mono font-bold text-slate-900 mt-0.5">{generatedNomor}</p>
                  ) : (
                    <p className="text-xs text-slate-400 mt-0.5">Lengkapi No Urut & Tanggal untuk membentuk nomor.</p>
                  )}
                  <p className="text-[10px] text-slate-400 mt-1">Format: No Urut TAHUN Tahun (dari Tanggal)</p>
                </div>
              </div>
            </div>

            <Field label="SK Ketua/Sekretaris" required testid="field-sk-oleh">
              <select
                data-testid="form-sk-oleh"
                value={form.skOleh}
                onChange={(e) => setField("skOleh", e.target.value)}
                className={inputCls}
              >
                <option value="">— Pilih —</option>
                <option value="Ketua">Ketua</option>
                <option value="Sekretaris">Sekretaris</option>
              </select>
            </Field>

            <Field label="Subbag" required testid="field-subbag">
              <select
                data-testid="form-subbag"
                value={form.subbagId}
                onChange={(e) => setField("subbagId", e.target.value)}
                className={inputCls}
              >
                <option value="">— Pilih Subbagian —</option>
                {subbags.map((s) => (
                  <option key={s.id || s.code} value={s.id || s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Upload SK" testid="field-upload-sk">
              <label
                htmlFor="sk-file-input"
                className="w-full flex items-center justify-between px-3 py-2 border border-dashed border-slate-300 rounded-md text-xs bg-slate-50/50 hover:bg-slate-50 cursor-pointer"
              >
                <span className="flex items-center gap-2 text-slate-500 truncate">
                  <UploadCloud className="w-3.5 h-3.5 shrink-0" />
                  {form.arsipFileName ? (
                    <span className="text-slate-800 font-medium truncate">{form.arsipFileName}</span>
                  ) : (
                    "Pilih file SK (PDF/JPG/PNG)..."
                  )}
                </span>
              </label>
              <input
                id="sk-file-input"
                data-testid="form-upload-sk"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                className="hidden"
              />
            </Field>

            <div className="md:col-span-2 lg:col-span-3">
              <Field label="Perihal" required testid="field-perihal">
                <textarea
                  data-testid="form-perihal"
                  rows={2}
                  value={form.perihal}
                  onChange={(e) => setField("perihal", e.target.value)}
                  placeholder="Uraikan perihal Surat Keputusan..."
                  className={inputCls}
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
              data-testid="btn-simpan-sk"
              disabled={submitting}
              className="inline-flex items-center justify-center px-5 py-2 bg-red-900 hover:bg-red-800 text-white rounded-md text-xs font-semibold shadow-sm transition-colors disabled:opacity-60"
            >
              <Save className="w-3.5 h-3.5 mr-1.5" />
              {submitting ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Simpan SK"}
            </button>
          </div>
        </form>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-red-900" />
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">Data SK</h2>
            </div>
            <span
              data-testid="data-count-badge"
              className="text-[10px] font-semibold text-red-900 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full"
            >
              {filtered.length} data
            </span>
          </div>

          <div className="p-4 border-b border-slate-200 bg-slate-50/40 flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="w-3.5 h-3.5 text-slate-400" />
              </span>
              <input
                data-testid="filter-search"
                type="text"
                placeholder="Cari nomor SK / perihal / subbagian..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-red-900"
              />
            </div>

            <select
              data-testid="filter-sk-oleh"
              value={filterOleh}
              onChange={(e) => setFilterOleh(e.target.value)}
              className="bg-white border border-slate-200 rounded-md px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-red-900"
            >
              <option value="Semua">Semua (Ketua & Sekretaris)</option>
              <option value="Ketua">Ketua</option>
              <option value="Sekretaris">Sekretaris</option>
            </select>

            <select
              data-testid="filter-tahun"
              value={filterTahun}
              onChange={(e) => setFilterTahun(e.target.value)}
              className="bg-white border border-slate-200 rounded-md px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-red-900"
            >
              <option value="Semua">Semua Tahun</option>
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div className="hidden lg:block overflow-x-auto">
            <table data-testid="sk-table" className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">No. Urut</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nomor SK</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tanggal</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Perihal</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">SK Ketua/Sekretaris</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Subbag</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Arsip</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200 text-xs">
                {loading && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                      <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Memuat data...
                    </td>
                  </tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-400 italic">
                      Tidak ada data SK yang cocok dengan filter.
                    </td>
                  </tr>
                )}
                {!loading && filtered.map((it) => (
                  <tr key={it.id} data-testid={`row-${it.id}`} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-900">{it.noUrut}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{it.nomorSk}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-700">{formatTgl(it.tanggal)}</td>
                    <td className="px-4 py-3 text-slate-700 max-w-[240px] truncate" title={it.perihal}>
                      {it.perihal}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          it.skOleh === "Ketua"
                            ? "bg-amber-50 text-amber-800 border-amber-200"
                            : "bg-sky-50 text-sky-800 border-sky-200"
                        }`}
                      >
                        {it.skOleh}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 max-w-[180px] truncate" title={subbagLabel(it.subbagId)}>
                      {subbagLabel(it.subbagId)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {skApi.arsipUrl(it.arsipFile) ? (
                        <a
                          href={skApi.arsipUrl(it.arsipFile)}
                          target="_blank"
                          rel="noreferrer"
                          data-testid={`link-arsip-${it.id}`}
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

          <div className="lg:hidden divide-y divide-slate-100">
            {loading && (
              <div className="py-10 text-center text-slate-400 text-xs">
                <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Memuat data...
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="py-10 text-center text-slate-400 italic text-xs">
                Tidak ada data SK yang cocok dengan filter.
              </div>
            )}
            {!loading && filtered.map((it) => {
              const isOpen = expandedId === it.id;
              return (
                <div key={it.id} data-testid={`card-${it.id}`} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                            it.skOleh === "Ketua"
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : "bg-sky-50 text-sky-800 border-sky-200"
                          }`}
                        >
                          {it.skOleh}
                        </span>
                        {skApi.arsipUrl(it.arsipFile) && (
                          <a
                            href={skApi.arsipUrl(it.arsipFile)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center text-[10px] font-semibold text-emerald-700"
                          >
                            <Paperclip className="w-3 h-3 mr-0.5" /> Arsip
                          </a>
                        )}
                      </div>
                      <div className="text-sm font-semibold text-slate-900 leading-snug">{it.nomorSk}</div>
                      <div className="text-[11px] text-slate-600 mt-1">{it.perihal}</div>
                      <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                        <Building2 className="w-3 h-3" /> {subbagLabel(it.subbagId)}
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