import React, { useState, useEffect } from "react";
import { UploadCloud, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { arsipDokumenApi } from "../api/arsipDokumen";

const BARU = "__baru__"; // pilihan "Buat folder baru..."
const MAKS_MB = 10;
const EKSTENSI = [".pdf", ".jpg", ".jpeg", ".png"];

const hariIni = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const inputCls =
  "mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-red-900 focus:border-red-900 text-sm";

// Dialog unggah dokumen arsip (item kosong) atau edit dokumen unggahan (item terisi).
//  kategori        : kode subbagian
//  folders         : daftar folder di subbagian ini
//  defaultFolderId : folder yang sedang dibuka (kalau ada)
//  onSaved         : dipanggil setelah ada perubahan di server supaya halaman memuat ulang
export default function ArsipUnggahDialog({ open, onClose, kategori, folders, defaultFolderId, item, onSaved }) {
  const edit = !!item;
  const [folderId, setFolderId] = useState("");
  const [namaBaru, setNamaBaru] = useState("");
  const [judul, setJudul] = useState("");
  const [perihal, setPerihal] = useState("");
  const [tanggal, setTanggal] = useState(hariIni());
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (item) {
      setFolderId(item.folderId || "");
      setJudul(item.title || "");
      setPerihal(item.perihal || "");
      setTanggal(item.tanggal || hariIni());
    } else {
      const awal = defaultFolderId && folders.some((f) => f.id === defaultFolderId)
        ? defaultFolderId
        : folders.length > 0 ? "" : BARU;
      setFolderId(awal);
      setJudul("");
      setPerihal("");
      setTanggal(hariIni());
    }
    setNamaBaru("");
    setFile(null);
    setSubmitting(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item]);

  if (!open) return null;

  const pilihBerkas = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const ext = `.${(f.name.split(".").pop() || "").toLowerCase()}`;
    if (!EKSTENSI.includes(ext)) {
      toast.error("Format file harus PDF, JPG, atau PNG");
      e.target.value = "";
      return;
    }
    if (f.size > MAKS_MB * 1024 * 1024) {
      toast.error(`Ukuran file maksimal ${MAKS_MB}MB`);
      e.target.value = "";
      return;
    }
    setFile(f);
  };

  const simpan = async (e) => {
    e.preventDefault();
    if (!folderId) {
      toast.error("Pilih folder tujuan");
      return;
    }
    if (folderId === BARU && !namaBaru.trim()) {
      toast.error("Isi nama folder baru");
      return;
    }
    if (!judul.trim() || !perihal.trim() || !tanggal) {
      toast.error("Judul, perihal, dan tanggal wajib diisi");
      return;
    }
    if (!edit && !file) {
      toast.error("Pilih berkas yang akan diunggah");
      return;
    }

    setSubmitting(true);
    let folderBaruDibuat = false;
    try {
      let fid = folderId;
      if (folderId === BARU) {
        const f = await arsipDokumenApi.createFolder(kategori, namaBaru.trim());
        fid = f.id;
        folderBaruDibuat = true;
        setFolderId(f.id); // kalau unggah gagal lalu dicoba lagi, folder tidak dibuat dua kali
      }
      const isian = { folderId: fid, judul: judul.trim(), perihal: perihal.trim(), tanggal };
      if (edit) {
        await arsipDokumenApi.updateUpload(item.id, isian, file);
        toast.success("Dokumen berhasil diperbarui");
      } else {
        await arsipDokumenApi.upload({ kategori, ...isian }, file);
        toast.success("Dokumen berhasil diunggah");
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message || "Gagal menyimpan dokumen");
      if (folderBaruDibuat) onSaved(); // folder sudah terbentuk; segarkan daftarnya
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
      data-testid="arsip-unggah-overlay"
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 my-8"
        onClick={(e) => e.stopPropagation()}
        data-testid="arsip-unggah-dialog"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-900 flex items-center justify-center">
              <UploadCloud className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-slate-900">{edit ? "Edit Dokumen" : "Unggah Dokumen"}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={simpan} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700">Folder</label>
            <select
              data-testid="arsip-unggah-folder"
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              className={inputCls}
            >
              <option value="">Pilih folder...</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nama}
                </option>
              ))}
              <option value={BARU}>+ Buat folder baru...</option>
            </select>
            {folderId === BARU && (
              <input
                data-testid="arsip-unggah-folder-baru"
                type="text"
                maxLength={60}
                value={namaBaru}
                onChange={(e) => setNamaBaru(e.target.value)}
                placeholder="Nama folder baru, contoh: SPIP"
                className={inputCls}
              />
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Judul</label>
            <input
              data-testid="arsip-unggah-judul"
              type="text"
              maxLength={300}
              value={judul}
              onChange={(e) => setJudul(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Perihal</label>
            <textarea
              data-testid="arsip-unggah-perihal"
              rows={2}
              maxLength={500}
              value={perihal}
              onChange={(e) => setPerihal(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Tanggal</label>
            <input
              data-testid="arsip-unggah-tanggal"
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">
              Berkas {edit && <span className="text-slate-400 font-normal">(kosongkan jika tidak diganti)</span>}
            </label>
            <label
              htmlFor="arsip-unggah-berkas"
              className="mt-1 w-full flex items-center px-3 py-2 border border-dashed border-slate-300 rounded-md text-xs bg-slate-50/50 hover:bg-slate-50 cursor-pointer"
            >
              <UploadCloud className="w-3.5 h-3.5 mr-2 shrink-0 text-slate-500" />
              <span className="truncate text-slate-600">
                {file ? file.name : edit && item?.fileName ? `Berkas saat ini: ${item.fileName}` : "Pilih PDF, JPG, atau PNG (maks. 10MB)..."}
              </span>
            </label>
            <input
              id="arsip-unggah-berkas"
              data-testid="arsip-unggah-berkas"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={pilihBerkas}
              className="hidden"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              data-testid="arsip-unggah-simpan"
              disabled={submitting}
              className="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-red-900 rounded-md hover:bg-red-800 disabled:opacity-60"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              {edit ? "Simpan Perubahan" : "Unggah"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}