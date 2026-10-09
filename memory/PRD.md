# PRD - SIPADIN KPU Kota Banjarmasin

## 1. Original Problem Statement
Create a polished, professional, responsive web application prototype called **SIPADIN** (Sistem Informasi Administrasi dan Persuratan) for an institution (KPU Kota Banjarmasin). The current goal is to create a high-quality UI/UX prototype for presentation to management using realistic dummy data and interactions.

## 2. User Personas
- **Administrator / Pimpinan (Sekretaris KPU)**: Full access to all modules, Buku Agenda, Dokumen Internal, Klasifikasi Arsip, Master Data, and Hak Akses configuration.
- **Pegawai / Staf (User)**: Role-restricted access to Buku Agenda and permitted Dokumen Internal sections according to administrator-defined access rights.

## 3. Core Requirements & Implemented Features
- **Branding**: SIPADIN KPU Kota Banjarmasin with official maroon (#7F1D1D) and white institutional color palette.
- **Login Page**: Clean professional login with 1-click demo buttons for Admin and User roles.
- **Dashboard**: "Selamat datang di SIPADIN KPU Kota Banjarmasin" with 4 primary stat cards (Surat Masuk, Surat Keluar, Total Arsip, Aktivitas Terbaru) and Dokumen Internal Terbaru.
- **Buku Agenda**: Comprehensive correspondence tracking for Surat Masuk, Surat Keluar, Surat Tugas, Nota Dinas, Berita Acara, Legalisir, SK, SOP, and MOU with search & filter.
- **Dokumen Internal**: Sectioned internal archiving with dynamic permission rendering.
- **Klasifikasi Arsip**: Substantif & Fasilitatif classification reference.
- **Master Data (Admin Only)**: Management tabs for Pegawai, Subbagian, Pejabat, Klasifikasi Arsip, Jenis Naskah Dinas, and Kode Wilayah with interactive add modals.
- **Hak Akses Control**: Dynamic toggle page controlling internal document section visibility for standard users.

## 4. Mocked in Frontend
- All static data, search filtering, session roles, and permission toggling are currently simulated using local state and localStorage.

## 5. Prioritized Backlog & Next Action Items (Phase 2)
1. Wire Laravel / FastAPI backend with PostgreSQL / MongoDB database.
2. Implement real user authentication with JWT tokens and secure password hashing.
3. Add full document file upload and secure storage integration.

---
## Update — 11 Feb 2026: Revisi halaman Surat Masuk
- SuratMasuk.jsx dirombak: form "Tambah Surat Masuk" sekarang INLINE (bukan modal) di atas halaman.
- Field baru: Nomor Urut, Nomor Agenda, Tanggal, Alamat Pengirim, Tanggal Surat, Nomor Surat, Perihal, Disposisi (KUL/PERDATIN/PARHUBMAS & SDM/TEKNIS & HUKUM), Ditujukan (KETUA/SEKRETARIS), Kode Arsip (searchable combobox, opsi PP.06 - Narasumber), checkbox SRIKANDI.
- Data section: search + filter (Tahun, Disposisi, Ditujukan, SRIKANDI). Desktop = table 10 kolom. Mobile/tablet = card list dengan expand inline (no modal).
- mock.js: `suratMasukList` di-reshape ke bentuk baru, seed 5 baris (termasuk baris agenda 1 UIN Antasari Banjarmasin, 2 Jan 2026, nomor 139/S/P/PP-PBPM-KPM/EMA-U/UN-A/I/2026).
- Frontend testing agent: 100% pass (12/12 skenario), tidak ada horizontal overflow di viewport 390x844.
