import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { AppLayout } from "./AppLayout";
import { useAuth } from "../context/AuthContext";
import { suratKeluarApi } from "../api/surat";
import { subbagianApi, jenisNaskahApi, wilayahApi } from "../api/master";
import { klasifikasiApi } from "../api/klasifikasi";
import {
  Send,
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
  Pencil,
  Trash2,
  Loader2,
  Landmark,
  Upload,
  Paperclip,
  X,
  Hash,
} from "lucide-react";
import { toast } from "sonner";

const todayIso = () => new Date().toISOString().split("T")[0];
// Sentinel untuk field opsional yang belum dipilih (segmen tidak ikut dibentuk di nomor).
const UNSET = "__unset";
const MAX_FILE_MB = 10;

const CURRENT_YEAR = new Date().getFullYear();

// Menyusun nomor surat keluar otomatis: {nomorUrut}/{kodeArsip}-{jenisNaskah}/[kodeWilayah/][subBagian/]{tahun}
// Tahun-nya diambil langsung dari field Tanggal, bukan dari pemilihan terpisah.
// Kode Wilayah opsional (dipilih dari Master Data Wilayah). Sub Bagian diambil dari
// Disposisi, diterjemahkan ke kode angka (SUBBAG_NOMOR_CODE) sebelum Tahun.
// Surat Edaran memakai format sederhana seperti SK: "{nomorUrut} TAHUN {tahun}".
const buildNomorSuratKeluar = ({ nomorUrut, jenisSurat, kodeArsip, jenisNaskah, tanggal, kodeWilayah, disposisi, subbagList = [] }) => {
  if (!nomorUrut || !tanggal) return "";
  const tahun = new Date(tanggal).getFullYear();
  if (!tahun || Number.isNaN(tahun)) return "";
  if (jenisSurat === "Surat Edaran") {
    return `${nomorUrut} TAHUN ${tahun}`;
  }
  if (!kodeArsip || !jenisNaskah) return "";
  const segments = [`${nomorUrut}`, `${kodeArsip}-${jenisNaskah}`];
  if (kodeWilayah && kodeWilayah !== UNSET) segments.push(kodeWilayah);
  const angkaSub = subbagList.find((s) => s.code === disposisi)?.angka;
  if (angkaSub) segments.push(`${angkaSub}`);
  segments.push(`${tahun}`);
  return segments.join("/");
};

