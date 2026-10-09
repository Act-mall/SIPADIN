import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { AppLayout } from "./AppLayout";
import { klasifikasiApi } from "../api/klasifikasi";
import { suratTugasApi, spdApi } from "../api/suratTugas";
import { jenisNaskahApi, pegawaiApi, wilayahApi } from "../api/master";
import {
  Briefcase,
  AlertTriangle,
  FileText,
  MapPin,
  Search,
  RotateCcw,
  Save,
  ChevronDown,
  Pencil,
  Trash2,
  Paperclip,
  Upload,
  X,
  Users,
  Loader2,
  Calendar,
  Hash,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

// ── Konstanta ────────────────────────────────────────────────────────────
const KATEGORI_KLASIFIKASI_OPTIONS = ["Substantif", "Fasilitatif"];
// Sentinel untuk field opsional yang belum dipilih (segmen tidak ikut dibentuk di nomor).
const UNSET = "__unset";
const CHECKLIST_OPTIONS = [
  "Daftar Hadir Lengkap",
  "Dokumentasi Lengkap",
  "Laporan TTD Lengkap",
  "Undangan dan Rundown Lengkap",
  "Daftar Hadir Tidak Lengkap",
  "Dokumentasi Tidak Lengkap",
  "Laporan Tidak Lengkap",
  "Undangan dan Rundown Tidak Lengkap",
];
const KETERANGAN_PERJADIN_OPTIONS = ["Uang Transport", "Uang Harian", "Uang Saku"];
const MAX_FILE_MB = 10;
const BAGIAN = "Sekretaris";

const todayIso = () => new Date().toISOString().split("T")[0];

const CURRENT_YEAR = new Date().getFullYear();


// Menyusun nomor surat tugas otomatis: {nomorUrut}/{kodeArsip}-{jenisNaskah}/[kodeWilayah/]{tahun}
// Tahun-nya diambil langsung dari field Tanggal. Kode Wilayah opsional (Master Data Wilayah).
const buildNomorSuratTugas = ({ nomorUrut, kodeArsip, jenisNaskah, tanggal, kodeWilayah }) => {
  if (!nomorUrut || !kodeArsip || !jenisNaskah || !tanggal) return "";
  const tahun = new Date(tanggal).getFullYear();
  if (!tahun || Number.isNaN(tahun)) return "";
  const segments = [`${nomorUrut}`, `${kodeArsip}-${jenisNaskah}`];
  if (kodeWilayah && kodeWilayah !== UNSET) segments.push(kodeWilayah);
  segments.push(`${tahun}`);
  return segments.join("/");
};

const ROMAN_MONTHS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

// Menyusun nomor SPD otomatis: {nomorUrut}/{kodeArsip}-{jenisNaskah}/[kodeWilayah/]{bulanRomawi}/{tahun}
// Kode Wilayah di sini juga opsional, sama seperti Surat Tugas.
const buildNomorSpd = ({ nomorUrut, kodeArsip, jenisNaskah, tanggal, kodeWilayah }) => {
  if (!nomorUrut || !kodeArsip || !jenisNaskah || !tanggal) return "";
  const d = new Date(tanggal);
  const tahun = d.getFullYear();
  if (!tahun || Number.isNaN(tahun)) return "";
  const bulanRomawi = ROMAN_MONTHS[d.getMonth()];
  const segments = [`${nomorUrut}`, `${kodeArsip}-${jenisNaskah}`];
  if (kodeWilayah && kodeWilayah !== UNSET) segments.push(kodeWilayah);
  segments.push(bulanRomawi, `${tahun}`);
  return segments.join("/");
};

const formatTgl = (iso) => {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  } catch (_e) {
    return iso;
  }
};

