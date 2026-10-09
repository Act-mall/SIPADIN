
/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `arsip_folder` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `kategori` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nama` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdBy` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updatedAt` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_arsip_folder_kategori` (`kategori`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `arsip_unggahan` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `kategori` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `folderId` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `judul` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `perihal` text COLLATE utf8mb4_unicode_ci,
  `tanggal` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `file` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fileName` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fileSize` bigint DEFAULT NULL,
  `createdBy` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updatedAt` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_arsip_unggahan_kategori` (`kategori`),
  KEY `idx_arsip_unggahan_folder` (`folderId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `arsip_visibility` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `keuangan` tinyint(1) DEFAULT NULL,
  `perencanaan` tinyint(1) DEFAULT NULL,
  `parhubmas` tinyint(1) DEFAULT NULL,
  `teknis` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `berita_acara` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `noUrut` int DEFAULT NULL,
  `nomor` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bagian` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `subbagId` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `jenisNaskah` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `kodeArsip` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `kodeWilayah` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tanggal` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `alamatTujuan` text COLLATE utf8mb4_unicode_ci,
  `perihal` text COLLATE utf8mb4_unicode_ci,
  `penanggungJawab` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `arsipFile` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `arsipFileName` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdBy` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updatedAt` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `jenis_naskah` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `kode` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nama` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ket` text COLLATE utf8mb4_unicode_ci,
  `created_at` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_at` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `jenis_naskah_kode_unique` (`kode`),
  KEY `idx_jenis_naskah_kode` (`kode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `klasifikasi_arsip` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `kode` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `uraian` text COLLATE utf8mb4_unicode_ci,
  `kategori` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bidang` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `level` int DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT NULL,
  `created_at` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_at` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `klasifikasi_arsip_kode_unique` (`kode`),
  KEY `idx_klasifikasi_kode` (`kode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `legalisir` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `noUrut` int DEFAULT NULL,
  `nomor` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `kodeArsip` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `kodeTujuan` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `kodeWilayah` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tanggalLegalisir` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tandaTanganLegalisir` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `instansiParpol` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `perihal` text COLLATE utf8mb4_unicode_ci,
  `tanggalPenyerahan` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `diserahkanKepada` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `arsipFile` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `arsipFileName` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdBy` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updatedAt` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `mou` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `noUrut` int DEFAULT NULL,
  `nomorMou` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `instansi` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tanggal` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `perihal` text COLLATE utf8mb4_unicode_ci,
  `lampiranFile` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `lampiranFileName` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdBy` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updatedAt` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nota_dinas` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `noUrut` int DEFAULT NULL,
  `nomor` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bagian` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `subBagian` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `jenisNaskah` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `kodeArsip` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `kodeTujuan` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `kodeWilayah` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tanggal` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `alamatTujuan` text COLLATE utf8mb4_unicode_ci,
  `perihal` text COLLATE utf8mb4_unicode_ci,
  `keterangan` text COLLATE utf8mb4_unicode_ci,
  `arsipFile` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `arsipFileName` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdBy` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updatedAt` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pegawai` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nip` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `jabatan` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `subbag_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT NULL,
  `permissions__keuangan` tinyint(1) DEFAULT NULL,
  `permissions__parhubmas` tinyint(1) DEFAULT NULL,
  `permissions__perencanaan` tinyint(1) DEFAULT NULL,
  `permissions__surat_approve` tinyint(1) DEFAULT NULL,
  `permissions__surat_delete` tinyint(1) DEFAULT NULL,
  `permissions__surat_edit` tinyint(1) DEFAULT NULL,
  `permissions__teknis` tinyint(1) DEFAULT NULL,
  `created_at` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_at` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pegawai_nip_unique` (`nip`),
  KEY `idx_pegawai_nip` (`nip`),
  KEY `idx_pegawai_subbag` (`subbag_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pejabat` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `jabatan` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT NULL,
  `created_at` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_at` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sk_dokumen` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `noUrut` int DEFAULT NULL,
  `nomorSk` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `subbagId` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `skOleh` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tanggal` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `perihal` text COLLATE utf8mb4_unicode_ci,
  `createdBy` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updatedAt` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `arsipFile` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `arsipFileName` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sop` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `noUrut` int DEFAULT NULL,
  `nomorSop` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `klasifikasi` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tanggal` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `perihal` text COLLATE utf8mb4_unicode_ci,
  `keterangan` text COLLATE utf8mb4_unicode_ci,
  `dokumenFile` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `dokumenFileName` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdBy` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updatedAt` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `spd` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nomorUrut` int DEFAULT NULL,
  `nomorSpd` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `suratTugasId` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bagian` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `jenisNaskah` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `kategoriKlasifikasi` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `kodeArsip` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `kodeWilayah` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tanggal` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tanggalBerangkat` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `lamaBerangkat` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tempatTujuan` text COLLATE utf8mb4_unicode_ci,
  `pembuatSpd` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `staf` text COLLATE utf8mb4_unicode_ci,
  `createdBy` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updatedAt` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_spd_surat_tugas` (`suratTugasId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `subbagian` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `kepala` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `angka` int DEFAULT NULL,
  `pegawai_count` int DEFAULT NULL,
  `created_at` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_at` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `subbagian_code_unique` (`code`),
  KEY `idx_subbagian_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `surat_keluar` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nomorUrut` int DEFAULT NULL,
  `nomor` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bagian` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `jenisNaskah` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `jenisSurat` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `kodeArsip` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `kodeWilayah` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tanggal` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tujuan` text COLLATE utf8mb4_unicode_ci,
  `perihal` text COLLATE utf8mb4_unicode_ci,
  `penanggungJawab` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `disposisi` text COLLATE utf8mb4_unicode_ci,
  `lampiran` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `srikandi` tinyint(1) DEFAULT NULL,
  `srikandiApprovedAt` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `srikandiApprovedBy` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdBy` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updatedAt` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `surat_masuk` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nomorUrut` int DEFAULT NULL,
  `nomorAgenda` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nomorSurat` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tanggal` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tanggalSurat` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `alamatPengirim` text COLLATE utf8mb4_unicode_ci,
  `ditujukan` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `perihal` text COLLATE utf8mb4_unicode_ci,
  `kodeArsip` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `disposisi` text COLLATE utf8mb4_unicode_ci,
  `lampiran` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `srikandi` tinyint(1) DEFAULT NULL,
  `srikandiApprovedAt` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `srikandiApprovedBy` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdBy` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updatedAt` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `surat_tugas` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nomorUrut` int DEFAULT NULL,
  `nomorSuratTugas` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bagian` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `jenisNaskah` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `kategoriKlasifikasi` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `kodeArsip` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `kodeWilayah` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tanggal` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `perihal` text COLLATE utf8mb4_unicode_ci,
  `pembuatSuratTugas` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `namaList` json DEFAULT NULL,
  `checklistKelengkapan` json DEFAULT NULL,
  `keteranganPerjadin` text COLLATE utf8mb4_unicode_ci,
  `createdBy` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updatedAt` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `wilayah` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `kode` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `kecamatan` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `kelurahan_count` int DEFAULT NULL,
  `created_at` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_at` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `wilayah_kode_unique` (`kode`),
  KEY `idx_wilayah_kode` (`kode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