const formatFileSize = (bytes) => {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const emptyForm = () => ({
  nomorUrut: "",
  jenisSurat: "Surat Keluar",
  jenisNaskah: "",
  tanggal: todayIso(),
  tujuan: "",
  perihal: "",
  disposisi: "",
  kodeArsip: "",
  kodeWilayah: UNSET,
  penanggungJawab: "",
});

const disposisiBadge = (d) => {
  const map = {
    "SUB-KUL": "bg-amber-50 text-amber-900 border-amber-200",
    "SUB-TEKNIS&HUKUM": "bg-stone-100 text-stone-800 border-stone-300",
    "SUB-RENDATIN": "bg-slate-100 text-slate-800 border-slate-200",
    "SUB-SDM": "bg-red-50 text-red-900 border-red-200",
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

// Tab halaman: Ketua atau Sekretaris - persis pola tab Surat Tugas / SPD.
// Data dan penomoran masing-masing bagian dipisah total di bawah tab ini,
// bukan lagi dipilih di dalam form.
const TabToggle = ({ value, onChange }) => (
  <div data-testid="tab-toggle" className="inline-flex items-center bg-white rounded-lg border border-slate-200 shadow-sm p-1">
    {["Ketua", "Sekretaris"].map((b) => (
      <button
        key={b}
        type="button"
        data-testid={`tab-${b.toLowerCase()}`}
        onClick={() => onChange(b)}
        className={`inline-flex items-center gap-1.5 px-5 py-2 rounded-md text-xs font-semibold transition-colors ${
          value === b ? "bg-red-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
        }`}
      >
        <Landmark className="w-3.5 h-3.5" /> {b}
      </button>
    ))}
  </div>
);

// Upload berkas surat keluar - opsional, diunggah sebagai lampiran setelah data tersimpan.
const FileUploadField = ({ file, onChange, existingLampiranName }) => {
  const inputRef = useRef(null);

  const handleFiles = (fileList) => {
    const f = fileList?.[0];
    if (!f) return;
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      toast.error(`Ukuran berkas maksimal ${MAX_FILE_MB} MB`);
      return;
    }
    onChange(f);
  };

  if (file) {
    return (
      <div data-testid="form-lampiran-preview" className="flex items-center justify-between gap-2 px-3 py-2 border border-slate-300 rounded-md text-xs bg-slate-50">
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
      <span>{existingLampiranName ? `Ganti berkas (saat ini: ${existingLampiranName})` : `Klik untuk unggah scan surat (PDF/JPG/PNG), maks ${MAX_FILE_MB}MB`}</span>
      <input ref={inputRef} data-testid="form-lampiran-input" type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
    </label>
  );
};

const SearchableCombobox = ({ value, onChange, options, placeholder, testidPrefix }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => options.filter((o) => o.code.toLowerCase().includes(query.toLowerCase()) || o.label.toLowerCase().includes(query.toLowerCase())),
    [options, query],
  );
  const selected = options.find((o) => o.code === value);
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
        <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute top-2.5 left-2" />
              <input autoFocus type="text" placeholder="Cari kode atau keterangan..." value={query} onChange={(e) => setQuery(e.target.value)} className="w-full pl-7 pr-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-red-900" />
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
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-red-50 hover:text-red-900 transition-colors ${value === o.code ? "bg-red-50 text-red-900 font-semibold" : "text-slate-700"}`}
                >
                  <div className="font-semibold font-mono">{o.code}</div>
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

const NomorUrutPicker = ({ value, onChange, taken }) => {
  const takenSet = useMemo(() => new Set(taken), [taken]);
  const isTaken = value !== "" && takenSet.has(Number(value));
  const suggestion = useMemo(() => {
    let n = 1;
    while (takenSet.has(n)) n += 1;
    return n;
  }, [takenSet]);
  return (
    <div className="space-y-1">
      <input data-testid="form-nomor-urut" type="number" min="1" value={value} onChange={(e) => onChange(e.target.value)} placeholder={`Contoh: ${suggestion}`} className={`${inputCls} ${isTaken ? "border-red-500 focus:ring-red-500" : ""}`} />
      {isTaken ? (
        <p className="text-[10px] text-red-700">Nomor {value} sudah dipakai. Nomor {suggestion} masih kosong.</p>
      ) : (
        <p className="text-[10px] text-slate-400">Boleh melompati nomor. Nomor berikut yang masih kosong: {suggestion}.</p>
      )}
    </div>
  );
};

export default function SuratKeluar() {
  const { user } = useAuth();
  // Tab aktif: "Ketua" atau "Sekretaris" - satu halaman Surat Keluar, tapi data dan
  // penomorannya dipisah per tab, sama seperti pola tab Surat Tugas / SPD.
  const [activeTab, setActiveTabState] = useState("Ketua");
  const [dataList, setDataList] = useState([]);
  const [subbagList, setSubbagList] = useState([]);
  const [jenisNaskahOptions, setJenisNaskahOptions] = useState([]);
  const [klasifikasiAll, setKlasifikasiAll] = useState([]);
  const [wilayahOptions, setWilayahOptions] = useState([]);
  const [filterKategori, setFilterKategori] = useState("");
  const [filterBidang, setFilterBidang] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm());
  const [file, setFile] = useState(null);
  const [existingLampiran, setExistingLampiran] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterDisposisi, setFilterDisposisi] = useState("Semua");
  const [filterSrikandi, setFilterSrikandi] = useState("Semua");
  // Filter Tahun di tabel - murni untuk menyaring tampilan, tahun diambil dari Tanggal tiap data.
  const [filterTahun, setFilterTahun] = useState(String(new Date().getFullYear()));

  // Tahun untuk Nomor Urut & nomor otomatis diambil langsung dari field Tanggal yang sedang diisi,
  // bukan dari pemilihan terpisah - jadi begitu Tanggal diganti, cek No Urut ikut pindah tahun juga.
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
  const ownSubbagCode = useMemo(() => subbagList.find((s) => s.id === user?.subbag_id)?.code, [subbagList, user]);
  const canApproveRow = useCallback((row) => canApproveGeneral && (isAdmin || row.disposisi === ownSubbagCode), [canApproveGeneral, isAdmin, ownSubbagCode]);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  // Ganti tab -> reset form & mode edit, karena datanya (termasuk nomor urut) terpisah per bagian.
  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    setForm(emptyForm());
    setFile(null);
    setExistingLampiran(null);
    setEditingId(null);
    setFilterKategori("");
    setFilterBidang("");
  };

  // Daftar Bidang mengikuti Klasifikasi (kategori) yang dipilih.
  const bidangOptions = useMemo(
    () => Array.from(new Set(klasifikasiAll.filter((k) => k.kategori === filterKategori).map((k) => k.bidang))),
    [klasifikasiAll, filterKategori],
  );
  // Kode Arsip dipersempit sesuai Klasifikasi + Bidang yang dipilih, jadi tidak lagi
  // mencari dari ratusan kode sekaligus.
  const kodeArsipOptions = useMemo(
    () =>
      klasifikasiAll
        .filter((k) => k.kategori === filterKategori && k.bidang === filterBidang)
        .map((k) => ({ code: k.kode, uraian: k.uraian, label: `${k.kode} — ${k.uraian}` })),
    [klasifikasiAll, filterKategori, filterBidang],
  );

  // Data surat keluar dipisah per tab berdasarkan bagian penandatangan.
  const dataListForTab = useMemo(() => dataList.filter((it) => it.bagian === activeTab), [dataList, activeTab]);

  // Nomor urut yang sudah dipakai dihitung per bagian DAN per tahun dari Tanggal yang sedang diisi di form,
  // supaya Nomor Urut otomatis bisa dipakai ulang tiap tahun tanpa perlu memilih tahun secara terpisah.
  const dataListForFormYear = useMemo(
    () => dataListForTab.filter((it) => (it.tanggal || "").startsWith(`${formYear}`)),
    [dataListForTab, formYear],
  );
  const nomorTerpakaiForTab = useMemo(() => dataListForFormYear.map((it) => it.nomorUrut), [dataListForFormYear]);

  // Nomor Surat Keluar dibentuk otomatis: {nomorUrut}/{kodeArsip}-{jenisNaskah}/{kodeWilayah}/{tahun}
  const generatedNomor = useMemo(() => buildNomorSuratKeluar({ ...form, subbagList }), [form, subbagList]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [list, subs, naskah, klas, wilayah] = await Promise.all([
        suratKeluarApi.list(),
        subbagianApi.list(),
        jenisNaskahApi.list(),
        klasifikasiApi.list({ activeOnly: true }),
        wilayahApi.list(),
      ]);
      setDataList(list);
      setSubbagList(subs);
      setJenisNaskahOptions(naskah || []);
      setKlasifikasiAll(klas || []);
      setWilayahOptions(wilayah || []);
    } catch (err) {
      toast.error(err.message || "Gagal memuat data surat keluar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleReset = () => {
    setForm(emptyForm());
    setFile(null);
    setExistingLampiran(null);
    setEditingId(null);
    setFilterKategori("");
    setFilterBidang("");
    toast.info("Form telah direset");
  };

  const startEdit = (it) => {
    setEditingId(it.id);
    setForm({
      nomorUrut: it.nomorUrut,
      jenisSurat: it.jenisSurat || "Surat Keluar",
      jenisNaskah: it.jenisNaskah || "",
      tanggal: it.tanggal,
      tujuan: it.tujuan,
      perihal: it.perihal,
      disposisi: it.disposisi,
      kodeArsip: it.kodeArsip || "",
      kodeWilayah: it.kodeWilayah || UNSET,
      penanggungJawab: it.penanggungJawab || "",
    });
    // Cari tahu Klasifikasi & Bidang dari kode arsip yang sudah tersimpan, supaya
    // dropdown bertingkat langsung terisi sesuai data yang sedang diedit.
    const match = klasifikasiAll.find((k) => k.kode === it.kodeArsip);
    setFilterKategori(match?.kategori || "");
    setFilterBidang(match?.bidang || "");
    setFile(null);
    setExistingLampiran(it.lampiran || null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const required =
      form.jenisSurat === "Surat Edaran"
        ? ["nomorUrut", "tanggal", "tujuan", "perihal", "disposisi", "penanggungJawab"]
        : ["nomorUrut", "jenisNaskah", "tanggal", "tujuan", "perihal", "disposisi", "kodeArsip", "penanggungJawab"];
    for (const k of required) {
      if (!form[k] && form[k] !== 0) {
        toast.error("Mohon lengkapi seluruh field yang wajib diisi");
        return;
      }
    }
    const nomor = buildNomorSuratKeluar({ ...form, subbagList });
    if (!nomor) {
      toast.error(
        form.jenisSurat === "Surat Edaran"
          ? "Nomor surat belum bisa dibentuk, pastikan Nomor Urut & Tanggal sudah terisi"
          : "Nomor surat belum bisa dibentuk, pastikan Nomor Urut, Kode Arsip, Jenis Naskah & Tanggal sudah terisi",
      );
      return;
    }
    // Tahun dari Tanggal yang diisi bukan tahun berjalan (susulan/arsip lama) -> minta konfirmasi dulu (khusus data baru).
    if (!editingId && formYear !== CURRENT_YEAR) {
      const ok = window.confirm(
        `Tanggal yang Anda isi berada di tahun ${formYear}, bukan tahun berjalan (${CURRENT_YEAR}). Nomor surat & Nomor Urut akan memakai tahun ${formYear}. Lanjutkan menyimpan?`,
      );
      if (!ok) return;
    }
    const payload = {
      ...form,
      bagian: activeTab,
      nomorUrut: Number(form.nomorUrut),
      nomor,
      kodeArsip: form.jenisSurat === "Surat Edaran" ? undefined : form.kodeArsip,
      jenisNaskah: form.jenisSurat === "Surat Edaran" ? undefined : form.jenisNaskah,
      kodeWilayah: form.jenisSurat === "Surat Edaran" ? undefined : form.kodeWilayah,
    };
    try {
      let saved;
      if (editingId) {
        saved = await suratKeluarApi.update(editingId, payload);
        toast.success("Surat keluar berhasil diperbarui");
      } else {
        saved = await suratKeluarApi.create(payload);
        toast.success("Surat keluar berhasil disimpan");
      }
      const targetId = editingId || saved?.id;
      if (file && targetId) {
        try {
          await suratKeluarApi.uploadLampiran(targetId, file);
        } catch (uploadErr) {
          toast.error(uploadErr.message || "Surat tersimpan, tapi lampiran gagal diunggah");
        }
      }
      setForm(emptyForm());
      setFile(null);
      setExistingLampiran(null);
      setEditingId(null);
      setFilterKategori("");
      setFilterBidang("");
      loadAll();
    } catch (err) {
      toast.error(err.message || "Gagal menyimpan surat keluar");
    }
  };

  const handleDelete = async (it) => {
    if (!window.confirm(`Hapus surat keluar "${it.perihal}"?`)) return;
    setBusyId(it.id);
    try {
      await suratKeluarApi.remove(it.id);
      toast.success("Surat keluar dihapus");
      loadAll();
    } catch (err) {
      toast.error(err.message || "Gagal menghapus surat keluar");
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleSrikandi = async (it) => {
    setBusyId(it.id);
    try {
      if (it.srikandi) {
        await suratKeluarApi.unapprove(it.id);
        toast.success("Persetujuan SRIKANDI dibatalkan");
      } else {
        await suratKeluarApi.approve(it.id);
        toast.success("Surat disetujui (SRIKANDI)");
      }
      loadAll();
    } catch (err) {
      toast.error(err.message || "Gagal memperbarui persetujuan");
    } finally {
      setBusyId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return dataListForTab
      .filter((it) => {
        if (q) {
          const hay = `${it.nomor} ${it.perihal} ${it.tujuan}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (filterDisposisi !== "Semua" && it.disposisi !== filterDisposisi) return false;
        if (filterSrikandi === "Sudah" && !it.srikandi) return false;
        if (filterSrikandi === "Belum" && it.srikandi) return false;
        if (filterTahun !== "Semua" && !(it.tanggal || "").startsWith(`${filterTahun}`)) return false;
        return true;
      })
      // Urut naik berdasarkan No Urut, supaya lompatan nomor (mis. 1 lalu 3, nomor 2 kosong)
      // tetap tampil sesuai urutan angkanya, bukan berdasarkan kapan datanya ditambahkan.
      .sort((a, b) => Number(a.nomorUrut) - Number(b.nomorUrut));
  }, [dataListForTab, searchQuery, filterDisposisi, filterSrikandi, filterTahun]);

  return (
    <AppLayout activePage="surat-keluar">
      <div data-testid="surat-keluar-container" className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-start gap-4">
            <div className="hidden sm:flex w-11 h-11 rounded-lg bg-red-900 items-center justify-center shadow-sm shrink-0">
              <Send className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-900 border border-red-200 mb-1.5 uppercase tracking-wide">Buku Agenda</span>
              <h1 data-testid="page-title-surat-keluar" className="text-2xl font-bold text-slate-900 tracking-tight">Surat Keluar</h1>
              <p className="text-sm text-slate-500 mt-0.5">Kelola dan catat data surat keluar bagian {activeTab}.</p>
            </div>
          </div>
        </div>

        {/* Tab: Ketua / Sekretaris - data & penomoran terpisah total per tab */}
        <TabToggle value={activeTab} onChange={setActiveTab} />

        {/* Inline Add / Edit Form */}
        <form onSubmit={handleSubmit} data-testid="form-tambah-surat-keluar" className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center gap-2">
            <FileText className="w-4 h-4 text-red-900" />
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">{editingId ? `Edit Surat Keluar (${activeTab})` : `Tambah Surat Keluar (${activeTab})`}</h2>
          </div>

          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Urutan: Jenis Surat -> Nomor Urut -> Klasifikasi -> Kode Arsip -> Jenis Naskah -> Kode Wilayah (opsional) -> Sub Bagian -> Nomor Otomatis */}
                <div className="md:col-span-2 lg:col-span-3">
                  <Field label="Jenis Surat" required testid="field-jenis-surat">
                    <div className="inline-flex items-center bg-slate-100 rounded-lg p-1">
                      {["Surat Keluar", "Surat Edaran"].map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          data-testid={`jenis-surat-${opt === "Surat Keluar" ? "sk" : "se"}`}
                          onClick={() => setField("jenisSurat", opt)}
                          className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                            form.jenisSurat === opt ? "bg-white text-red-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                    {form.jenisSurat === "Surat Edaran" && (
                      <p className="text-[10px] text-slate-400 mt-1.5">
                        Surat Edaran tidak memakai Kode Arsip/Jenis Naskah/Kode Wilayah — nomornya otomatis berformat "Nomor Urut TAHUN Tahun", sama seperti SK.
                      </p>
                    )}
                  </Field>
                </div>

                <Field label="Nomor Urut" required testid="field-nomor-urut">
                  <NomorUrutPicker value={form.nomorUrut} onChange={(v) => setField("nomorUrut", v)} taken={nomorTerpakaiForTab.filter((n) => n !== (editingId ? Number(form.nomorUrut) : null))} />
                </Field>

                {form.jenisSurat === "Surat Keluar" && (
                  <>
                <div className="md:col-span-2 lg:col-span-2">
                <Field label="Klasifikasi & Kode Arsip" required testid="field-kode-arsip">
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <select
                        data-testid="form-klasifikasi"
                        value={filterKategori}
                        onChange={(e) => {
                          setFilterKategori(e.target.value);
                          setFilterBidang("");
                          setField("kodeArsip", "");
                        }}
                        className={inputCls}
                      >
                        <option value="">Klasifikasi...</option>
                        <option value="Substantif">Substantif</option>
                        <option value="Fasilitatif">Fasilitatif</option>
                      </select>
                      <select
                        data-testid="form-bidang"
                        value={filterBidang}
                        disabled={!filterKategori}
                        onChange={(e) => {
                          setFilterBidang(e.target.value);
                          setField("kodeArsip", "");
                        }}
                        className={`${inputCls} disabled:bg-slate-50 disabled:text-slate-400`}
                      >
                        <option value="">{filterKategori ? "Pilih bidang..." : "Pilih klasifikasi dulu"}</option>
                        {bidangOptions.map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>
                    {filterBidang ? (
                      <SearchableCombobox value={form.kodeArsip} onChange={(v) => setField("kodeArsip", v)} options={kodeArsipOptions} placeholder="Pilih kode arsip..." testidPrefix="form-kode-arsip" />
                    ) : (
                      <p className="text-[10px] text-slate-400 italic">Pilih Klasifikasi lalu Bidang di atas dulu untuk mempersempit pilihan kode arsip.</p>
                    )}
                  </div>
                </Field>
                </div>

                <Field label="Jenis Naskah" required testid="field-jenis-naskah">
                  <select data-testid="form-jenis-naskah" value={form.jenisNaskah} onChange={(e) => setField("jenisNaskah", e.target.value)} className={inputCls}>
                    <option value="">{jenisNaskahOptions.length === 0 ? "Belum ada data di Master Data" : "Pilih jenis naskah..."}</option>
                    {jenisNaskahOptions.map((n) => (
                      <option key={n.id} value={n.kode}>
                        {n.kode} — {n.nama}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Kode Wilayah (opsional)" testid="field-kode-wilayah">
                  <select data-testid="form-kode-wilayah" value={form.kodeWilayah} onChange={(e) => setField("kodeWilayah", e.target.value)} className={inputCls}>
                    <option value={UNSET}>{wilayahOptions.length === 0 ? "Belum ada data" : "— Tidak ditambahkan —"}</option>
                    {wilayahOptions.map((w) => (
                      <option key={w.id || w.kode} value={w.kode}>
                        {w.kode} — {w.kecamatan}
                      </option>
                    ))}
                  </select>
                </Field>
                  </>
                )}

                <Field label="Sub Bagian (Disposisi)" required testid="field-disposisi">
                  <select data-testid="form-disposisi" value={form.disposisi} onChange={(e) => setField("disposisi", e.target.value)} className={inputCls}>
                    <option value="">Pilih sub-bagian...</option>
                    {subbagList.map((s) => (
                      <option key={s.id} value={s.code}>
                        {s.code} — {s.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <div className="md:col-span-2 lg:col-span-3">
                  <div data-testid="preview-nomor-surat-keluar" className="flex items-start gap-2.5 px-4 py-3 rounded-md border border-red-100 bg-red-50/60">
                    <Hash className="w-3.5 h-3.5 text-red-900 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-semibold text-red-900 uppercase tracking-wide">Nomor Surat (Otomatis)</p>
                      {generatedNomor ? (
                        <p className="text-sm font-mono font-bold text-slate-900 mt-0.5">{generatedNomor}</p>
                      ) : (
                        <p className="text-xs text-slate-400 mt-0.5">Lengkapi Nomor Urut, Kode Arsip, Jenis Naskah & Tanggal untuk membentuk nomor surat.</p>
                      )}
                      <p className="text-[10px] text-slate-400 mt-1">
                        Format: Nomor Urut / Kode Arsip - Jenis Naskah / [Kode Wilayah] / [Sub Bagian] / Tahun (dari Tanggal)
                        <br />
                        Kode Wilayah & Sub Bagian bersifat opsional di nomor — hanya muncul kalau dipilih.
                      </p>
                    </div>
                  </div>
                </div>

                <Field label="Tanggal" required testid="field-tanggal">
                  <input data-testid="form-tanggal" type="date" value={form.tanggal} onChange={(e) => setField("tanggal", e.target.value)} className={inputCls} />
                  {formYear !== CURRENT_YEAR ? (
                    <p className="text-[10px] text-amber-700 mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Nomor Urut & nomor surat akan memakai tahun {formYear} (bukan tahun berjalan, {CURRENT_YEAR}).
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-400 mt-1">Nomor Urut & nomor surat memakai tahun {formYear}.</p>
                  )}
                </Field>
                <Field label="Tujuan" required testid="field-tujuan">
                  <input data-testid="form-tujuan" type="text" value={form.tujuan} onChange={(e) => setField("tujuan", e.target.value)} placeholder="Contoh: PPK Se-Kota Banjarmasin" className={inputCls} />
                </Field>
                <Field label="Nama Penanggung Jawab" required testid="field-penanggung-jawab">
                  <input data-testid="form-penanggung-jawab" type="text" value={form.penanggungJawab} onChange={(e) => setField("penanggungJawab", e.target.value)} placeholder="Nama penanggung jawab surat" className={inputCls} />
                </Field>
                <div className="md:col-span-2 lg:col-span-3">
                  <Field label="Perihal" required testid="field-perihal">
                    <textarea data-testid="form-perihal" rows={3} value={form.perihal} onChange={(e) => setField("perihal", e.target.value)} placeholder="Uraikan perihal surat..." className={inputCls} />
                  </Field>
                </div>
                <div className="md:col-span-2 lg:col-span-3">
                  <Field label="Berkas Surat (Opsional)" testid="field-lampiran">
                    <FileUploadField file={file} onChange={setFile} existingLampiranName={existingLampiran} />
                  </Field>
                </div>
              </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/50 flex items-center justify-end gap-2">
            <button type="button" onClick={handleReset} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-600 border border-slate-300 rounded-md hover:bg-slate-100">
              <RotateCcw className="w-3.5 h-3.5" /> {editingId ? "Batal" : "Reset"}
            </button>
            <button type="submit" className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-red-900 rounded-md hover:bg-red-800">
              <Save className="w-3.5 h-3.5" /> {editingId ? "Simpan Perubahan" : "Simpan"}
            </button>
          </div>
        </form>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute top-2.5 left-2.5" />
            <input data-testid="filter-search" type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Cari perihal, nomor surat, tujuan..." className="w-full pl-8 pr-2 py-2 border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-red-900 focus:outline-none" />
          </div>
          <select data-testid="filter-tahun" value={filterTahun} onChange={(e) => setFilterTahun(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-md text-xs">
            <option value="Semua">Semua Tahun</option>
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select value={filterDisposisi} onChange={(e) => setFilterDisposisi(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-md text-xs">
            <option value="Semua">Semua Sub-bagian</option>
            {subbagList.map((s) => (
              <option key={s.id} value={s.code}>{s.code}</option>
            ))}
          </select>
          <select value={filterSrikandi} onChange={(e) => setFilterSrikandi(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-md text-xs">
            <option value="Semua">Semua SRIKANDI</option>
            <option value="Sudah">Sudah disetujui</option>
            <option value="Belum">Belum disetujui</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div data-testid="table-caption" className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-red-900" />
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">Surat Keluar &mdash; {activeTab}</h2>
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
                      <th className="px-4 py-3">Tanggal</th>
                      <th className="px-4 py-3">Nomor Surat</th>
                      <th className="px-4 py-3">Tujuan</th>
                      <th className="px-4 py-3">Perihal</th>
                      <th className="px-4 py-3">Penanggung Jawab</th>
                      <th className="px-4 py-3">Disposisi</th>
                      <th className="px-4 py-3 text-center">Lampiran</th>
                      <th className="px-4 py-3 text-center">SRIKANDI</th>
                      <th className="px-4 py-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200 text-xs">
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={10} className="px-4 py-10 text-center text-slate-400 italic">Tidak ada data surat keluar {activeTab} yang cocok dengan filter.</td>
                      </tr>
                    )}
                    {filtered.map((it) => (
                      <tr key={it.id} data-testid={`row-${it.id}`} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-900">{it.nomorUrut}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-700">{formatTgl(it.tanggal)}</td>
                        <td className="px-4 py-3 text-slate-700 max-w-[160px] truncate font-mono text-[11px]" title={it.nomor}>{it.nomor}</td>
                        <td className="px-4 py-3 font-medium text-slate-800 max-w-[160px] truncate" title={it.tujuan}>{it.tujuan}</td>
                        <td className="px-4 py-3 text-slate-700 max-w-[200px] truncate" title={it.perihal}>{it.perihal}</td>
                        <td className="px-4 py-3 text-slate-700 max-w-[160px] truncate" title={it.penanggungJawab}>{it.penanggungJawab}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${disposisiBadge(it.disposisi)}`}>{it.disposisi}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {it.lampiran ? <a href={suratKeluarApi.lampiranUrl(it.lampiran)} target="_blank" rel="noreferrer" data-testid={`link-lampiran-${it.id}`} className="inline-flex items-center text-[10px] font-semibold text-emerald-700 hover:underline"><Paperclip className="w-3.5 h-3.5 mr-1" /> Lihat</a> : <span className="text-slate-300">-</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {canApproveRow(it) ? (
                            <button
                              type="button"
                              disabled={busyId === it.id}
                              onClick={() => handleToggleSrikandi(it)}
                              className={`inline-flex items-center text-[10px] font-semibold rounded px-1.5 py-0.5 border ${it.srikandi ? "text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100" : "text-slate-500 border-slate-200 hover:bg-slate-100"}`}
                            >
                              {it.srikandi ? <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> : <XCircle className="w-3.5 h-3.5 mr-1" />}
                              {it.srikandi ? "Sudah" : "Klik utk setujui"}
                            </button>
                          ) : it.srikandi ? (
                            <span className="inline-flex items-center text-[10px] font-semibold text-emerald-700"><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Sudah</span>
                          ) : (
                            <span className="inline-flex items-center text-[10px] font-semibold text-slate-400"><XCircle className="w-3.5 h-3.5 mr-1" /> Belum</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button type="button" disabled={!canEdit} title={canEdit ? "Edit" : "Anda tidak punya izin edit"} onClick={() => startEdit(it)} className={`w-7 h-7 rounded-md border flex items-center justify-center ${canEdit ? "text-slate-600 border-slate-200 hover:bg-slate-100" : "text-slate-300 border-slate-100 cursor-not-allowed"}`}>
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button type="button" disabled={!canDelete || busyId === it.id} title={canDelete ? "Hapus" : "Anda tidak punya izin hapus"} onClick={() => handleDelete(it)} className={`w-7 h-7 rounded-md border flex items-center justify-center ${canDelete ? "text-red-700 border-red-200 hover:bg-red-50" : "text-slate-300 border-slate-100 cursor-not-allowed"}`}>
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
                {filtered.length === 0 && <div className="py-10 text-center text-slate-400 italic text-xs">Tidak ada data surat keluar {activeTab} yang cocok dengan filter.</div>}
                {filtered.map((it) => {
                  const isOpen = expandedId === it.id;
                  return (
                    <div key={it.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${disposisiBadge(it.disposisi)}`}>{it.disposisi}</span>
                            {it.lampiran && <a href={suratKeluarApi.lampiranUrl(it.lampiran)} target="_blank" rel="noreferrer" className="inline-flex items-center text-[10px] font-semibold text-emerald-700"><Paperclip className="w-3 h-3 mr-0.5" /> Berkas</a>}
                          </div>
                          <div className="text-sm font-semibold text-slate-900 leading-snug">{it.perihal}</div>
                          <div className="text-[11px] text-slate-500 mt-1">{it.tujuan}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {formatTgl(it.tanggal)}
                          </div>
                        </div>
                        <button type="button" onClick={() => setExpandedId(isOpen ? null : it.id)} className="shrink-0 w-8 h-8 rounded-md border border-slate-200 flex items-center justify-center text-slate-500 hover:text-red-900 hover:border-red-200 hover:bg-red-50 transition-colors">
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
                              <div className="text-slate-400 uppercase tracking-wide text-[9px] font-semibold">Penanggung Jawab</div>
                              <div className="text-slate-800 font-semibold">{it.penanggungJawab}</div>
                            </div>
                            <div className="col-span-2">
                              <div className="text-slate-400 uppercase tracking-wide text-[9px] font-semibold">Nomor Surat</div>
                              <div className="text-slate-800 font-mono break-all">{it.nomor}</div>
                            </div>
                            <div>
                              <div className="text-slate-400 uppercase tracking-wide text-[9px] font-semibold">Kode Arsip</div>
                              <div className="text-slate-800 font-mono">{it.kodeArsip}</div>
                            </div>
                            {it.kodeWilayah && (
                              <div>
                                <div className="text-slate-400 uppercase tracking-wide text-[9px] font-semibold">Kode Wilayah</div>
                                <div className="text-slate-800 font-mono">{it.kodeWilayah}</div>
                              </div>
                            )}
                            {it.lampiran && (
                              <div>
                                <div className="text-slate-400 uppercase tracking-wide text-[9px] font-semibold">Berkas</div>
                                <a href={suratKeluarApi.lampiranUrl(it.lampiran)} target="_blank" rel="noreferrer" className="text-emerald-700 hover:underline flex items-center gap-1"><Paperclip className="w-3 h-3" /> Buka berkas</a>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-2 pt-1">
                            {canApproveRow(it) ? (
                              <button type="button" disabled={busyId === it.id} onClick={() => handleToggleSrikandi(it)} className={`inline-flex items-center text-[11px] font-semibold rounded px-2 py-1 border ${it.srikandi ? "text-emerald-700 border-emerald-200 bg-emerald-50" : "text-slate-500 border-slate-200"}`}>
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