const formatFileSize = (bytes) => {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const emptyFormTugas = () => ({
  nomorUrut: "",
  jenisNaskah: "",
  tanggal: todayIso(),
  pegawaiList: [],
  perihal: "",
  pembuatSuratTugas: "",
  checklistKelengkapan: [],
  keteranganPerjadin: "",
  kategoriKlasifikasi: "",
  kodeArsip: "",
  kodeWilayah: UNSET,
});

const emptyFormSpd = () => ({
  nomorUrut: "",
  jenisNaskah: "",
  tanggal: todayIso(),
  suratTugasId: "",
  stafList: [],
  tempatTujuan: "",
  lamaBerangkat: "",
  tanggalBerangkat: todayIso(),
  pembuatSpd: "",
  kategoriKlasifikasi: "",
  kodeArsip: "",
  kodeWilayah: UNSET,
});

// ── Komponen kecil bersama ──────────────────────────────────────────────
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

// Kode Arsip: searchable combobox dari backend klasifikasi-arsip, terkunci sampai
// kategori (Substantif/Fasilitatif) dipilih, dan bisa dicari berdasar kode / keterangan.
const KodeArsipCombobox = ({ options, value, onChange, disabled, testidPrefix }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => options.filter((o) => o.code.toLowerCase().includes(query.toLowerCase()) || o.uraian.toLowerCase().includes(query.toLowerCase())),
    [options, query],
  );
  const selected = options.find((o) => o.code === value);

  if (disabled) {
    return (
      <div
        data-testid={`${testidPrefix}-disabled`}
        className="w-full flex items-center px-3 py-2 border border-dashed border-slate-300 rounded-md text-xs bg-slate-50 text-slate-400"
      >
        Pilih klasifikasi terlebih dahulu...
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
        <span className={selected ? "text-slate-900" : "text-slate-400"}>{selected ? selected.code : "Pilih kode arsip..."}</span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
      </button>
      {selected && (
        <p data-testid={`${testidPrefix}-keterangan`} className="mt-1 text-[11px] text-slate-500 leading-snug">
          {selected.uraian}
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
                placeholder="Cari kode atau keterangan..."
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
                  <div className="font-semibold font-mono">{o.code}</div>
                  <div className="text-[11px] text-slate-500 leading-snug">{o.uraian}</div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Field klasifikasi + kode arsip berdampingan (dipakai di kedua form)
const KlasifikasiKodeArsipFields = ({ form, setField, setKategori, kodeArsipOptions, testidPrefix }) => {
  const [bidang, setBidang] = useState("");

  // Kalau form sudah berisi Kode Arsip (mis. mode edit), Bidang-nya terisi otomatis.
  useEffect(() => {
    if (!form.kodeArsip) return;
    const cocok = kodeArsipOptions.find((o) => o.code === form.kodeArsip && o.kategori === form.kategoriKlasifikasi);
    if (cocok) setBidang(cocok.bidang || "");
  }, [form.kodeArsip, form.kategoriKlasifikasi, kodeArsipOptions]);

  // Form dikosongkan (setelah simpan atau batal) -> Bidang ikut kosong.
  useEffect(() => {
    if (!form.kategoriKlasifikasi) setBidang("");
  }, [form.kategoriKlasifikasi]);

  // Bidang mengikuti Klasifikasi; Kode Arsip dipersempit oleh Klasifikasi + Bidang.
  const bidangOptions = useMemo(
    () => Array.from(new Set(kodeArsipOptions.filter((o) => o.kategori === form.kategoriKlasifikasi).map((o) => o.bidang).filter(Boolean))),
    [kodeArsipOptions, form.kategoriKlasifikasi],
  );
  const filteredOptions = useMemo(
    () => kodeArsipOptions.filter((o) => o.kategori === form.kategoriKlasifikasi && o.bidang === bidang),
    [kodeArsipOptions, form.kategoriKlasifikasi, bidang],
  );
  return (
    <div className="md:col-span-2 lg:col-span-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="Klasifikasi" required testid={`field-${testidPrefix}-kategori`}>
          <select
            data-testid={`form-${testidPrefix}-kategori`}
            value={form.kategoriKlasifikasi}
            onChange={(e) => {
              setBidang("");
              setKategori(e.target.value);
            }}
            className={inputCls}
          >
            <option value="">Pilih klasifikasi...</option>
            {KATEGORI_KLASIFIKASI_OPTIONS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Bidang" required testid={`field-${testidPrefix}-bidang`}>
          <select
            data-testid={`form-${testidPrefix}-bidang`}
            value={bidang}
            disabled={!form.kategoriKlasifikasi}
            onChange={(e) => {
              setBidang(e.target.value);
              setField("kodeArsip", "");
            }}
            className={inputCls}
          >
            <option value="">{form.kategoriKlasifikasi ? "Pilih bidang..." : "Pilih klasifikasi dulu"}</option>
            {bidangOptions.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Kode Arsip" required testid={`field-${testidPrefix}-kode-arsip`}>
          <KodeArsipCombobox
            options={filteredOptions}
            value={form.kodeArsip}
            onChange={(v) => setField("kodeArsip", v)}
            disabled={!bidang}
            testidPrefix={`form-${testidPrefix}-kode-arsip`}
          />
        </Field>
      </div>
    </div>
  );
};

// Input tag nama pegawai/staf yang berangkat - bisa ketik bebas (mis. "Seluruh Staf")
// ATAU pilih dari master data pegawai (bisa lebih dari satu), keduanya masuk daftar yang sama.
const PegawaiTagInput = ({ value, onChange, pegawaiOptions }) => {
  const [text, setText] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");

  const addName = (name) => {
    const n = name.trim();
    if (!n) return;
    if (value.includes(n)) {
      toast.error("Nama tersebut sudah ditambahkan");
      return;
    }
    onChange([...value, n]);
  };

  const handleAddFreeText = () => {
    addName(text);
    setText("");
  };

  const removeName = (name) => onChange(value.filter((n) => n !== name));

  const filteredPegawai = useMemo(
    () => pegawaiOptions.filter((p) => `${p.name} ${p.jabatan}`.toLowerCase().includes(pickerQuery.toLowerCase())),
    [pegawaiOptions, pickerQuery],
  );

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          data-testid="form-pegawai-input"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              handleAddFreeText();
            }
          }}
          placeholder="Ketik keterangan bebas, mis. Seluruh Komisioner, lalu Enter"
          className={inputCls}
        />
        <button
          type="button"
          data-testid="form-pegawai-add"
          onClick={handleAddFreeText}
          className="shrink-0 px-3 py-2 text-xs font-semibold text-red-900 border border-red-200 rounded-md bg-red-50 hover:bg-red-100"
        >
          Tambah
        </button>
      </div>

      {/* Pilih dari master data pegawai */}
      <div className="relative">
        <button
          type="button"
          data-testid="form-pegawai-picker-trigger"
          onClick={() => setPickerOpen((v) => !v)}
          className="w-full flex items-center gap-1.5 px-3 py-2 border border-dashed border-slate-300 rounded-md text-xs text-slate-500 bg-white hover:bg-slate-50 hover:border-red-300 transition-colors"
        >
          <UserPlus className="w-3.5 h-3.5 text-slate-400" />
          Atau pilih dari master data pegawai...
        </button>
        {pickerOpen && (
          <div data-testid="form-pegawai-picker-dropdown" className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg">
            <div className="p-2 border-b border-slate-100">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute top-2.5 left-2" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Cari nama / jabatan..."
                  value={pickerQuery}
                  onChange={(e) => setPickerQuery(e.target.value)}
                  className="w-full pl-7 pr-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-red-900"
                />
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filteredPegawai.length === 0 ? (
                <div className="px-3 py-3 text-xs text-slate-400 italic">
                  {pegawaiOptions.length === 0 ? "Belum ada data pegawai di Master Data" : "Tidak ada hasil"}
                </div>
              ) : (
                filteredPegawai.map((p) => {
                  const already = value.includes(p.name);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={already}
                      onClick={() => {
                        addName(p.name);
                        setPickerQuery("");
                      }}
                      className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                        already ? "opacity-40 cursor-not-allowed" : "hover:bg-red-50 hover:text-red-900 text-slate-700"
                      }`}
                    >
                      <div className="font-semibold">
                        {p.name} {already && <span className="text-[10px] font-normal">(sudah dipilih)</span>}
                      </div>
                      <div className="text-[11px] text-slate-500">{p.jabatan}</div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {value.length > 0 && (
        <div data-testid="form-pegawai-chips" className="flex flex-wrap gap-1.5">
          {value.map((n) => (
            <span key={n} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
              {n}
              <button type="button" onClick={() => removeName(n)} className="text-slate-400 hover:text-red-800" aria-label={`Hapus ${n}`}>
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// Upload berkas (Link Upload Laporan Perjadin / Link Tanda Terima Laporan Perjadin)
const FileUploadField = ({ file, onChange, testid, compactLabel }) => {
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
      <div data-testid={`${testid}-preview`} className="flex items-center justify-between gap-2 px-3 py-2 border border-slate-300 rounded-md text-xs bg-slate-50">
        <div className="flex items-center gap-2 min-w-0">
          <Paperclip className="w-3.5 h-3.5 text-red-900 shrink-0" />
          <span className="truncate font-medium text-slate-800">{file.name}</span>
          <span className="text-slate-400 shrink-0">{formatFileSize(file.size)}</span>
        </div>
        <button
          type="button"
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
      data-testid={`${testid}-dropzone`}
      className="flex items-center gap-2 px-3 py-2 border border-dashed border-slate-300 rounded-md text-xs bg-white hover:bg-slate-50 hover:border-red-300 cursor-pointer text-slate-500 transition-colors"
    >
      <Upload className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      <span>{compactLabel || `Klik untuk unggah (PDF/JPG/PNG), maks ${MAX_FILE_MB}MB`}</span>
      <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
    </label>
  );
};

const NomorUrutPicker = ({ value, onChange, taken, testid }) => {
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
        data-testid={testid}
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

const checklistBadge = (c) => {
  if (c.includes("Tidak Lengkap")) return "bg-amber-50 text-amber-800 border-amber-200";
  return "bg-emerald-50 text-emerald-800 border-emerald-200";
};

// Checkbox group untuk Checklist Kelengkapan Laporan Perjadin - opsional, bisa pilih lebih dari satu
const ChecklistCheckboxGroup = ({ value, onChange }) => {
  const toggle = (opt) => {
    if (value.includes(opt)) onChange(value.filter((v) => v !== opt));
    else onChange([...value, opt]);
  };
  return (
    <div data-testid="form-tugas-checklist" className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 px-3 py-2.5 border border-slate-300 rounded-md bg-white">
      {CHECKLIST_OPTIONS.map((opt) => (
        <label key={opt} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            data-testid={`form-tugas-checklist-${opt.replace(/\s+/g, "-").toLowerCase()}`}
            checked={value.includes(opt)}
            onChange={() => toggle(opt)}
            className="w-3.5 h-3.5 rounded border-slate-300 text-red-900 focus:ring-red-900"
          />
          {opt}
        </label>
      ))}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════
export default function SuratTugasSpdSekretaris() {
  const [activeTab, setActiveTab] = useState("tugas"); // "tugas" | "spd"

  const [suratTugasList, setSuratTugasList] = useState([]);
  const [spdList, setSpdList] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const [kodeArsipOptions, setKodeArsipOptions] = useState([]);
  const [jenisNaskahOptions, setJenisNaskahOptions] = useState([]);
  const [pegawaiOptions, setPegawaiOptions] = useState([]);
  const [wilayahOptions, setWilayahOptions] = useState([]);
  const [loadingKlas, setLoadingKlas] = useState(true);

  const [formTugas, setFormTugas] = useState(emptyFormTugas());
  const [fileLaporan, setFileLaporan] = useState(null);
  const [fileTandaTerima, setFileTandaTerima] = useState(null);
  const [editingTugasId, setEditingTugasId] = useState(null);

  const [formSpd, setFormSpd] = useState(emptyFormSpd());
  const [editingSpdId, setEditingSpdId] = useState(null);

  const [searchTugas, setSearchTugas] = useState("");
  const [searchSpd, setSearchSpd] = useState("");
  // Filter Tahun di tabel - murni untuk menyaring tampilan, tahun diambil dari Tanggal tiap data.
  const [filterTahunTugas, setFilterTahunTugas] = useState(String(new Date().getFullYear()));
  const [filterTahunSpd, setFilterTahunSpd] = useState(String(new Date().getFullYear()));

  // Tahun untuk Nomor Urut & nomor otomatis diambil langsung dari field Tanggal yang sedang diisi di tiap form.
  const formYearTugas = useMemo(() => {
    const y = new Date(formTugas.tanggal).getFullYear();
    return Number.isNaN(y) ? CURRENT_YEAR : y;
  }, [formTugas.tanggal]);
  const formYearSpd = useMemo(() => {
    const y = new Date(formSpd.tanggal).getFullYear();
    return Number.isNaN(y) ? CURRENT_YEAR : y;
  }, [formSpd.tanggal]);

  useEffect(() => {
    (async () => {
      setLoadingKlas(true);
      try {
        const [klas, naskah, pegawai, wilayah] = await Promise.all([
          klasifikasiApi.list({ activeOnly: true }),
          jenisNaskahApi.list(),
          pegawaiApi.list(),
          wilayahApi.list(),
        ]);
        setKodeArsipOptions((klas || []).map((k) => ({ code: k.kode, uraian: k.uraian, kategori: k.kategori, bidang: k.bidang })));
        setJenisNaskahOptions(naskah || []);
        setPegawaiOptions((pegawai || []).filter((p) => p.is_active !== false));
        setWilayahOptions(wilayah || []);
      } catch (err) {
        toast.error(err.message || "Gagal memuat data master (klasifikasi/jenis naskah/pegawai)");
      } finally {
        setLoadingKlas(false);
      }
    })();
  }, []);

  
  // Muat Surat Tugas & SPD dari server.
  const muatData = async () => {
    try {
      const [st, sp] = await Promise.all([suratTugasApi.list(BAGIAN, "pegawaiList"), spdApi.list(BAGIAN)]);
      setSuratTugasList(st);
      setSpdList(sp);
    } catch (err) {
      toast.error(err.message || "Gagal memuat Surat Tugas/SPD dari server");
    }
  };
  useEffect(() => {
    muatData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tabel ikut tahun dari Tanggal di form.
  useEffect(() => {
    setFilterTahunTugas(String(formYearTugas));
  }, [formYearTugas]);
  useEffect(() => {
    setFilterTahunSpd(String(formYearSpd));
  }, [formYearSpd]);

  // Pilihan tahun: semua tahun yang ada datanya + tahun berjalan + tahun di form, terbaru dulu.
  const yearOptionsTugas = useMemo(() => {
    const set = new Set([CURRENT_YEAR, formYearTugas]);
    suratTugasList.forEach((it) => {
      const y = Number((it.tanggal || "").slice(0, 4));
      if (y) set.add(y);
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [suratTugasList, formYearTugas]);
  const yearOptionsSpd = useMemo(() => {
    const set = new Set([CURRENT_YEAR, formYearSpd]);
    spdList.forEach((it) => {
      const y = Number((it.tanggal || "").slice(0, 4));
      if (y) set.add(y);
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [spdList, formYearSpd]);

  // Nomor Surat Tugas dibentuk otomatis: {nomorUrut}/{kodeArsip}-{jenisNaskah}/{kodeWilayah}/{tahun}
  const generatedNomorSuratTugas = useMemo(() => buildNomorSuratTugas(formTugas), [formTugas]);

  // ── Surat Tugas: handlers ──────────────────────────────────────────
  const setFieldTugas = (key, value) => setFormTugas((f) => ({ ...f, [key]: value }));
  const setKategoriTugas = (kategori) => setFormTugas((f) => ({ ...f, kategoriKlasifikasi: kategori, kodeArsip: "" }));

  const resetFormTugas = () => {
    setFormTugas(emptyFormTugas());
    setFileLaporan(null);
    setFileTandaTerima(null);
    setEditingTugasId(null);
  };

  const startEditTugas = (it) => {
    setEditingTugasId(it.id);
    setFormTugas({
      nomorUrut: it.nomorUrut,
      jenisNaskah: it.jenisNaskah,
      tanggal: it.tanggal,
      pegawaiList: it.pegawaiList,
      perihal: it.perihal,
      pembuatSuratTugas: it.pembuatSuratTugas,
      checklistKelengkapan: it.checklistKelengkapan || [],
      keteranganPerjadin: it.keteranganPerjadin,
      kategoriKlasifikasi: it.kategoriKlasifikasi,
      kodeArsip: it.kodeArsip,
      kodeWilayah: it.kodeWilayah || UNSET,
    });
    setFileLaporan(it.fileLaporan || null);
    setFileTandaTerima(it.fileTandaTerima || null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteTugas = async (id) => {
    const used = spdList.some((s) => s.suratTugasId === id);
    if (used) {
      toast.error("Surat Tugas ini tidak bisa dihapus karena sudah dipakai di data SPD");
      return;
    }
    try {
      await suratTugasApi.remove(id);
      toast.success("Surat Tugas berhasil dihapus");
      await muatData();
    } catch (err) {
      toast.error(err.message || "Gagal menghapus Surat Tugas");
    }
  };

  const handleSubmitTugas = async (e) => {
    e.preventDefault();
    const required = ["nomorUrut", "jenisNaskah", "tanggal", "perihal", "pembuatSuratTugas", "kategoriKlasifikasi", "kodeArsip"];
    for (const k of required) {
      if (!formTugas[k] && formTugas[k] !== 0) {
        toast.error("Mohon lengkapi seluruh field yang wajib diisi");
        return;
      }
    }
    if (formTugas.pegawaiList.length ===0) {
      toast.error("Tambahkan minimal satu nama/keterangan pegawai/staf yang berangkat");
      return;
    }
    const nomorSuratTugas = buildNomorSuratTugas(formTugas);
    if (!nomorSuratTugas) {
      toast.error("Nomor Surat Tugas belum bisa dibentuk, pastikan Nomor Urut, Klasifikasi, Kode Arsip, Jenis Naskah & Tanggal sudah terisi");
      return;
    }
    // Tahun dari Tanggal yang diisi bukan tahun berjalan (susulan/arsip lama) -> minta konfirmasi dulu (khusus data baru).
    if (!editingTugasId && formYearTugas !== CURRENT_YEAR) {
      const ok = window.confirm(
        `Tanggal yang Anda isi berada di tahun ${formYearTugas}, bukan tahun berjalan (${CURRENT_YEAR}). Lanjutkan menyimpan?`,
      );
      if (!ok) return;
    }
    const payload = {
      bagian: BAGIAN,
      nomorUrut: Number(formTugas.nomorUrut),
      nomorSuratTugas,
      jenisNaskah: formTugas.jenisNaskah,
      tanggal: formTugas.tanggal,
      namaList: formTugas.pegawaiList,
      perihal: formTugas.perihal,
      pembuatSuratTugas: formTugas.pembuatSuratTugas,
      checklistKelengkapan: formTugas.checklistKelengkapan,
      keteranganPerjadin: formTugas.keteranganPerjadin || "",
      kategoriKlasifikasi: formTugas.kategoriKlasifikasi,
      kodeArsip: formTugas.kodeArsip,
      kodeWilayah: formTugas.kodeWilayah && formTugas.kodeWilayah !== UNSET ? formTugas.kodeWilayah : "",
    };
    setSubmitting(true);
    try {
      const { gagal } = await suratTugasApi.save(editingTugasId, payload, { laporan: fileLaporan, tandaTerima: fileTandaTerima });
      toast.success(editingTugasId ? "Surat Tugas berhasil diperbarui" : "Surat Tugas berhasil disimpan");
      gagal.forEach((m) => toast.error(`Berkas: ${m}`));
      resetFormTugas();
      await muatData();
    } catch (err) {
      toast.error(err.message || "Gagal menyimpan Surat Tugas");
    } finally {
      setSubmitting(false);
    }
  };

  // No Urut yang sudah dipakai dihitung per tahun dari Tanggal yang sedang diisi di form Surat Tugas.
  const suratTugasForNomorCheck = useMemo(
    () => suratTugasList.filter((it) => (it.tanggal || "").startsWith(`${formYearTugas}`)),
    [suratTugasList, formYearTugas],
  );
  const nomorTerpakaiTugas = useMemo(() => suratTugasForNomorCheck.map((it) => it.nomorUrut), [suratTugasForNomorCheck]);

  // Surat Tugas untuk dropdown "Pilih Surat Tugas" di form SPD - disaring ke tahun dari Tanggal SPD yang sedang diisi.
  const suratTugasForSpdDropdown = useMemo(
    () => suratTugasList.filter((it) => (it.tanggal || "").startsWith(`${formYearSpd}`)),
    [suratTugasList, formYearSpd],
  );

  const filteredTugas = useMemo(() => {
    const q = searchTugas.trim().toLowerCase();
    const base = suratTugasList
      .filter((it) => filterTahunTugas === "Semua" || (it.tanggal || "").startsWith(`${filterTahunTugas}`))
      .filter((it) =>
        !q || `${it.nomorSuratTugas} ${it.perihal} ${it.pegawaiList.join(" ")} ${it.pembuatSuratTugas}`.toLowerCase().includes(q),
      );
    // Urut naik berdasarkan No Urut, supaya lompatan nomor tetap tampil sesuai urutan angkanya.
    return [...base].sort((a, b) => Number(a.nomorUrut) - Number(b.nomorUrut));
  }, [suratTugasList, searchTugas, filterTahunTugas]);

  // ── SPD: handlers ──────────────────────────────────────────────────
  const setFieldSpd = (key, value) => setFormSpd((f) => ({ ...f, [key]: value }));
  const setKategoriSpd = (kategori) => setFormSpd((f) => ({ ...f, kategoriKlasifikasi: kategori, kodeArsip: "" }));

  const selectedSuratTugasForSpd = useMemo(
    () => suratTugasList.find((it) => it.id === formSpd.suratTugasId) || null,
    [suratTugasList, formSpd.suratTugasId],
  );

  const setSuratTugasForSpd = (suratTugasId) => setFormSpd((f) => ({ ...f, suratTugasId, stafList: [] }));

  const toggleStafSpd = (name) =>
    setFormSpd((f) => ({
      ...f,
      stafList: f.stafList.includes(name) ? f.stafList.filter((n) => n !== name) : [...f.stafList, name],
    }));

  const resetFormSpd = () => {
    setFormSpd(emptyFormSpd());
    setEditingSpdId(null);
  };

  const startEditSpd = (it) => {
    setEditingSpdId(it.id);
    setFormSpd({
      nomorUrut: it.nomorUrut,
      jenisNaskah: it.jenisNaskah,
      tanggal: it.tanggal,
      suratTugasId: it.suratTugasId,
      stafList: [it.staf],
      tempatTujuan: it.tempatTujuan,
      lamaBerangkat: it.lamaBerangkat,
      tanggalBerangkat: it.tanggalBerangkat,
      pembuatSpd: it.pembuatSpd,
      kategoriKlasifikasi: it.kategoriKlasifikasi,
      kodeArsip: it.kodeArsip,
      kodeWilayah: it.kodeWilayah || UNSET,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteSpd = async (id) => {
    try {
      await spdApi.remove(id);
      toast.success("Data SPD berhasil dihapus");
      await muatData();
    } catch (err) {
      toast.error(err.message || "Gagal menghapus data SPD");
    }
  };

  // No Urut yang sudah dipakai dihitung per tahun dari Tanggal yang sedang diisi di form SPD.
  const spdForNomorCheck = useMemo(
    () => spdList.filter((it) => (it.tanggal || "").startsWith(`${formYearSpd}`)),
    [spdList, formYearSpd],
  );
  const nomorTerpakaiSpd = useMemo(() => spdForNomorCheck.map((it) => it.nomorUrut), [spdForNomorCheck]);
  const nomorTerpakaiSpdSet = useMemo(() => new Set(nomorTerpakaiSpd), [nomorTerpakaiSpd]);

  // Pratinjau batch: 1 baris per staf yang dicentang, dengan nomor urut berurutan
  // mulai dari Nomor Urut yang dipilih (hanya berlaku saat menambah data baru, bukan edit).
  const spdBatchPreview = useMemo(() => {
    if (editingSpdId) return [];
    const start = Number(formSpd.nomorUrut);
    if (!start || formSpd.stafList.length === 0) return [];
    return formSpd.stafList.map((staf, idx) => {
      const nomorUrut = start + idx;
      return {
        staf,
        nomorUrut,
        nomorSpd: buildNomorSpd({ nomorUrut, kodeArsip: formSpd.kodeArsip, jenisNaskah: formSpd.jenisNaskah, tanggal: formSpd.tanggal, kodeWilayah: formSpd.kodeWilayah }),
        conflict: nomorTerpakaiSpdSet.has(nomorUrut),
      };
    });
  }, [editingSpdId, formSpd.nomorUrut, formSpd.stafList, formSpd.kodeArsip, formSpd.jenisNaskah, formSpd.tanggal, formSpd.kodeWilayah, nomorTerpakaiSpdSet]);

  const handleSubmitSpd = async (e) => {
    e.preventDefault();
    const required = ["nomorUrut", "jenisNaskah", "tanggal", "suratTugasId", "tempatTujuan", "lamaBerangkat", "tanggalBerangkat", "pembuatSpd", "kategoriKlasifikasi", "kodeArsip"];
    for (const k of required) {
      if (!formSpd[k] && formSpd[k] !== 0) {
        toast.error("Mohon lengkapi seluruh field yang wajib diisi, termasuk memilih Surat Tugas");
        return;
      }
    }
    if (formSpd.stafList.length === 0) {
      toast.error("Pilih minimal satu staf yang berangkat");
      return;
    }
    // Tahun dari Tanggal yang diisi bukan tahun berjalan (susulan/arsip lama) -> minta konfirmasi dulu.
    if (formYearSpd !== CURRENT_YEAR) {
      const ok = window.confirm(
        `Tanggal yang Anda isi berada di tahun ${formYearSpd}, bukan tahun berjalan (${CURRENT_YEAR}). Lanjutkan menyimpan?`,
      );
      if (!ok) return;
    }

    const bentukSpd = (nomorUrut, staf) => ({
      bagian: BAGIAN,
      nomorUrut,
      nomorSpd: buildNomorSpd({ nomorUrut, kodeArsip: formSpd.kodeArsip, jenisNaskah: formSpd.jenisNaskah, tanggal: formSpd.tanggal, kodeWilayah: formSpd.kodeWilayah }),
      jenisNaskah: formSpd.jenisNaskah,
      tanggal: formSpd.tanggal,
      suratTugasId: formSpd.suratTugasId,
      staf,
      tempatTujuan: formSpd.tempatTujuan,
      lamaBerangkat: formSpd.lamaBerangkat,
      tanggalBerangkat: formSpd.tanggalBerangkat,
      pembuatSpd: formSpd.pembuatSpd,
      kategoriKlasifikasi: formSpd.kategoriKlasifikasi,
      kodeArsip: formSpd.kodeArsip,
      kodeWilayah: formSpd.kodeWilayah && formSpd.kodeWilayah !== UNSET ? formSpd.kodeWilayah : "",
    });

    setSubmitting(true);
    try {
      if (editingSpdId) {
        // Mode edit: selalu 1 record, staf tunggal.
        const data = bentukSpd(Number(formSpd.nomorUrut), formSpd.stafList[0]);
        if (!data.nomorSpd) {
          toast.error("Nomor SPD belum bisa dibentuk, pastikan Nomor Urut, Klasifikasi, Kode Arsip, Jenis Naskah & Tanggal sudah terisi");
          return;
        }
        await spdApi.update(editingSpdId, data);
        toast.success("Data SPD berhasil diperbarui");
      } else {
        // Mode tambah: 1 record per staf yang dicentang, nomor urut berurutan otomatis.
        const start = Number(formSpd.nomorUrut);
        const conflicts = spdBatchPreview.filter((r) => r.conflict).map((r) => r.nomorUrut);
        if (conflicts.length > 0) {
          toast.error(`Nomor urut ${conflicts.join(", ")} sudah dipakai. Ganti Nomor Urut awal atau hapus data yang bentrok.`);
          return;
        }
        const items = formSpd.stafList.map((staf, idx) => bentukSpd(start + idx, staf));
        await spdApi.createBatch(items);
        toast.success(items.length > 1 ? `${items.length} data SPD berhasil dibuat sekaligus` : "Data SPD berhasil disimpan");
      }
      resetFormSpd();
      await muatData();
    } catch (err) {
      toast.error(err.message || "Gagal menyimpan data SPD");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredSpd = useMemo(() => {
    const q = searchSpd.trim().toLowerCase();
    const base = spdList
      .filter((it) => filterTahunSpd === "Semua" || (it.tanggal || "").startsWith(`${filterTahunSpd}`))
      .filter((it) => !q || `${it.nomorSpd} ${it.staf} ${it.tempatTujuan} ${it.pembuatSpd}`.toLowerCase().includes(q));
    // Urut naik berdasarkan No Urut, supaya lompatan nomor tetap tampil sesuai urutan angkanya.
    return [...base].sort((a, b) => Number(a.nomorUrut) - Number(b.nomorUrut));
  }, [spdList, searchSpd, filterTahunSpd]);

  const findSuratTugas = (id) => suratTugasList.find((it) => it.id === id);

  return (
    <AppLayout activePage="surat-tugas-sekretaris">
      <div data-testid="surat-tugas-spd-sekretaris-container" className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-start gap-4">
            <div className="hidden sm:flex w-11 h-11 rounded-lg bg-red-900 items-center justify-center shadow-sm shrink-0">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-red-50 text-red-900 border border-red-100 uppercase mb-1.5">
                Buku Agenda
              </span>
              <h1 className="text-xl font-bold text-slate-900">Surat Tugas & SPD Sekretaris</h1>
              <p className="text-xs text-slate-500 mt-0.5">Kelola Surat Tugas dan Surat Perjalanan Dinas (SPD) untuk Sekretaris.</p>
            </div>
          </div>
        </div>

        {/* Tab toggle */}
        <div data-testid="tab-toggle" className="inline-flex items-center bg-white rounded-lg border border-slate-200 shadow-sm p-1">
          <button
            type="button"
            data-testid="tab-surat-tugas"
            onClick={() => setActiveTab("tugas")}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold transition-colors ${
              activeTab === "tugas" ? "bg-red-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <FileText className="w-3.5 h-3.5" /> Surat Tugas
          </button>
          <button
            type="button"
            data-testid="tab-spd"
            onClick={() => setActiveTab("spd")}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold transition-colors ${
              activeTab === "spd" ? "bg-red-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <MapPin className="w-3.5 h-3.5" /> SPD
          </button>
        </div>

        {/* ══════════ TAB: SURAT TUGAS ══════════ */}
        {activeTab === "tugas" && (
          <>
            <form onSubmit={handleSubmitTugas} data-testid="form-surat-tugas" className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
                <FileText className="w-4 h-4 text-red-900" />
                <h2 className="text-sm font-bold text-slate-800">{editingTugasId ? "Edit Surat Tugas" : "Tambah Surat Tugas"}</h2>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Urutan: Nomor Urut -> Klasifikasi & Kode Arsip -> Jenis Naskah -> Kode Wilayah (opsional) -> Nomor Otomatis */}
                <Field label="Nomor Urut" required testid="field-tugas-nomor-urut">
                  <NomorUrutPicker value={formTugas.nomorUrut} onChange={(v) => setFieldTugas("nomorUrut", v)} taken={nomorTerpakaiTugas} testid="form-tugas-nomor-urut" />
                </Field>

                <KlasifikasiKodeArsipFields
                  form={formTugas}
                  setField={setFieldTugas}
                  setKategori={setKategoriTugas}
                  kodeArsipOptions={kodeArsipOptions}
                  testidPrefix="tugas"
                />

                <Field label="Jenis Naskah" required testid="field-tugas-jenis-naskah">
                  <select
                    data-testid="form-tugas-jenis-naskah"
                    value={formTugas.jenisNaskah}
                    onChange={(e) => setFieldTugas("jenisNaskah", e.target.value)}
                    className={inputCls}
                  >
                    <option value="">
                      {jenisNaskahOptions.length === 0 ? "Belum ada data di Master Data" : "Pilih jenis naskah..."}
                    </option>
                    {jenisNaskahOptions.map((n) => (
                      <option key={n.id} value={n.kode}>
                        {n.kode} — {n.nama}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Kode Wilayah (opsional)" testid="field-tugas-kode-wilayah">
                  <select
                    data-testid="form-tugas-kode-wilayah"
                    value={formTugas.kodeWilayah}
                    onChange={(e) => setFieldTugas("kodeWilayah", e.target.value)}
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
                  <div data-testid="preview-nomor-surat-tugas" className="flex items-start gap-2.5 px-4 py-3 rounded-md border border-red-100 bg-red-50/60">
                    <Hash className="w-3.5 h-3.5 text-red-900 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-semibold text-red-900 uppercase tracking-wide">Nomor Surat Tugas (Otomatis)</p>
                      {generatedNomorSuratTugas ? (
                        <p className="text-sm font-mono font-bold text-slate-900 mt-0.5">{generatedNomorSuratTugas}</p>
                      ) : (
                        <p className="text-xs text-slate-400 mt-0.5">
                          Lengkapi Nomor Urut, Klasifikasi, Kode Arsip, Jenis Naskah & Tanggal untuk membentuk nomor surat.
                        </p>
                      )}
                      <p className="text-[10px] text-slate-400 mt-1">
                        Format: Nomor Urut / Kode Arsip - Jenis Naskah / [Kode Wilayah] / Tahun (dari Tanggal)
                        <br />
                        Kode Wilayah bersifat opsional — hanya muncul kalau dipilih.
                      </p>
                    </div>
                  </div>
                </div>

                <Field label="Tanggal" required testid="field-tugas-tanggal">
                  <input data-testid="form-tugas-tanggal" type="date" value={formTugas.tanggal} onChange={(e) => setFieldTugas("tanggal", e.target.value)} className={inputCls} />
                  {formYearTugas !== CURRENT_YEAR ? (
                    <p className="text-[10px] text-amber-700 mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Nomor Urut & nomor akan memakai tahun {formYearTugas} (bukan tahun berjalan, {CURRENT_YEAR}).
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-400 mt-1">Nomor Urut & nomor memakai tahun {formYearTugas}.</p>
                  )}
                </Field>

                <div className="md:col-span-2 lg:col-span-3">
                  <Field label="Pegawai/Staf yang Berangkat" required testid="field-tugas-pegawai">
                    <PegawaiTagInput value={formTugas.pegawaiList} onChange={(v) => setFieldTugas("pegawaiList", v)} pegawaiOptions={pegawaiOptions} />
                  </Field>
                </div>

                <div className="md:col-span-2 lg:col-span-3">
                  <Field label="Perihal" required testid="field-tugas-perihal">
                    <textarea
                      data-testid="form-tugas-perihal"
                      rows={3}
                      value={formTugas.perihal}
                      onChange={(e) => setFieldTugas("perihal", e.target.value)}
                      placeholder="Uraikan perihal surat tugas..."
                      className={inputCls}
                    />
                  </Field>
                </div>

                <Field label="Pembuat Surat Tugas" required testid="field-tugas-pembuat">
                  <input
                    data-testid="form-tugas-pembuat"
                    type="text"
                    value={formTugas.pembuatSuratTugas}
                    onChange={(e) => setFieldTugas("pembuatSuratTugas", e.target.value)}
                    placeholder="Nama pembuat surat tugas"
                    className={inputCls}
                  />
                </Field>

                <div className="md:col-span-2 lg:col-span-3">
                  <Field label="Checklist Kelengkapan Laporan Perjadin (Opsional)" testid="field-tugas-checklist">
                    <ChecklistCheckboxGroup value={formTugas.checklistKelengkapan} onChange={(v) => setFieldTugas("checklistKelengkapan", v)} />
                  </Field>
                </div>

                <Field label="Keterangan Perjadin (Opsional)" testid="field-tugas-keterangan">
                  <select
                    data-testid="form-tugas-keterangan"
                    value={formTugas.keteranganPerjadin}
                    onChange={(e) => setFieldTugas("keteranganPerjadin", e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Pilih keterangan...</option>
                    {KETERANGAN_PERJADIN_OPTIONS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Link Upload Laporan Perjadin (Opsional)" testid="field-tugas-file-laporan">
                  <FileUploadField file={fileLaporan} onChange={setFileLaporan} testid="form-tugas-file-laporan" compactLabel="Unggah laporan perjadin..." />
                </Field>

                <Field label="Link Tanda Terima Laporan Perjadin (Opsional)" testid="field-tugas-file-tanda-terima">
                  <FileUploadField file={fileTandaTerima} onChange={setFileTandaTerima} testid="form-tugas-file-tanda-terima" compactLabel="Unggah tanda terima..." />
                </Field>
              </div>

              <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/50 flex items-center justify-end gap-2">
                <button type="button" onClick={resetFormTugas} data-testid="btn-reset-tugas" className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-600 border border-slate-300 rounded-md hover:bg-slate-100">
                  <RotateCcw className="w-3.5 h-3.5" /> {editingTugasId ? "Batal" : "Reset"}
                </button>
                <button type="submit" disabled={submitting} data-testid="btn-simpan-tugas" className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-red-900 rounded-md hover:bg-red-800">
                  <Save className="w-3.5 h-3.5" /> {editingTugasId ? "Simpan Perubahan" : "Simpan"}
                </button>
              </div>
            </form>

            {/* Filter + search */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute top-2.5 left-2.5" />
                <input
                  data-testid="filter-search-tugas"
                  type="text"
                  value={searchTugas}
                  onChange={(e) => setSearchTugas(e.target.value)}
                  placeholder="Cari nomor surat, perihal, nama staf..."
                  className="w-full pl-8 pr-2 py-2 border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-red-900 focus:outline-none"
                />
              </div>
              <select
                data-testid="filter-tahun-tugas"
                value={filterTahunTugas}
                onChange={(e) => setFilterTahunTugas(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-md text-xs"
              >
                <option value="Semua">Semua Tahun</option>
                {yearOptionsTugas.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Tabel Surat Tugas */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div data-testid="table-caption" className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-red-900" />
                  <h2 className="text-sm font-bold text-slate-900 tracking-tight">Surat Tugas Sekretaris</h2>
                </div>
                <span data-testid="data-count-badge" className="text-[10px] font-semibold text-red-900 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                  {filteredTugas.length} data
                </span>
              </div>
              {loadingKlas ? (
                <div className="py-16 flex items-center justify-center text-slate-400 text-sm gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Memuat data klasifikasi arsip...
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                        <th className="px-4 py-3">No. Urut</th>
                        <th className="px-4 py-3">Nomor Surat Tugas</th>
                        <th className="px-4 py-3">Pegawai/Staf</th>
                        <th className="px-4 py-3">Tanggal</th>
                        <th className="px-4 py-3">Perihal</th>
                        <th className="px-4 py-3">Pembuat</th>
                        <th className="px-4 py-3 text-center">Laporan</th>
                        <th className="px-4 py-3 text-center">Tanda Terima</th>
                        <th className="px-4 py-3">Checklist</th>
                        <th className="px-4 py-3">Keterangan Perjadin</th>
                        <th className="px-4 py-3">Kode Arsip</th>
                        <th className="px-4 py-3 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200 text-xs">
                      {filteredTugas.length === 0 && (
                        <tr>
                          <td colSpan={12} className="px-4 py-10 text-center text-slate-400 italic">
                            Belum ada data Surat Tugas.
                          </td>
                        </tr>
                      )}
                      {filteredTugas.map((it) => (
                        <tr key={it.id} data-testid={`row-tugas-${it.id}`} className="hover:bg-slate-50 transition-colors align-top">
                          <td className="px-4 py-3 font-semibold text-slate-900">{it.nomorUrut}</td>
                          <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-slate-700">{it.nomorSuratTugas}</td>
                          <td className="px-4 py-3 text-slate-700 max-w-[180px]">
                            <div className="flex flex-wrap gap-1">
                              {it.pegawaiList.map((n) => (
                                <span key={n} className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-medium text-slate-700">
                                  {n}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-slate-700">{formatTgl(it.tanggal)}</td>
                          <td className="px-4 py-3 text-slate-700 max-w-[220px] truncate" title={it.perihal}>
                            {it.perihal}
                          </td>
                          <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{it.pembuatSuratTugas}</td>
                          <td className="px-4 py-3 text-center">
                            {it.fileLaporan ? <a href={it.fileLaporan.url} target="_blank" rel="noreferrer" title={it.fileLaporan.name}><Paperclip className="w-3.5 h-3.5 text-red-900 inline" /></a> : <span className="text-slate-300">-</span>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {it.fileTandaTerima ? <a href={it.fileTandaTerima.url} target="_blank" rel="noreferrer" title={it.fileTandaTerima.name}><Paperclip className="w-3.5 h-3.5 text-red-900 inline" /></a> : <span className="text-slate-300">-</span>}
                          </td>
                          <td className="px-4 py-3 max-w-[180px]">
                            {it.checklistKelengkapan && it.checklistKelengkapan.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {it.checklistKelengkapan.map((c) => (
                                  <span key={c} className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold border ${checklistBadge(c)}`}>
                                    {c}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-300 text-[10px]">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-slate-700">{it.keteranganPerjadin}</td>
                          <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-slate-600">{it.kodeArsip}</td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button data-testid={`edit-tugas-${it.id}`} onClick={() => startEditTugas(it)} className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-red-900" title="Edit">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button data-testid={`delete-tugas-${it.id}`} onClick={() => deleteTugas(it.id)} className="p-1.5 rounded hover:bg-red-50 text-slate-500 hover:text-red-700" title="Hapus">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ══════════ TAB: SPD ══════════ */}
        {activeTab === "spd" && (
          <>
            <form onSubmit={handleSubmitSpd} data-testid="form-spd" className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-red-900" />
                <h2 className="text-sm font-bold text-slate-800">{editingSpdId ? "Edit SPD" : "Tambah SPD"}</h2>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Urutan: Nomor Urut -> Klasifikasi & Kode Arsip -> Jenis Naskah -> Kode Wilayah (opsional) -> Nomor Otomatis */}
                <Field label={editingSpdId ? "Nomor Urut" : "Nomor Urut Awal"} required testid="field-spd-nomor-urut">
                  <NomorUrutPicker value={formSpd.nomorUrut} onChange={(v) => setFieldSpd("nomorUrut", v)} taken={nomorTerpakaiSpd} testid="form-spd-nomor-urut" />
                  {!editingSpdId && formSpd.stafList.length > 1 && (
                    <p className="text-[10px] text-red-800 mt-1">
                      Karena {formSpd.stafList.length} staf dipilih, nomor urut yang dipakai: {Number(formSpd.nomorUrut) || "?"}–
                      {(Number(formSpd.nomorUrut) || 0) + formSpd.stafList.length - 1}.
                    </p>
                  )}
                </Field>

                <KlasifikasiKodeArsipFields
                  form={formSpd}
                  setField={setFieldSpd}
                  setKategori={setKategoriSpd}
                  kodeArsipOptions={kodeArsipOptions}
                  testidPrefix="spd"
                />

                <Field label="Jenis Naskah" required testid="field-spd-jenis-naskah">
                  <select
                    data-testid="form-spd-jenis-naskah"
                    value={formSpd.jenisNaskah}
                    onChange={(e) => setFieldSpd("jenisNaskah", e.target.value)}
                    className={inputCls}
                  >
                    <option value="">
                      {jenisNaskahOptions.length === 0 ? "Belum ada data di Master Data" : "Pilih jenis naskah..."}
                    </option>
                    {jenisNaskahOptions.map((n) => (
                      <option key={n.id} value={n.kode}>
                        {n.kode} — {n.nama}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Kode Wilayah (opsional)" testid="field-spd-kode-wilayah">
                  <select
                    data-testid="form-spd-kode-wilayah"
                    value={formSpd.kodeWilayah}
                    onChange={(e) => setFieldSpd("kodeWilayah", e.target.value)}
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
                  {editingSpdId ? (
                    <div data-testid="preview-nomor-spd" className="flex items-start gap-2.5 px-4 py-3 rounded-md border border-red-100 bg-red-50/60">
                      <Hash className="w-3.5 h-3.5 text-red-900 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10px] font-semibold text-red-900 uppercase tracking-wide">Nomor SPD (Otomatis)</p>
                        {buildNomorSpd(formSpd) ? (
                          <p className="text-sm font-mono font-bold text-slate-900 mt-0.5">{buildNomorSpd(formSpd)}</p>
                        ) : (
                          <p className="text-xs text-slate-400 mt-0.5">Lengkapi Nomor Urut, Klasifikasi, Kode Arsip, Jenis Naskah & Tanggal.</p>
                        )}
                        <p className="text-[10px] text-slate-400 mt-1">Kode Wilayah bersifat opsional — hanya muncul kalau dipilih.</p>
                      </div>
                    </div>
                  ) : (
                    <div data-testid="preview-nomor-spd-batch" className="rounded-md border border-red-100 bg-red-50/60 overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-red-100">
                        <Hash className="w-3.5 h-3.5 text-red-900 shrink-0" />
                        <p className="text-[10px] font-semibold text-red-900 uppercase tracking-wide">
                          Nomor SPD (Otomatis) {spdBatchPreview.length > 1 && `— akan membuat ${spdBatchPreview.length} SPD sekaligus`}
                        </p>
                      </div>
                      {spdBatchPreview.length === 0 ? (
                        <p className="px-4 py-3 text-xs text-slate-400">
                          Lengkapi Nomor Urut, Klasifikasi, Kode Arsip, Jenis Naskah, Tanggal & pilih minimal satu staf.
                        </p>
                      ) : (
                        <div className="divide-y divide-red-100/70">
                          {spdBatchPreview.map((r) => (
                            <div key={r.nomorUrut} className="flex items-center justify-between gap-3 px-4 py-2 text-xs">
                              <span className="text-slate-700 font-medium">{r.staf}</span>
                              {r.conflict ? (
                                <span className="text-red-700 font-semibold">Nomor urut {r.nomorUrut} sudah dipakai!</span>
                              ) : (
                                <span className="font-mono font-bold text-slate-900">{r.nomorSpd || "-"}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="px-4 py-2 text-[10px] text-slate-400 border-t border-red-100/70">
                        Format: Nomor Urut / Kode Arsip - Jenis Naskah / [Kode Wilayah] / Bulan (angka romawi, dari Tanggal) / Tahun
                      </p>
                    </div>
                  )}
                </div>

                <Field label="Tanggal" required testid="field-spd-tanggal">
                  <input data-testid="form-spd-tanggal" type="date" value={formSpd.tanggal} onChange={(e) => setFieldSpd("tanggal", e.target.value)} className={inputCls} />
                  {formYearSpd !== CURRENT_YEAR ? (
                    <p className="text-[10px] text-amber-700 mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Nomor Urut & nomor akan memakai tahun {formYearSpd} (bukan tahun berjalan, {CURRENT_YEAR}).
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-400 mt-1">Nomor Urut & nomor memakai tahun {formYearSpd}.</p>
                  )}
                </Field>

                <div className="md:col-span-2 lg:col-span-3 border border-slate-200 rounded-lg p-4 bg-slate-50/60">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-3.5 h-3.5 text-red-900" />
                    <h3 className="text-xs font-bold text-slate-700">Rujukan Surat Tugas</h3>
                  </div>
                  <Field label="Pilih Surat Tugas" required testid="field-spd-surat-tugas">
                    <select
                      data-testid="form-spd-surat-tugas"
                      value={formSpd.suratTugasId}
                      onChange={(e) => setSuratTugasForSpd(e.target.value)}
                      disabled={!!editingSpdId}
                      className={`${inputCls} ${editingSpdId ? "bg-slate-100 text-slate-400 cursor-not-allowed" : ""}`}
                    >
                      <option value="">
                        {suratTugasForSpdDropdown.length === 0
                          ? `Belum ada Surat Tugas tahun ${formYearSpd} — buat dahulu di tab Surat Tugas`
                          : "Pilih surat tugas..."}
                      </option>
                      {suratTugasForSpdDropdown.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.nomorSuratTugas} — {st.perihal.slice(0, 40)}
                          {st.perihal.length > 40 ? "..." : ""} ({formatTgl(st.tanggal)})
                        </option>
                      ))}
                    </select>
                  </Field>

                  {selectedSuratTugasForSpd && (
                    <div data-testid="spd-surat-tugas-preview" className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-slate-400">Nomor Surat Tugas: </span>
                        <span className="font-mono text-slate-700">{selectedSuratTugasForSpd.nomorSuratTugas}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Tanggal Surat Tugas: </span>
                        <span className="text-slate-700">{formatTgl(selectedSuratTugasForSpd.tanggal)}</span>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-slate-400">Perihal: </span>
                        <span className="text-slate-700">{selectedSuratTugasForSpd.perihal}</span>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <Field
                      label={editingSpdId ? "Staf" : "Pilih Staf yang Berangkat (bisa lebih dari satu)"}
                      required
                      testid="field-spd-staf"
                    >
                      {pegawaiOptions.length === 0 ? (
                        <div className="px-3 py-2 border border-dashed border-slate-300 rounded-md text-xs bg-slate-50 text-slate-400">
                          Belum ada data pegawai di Master Data. Tambahkan dahulu di Manajemen Master Data.
                        </div>
                      ) : (
                        <div data-testid="form-spd-staf" className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 px-3 py-2.5 border border-slate-300 rounded-md bg-white max-h-52 overflow-y-auto">
                          {pegawaiOptions.map((p) => (
                            <label key={p.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                data-testid={`form-spd-staf-${p.name.replace(/\s+/g, "-").toLowerCase()}`}
                                checked={formSpd.stafList.includes(p.name)}
                                onChange={() => toggleStafSpd(p.name)}
                                disabled={!!editingSpdId && !formSpd.stafList.includes(p.name) && formSpd.stafList.length >= 1}
                                className="w-3.5 h-3.5 rounded border-slate-300 text-red-900 focus:ring-red-900"
                              />
                              <span>
                                {p.name}
                                <span className="block text-[10px] text-slate-400 leading-tight">{p.jabatan}</span>
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                      {editingSpdId && <p className="text-[10px] text-slate-400 mt-1">Mode edit hanya untuk satu staf. Untuk staf lain, buat SPD baru.</p>}
                    </Field>
                  </div>
                </div>

                <Field label="Tempat Tujuan" required testid="field-spd-tempat">
                  <input
                    data-testid="form-spd-tempat"
                    type="text"
                    value={formSpd.tempatTujuan}
                    onChange={(e) => setFieldSpd("tempatTujuan", e.target.value)}
                    placeholder="Contoh: Kantor KPU Kab. Tabalong"
                    className={inputCls}
                  />
                </Field>

                <Field label="Lama Berangkat" required testid="field-spd-lama">
                  <input
                    data-testid="form-spd-lama"
                    type="text"
                    value={formSpd.lamaBerangkat}
                    onChange={(e) => setFieldSpd("lamaBerangkat", e.target.value)}
                    placeholder="Contoh: 1 Hari"
                    className={inputCls}
                  />
                </Field>

                <Field label="Tanggal Berangkat" required testid="field-spd-tanggal-berangkat">
                  <input
                    data-testid="form-spd-tanggal-berangkat"
                    type="date"
                    value={formSpd.tanggalBerangkat}
                    onChange={(e) => setFieldSpd("tanggalBerangkat", e.target.value)}
                    className={inputCls}
                  />
                </Field>

                <Field label="Pembuat SPD" required testid="field-spd-pembuat">
                  <input
                    data-testid="form-spd-pembuat"
                    type="text"
                    value={formSpd.pembuatSpd}
                    onChange={(e) => setFieldSpd("pembuatSpd", e.target.value)}
                    placeholder="Nama pembuat SPD"
                    className={inputCls}
                  />
                </Field>
              </div>

              <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/50 flex items-center justify-end gap-2">
                <button type="button" onClick={resetFormSpd} data-testid="btn-reset-spd" className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-600 border border-slate-300 rounded-md hover:bg-slate-100">
                  <RotateCcw className="w-3.5 h-3.5" /> {editingSpdId ? "Batal" : "Reset"}
                </button>
                <button type="submit" disabled={submitting} data-testid="btn-simpan-spd" className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-red-900 rounded-md hover:bg-red-800">
                  <Save className="w-3.5 h-3.5" /> {editingSpdId ? "Simpan Perubahan" : spdBatchPreview.length > 1 ? `Simpan ${spdBatchPreview.length} SPD` : "Simpan"}
                </button>
              </div>
            </form>

            {/* Filter + search */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute top-2.5 left-2.5" />
                <input
                  data-testid="filter-search-spd"
                  type="text"
                  value={searchSpd}
                  onChange={(e) => setSearchSpd(e.target.value)}
                  placeholder="Cari nomor SPD, nama staf, tempat tujuan..."
                  className="w-full pl-8 pr-2 py-2 border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-red-900 focus:outline-none"
                />
              </div>
              <select
                data-testid="filter-tahun-spd"
                value={filterTahunSpd}
                onChange={(e) => setFilterTahunSpd(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-md text-xs"
              >
                <option value="Semua">Semua Tahun</option>
                {yearOptionsSpd.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Tabel SPD */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div data-testid="table-caption" className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-red-900" />
                  <h2 className="text-sm font-bold text-slate-900 tracking-tight">SPD Sekretaris</h2>
                </div>
                <span data-testid="data-count-badge" className="text-[10px] font-semibold text-red-900 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                  {filteredSpd.length} data
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                      <th className="px-4 py-3">No. Urut</th>
                      <th className="px-4 py-3">Nomor SPD</th>
                      <th className="px-4 py-3">Tanggal</th>
                      <th className="px-4 py-3">Surat Tugas</th>
                      <th className="px-4 py-3">Perihal</th>
                      <th className="px-4 py-3">Pegawai/Staf</th>
                      <th className="px-4 py-3">Tempat Tujuan</th>
                      <th className="px-4 py-3">Lama Berangkat</th>
                      <th className="px-4 py-3">Tgl Berangkat</th>
                      <th className="px-4 py-3">Pembuat</th>
                      <th className="px-4 py-3">Kode Arsip</th>
                      <th className="px-4 py-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200 text-xs">
                    {filteredSpd.length === 0 && (
                      <tr>
                        <td colSpan={12} className="px-4 py-10 text-center text-slate-400 italic">
                          Belum ada data SPD.
                        </td>
                      </tr>
                    )}
                    {filteredSpd.map((it) => {
                      const st = findSuratTugas(it.suratTugasId);
                      return (
                        <tr key={it.id} data-testid={`row-spd-${it.id}`} className="hover:bg-slate-50 transition-colors align-top">
                          <td className="px-4 py-3 font-semibold text-slate-900">{it.nomorUrut}</td>
                          <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-slate-700">{it.nomorSpd}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-slate-700">{formatTgl(it.tanggal)}</td>
                          <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-slate-600">
                            {st ? (
                              <>
                                {st.nomorSuratTugas}
                                <div className="text-slate-400">{formatTgl(st.tanggal)}</div>
                              </>
                            ) : (
                              <span className="text-red-400 italic">terhapus</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-700 max-w-[200px] truncate" title={st?.perihal}>
                            {st?.perihal || "-"}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-slate-700">{it.staf}</td>
                          <td className="px-4 py-3 text-slate-700 max-w-[160px] truncate" title={it.tempatTujuan}>
                            {it.tempatTujuan}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-slate-700">{it.lamaBerangkat}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-slate-700">{formatTgl(it.tanggalBerangkat)}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-slate-700">{it.pembuatSpd}</td>
                          <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-slate-600">{it.kodeArsip}</td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button data-testid={`edit-spd-${it.id}`} onClick={() => startEditSpd(it)} className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-red-900" title="Edit">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button data-testid={`delete-spd-${it.id}`} onClick={() => deleteSpd(it.id)} className="p-1.5 rounded hover:bg-red-50 text-slate-500 hover:text-red-700" title="Hapus">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}