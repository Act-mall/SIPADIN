import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AppLayout } from "./AppLayout";
import { subbagianApi, jenisNaskahApi, wilayahApi } from "../api/master";
import { klasifikasiApi } from "../api/klasifikasi";
import { beritaAcaraApi } from "../api/beritaAcara";
import {
  FileCheck,
  AlertTriangle,
  Landmark,
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
  MapPin,
  Hash,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

const UNSET = "__unset";
const todayIso = () => new Date().toISOString().split("T")[0];

const CURRENT_YEAR = new Date().getFullYear();

// Menyusun nomor Berita Acara otomatis: {noUrut}/{kodeArsip}-{jenisNaskah}/[kodeWilayah/]{subBagianKode}/{tahun}
// Tahun-nya diambil langsung dari field Tanggal. Kode Wilayah opsional (dropdown Master Data
// Wilayah). Sub Bagian wajib dipilih di Berita Acara, kode angkanya lewat SUBBAG_NOMOR_CODE.
const buildNomorBeritaAcara = ({ noUrut, kodeArsip, jenisNaskah, tanggal, kodeWilayah, subbagId, subbags }) => {
  if (!noUrut || !kodeArsip || !jenisNaskah || !tanggal) return "";
  const tahun = new Date(tanggal).getFullYear();
  if (!tahun || Number.isNaN(tahun)) return "";
  const segments = [`${noUrut}`, `${kodeArsip}-${jenisNaskah}`];
  if (kodeWilayah && kodeWilayah !== UNSET) segments.push(kodeWilayah);
  const sub = subbags.find((s) => s.id === subbagId);
  if (sub?.angka) segments.push(`${sub.angka}`);
  segments.push(`${tahun}`);
  return segments.join("/");
};

const emptyForm = () => ({
  noUrut: "",
  kodeArsip: "",
  jenisNaskah: "",
  kodeWilayah: UNSET,
  tanggal: todayIso(),
  alamatTujuan: "",
  subbagId: "",
  penanggungJawab: "",
  perihal: "",
  arsipFileName: "",
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

// Tab Ketua / Sekretaris - data & nomor urut dipisah per bagian, sama seperti Surat Keluar.
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

// Kode Arsip dicari lewat combobox pencarian, sama persis dengan pola di Surat Keluar.
const SearchableCombobox = ({ value, onChange, options, placeholder, testidPrefix }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filteredOpts = useMemo(
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
              <input
                autoFocus
                type="text"
                placeholder="Cari kode atau keterangan..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-7 pr-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-red-900"
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filteredOpts.length === 0 ? (
              <div className="px-3 py-3 text-xs text-slate-400 italic">Tidak ada hasil</div>
            ) : (
              filteredOpts.map((o) => (
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

// No Urut - sama seperti Surat Keluar: boleh melompat, tapi diberi peringatan kalau bentrok.
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

export default function BeritaAcara() {
  const [activeTab, setActiveTabState] = useState("Ketua");
  const [dataList, setDataList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const [subbags, setSubbags] = useState([]);
  const [jenisNaskahOptions, setJenisNaskahOptions] = useState([]);
  const [wilayahOptions, setWilayahOptions] = useState([]);
  const [klasifikasiAll, setKlasifikasiAll] = useState([]);
  const [filterKategori, setFilterKategori] = useState("");
  const [filterBidang, setFilterBidang] = useState("");

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

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const list = await beritaAcaraApi.list();
      setDataList(list);
    } catch (e) {
      toast.error(e.message || "Gagal memuat data Berita Acara dari server");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMasters = useCallback(async () => {
    try {
      const [subs, naskah, klas, wilayah] = await Promise.all([
        subbagianApi.list(),
        jenisNaskahApi.list(),
        klasifikasiApi.list({ activeOnly: true }),
        wilayahApi.list(),
      ]);
      setSubbags(subs || []);
      setJenisNaskahOptions(naskah || []);
      setKlasifikasiAll(klas || []);
      setWilayahOptions(wilayah || []);
    } catch (e) {
      toast.error("Gagal memuat sebagian data master dari server, memakai data sementara");
    }
  }, []);

  useEffect(() => {
    loadData();
    loadMasters();
  }, [loadData, loadMasters]);

  const subbagLabel = (idOrCode) => {
    const found = subbags.find((s) => (s.id || s.code) === idOrCode);
    return found ? found.name : idOrCode || "-";
  };

  // Daftar Bidang mengikuti Klasifikasi yang dipilih.
  const bidangOptions = useMemo(
    () => Array.from(new Set(klasifikasiAll.filter((k) => k.kategori === filterKategori).map((k) => k.bidang))),
    [klasifikasiAll, filterKategori],
  );
  // Kode Arsip dipersempit sesuai Klasifikasi + Bidang yang dipilih.
  const kodeArsipOptions = useMemo(
    () =>
      klasifikasiAll
        .filter((k) => k.kategori === filterKategori && k.bidang === filterBidang)
        .map((k) => ({ code: k.kode, uraian: k.uraian, label: `${k.kode} — ${k.uraian}` })),
    [klasifikasiAll, filterKategori, filterBidang],
  );

  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    setForm(emptyForm());
    setEditingId(null);
    setFilterKategori("");
    setFilterBidang("");
  };

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleReset = () => {
    setForm(emptyForm());
    setEditingId(null);
    setFilterKategori("");
    setFilterBidang("");
    toast.info("Form telah direset");
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setForm((f) => ({ ...f, arsipFileName: file.name, rawFile: file }));
  };

  const handleEdit = (it) => {
    setEditingId(it.id);
    setForm({
      noUrut: it.noUrut,
      kodeArsip: it.kodeArsip,
      jenisNaskah: it.jenisNaskah,
      kodeWilayah: it.kodeWilayah || UNSET,
      tanggal: it.tanggal,
      alamatTujuan: it.alamatTujuan,
      subbagId: it.subbagId,
      penanggungJawab: it.penanggungJawab,
      perihal: it.perihal,
      arsipFileName: "",
      rawFile: null,
    });
    const klas = klasifikasiAll.find((k) => k.kode === it.kodeArsip);
    setFilterKategori(klas?.kategori || "");
    setFilterBidang(klas?.bidang || "");
    if (it.bagian !== activeTab) setActiveTabState(it.bagian);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (it) => {
    if (!window.confirm(`Hapus data Berita Acara nomor ${it.nomor}?`)) return;
    try {
      await beritaAcaraApi.remove(it.id);
      toast.success("Data Berita Acara berhasil dihapus");
      await loadData();
    } catch (e) {
      toast.error(e.message || "Gagal menghapus data Berita Acara");
    }
  };

  // Data dipisah per tab (Ketua / Sekretaris) untuk tabel.
  const dataListForTab = useMemo(() => dataList.filter((it) => it.bagian === activeTab), [dataList, activeTab]);
  // No Urut yang sudah dipakai dihitung per bagian DAN per tahun dari Tanggal yang sedang diisi di form,
  // supaya No Urut otomatis bisa dipakai ulang tiap tahun.
  const dataListForFormYear = useMemo(
    () => dataListForTab.filter((it) => (it.tanggal || "").startsWith(`${formYear}`)),
    [dataListForTab, formYear],
  );
  const nomorTerpakaiForTab = useMemo(
    () => dataListForFormYear.filter((it) => it.id !== editingId).map((it) => it.noUrut),
    [dataListForFormYear, editingId],
  );
  const generatedNomor = useMemo(() => buildNomorBeritaAcara({ ...form, subbags }), [form, subbags]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const required = ["noUrut", "kodeArsip", "jenisNaskah", "tanggal", "alamatTujuan", "subbagId", "penanggungJawab", "perihal"];
    for (const k of required) {
      if (!form[k]) {
        toast.error("Mohon lengkapi seluruh field yang wajib diisi");
        return;
      }
    }
    const nomor = buildNomorBeritaAcara({ ...form, subbags });
    if (!nomor) {
      toast.error("Nomor Berita Acara belum bisa dibentuk, pastikan No Urut, Kode Arsip, Jenis Naskah & Tanggal sudah terisi");
      return;
    }
    // Tahun dari Tanggal yang diisi bukan tahun berjalan (susulan/arsip lama) -> minta konfirmasi dulu.
    if (!editingId && formYear !== CURRENT_YEAR) {
      const ok = window.confirm(
        `Tanggal yang Anda isi berada di tahun ${formYear}, bukan tahun berjalan (${CURRENT_YEAR}). Lanjutkan menyimpan?`,
      );
      if (!ok) return;
    }
    const payload = {
      bagian: activeTab,
      noUrut: Number(form.noUrut),
      nomor,
      kodeArsip: form.kodeArsip,
      jenisNaskah: form.jenisNaskah,
      kodeWilayah: form.kodeWilayah && form.kodeWilayah !== UNSET ? form.kodeWilayah : undefined,
      subbagId: form.subbagId,
      tanggal: form.tanggal,
      alamatTujuan: form.alamatTujuan,
      penanggungJawab: form.penanggungJawab,
      perihal: form.perihal,
    };
    setSubmitting(true);
    try {
      let saved;
      if (editingId) {
        saved = await beritaAcaraApi.update(editingId, payload);
        toast.success("Data Berita Acara berhasil diperbarui");
      } else {
        saved = await beritaAcaraApi.create(payload);
        toast.success("Data Berita Acara berhasil disimpan");
      }
      if (form.rawFile) {
        try {
          await beritaAcaraApi.uploadArsip(saved.id, form.rawFile);
        } catch (e) {
          toast.error(e.message || "Data tersimpan, tapi gagal mengunggah arsip");
        }
      }
      setForm(emptyForm());
      setEditingId(null);
      setFilterKategori("");
      setFilterBidang("");
      await loadData();
    } catch (e) {
      toast.error(e.message || "Gagal menyimpan data Berita Acara");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return dataListForTab
      .filter((it) => {
        if (filterTahun !== "Semua" && !(it.tanggal || "").startsWith(`${filterTahun}`)) return false;
        if (!q) return true;
        const hay = `${it.nomor} ${it.perihal} ${it.alamatTujuan} ${subbagLabel(it.subbagId)}`.toLowerCase();
        return hay.includes(q);
      })
      // Urut naik berdasarkan No Urut, supaya lompatan nomor (mis. 1 lalu 3, nomor 2 kosong)
      // tetap tampil sesuai urutan angkanya, bukan berdasarkan kapan datanya ditambahkan.
      .sort((a, b) => Number(a.noUrut) - Number(b.noUrut));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataListForTab, searchQuery, subbags, filterTahun]);

  return (
    <AppLayout activePage="berita-acara">
      <div data-testid="berita-acara-container" className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-start gap-4">
            <div className="hidden sm:flex w-11 h-11 rounded-lg bg-red-900 items-center justify-center shadow-sm shrink-0">
              <FileCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-900 border border-red-200 mb-1.5 uppercase tracking-wide">
                Buku Agenda
              </span>
              <h1 data-testid="page-title-berita-acara" className="text-2xl font-bold text-slate-900 tracking-tight">
                Berita Acara
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Pencatatan Berita Acara bagian {activeTab} beserta arsipnya.
              </p>
            </div>
          </div>
        </div>

        {/* Tab: Ketua / Sekretaris - data & penomoran terpisah total per tab */}
        <TabToggle value={activeTab} onChange={setActiveTab} />

        {/* Inline Add Form */}
        <form
          onSubmit={handleSubmit}
          data-testid="form-tambah-berita-acara"
          className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center gap-2">
            <FileText className="w-4 h-4 text-red-900" />
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              Tambah Data Berita Acara &mdash; Bagian {activeTab}
            </h2>
          </div>

          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Urutan: No Urut -> Klasifikasi -> Kode Arsip -> Jenis Naskah -> (Kode Wilayah otomatis) */}
              <Field label="No Urut" required testid="field-no-urut">
                <NomorUrutPicker
                  value={form.noUrut}
                  onChange={(v) => setField("noUrut", v)}
                  taken={nomorTerpakaiForTab}
                />
              </Field>

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
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </div>
                    {filterBidang ? (
                      <SearchableCombobox
                        value={form.kodeArsip}
                        onChange={(v) => setField("kodeArsip", v)}
                        options={kodeArsipOptions}
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

              <Field label="Jenis Naskah" required testid="field-jenis-naskah">
                <select
                  data-testid="form-jenis-naskah"
                  value={form.jenisNaskah}
                  onChange={(e) => setField("jenisNaskah", e.target.value)}
                  className={inputCls}
                >
                  <option value="">{jenisNaskahOptions.length === 0 ? "Belum ada data" : "Pilih jenis naskah..."}</option>
                  {jenisNaskahOptions.map((n) => (
                    <option key={n.id || n.kode} value={n.kode}>
                      {n.kode} — {n.nama}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Kode Wilayah (opsional)" testid="field-kode-wilayah">
                <select
                  data-testid="form-kode-wilayah"
                  value={form.kodeWilayah}
                  onChange={(e) => setField("kodeWilayah", e.target.value)}
                  className={inputCls}
                >
                  <option value={UNSET}>{wilayahOptions.length === 0 ? "Belum ada data" : "— Tidak ditambahkan —"}</option>
                  {wilayahOptions.map((w) => (
                    <option key={w.id || w.kode} value={w.kode}>
                      {w.kode} — {w.kecamatan}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Sub Bagian" required testid="field-subbag">
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

              <div className="md:col-span-2 lg:col-span-3">
                <div data-testid="preview-nomor-berita-acara" className="flex items-start gap-2.5 px-4 py-3 rounded-md border border-red-100 bg-red-50/60">
                  <Hash className="w-3.5 h-3.5 text-red-900 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-semibold text-red-900 uppercase tracking-wide">Nomor Berita Acara (Otomatis)</p>
                    {generatedNomor ? (
                      <p className="text-sm font-mono font-bold text-slate-900 mt-0.5">{generatedNomor}</p>
                    ) : (
                      <p className="text-xs text-slate-400 mt-0.5">
                        Lengkapi No Urut, Kode Arsip, Jenis Naskah & Tanggal untuk membentuk nomor.
                      </p>
                    )}
                    <p className="text-[10px] text-slate-400 mt-1">
                      Format: No Urut / Kode Arsip - Jenis Naskah / [Kode Wilayah] / Sub Bagian / Tahun (dari Tanggal)
                      <br />
                      Kode Wilayah bersifat opsional — hanya muncul kalau dipilih.
                    </p>
                  </div>
                </div>
              </div>

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

              <Field label="Alamat Tujuan" required testid="field-alamat-tujuan">
                <input
                  data-testid="form-alamat-tujuan"
                  type="text"
                  value={form.alamatTujuan}
                  onChange={(e) => setField("alamatTujuan", e.target.value)}
                  placeholder="Contoh: PPK Se-Kota Banjarmasin"
                  className={inputCls}
                />
              </Field>

              <Field label="Penanggung Jawab Berita Acara" required testid="field-penanggung-jawab">
                <input
                  data-testid="form-penanggung-jawab"
                  type="text"
                  value={form.penanggungJawab}
                  onChange={(e) => setField("penanggungJawab", e.target.value)}
                  placeholder="Nama penanggung jawab"
                  className={inputCls}
                />
              </Field>

              <div className="md:col-span-2 lg:col-span-3">
                <Field label="Perihal" required testid="field-perihal">
                  <textarea
                    data-testid="form-perihal"
                    rows={2}
                    value={form.perihal}
                    onChange={(e) => setField("perihal", e.target.value)}
                    placeholder="Uraikan perihal Berita Acara..."
                    className={inputCls}
                  />
                </Field>
              </div>

              {/* Upload Arsip diletakkan paling akhir, setelah Perihal */}
              <div className="md:col-span-2 lg:col-span-3">
                <Field label="Upload Arsip" testid="field-upload-arsip">
                  <label
                    htmlFor="ba-file-input"
                    className="w-full flex items-center justify-between px-3 py-2 border border-dashed border-slate-300 rounded-md text-xs bg-slate-50/50 hover:bg-slate-50 cursor-pointer max-w-xl"
                  >
                    <span className="flex items-center gap-2 text-slate-500 truncate">
                      <UploadCloud className="w-3.5 h-3.5 shrink-0" />
                      {form.arsipFileName ? (
                        <span className="text-slate-800 font-medium truncate">{form.arsipFileName}</span>
                      ) : (
                        "Pilih file arsip (PDF/JPG/PNG)..."
                      )}
                    </span>
                  </label>
                  <input
                    id="ba-file-input"
                    data-testid="form-upload-arsip"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </Field>
              </div>
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
              data-testid="btn-simpan-berita-acara"
              disabled={submitting}
              className="inline-flex items-center justify-center px-5 py-2 bg-red-900 hover:bg-red-800 text-white rounded-md text-xs font-semibold shadow-sm transition-colors disabled:opacity-60"
            >
              <Save className="w-3.5 h-3.5 mr-1.5" />
              {submitting ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Simpan Berita Acara"}
            </button>
          </div>
        </form>

        {/* Data section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-red-900" />
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                Data Berita Acara &mdash; {activeTab}
              </h2>
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
                placeholder="Cari nomor / perihal / alamat tujuan / subbagian..."
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
            <table data-testid="berita-acara-table" className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">No. Urut</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nomor Berita Acara</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tanggal</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Alamat Tujuan</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Perihal</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Subbagian</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Penanggung Jawab</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Arsip</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200 text-xs">
                {loading && (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                      <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Memuat data...
                    </td>
                  </tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-slate-400 italic">
                      Tidak ada data Berita Acara {activeTab} yang cocok dengan filter.
                    </td>
                  </tr>
                )}
                {!loading && filtered.map((it) => (
                  <tr key={it.id} data-testid={`row-${it.id}`} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-900">{it.noUrut}</td>
                    <td className="px-4 py-3 text-slate-700 max-w-[180px] truncate font-mono text-[11px]" title={it.nomor}>
                      {it.nomor}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-700">{formatTgl(it.tanggal)}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 max-w-[180px] truncate" title={it.alamatTujuan}>
                      {it.alamatTujuan}
                    </td>
                    <td className="px-4 py-3 text-slate-700 max-w-[200px] truncate" title={it.perihal}>
                      {it.perihal}
                    </td>
                    <td className="px-4 py-3 text-slate-700 max-w-[160px] truncate" title={subbagLabel(it.subbagId)}>
                      {subbagLabel(it.subbagId)}
                    </td>
                    <td className="px-4 py-3 text-slate-700 max-w-[160px] truncate" title={it.penanggungJawab}>
                      {it.penanggungJawab}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {beritaAcaraApi.arsipUrl(it.arsipFile) ? (
                        <a
                          href={beritaAcaraApi.arsipUrl(it.arsipFile)}
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

          {/* Mobile / Tablet cards */}
          <div className="lg:hidden divide-y divide-slate-100">
            {loading && (
              <div className="py-10 text-center text-slate-400 text-xs">
                <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Memuat data...
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="py-10 text-center text-slate-400 italic text-xs">
                Tidak ada data Berita Acara {activeTab} yang cocok dengan filter.
              </div>
            )}
            {!loading && filtered.map((it) => {
              const isOpen = expandedId === it.id;
              return (
                <div key={it.id} data-testid={`card-${it.id}`} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[10px] font-mono font-semibold text-red-900 bg-red-50 border border-red-200 rounded px-1.5 py-0.5 truncate max-w-[160px]">
                          {it.nomor}
                        </span>
                        {beritaAcaraApi.arsipUrl(it.arsipFile) && (
                          <a
                            href={beritaAcaraApi.arsipUrl(it.arsipFile)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center text-[10px] font-semibold text-emerald-700"
                          >
                            <Paperclip className="w-3 h-3 mr-0.5" /> Arsip
                          </a>
                        )}
                      </div>
                      <div className="text-sm font-semibold text-slate-900 leading-snug">{it.perihal}</div>
                      <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {it.alamatTujuan}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
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
                      <div>
                        <div className="text-slate-400 uppercase tracking-wide text-[9px] font-semibold">Penanggung Jawab</div>
                        <div className="text-slate-800">{it.penanggungJawab}</div>
                      </div>
                      <div>
                        <div className="text-slate-400 uppercase tracking-wide text-[9px] font-semibold">Kode Arsip</div>
                        <div className="text-slate-800 font-mono">{it.kodeArsip}</div>
                      </div>
                      <div>
                        <div className="text-slate-400 uppercase tracking-wide text-[9px] font-semibold">Jenis Naskah</div>
                        <div className="text-slate-800 font-mono">{it.jenisNaskah}</div>
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