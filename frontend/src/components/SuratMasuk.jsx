import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { AppLayout } from "./AppLayout";
import { useAuth } from "../context/AuthContext";
import { suratMasukApi } from "../api/surat";
import { subbagianApi } from "../api/master";
import { klasifikasiApi } from "../api/klasifikasi";
import {
  Inbox,
  AlertTriangle,
  Search,
  RotateCcw,
  Save,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  Calendar,
  Building2,
  Hash,
  Paperclip,
  Pencil,
  Trash2,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

const DITUJUKAN_OPTIONS = ["KETUA", "SEKRETARIS"];
const KATEGORI_KLASIFIKASI_OPTIONS = ["Substantif", "Fasilitatif"];
const MAX_LAMPIRAN_MB = 10;

const CURRENT_YEAR = new Date().getFullYear();
// Daftar tahun yang tersedia di filter tabel.

const todayIso = () => new Date().toISOString().split("T")[0];

const formatFileSize = (bytes) => {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const emptyForm = () => ({
  nomorUrut: "",
  nomorAgenda: "",
  tanggal: todayIso(),
  alamatPengirim: "",
  tanggalSurat: todayIso(),
  nomorSurat: "",
  perihal: "",
  disposisi: "",
  ditujukan: "",
  kategoriKlasifikasi: "",
  bidangKlasifikasi: "",
  kodeArsip: "",
});

const disposisiBadge = (d) => {
  const map = {
    "SUB-KUL": "bg-red-50 text-red-900 border-red-200",
    "SUB-PDI": "bg-slate-100 text-slate-800 border-slate-200",
    "SUB-PSD": "bg-amber-50 text-amber-900 border-amber-200",
    "SUB-TPH": "bg-stone-100 text-stone-800 border-stone-300",
  };
  return map[d] || "bg-slate-100 text-slate-700 border-slate-200";
};

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

// Searchable combobox reused for Kode Arsip - generic over any {code,label} option list.
const SearchableCombobox = ({ value, onChange, options, placeholder, testidPrefix, disabled, disabledPlaceholder }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () =>
      options.filter(
        (o) => o.code.toLowerCase().includes(query.toLowerCase()) || o.label.toLowerCase().includes(query.toLowerCase()),
      ),
    [options, query],
  );
  const selected = options.find((o) => o.code === value);

  if (disabled) {
    return (
      <div
        data-testid={`${testidPrefix}-disabled`}
        className="w-full flex items-center px-3 py-2 border border-dashed border-slate-300 rounded-md text-xs bg-slate-50 text-slate-400"
      >
        {disabledPlaceholder || placeholder}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        data-testid={`${testidPrefix}-trigger`}
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 border border-slate-300 rounded-md text-xs bg-white hover:bg-slate-50 focus:ring-1 focus:ring-red-900 focus:outline-none"
      >
        <span className={selected ? "text-slate-900" : "text-slate-400"}>{selected ? selected.code : placeholder}</span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
      </button>
      {selected && (
        <p data-testid={`${testidPrefix}-keterangan`} className="mt-1 text-[11px] text-slate-500 leading-snug">
          {selected.uraian || selected.label}
        </p>
      )}
      {open && (
        <div data-testid={`${testidPrefix}-dropdown`} className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute top-2.5 left-2" />
              <input
                autoFocus
                type="text"
                placeholder="Cari kode atau keterangan, mis. pemilu..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-7 pr-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-red-900"
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-xs text-slate-400 italic">Tidak ada hasil</div>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.code}
                  type="button"
                  onClick={() => {
                    onChange(o.code);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-red-50 hover:text-red-900 transition-colors ${
                    value === o.code ? "bg-red-50 text-red-900 font-semibold" : "text-slate-700"
                  }`}
                >
                  <div className="font-semibold">{o.code}</div>
                  <div className="text-[11px] text-slate-500">{o.uraian || o.label}</div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Nomor urut Surat Masuk: TIDAK BOLEH dilompati (beda dari surat lain yang boleh melompat).
// Karena itu field ini terkunci (bukan diketik manual) - selalu terisi otomatis dengan
// nomor berikutnya yang masih kosong untuk tahun (dari Tanggal Surat Masuk) yang sedang diisi.
// Saat mode edit, menampilkan nomor asli data tersebut (tidak dihitung ulang).
const SequentialNomorUrut = ({ value, taken, isEditing }) => {
  const takenSet = useMemo(() => new Set(taken), [taken]);
  const suggestion = useMemo(() => {
    let n = 1;
    while (takenSet.has(n)) n += 1;
    return n;
  }, [takenSet]);
  const display = isEditing ? value : suggestion;
  return (
    <div className="space-y-1">
      <div
        data-testid="form-nomor-urut"
        className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs bg-slate-50 text-slate-800 font-mono font-semibold"
      >
        {display || "-"}
      </div>
      <p className="text-[10px] text-slate-400">
        Otomatis berurutan, tidak bisa dilompati atau diketik manual.
      </p>
    </div>
  );
};

// Upload berkas surat langsung dari form tambah/edit — file diunggah sebagai
// lampiran begitu data surat berhasil disimpan (create/update).
const FileUploadField = ({ file, onChange, existingLampiranName }) => {
  const inputRef = useRef(null);

  const handleFiles = (fileList) => {
    const f = fileList?.[0];
    if (!f) return;
    if (f.size > MAX_LAMPIRAN_MB * 1024 * 1024) {
      toast.error(`Ukuran berkas maksimal ${MAX_LAMPIRAN_MB} MB`);
      return;
    }
    onChange(f);
  };

  if (file) {
    return (
      <div
        data-testid="form-lampiran-preview"
        className="flex items-center justify-between gap-2 px-3 py-2 border border-slate-300 rounded-md text-xs bg-slate-50"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Paperclip className="w-3.5 h-3.5 text-red-900 shrink-0" />
          <span className="truncate font-medium text-slate-800">{file.name}</span>
          <span className="text-slate-400 shrink-0">{formatFileSize(file.size)}</span>
        </div>
        <button
          type="button"
          data-testid="form-lampiran-remove"
          onClick={() => {
            onChange(null);
            if (inputRef.current) inputRef.current.value = "";
          }}
          className="shrink-0 text-slate-400 hover:text-red-800"
          aria-label="Hapus berkas"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <label
      data-testid="form-lampiran-dropzone"
      className="flex items-center gap-2 px-3 py-2 border border-dashed border-slate-300 rounded-md text-xs bg-white hover:bg-slate-50 hover:border-red-300 cursor-pointer text-slate-500 transition-colors"
    >
      <Upload className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      <span>
        {existingLampiranName
          ? `Ganti berkas (saat ini: ${existingLampiranName})`
          : `Klik untuk unggah scan surat (PDF/JPG/PNG), maks ${MAX_LAMPIRAN_MB}MB`}
      </span>
      <input
        ref={inputRef}
        data-testid="form-lampiran-input"
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </label>
  );
};

export default function SuratMasuk() {
  const { user } = useAuth();
  const [dataList, setDataList] = useState([]);
  const [subbagList, setSubbagList] = useState([]);
  const [kodeArsipOptions, setKodeArsipOptions] = useState([]);
  const [nomorTerpakai, setNomorTerpakai] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [existingLampiran, setExistingLampiran] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterDisposisi, setFilterDisposisi] = useState("Semua");
  const [filterDitujukan, setFilterDitujukan] = useState("Semua");
  const [filterSrikandi, setFilterSrikandi] = useState("Semua");
  // Filter Tahun di tabel - murni untuk menyaring tampilan, tahun diambil dari Tanggal Surat Masuk tiap data.
  const [filterTahun, setFilterTahun] = useState(String(new Date().getFullYear()));

  // Tahun untuk No Urut diambil langsung dari Tanggal Surat Masuk yang sedang diisi di form.
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

  const permissions = user?.permissions || {};
  const isAdmin = (user?.role || "").toLowerCase() === "admin";
  const canEdit = isAdmin || !!permissions.surat_edit;
  const canDelete = isAdmin || !!permissions.surat_delete;
  const canApproveGeneral = isAdmin || !!permissions.surat_approve;
  const ownSubbagCode = useMemo(
    () => subbagList.find((s) => s.id === user?.subbag_id)?.code,
    [subbagList, user],
  );

  const canApproveRow = useCallback(
    (row) => canApproveGeneral && (isAdmin || row.disposisi === ownSubbagCode),
    [canApproveGeneral, isAdmin, ownSubbagCode],
  );

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  // Ganti kategori klasifikasi mengosongkan kode arsip yang sudah dipilih,
  // karena daftar kode arsip yang tampil tergantung kategori (Substantif/Fasilitatif).
  const setKategoriKlasifikasi = (kategori) =>
    setForm((f) => ({ ...f, kategoriKlasifikasi: kategori, bidangKlasifikasi: "", kodeArsip: "" }));

  // Ganti bidang juga mengosongkan kode arsip yang sudah dipilih, karena daftar
  // kode arsip yang tampil tergantung kombinasi kategori + bidang.
  const setBidangKlasifikasi = (bidang) =>
    setForm((f) => ({ ...f, bidangKlasifikasi: bidang, kodeArsip: "" }));

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [list, subs, klas, terpakai] = await Promise.all([
        suratMasukApi.list(),
        subbagianApi.list(),
        klasifikasiApi.list({ activeOnly: true }),
        suratMasukApi.nomorTerpakai(),
      ]);
      setDataList(list);
      setSubbagList(subs);
      setKodeArsipOptions(
        (klas || []).map((k) => ({ code: k.kode, uraian: k.uraian, kategori: k.kategori, bidang: k.bidang, label: `${k.kode} — ${k.uraian}` })),
      );
      setNomorTerpakai(terpakai);
    } catch (err) {
      toast.error(err.message || "Gagal memuat data surat masuk");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Bidang hanya menampilkan opsi sesuai kategori klasifikasi yang dipilih.
  const bidangOptions = useMemo(
    () => Array.from(new Set(kodeArsipOptions.filter((o) => o.kategori === form.kategoriKlasifikasi).map((o) => o.bidang))),
    [kodeArsipOptions, form.kategoriKlasifikasi],
  );

  // Kode arsip hanya menampilkan opsi sesuai kategori + bidang yang dipilih.
  const kodeArsipOptionsForKategori = useMemo(
    () => kodeArsipOptions.filter((o) => o.kategori === form.kategoriKlasifikasi && o.bidang === form.bidangKlasifikasi),
    [kodeArsipOptions, form.kategoriKlasifikasi, form.bidangKlasifikasi],
  );

  // No Urut yang sudah dipakai dihitung per tahun dari Tanggal Surat Masuk yang sedang diisi di form
  // (dihitung dari data yang sudah dimuat, bukan endpoint nomorTerpakai global, supaya per-tahun akurat).
  const nomorTerpakaiForFormYear = useMemo(
    () => dataList.filter((it) => (it.tanggal || "").startsWith(`${formYear}`)).map((it) => it.nomorUrut),
    [dataList, formYear],
  );

  // Saat menambah data baru (bukan edit), No Urut selalu dikunci ke nomor berikutnya yang masih
  // kosong untuk tahun tersebut - supaya benar-benar tidak bisa dilompati.
  useEffect(() => {
    if (editingId) return;
    const takenSet = new Set(nomorTerpakaiForFormYear);
    let next = 1;
    while (takenSet.has(next)) next += 1;
    setForm((f) => (f.nomorUrut === next ? f : { ...f, nomorUrut: next }));
  }, [editingId, nomorTerpakaiForFormYear]);

  const handleReset = () => {
    setForm(emptyForm());
    setEditingId(null);
    setPendingFile(null);
    setExistingLampiran(null);
    toast.info("Form telah direset");
  };

  const startEdit = (it) => {
    setEditingId(it.id);
    const matchedKode = kodeArsipOptions.find((o) => o.code === it.kodeArsip);
    setForm({
      nomorUrut: it.nomorUrut,
      nomorAgenda: it.nomorAgenda || "",
      tanggal: it.tanggal,
      alamatPengirim: it.alamatPengirim,
      tanggalSurat: it.tanggalSurat,
      nomorSurat: it.nomorSurat,
      perihal: it.perihal,
      disposisi: it.disposisi,
      ditujukan: it.ditujukan,
      kategoriKlasifikasi: matchedKode?.kategori || "",
      bidangKlasifikasi: matchedKode?.bidang || "",
      kodeArsip: it.kodeArsip,
    });
    setPendingFile(null);
    setExistingLampiran(it.lampiran || null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const required = ["nomorUrut", "tanggal", "alamatPengirim", "tanggalSurat", "nomorSurat", "perihal", "disposisi", "ditujukan", "kategoriKlasifikasi", "kodeArsip"];
    for (const k of required) {
      if (!form[k] && form[k] !== 0) {
        toast.error("Mohon lengkapi seluruh field yang wajib diisi");
        return;
      }
    }
    // kategoriKlasifikasi hanya dipakai di UI untuk mempersempit pilihan kode arsip;
    // tidak dikirim ke backend karena bukan bagian dari skema surat masuk.
    const { kategoriKlasifikasi, ...rest } = form;
    // Tahun dari Tanggal Surat Masuk bukan tahun berjalan (susulan/arsip lama) -> minta konfirmasi dulu (khusus data baru).
    if (!editingId && formYear !== CURRENT_YEAR) {
      const ok = window.confirm(
        `Tanggal Surat Masuk berada di tahun ${formYear}, bukan tahun berjalan (${CURRENT_YEAR}). Lanjutkan menyimpan?`,
      );
      if (!ok) return;
    }
    const payload = { ...rest, nomorUrut: Number(form.nomorUrut) };
    try {
      let saved;
      if (editingId) {
        saved = await suratMasukApi.update(editingId, payload);
        toast.success("Surat masuk berhasil diperbarui");
      } else {
        saved = await suratMasukApi.create(payload);
        toast.success("Surat masuk berhasil disimpan");
      }
      if (pendingFile && saved?.id) {
        try {
          await suratMasukApi.uploadLampiran(saved.id, pendingFile);
        } catch (uploadErr) {
          toast.error(uploadErr.message || "Surat tersimpan, tapi lampiran gagal diunggah");
        }
      }
      setForm(emptyForm());
      setEditingId(null);
      setPendingFile(null);
      setExistingLampiran(null);
      loadAll();
    } catch (err) {
      toast.error(err.message || "Gagal menyimpan surat masuk");
    }
  };

  const handleDelete = async (it) => {
    if (!window.confirm(`Hapus surat masuk "${it.perihal}"?`)) return;
    setBusyId(it.id);
    try {
      await suratMasukApi.remove(it.id);
      toast.success("Surat masuk dihapus");
      loadAll();
    } catch (err) {
      toast.error(err.message || "Gagal menghapus surat masuk");
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleSrikandi = async (it) => {
    setBusyId(it.id);
    try {
      if (it.srikandi) {
        await suratMasukApi.unapprove(it.id);
        toast.success("Persetujuan SRIKANDI dibatalkan");
      } else {
        await suratMasukApi.approve(it.id);
        toast.success("Surat disetujui (SRIKANDI)");
      }
      loadAll();
    } catch (err) {
      toast.error(err.message || "Gagal memperbarui persetujuan");
    } finally {
      setBusyId(null);
    }
  };

  const handleUpload = async (it, file) => {
    if (!file) return;
    setBusyId(it.id);
    try {
      await suratMasukApi.uploadLampiran(it.id, file);
      toast.success("Lampiran berhasil diunggah");
      loadAll();
    } catch (err) {
      toast.error(err.message || "Gagal mengunggah lampiran");
    } finally {
      setBusyId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return dataList
      .filter((it) => {
        if (q) {
          const hay = `${it.nomorSurat} ${it.perihal} ${it.alamatPengirim} ${it.nomorAgenda}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (filterDisposisi !== "Semua" && it.disposisi !== filterDisposisi) return false;
        if (filterDitujukan !== "Semua" && it.ditujukan !== filterDitujukan) return false;
        if (filterSrikandi === "Sudah" && !it.srikandi) return false;
        if (filterSrikandi === "Belum" && it.srikandi) return false;
        if (filterTahun !== "Semua" && !(it.tanggal || "").startsWith(`${filterTahun}`)) return false;
        return true;
      })
      // Urut naik berdasarkan No Urut, supaya lompatan nomor (kalaupun ada dari data lama)
      // tetap tampil sesuai urutan angkanya, bukan berdasarkan kapan datanya ditambahkan.
      .sort((a, b) => Number(a.nomorUrut) - Number(b.nomorUrut));
  }, [dataList, searchQuery, filterDisposisi, filterDitujukan, filterSrikandi, filterTahun]);

  return (
    <AppLayout activePage="surat-masuk">
      <div data-testid="surat-masuk-container" className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-start gap-4">
            <div className="hidden sm:flex w-11 h-11 rounded-lg bg-red-900 items-center justify-center shadow-sm shrink-0">
              <Inbox className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-900 border border-red-200 mb-1.5 uppercase tracking-wide">
                Buku Agenda
              </span>
              <h1 data-testid="page-title-surat-masuk" className="text-2xl font-bold text-slate-900 tracking-tight">
                Surat Masuk
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">Kelola dan catat data surat masuk.</p>
            </div>
          </div>
        </div>

        {/* Inline Add / Edit Form */}
        <form onSubmit={handleSubmit} data-testid="form-tambah-surat-masuk" className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center gap-2 rounded-t-xl">
            <FileText className="w-4 h-4 text-red-900" />
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              {editingId ? "Edit Surat Masuk" : "Tambah Surat Masuk"}
            </h2>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Nomor Urut" required testid="field-nomor-urut">
              <SequentialNomorUrut
                value={form.nomorUrut}
                taken={nomorTerpakaiForFormYear.filter((n) => n !== (editingId ? Number(form.nomorUrut) : null))}
                isEditing={!!editingId}
              />
            </Field>

            <Field label="Nomor Agenda" testid="field-nomor-agenda">
              <input
                data-testid="form-nomor-agenda"
                type="text"
                value={form.nomorAgenda}
                onChange={(e) => setField("nomorAgenda", e.target.value)}
                placeholder="Kosongkan = sama dengan nomor urut"
                className={inputCls}
              />
            </Field>

            <Field label="Tanggal Surat Masuk" required testid="field-tanggal">
              <input data-testid="form-tanggal" type="date" value={form.tanggal} onChange={(e) => setField("tanggal", e.target.value)} className={inputCls} />
              {formYear !== CURRENT_YEAR ? (
                <p className="text-[10px] text-amber-700 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> No Urut akan memakai tahun {formYear} (bukan tahun berjalan, {CURRENT_YEAR}).
                </p>
              ) : (
                <p className="text-[10px] text-slate-400 mt-1">No Urut memakai tahun {formYear}.</p>
              )}
            </Field>

            <Field label="Alamat Pengirim" required testid="field-alamat-pengirim">
              <input
                data-testid="form-alamat-pengirim"
                type="text"
                value={form.alamatPengirim}
                onChange={(e) => setField("alamatPengirim", e.target.value)}
                placeholder="Contoh: UIN Antasari Banjarmasin"
                className={inputCls}
              />
            </Field>

            <div className="md:col-span-2 lg:col-span-3">
              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="w-4 h-4 text-red-900" />
                  <h3 className="text-xs font-bold text-slate-900">Dari Surat Asli</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Tanggal Surat" required testid="field-tanggal-surat">
                    <input data-testid="form-tanggal-surat" type="date" value={form.tanggalSurat} onChange={(e) => setField("tanggalSurat", e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="Nomor Surat" required testid="field-nomor-surat">
                    <input
                      data-testid="form-nomor-surat"
                      type="text"
                      value={form.nomorSurat}
                      onChange={(e) => setField("nomorSurat", e.target.value)}
                      placeholder="Contoh: 139/S/P/PP-PBPM-KPM/EMA-U/UN-A/I/2026"
                      className={inputCls}
                    />
                  </Field>
                </div>
                <div className="mt-4">
                  <Field label="Perihal" required testid="field-perihal">
                    <textarea data-testid="form-perihal" rows={3} value={form.perihal} onChange={(e) => setField("perihal", e.target.value)} placeholder="Uraikan perihal surat..." className={inputCls} />
                  </Field>
                </div>
                <div className="mt-4">
                  <Field label="Berkas Surat (Opsional)" testid="field-lampiran">
                    <FileUploadField file={pendingFile} onChange={setPendingFile} existingLampiranName={existingLampiran} />
                  </Field>
                </div>
              </div>
            </div>

            <Field label="Disposisi (Sub-bagian Tujuan)" required testid="field-disposisi">
              <select data-testid="form-disposisi" value={form.disposisi} onChange={(e) => setField("disposisi", e.target.value)} className={inputCls}>
                <option value="">Pilih sub-bagian...</option>
                {subbagList.map((s) => (
                  <option key={s.id} value={s.code}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Ditujukan" required testid="field-ditujukan">
              <select data-testid="form-ditujukan" value={form.ditujukan} onChange={(e) => setField("ditujukan", e.target.value)} className={inputCls}>
                <option value="">Pilih...</option>
                {DITUJUKAN_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>

            {/* Klasifikasi & Kode Arsip: kategori dipilih dulu (Substantif/Fasilitatif), lalu
                bidang sesuai kategori itu, baru kode arsip muncul sesuai keduanya. */}
            <div className="md:col-span-2 lg:col-span-3">
              <Field label="Klasifikasi & Kode Arsip" required testid="field-kode-arsip">
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select
                      data-testid="form-kategori-klasifikasi"
                      value={form.kategoriKlasifikasi}
                      onChange={(e) => setKategoriKlasifikasi(e.target.value)}
                      className={inputCls}
                    >
                      <option value="">Klasifikasi...</option>
                      {KATEGORI_KLASIFIKASI_OPTIONS.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                    <select
                      data-testid="form-bidang-klasifikasi"
                      value={form.bidangKlasifikasi}
                      disabled={!form.kategoriKlasifikasi}
                      onChange={(e) => setBidangKlasifikasi(e.target.value)}
                      className={`${inputCls} disabled:bg-slate-50 disabled:text-slate-400`}
                    >
                      <option value="">{form.kategoriKlasifikasi ? "Pilih bidang..." : "Pilih klasifikasi dulu"}</option>
                      {bidangOptions.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>
                  {form.bidangKlasifikasi ? (
                    <SearchableCombobox
                      value={form.kodeArsip}
                      onChange={(v) => setField("kodeArsip", v)}
                      options={kodeArsipOptionsForKategori}
                      placeholder="Pilih kode arsip..."
                      testidPrefix="form-kode-arsip"
                    />
                  ) : (
                    <p className="text-[10px] text-slate-400 italic">
                      Pilih Klasifikasi lalu Bidang di atas dulu untuk mempersempit pilihan kode arsip.
                    </p>
                  )}
                </div>
              </Field>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/50 flex items-center justify-end gap-2 rounded-b-xl">
            <button type="button" onClick={handleReset} data-testid="btn-reset" className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-600 border border-slate-300 rounded-md hover:bg-slate-100">
              <RotateCcw className="w-3.5 h-3.5" /> {editingId ? "Batal" : "Reset"}
            </button>
            <button type="submit" data-testid="btn-simpan" className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-red-900 rounded-md hover:bg-red-800">
              <Save className="w-3.5 h-3.5" /> {editingId ? "Simpan Perubahan" : "Simpan"}
            </button>
          </div>
        </form>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute top-2.5 left-2.5" />
            <input
              data-testid="filter-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari perihal, nomor surat, pengirim..."
              className="w-full pl-8 pr-2 py-2 border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-red-900 focus:outline-none"
            />
          </div>
          <select data-testid="filter-disposisi" value={filterDisposisi} onChange={(e) => setFilterDisposisi(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-md text-xs">
            <option value="Semua">Semua Sub-bagian</option>
            {subbagList.map((s) => (
              <option key={s.id} value={s.code}>
                {s.code}
              </option>
            ))}
          </select>
          <select data-testid="filter-ditujukan" value={filterDitujukan} onChange={(e) => setFilterDitujukan(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-md text-xs">
            <option value="Semua">Semua Ditujukan</option>
            {DITUJUKAN_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select data-testid="filter-srikandi" value={filterSrikandi} onChange={(e) => setFilterSrikandi(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-md text-xs">
            <option value="Semua">Semua SRIKANDI</option>
            <option value="Sudah">Sudah disetujui</option>
            <option value="Belum">Belum disetujui</option>
          </select>
          <select data-testid="filter-tahun" value={filterTahun} onChange={(e) => setFilterTahun(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-md text-xs">
            <option value="Semua">Semua Tahun</option>
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div data-testid="table-caption" className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Inbox className="w-4 h-4 text-red-900" />
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">Surat Masuk</h2>
            </div>
            <span data-testid="data-count-badge" className="text-[10px] font-semibold text-red-900 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
              {filtered.length} data
            </span>
          </div>
          {loading ? (
            <div className="py-16 flex items-center justify-center text-slate-400 text-sm gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Memuat data...
            </div>
          ) : (
            <>
              <div className="hidden lg:block overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                      <th className="px-4 py-3">No. Urut</th>
                      <th className="px-4 py-3">Tgl Masuk</th>
                      <th className="px-4 py-3">Tgl Surat</th>
                      <th className="px-4 py-3">Pengirim</th>
                      <th className="px-4 py-3">Nomor Surat</th>
                      <th className="px-4 py-3">Perihal</th>
                      <th className="px-4 py-3">Disposisi</th>
                      <th className="px-4 py-3">Ditujukan</th>
                      <th className="px-4 py-3">Kode Arsip</th>
                      <th className="px-4 py-3 text-center">Lampiran</th>
                      <th className="px-4 py-3 text-center">SRIKANDI</th>
                      <th className="px-4 py-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200 text-xs">
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={12} className="px-4 py-10 text-center text-slate-400 italic">
                          Tidak ada data surat masuk yang cocok dengan filter.
                        </td>
                      </tr>
                    )}
                    {filtered.map((it) => (
                      <tr key={it.id} data-testid={`row-${it.id}`} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-900">{it.nomorUrut}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-700">{formatTgl(it.tanggal)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-700">{formatTgl(it.tanggalSurat)}</td>
                        <td className="px-4 py-3 font-medium text-slate-800 max-w-[160px] truncate" title={it.alamatPengirim}>
                          {it.alamatPengirim}
                        </td>
                        <td className="px-4 py-3 text-slate-700 max-w-[180px] truncate font-mono text-[11px]" title={it.nomorSurat}>
                          {it.nomorSurat}
                        </td>
                        <td className="px-4 py-3 text-slate-700 max-w-[220px] truncate" title={it.perihal}>
                          {it.perihal}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${disposisiBadge(it.disposisi)}`}>{it.disposisi}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">{it.ditujukan}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-slate-600">{it.kodeArsip}</td>
                        <td className="px-4 py-3 text-center">
                          {it.lampiran ? (
                            <a href={suratMasukApi.lampiranUrl(it.lampiran)} target="_blank" rel="noreferrer" className="inline-flex items-center text-emerald-700" title="Lihat lampiran">
                              <Paperclip className="w-3.5 h-3.5" />
                            </a>
                          ) : (
                            <label className="inline-flex items-center text-slate-400 hover:text-red-900 cursor-pointer" title="Unggah lampiran">
                              <Paperclip className="w-3.5 h-3.5" />
                              <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => handleUpload(it, e.target.files?.[0])} />
                            </label>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {canApproveRow(it) ? (
                            <button
                              type="button"
                              data-testid={`btn-approve-${it.id}`}
                              disabled={busyId === it.id}
                              onClick={() => handleToggleSrikandi(it)}
                              className={`inline-flex items-center text-[10px] font-semibold rounded px-1.5 py-0.5 border ${
                                it.srikandi ? "text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100" : "text-slate-500 border-slate-200 hover:bg-slate-100"
                              }`}
                            >
                              {it.srikandi ? <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> : <XCircle className="w-3.5 h-3.5 mr-1" />}
                              {it.srikandi ? "Sudah" : "Klik utk setujui"}
                            </button>
                          ) : it.srikandi ? (
                            <span className="inline-flex items-center text-[10px] font-semibold text-emerald-700">
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Sudah
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[10px] font-semibold text-slate-400">
                              <XCircle className="w-3.5 h-3.5 mr-1" /> Belum
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              disabled={!canEdit}
                              title={canEdit ? "Edit" : "Anda tidak punya izin edit"}
                              onClick={() => startEdit(it)}
                              className={`w-7 h-7 rounded-md border flex items-center justify-center ${canEdit ? "text-slate-600 border-slate-200 hover:bg-slate-100" : "text-slate-300 border-slate-100 cursor-not-allowed"}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={!canDelete || busyId === it.id}
                              title={canDelete ? "Hapus" : "Anda tidak punya izin hapus"}
                              onClick={() => handleDelete(it)}
                              className={`w-7 h-7 rounded-md border flex items-center justify-center ${canDelete ? "text-red-700 border-red-200 hover:bg-red-50" : "text-slate-300 border-slate-100 cursor-not-allowed"}`}
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
                {filtered.length === 0 && <div className="py-10 text-center text-slate-400 italic text-xs">Tidak ada data surat masuk yang cocok dengan filter.</div>}
                {filtered.map((it) => {
                  const isOpen = expandedId === it.id;
                  return (
                    <div key={it.id} data-testid={`card-${it.id}`} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-[10px] font-bold text-red-900 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">Agenda #{it.nomorAgenda}</span>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${disposisiBadge(it.disposisi)}`}>{it.disposisi}</span>
                          </div>
                          <div className="text-sm font-semibold text-slate-900 leading-snug">{it.perihal}</div>
                          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                            <Building2 className="w-3 h-3" /> {it.alamatPengirim}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {formatTgl(it.tanggal)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setExpandedId(isOpen ? null : it.id)}
                          className="shrink-0 w-8 h-8 rounded-md border border-slate-200 flex items-center justify-center text-slate-500 hover:text-red-900 hover:border-red-200 hover:bg-red-50 transition-colors"
                        >
                          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>

                      {isOpen && (
                        <div className="mt-3 pt-3 border-t border-dashed border-slate-200 space-y-3">
                          <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
                            <div>
                              <div className="text-slate-400 uppercase tracking-wide text-[9px] font-semibold">No. Urut</div>
                              <div className="text-slate-800 font-semibold">{it.nomorUrut}</div>
                            </div>
                            <div>
                              <div className="text-slate-400 uppercase tracking-wide text-[9px] font-semibold">Ditujukan</div>
                              <div className="text-slate-800 font-semibold">{it.ditujukan}</div>
                            </div>
                            <div className="col-span-2">
                              <div className="text-slate-400 uppercase tracking-wide text-[9px] font-semibold flex items-center gap-1">
                                <Hash className="w-3 h-3" /> Nomor Surat
                              </div>
                              <div className="text-slate-800 font-mono break-all">{it.nomorSurat}</div>
                            </div>
                            <div>
                              <div className="text-slate-400 uppercase tracking-wide text-[9px] font-semibold">Tanggal Surat</div>
                              <div className="text-slate-800">{formatTgl(it.tanggalSurat)}</div>
                            </div>
                            <div>
                              <div className="text-slate-400 uppercase tracking-wide text-[9px] font-semibold">Kode Arsip</div>
                              <div className="text-slate-800 font-mono">{it.kodeArsip}</div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-1">
                            {canApproveRow(it) ? (
                              <button
                                type="button"
                                disabled={busyId === it.id}
                                onClick={() => handleToggleSrikandi(it)}
                                className={`inline-flex items-center text-[11px] font-semibold rounded px-2 py-1 border ${it.srikandi ? "text-emerald-700 border-emerald-200 bg-emerald-50" : "text-slate-500 border-slate-200"}`}
                              >
                                {it.srikandi ? <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> : <XCircle className="w-3.5 h-3.5 mr-1" />}
                                SRIKANDI: {it.srikandi ? "Sudah" : "Klik utk setujui"}
                              </button>
                            ) : (
                              <span className={`inline-flex items-center text-[11px] font-semibold ${it.srikandi ? "text-emerald-700" : "text-slate-400"}`}>
                                {it.srikandi ? <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> : <XCircle className="w-3.5 h-3.5 mr-1" />}
                                SRIKANDI: {it.srikandi ? "Sudah" : "Belum"}
                              </span>
                            )}
                            <div className="flex items-center gap-1">
                              <button type="button" disabled={!canEdit} onClick={() => startEdit(it)} className={`w-7 h-7 rounded-md border flex items-center justify-center ${canEdit ? "text-slate-600 border-slate-200" : "text-slate-300 border-slate-100"}`}>
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button type="button" disabled={!canDelete} onClick={() => handleDelete(it)} className={`w-7 h-7 rounded-md border flex items-center justify-center ${canDelete ? "text-red-700 border-red-200" : "text-slate-300 border-slate-100"}`}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}