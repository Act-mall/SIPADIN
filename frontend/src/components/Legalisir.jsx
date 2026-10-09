import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AppLayout } from "./AppLayout";
import { legalisirApi } from "../api/legalisir";
import { klasifikasiApi } from "../api/klasifikasi";
import { wilayahApi } from "../api/master";
import {
  Stamp,
  Search,
  RotateCcw,
  Save,
  ChevronDown,
  ChevronUp,
  FileText,
  Calendar,
  Building2,
  UserCheck,
  UploadCloud,
  Paperclip,
  Hash,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

const UNSET = "__unset";

// Jenis naskah tetap untuk Legalisir (tidak dipilih pengguna, selalu "LGS").
const LEGALISIR_JENIS_NASKAH = "LGS";

// Sama seperti di Nota Dinas - daftar kode tujuan yang dipakai bersama.
const KODE_TUJUAN_OPTIONS = [
  { value: "Sek-Bjm", label: "Sek-Bjm" },
  { value: "K", label: "K" },
];

// Menyusun nomor Legalisir otomatis, pola sama seperti Nota Dinas/Surat Keluar:
// {noUrut}/{kodeArsip}-LGS/[kodeTujuan/][kodeWilayah/]{tahun}
// Contoh: 1/KU.03.1-LGS/Sek-Bjm/6371/2026
// Tahun diambil dari Tanggal Legalisir. Kode Tujuan & Kode Wilayah opsional -
// segmennya hanya muncul kalau dipilih (bukan UNSET).
const buildNomorLegalisir = ({ noUrut, kodeArsip, tanggalLegalisir, kodeTujuan, kodeWilayah }) => {
  if (!noUrut || !kodeArsip || !tanggalLegalisir) return "";
  const d = new Date(tanggalLegalisir);
  if (Number.isNaN(d.getTime())) return "";
  const segments = [`${noUrut}`, `${kodeArsip}-${LEGALISIR_JENIS_NASKAH}`];
  if (kodeTujuan && kodeTujuan !== UNSET) segments.push(kodeTujuan);
  if (kodeWilayah && kodeWilayah !== UNSET) segments.push(kodeWilayah);
  segments.push(`${d.getFullYear()}`);
  return segments.join("/");
};

const emptyForm = () => ({
  noUrut: "",
  kodeArsip: "",
  kodeTujuan: UNSET,
  kodeWilayah: UNSET,
  tanggalLegalisir: new Date().toISOString().split("T")[0],
  tandaTanganLegalisir: "",
  instansiParpol: "",
  perihal: "",
  tanggalPenyerahan: new Date().toISOString().split("T")[0],
  diserahkanKepada: "",
  arsipFileName: "",
  rawFile: null,
});

// SearchableCombobox untuk kode arsip - sama persis seperti di Nota Dinas.
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

// No Urut - boleh melompat, tapi diberi peringatan kalau bentrok dengan nomor lain.
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

const formatTgl = (iso) => {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
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

export default function Legalisir() {
  const [dataList, setDataList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const [klasifikasiAll, setKlasifikasiAll] = useState([]);
  const [wilayahOptions, setWilayahOptions] = useState([]);
  const [filterKategori, setFilterKategori] = useState("");
  const [filterBidang, setFilterBidang] = useState("");

  // Filters (tabel)
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTahun, setFilterTahun] = useState(String(new Date().getFullYear()));

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await legalisirApi.list();
      setDataList(list);
    } catch (e) {
      toast.error(e.message || "Gagal memuat data legalisir dari server");
    } finally {
      setLoading(false);
    }
  };

  const loadMasters = useCallback(async () => {
    try {
      const [klas, wilayah] = await Promise.all([
        klasifikasiApi.list({ activeOnly: true }),
        wilayahApi.list(),
      ]);
      setKlasifikasiAll(klas || []);
      setWilayahOptions(wilayah || []);
    } catch (e) {
      toast.error("Gagal memuat sebagian data master (Klasifikasi/Wilayah) dari server");
    }
  }, []);

  useEffect(() => {
    loadData();
    loadMasters();
  }, [loadMasters]);

  const bidangOptions = useMemo(
    () => Array.from(new Set(klasifikasiAll.filter((k) => k.kategori === filterKategori).map((k) => k.bidang))),
    [klasifikasiAll, filterKategori],
  );
  const kodeArsipOptions = useMemo(
    () =>
      klasifikasiAll
        .filter((k) => k.kategori === filterKategori && k.bidang === filterBidang)
        .map((k) => ({ code: k.kode, uraian: k.uraian, label: `${k.kode} — ${k.uraian}` })),
    [klasifikasiAll, filterKategori, filterBidang],
  );

  // No Urut yang sudah dipakai, dihitung per tahun dari Tanggal Legalisir yang sedang diisi.
  const formYear = useMemo(() => {
    const y = new Date(form.tanggalLegalisir).getFullYear();
    return Number.isNaN(y) ? new Date().getFullYear() : y;
  }, [form.tanggalLegalisir]);
  
  // Tabel ikut tahun dari Tanggal Legalisir di form.
  useEffect(() => {
    setFilterTahun(String(formYear));
  }, [formYear]);

  const nomorTerpakai = useMemo(
    () => dataList.filter((it) => (it.tanggalLegalisir || "").startsWith(`${formYear}`) && it.id !== editingId).map((it) => it.noUrut),
    [dataList, formYear, editingId],
  );

  const generatedNomor = useMemo(() => buildNomorLegalisir(form), [form]);

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
      kodeTujuan: it.kodeTujuan || UNSET,
      kodeWilayah: it.kodeWilayah || UNSET,
      tanggalLegalisir: it.tanggalLegalisir,
      tandaTanganLegalisir: it.tandaTanganLegalisir,
      instansiParpol: it.instansiParpol,
      perihal: it.perihal,
      tanggalPenyerahan: it.tanggalPenyerahan,
      diserahkanKepada: it.diserahkanKepada,
      arsipFileName: "",
      rawFile: null,
    });
    const klas = klasifikasiAll.find((k) => k.kode === it.kodeArsip);
    setFilterKategori(klas?.kategori || "");
    setFilterBidang(klas?.bidang || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (it) => {
    if (!window.confirm(`Hapus data legalisir nomor ${it.nomor}?`)) return;
    try {
      await legalisirApi.remove(it.id);
      toast.success("Data legalisir berhasil dihapus");
      await loadData();
    } catch (e) {
      toast.error(e.message || "Gagal menghapus data legalisir");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const required = [
      "noUrut",
      "kodeArsip",
      "tanggalLegalisir",
      "tandaTanganLegalisir",
      "instansiParpol",
      "perihal",
      "tanggalPenyerahan",
      "diserahkanKepada",
    ];
    for (const k of required) {
      if (!form[k] && form[k] !== 0) {
        toast.error("Mohon lengkapi seluruh field yang wajib diisi");
        return;
      }
    }
    setSubmitting(true);
    try {
      const payload = {
        noUrut: Number(form.noUrut),
        kodeArsip: form.kodeArsip,
        kodeTujuan: form.kodeTujuan && form.kodeTujuan !== UNSET ? form.kodeTujuan : undefined,
        kodeWilayah: form.kodeWilayah && form.kodeWilayah !== UNSET ? form.kodeWilayah : undefined,
        tanggalLegalisir: form.tanggalLegalisir,
        tandaTanganLegalisir: form.tandaTanganLegalisir,
        instansiParpol: form.instansiParpol,
        perihal: form.perihal,
        tanggalPenyerahan: form.tanggalPenyerahan,
        diserahkanKepada: form.diserahkanKepada,
      };
      let saved;
      if (editingId) {
        saved = await legalisirApi.update(editingId, payload);
        toast.success("Data legalisir berhasil diperbarui");
      } else {
        saved = await legalisirApi.create(payload);
        toast.success("Data legalisir berhasil disimpan");
      }
      if (form.rawFile) {
        try {
          await legalisirApi.uploadArsip(saved.id, form.rawFile);
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
      toast.error(e.message || "Gagal menyimpan data legalisir");
    } finally {
      setSubmitting(false);
    }
  };

  // Pilihan tahun: semua tahun yang ada datanya + tahun berjalan + tahun di form, terbaru dulu.
  const years = useMemo(() => {
    const set = new Set([String(new Date().getFullYear()), String(formYear)]);
    dataList.forEach((d) => {
      const y = (d.tanggalLegalisir || "").slice(0, 4);
      if (y) set.add(y);
    });
    return ["Semua", ...Array.from(set).sort().reverse()];
  }, [dataList, formYear]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return dataList.filter((it) => {
      if (q) {
        const hay = `${it.nomor} ${it.perihal} ${it.instansiParpol} ${it.diserahkanKepada}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filterTahun !== "Semua" && !(it.tanggalLegalisir || "").startsWith(filterTahun)) return false;
      return true;
    });
  }, [dataList, searchQuery, filterTahun]);

  if (loading) {
    return (
      <AppLayout activePage="legalisir">
        <div data-testid="legalisir-container" className="bg-white rounded-xl shadow-sm border border-slate-200 p-10 text-center text-sm text-slate-500">
          Memuat data legalisir...
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout activePage="legalisir">
      <div data-testid="legalisir-container" className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-start gap-4">
            <div className="hidden sm:flex w-11 h-11 rounded-lg bg-red-900 items-center justify-center shadow-sm shrink-0">
              <Stamp className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-900 border border-red-200 mb-1.5 uppercase tracking-wide">
                Buku Agenda
              </span>
              <h1 data-testid="page-title-legalisir" className="text-2xl font-bold text-slate-900 tracking-tight">
                Legalisir
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Pencatatan pengesahan dokumen dan salinan sah.
              </p>
            </div>
          </div>
        </div>

        {/* Inline Add Form */}
        <form
          onSubmit={handleSubmit}
          data-testid="form-tambah-legalisir"
          className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center gap-2">
            <FileText className="w-4 h-4 text-red-900" />
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">Tambah Data Legalisir</h2>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="No Urut" required testid="field-no-urut">
              <NomorUrutPicker
                value={form.noUrut}
                onChange={(v) => setField("noUrut", v)}
                taken={nomorTerpakai}
                inputCls={inputCls}
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

            <Field label="Kode Tujuan (opsional)" testid="field-kode-tujuan">
              <select
                data-testid="form-kode-tujuan"
                value={form.kodeTujuan}
                onChange={(e) => setField("kodeTujuan", e.target.value)}
                className={inputCls}
              >
                <option value={UNSET}>— Tidak ditambahkan —</option>
                {KODE_TUJUAN_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
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

            <div className="md:col-span-2 lg:col-span-3">
              <div data-testid="preview-nomor-legalisir" className="flex items-start gap-2.5 px-4 py-3 rounded-md border border-red-100 bg-red-50/60">
                <Hash className="w-3.5 h-3.5 text-red-900 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-semibold text-red-900 uppercase tracking-wide">Nomor Legalisir (Otomatis)</p>
                  {generatedNomor ? (
                    <p className="text-sm font-mono font-bold text-slate-900 mt-0.5">{generatedNomor}</p>
                  ) : (
                    <p className="text-xs text-slate-400 mt-0.5">
                      Lengkapi No Urut, Kode Arsip & Tanggal Legalisir untuk membentuk nomor.
                    </p>
                  )}
                  <p className="text-[10px] text-slate-400 mt-1">
                    Format: No Urut / Kode Arsip - LGS / [Kode Tujuan] / [Kode Wilayah] / Tahun
                    <br />
                    Bagian dalam kurung siku bersifat opsional — hanya muncul kalau dipilih.
                  </p>
                </div>
              </div>
            </div>

            <Field label="Tanggal Legalisir" required testid="field-tanggal-legalisir">
              <input
                data-testid="form-tanggal-legalisir"
                type="date"
                value={form.tanggalLegalisir}
                onChange={(e) => setField("tanggalLegalisir", e.target.value)}
                className={inputCls}
              />
            </Field>

            <Field label="Tanda Tangan Legalisir" required testid="field-ttd-legalisir">
              <input
                data-testid="form-ttd-legalisir"
                type="text"
                value={form.tandaTanganLegalisir}
                onChange={(e) => setField("tandaTanganLegalisir", e.target.value)}
                placeholder="Nama pejabat penandatangan"
                className={inputCls}
              />
            </Field>

            <Field label="Instansi/Parpol" required testid="field-instansi-parpol">
              <input
                data-testid="form-instansi-parpol"
                type="text"
                value={form.instansiParpol}
                onChange={(e) => setField("instansiParpol", e.target.value)}
                placeholder="Contoh: DPC Partai XYZ Kota Banjarmasin"
                className={inputCls}
              />
            </Field>

            <Field label="Tanggal Penyerahan Legalisir" required testid="field-tanggal-penyerahan">
              <input
                data-testid="form-tanggal-penyerahan"
                type="date"
                value={form.tanggalPenyerahan}
                onChange={(e) => setField("tanggalPenyerahan", e.target.value)}
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
                  placeholder="Uraikan perihal dokumen yang dilegalisir..."
                  className={inputCls}
                />
              </Field>
            </div>

            <Field label="Telah Diserahkan Kepada" required testid="field-diserahkan-kepada">
              <input
                data-testid="form-diserahkan-kepada"
                type="text"
                value={form.diserahkanKepada}
                onChange={(e) => setField("diserahkanKepada", e.target.value)}
                placeholder="Nama penerima"
                className={inputCls}
              />
            </Field>

            <div className="md:col-span-2">
              <Field label="Upload Arsip Legalisir" testid="field-upload-arsip">
                <label
                  htmlFor="legalisir-file-input"
                  className="w-full flex items-center justify-between px-3 py-2 border border-dashed border-slate-300 rounded-md text-xs bg-slate-50/50 hover:bg-slate-50 cursor-pointer"
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
                  id="legalisir-file-input"
                  data-testid="form-upload-arsip"
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
              data-testid="btn-simpan-legalisir"
              disabled={submitting}
              className="inline-flex items-center justify-center px-5 py-2 bg-red-900 hover:bg-red-800 text-white rounded-md text-xs font-semibold shadow-sm transition-colors disabled:opacity-60"
            >
              <Save className="w-3.5 h-3.5 mr-1.5" />
              {submitting ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Simpan Legalisir"}
            </button>
          </div>
        </form>

        {/* Data section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Stamp className="w-4 h-4 text-red-900" />
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">Data Legalisir</h2>
            </div>
            <span
              data-testid="data-count-badge"
              className="text-[10px] font-semibold text-red-900 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full"
            >
              {filtered.length} data
            </span>
          </div>

          {/* Filter Bar */}
          <div className="p-4 border-b border-slate-200 bg-slate-50/40 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative md:col-span-2">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="w-3.5 h-3.5 text-slate-400" />
              </span>
              <input
                data-testid="filter-search"
                type="text"
                placeholder="Cari nomor / perihal / instansi / penerima..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-red-900"
              />
            </div>

            <select
              data-testid="filter-tahun"
              value={filterTahun}
              onChange={(e) => setFilterTahun(e.target.value)}
              className="bg-white border border-slate-200 rounded-md px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-red-900"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y === "Semua" ? "Semua Tahun" : `Tahun ${y}`}
                </option>
              ))}
            </select>
          </div>

          {/* Desktop table */}
          <div className="hidden lg:block overflow-x-auto">
            <table data-testid="legalisir-table" className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">No. Urut</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nomor</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tgl Legalisir</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">TTD Legalisir</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Instansi/Parpol</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Perihal</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tgl Penyerahan</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Diserahkan Kepada</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Arsip</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200 text-xs">
                {loading && (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-slate-400">
                      <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Memuat data...
                    </td>
                  </tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-slate-400 italic">
                      Tidak ada data legalisir yang cocok dengan filter.
                    </td>
                  </tr>
                )}
                {!loading && filtered.map((it) => (
                  <tr key={it.id} data-testid={`row-${it.id}`} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-900">{it.noUrut}</td>
                    <td className="px-4 py-3 text-slate-700 font-mono">{it.nomor}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-700">{formatTgl(it.tanggalLegalisir)}</td>
                    <td className="px-4 py-3 text-slate-700 max-w-[160px] truncate" title={it.tandaTanganLegalisir}>
                      {it.tandaTanganLegalisir}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800 max-w-[180px] truncate" title={it.instansiParpol}>
                      {it.instansiParpol}
                    </td>
                    <td className="px-4 py-3 text-slate-700 max-w-[220px] truncate" title={it.perihal}>
                      {it.perihal}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-700">{formatTgl(it.tanggalPenyerahan)}</td>
                    <td className="px-4 py-3 text-slate-700 max-w-[160px] truncate" title={it.diserahkanKepada}>
                      {it.diserahkanKepada}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {legalisirApi.arsipUrl(it.arsipFile) ? (
                        <a
                          href={legalisirApi.arsipUrl(it.arsipFile)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center text-[10px] font-semibold text-emerald-700 hover:underline"
                        >
                          <Paperclip className="w-3.5 h-3.5 mr-1" /> Lihat
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
                Tidak ada data legalisir yang cocok dengan filter.
              </div>
            )}
            {!loading && filtered.map((it) => {
              const isOpen = expandedId === it.id;
              return (
                <div key={it.id} data-testid={`card-${it.id}`} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[10px] font-bold text-red-900 bg-red-50 border border-red-200 rounded px-1.5 py-0.5 font-mono">
                          {it.nomor}
                        </span>
                        {legalisirApi.arsipUrl(it.arsipFile) && (
                          <span className="inline-flex items-center text-[10px] font-semibold text-emerald-700">
                            <Paperclip className="w-3 h-3 mr-0.5" /> Arsip
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-semibold text-slate-900 leading-snug">{it.perihal}</div>
                      <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                        <Building2 className="w-3 h-3" /> {it.instansiParpol}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {formatTgl(it.tanggalLegalisir)}
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
                        <div className="text-slate-400 uppercase tracking-wide text-[9px] font-semibold flex items-center gap-1">
                          <UserCheck className="w-3 h-3" /> TTD Legalisir
                        </div>
                        <div className="text-slate-800">{it.tandaTanganLegalisir}</div>
                      </div>
                      <div>
                        <div className="text-slate-400 uppercase tracking-wide text-[9px] font-semibold">Tgl Penyerahan</div>
                        <div className="text-slate-800">{formatTgl(it.tanggalPenyerahan)}</div>
                      </div>
                      <div>
                        <div className="text-slate-400 uppercase tracking-wide text-[9px] font-semibold">Diserahkan Kepada</div>
                        <div className="text-slate-800">{it.diserahkanKepada}</div>
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