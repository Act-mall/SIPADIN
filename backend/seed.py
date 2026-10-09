"""One-time (idempotent) startup seed for all master data + admin default password.
Idempotent: if a collection is empty, seed it. Existing entries never overwritten.
Ensures at least one active admin exists."""
from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from mysql_db import MySQLDatabase as AsyncIOMotorDatabase

from auth import hash_password

logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent


def _ts() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---- Master seed constants ----
# Subbagian, Pejabat, Wilayah, dan Jenis Naskah SENGAJA dikosongkan (list kosong).
# Data-data ini diisi manual oleh admin lewat UI Master Data setelah login pertama kali.
# Hanya satu akun admin (di bawah) dan Klasifikasi Arsip yang tetap di-seed, karena
# akun admin dibutuhkan supaya ada yang bisa login pertama kali untuk mengisi sisanya.

SEED_SUBBAGIAN: list = []

# Satu akun admin awal, tanpa subbagian (subbag_id akan None sampai admin
# membuat data Subbagian sendiri dan mengaitkannya lewat menu Pegawai).
SEED_PEGAWAI = [
    {
        "nip": "admin",
        "name": "Administrator",
        "jabatan": "Administrator Sistem",
        "subbag_code": None,
        "role": "admin",
    },
]

SEED_PEJABAT: list = []

SEED_WILAYAH: list = []

SEED_NASKAH: list = []

DEFAULT_PERMISSIONS = {"keuangan": True, "perencanaan": True, "parhubmas": True, "teknis": False}


async def _seed_if_empty(coll, docs, ts):
    if await coll.count_documents({}) > 0:
        return 0
    for d in docs:
        d.setdefault("id", str(uuid.uuid4()))
        d["created_at"] = ts
        d["updated_at"] = ts
    if docs:
        await coll.insert_many(docs)
    return len(docs)


async def run_seed(db: AsyncIOMotorDatabase) -> None:
    ts = _ts()
    admin_pw = os.environ.get("ADMIN_DEFAULT_PASSWORD", "admin123")

    # Nomor urut Surat Masuk/Surat Keluar sengaja TIDAK dibuat unik global: nomor kembali ke 1
    # tiap tahun dan terpisah per bagian (Ketua/Sekretaris). Keunikannya dicek di
    # _check_nomor_urut_unique (per tahun, dan per bagian untuk Surat Keluar).
    
    # Klasifikasi Arsip (from Excel-derived JSON)
    await db.klasifikasi_arsip.create_index("kode", unique=True)
    if await db.klasifikasi_arsip.count_documents({}) == 0:
        seed_path = ROOT_DIR / "data" / "klasifikasi_seed.json"
        if seed_path.exists():
            rows = json.loads(seed_path.read_text(encoding="utf-8"))
            docs = []
            for r in rows:
                docs.append({
                    "id": str(uuid.uuid4()),
                    "kategori": r["kategori"],
                    "bidang": r["bidang"],
                    "kode": r["kode"],
                    "uraian": r["uraian"],
                    "level": int(r.get("level", 0)),
                    "is_active": True,
                    "created_at": ts,
                    "updated_at": ts,
                })
            if docs:
                await db.klasifikasi_arsip.insert_many(docs)
                logger.info("Seeded %d klasifikasi_arsip rows.", len(docs))

    # Subbagian
    await db.subbagian.create_index("code", unique=True)
    added = await _seed_if_empty(db.subbagian, [dict(x) for x in SEED_SUBBAGIAN], ts)
    if added:
        logger.info("Seeded %d subbagian.", added)

    # Pegawai (link by subbag_code -> subbag_id)
    await db.pegawai.create_index("nip", unique=True)
    if await db.pegawai.count_documents({}) == 0:
        # map code -> id
        code_to_id = {}
        async for sub in db.subbagian.find({}, {"_id": 0, "id": 1, "code": 1}):
            code_to_id[sub["code"]] = sub["id"]
        docs = []
        for p in SEED_PEGAWAI:
            docs.append({
                "id": str(uuid.uuid4()),
                "nip": p["nip"],
                "name": p["name"],
                "jabatan": p["jabatan"],
                "subbag_id": code_to_id.get(p["subbag_code"]),
                "role": p["role"],
                "is_active": True,
                "permissions": DEFAULT_PERMISSIONS.copy(),
                "password_hash": hash_password(admin_pw),  # all seeded pegawai share default pw
                "created_at": ts,
                "updated_at": ts,
            })
        if docs:
            await db.pegawai.insert_many(docs)
            logger.info("Seeded %d pegawai (default password '%s').", len(docs), admin_pw)
    else:
        # Ensure at least one active admin exists; if not, promote the seeded admin nip.
        admins = await db.pegawai.count_documents({"role": "admin", "is_active": True})
        if admins == 0:
            await db.pegawai.update_one(
                {"nip": SEED_PEGAWAI[0]["nip"]},
                {"$set": {"role": "admin", "is_active": True, "updated_at": ts}},
            )
            logger.info("Restored default admin %s.", SEED_PEGAWAI[0]["nip"])

    # Pejabat
    added = await _seed_if_empty(db.pejabat, [{**x, "is_active": True} for x in SEED_PEJABAT], ts)
    if added:
        logger.info("Seeded %d pejabat.", added)

    # Wilayah
    await db.wilayah.create_index("kode", unique=True)
    added = await _seed_if_empty(db.wilayah, [dict(x) for x in SEED_WILAYAH], ts)
    if added:
        logger.info("Seeded %d wilayah.", added)

    # Jenis Naskah
    await db.jenis_naskah.create_index("kode", unique=True)
    added = await _seed_if_empty(db.jenis_naskah, [dict(x) for x in SEED_NASKAH], ts)
    if added:
        logger.info("Seeded %d jenis naskah.", added)