"""All master data routes (klasifikasi, pegawai, subbagian, pejabat, wilayah, jenis naskah)
plus auth routes. Uses JWT bearer tokens for admin gating."""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from mysql_db import MySQLDatabase as AsyncIOMotorDatabase
from pydantic import BaseModel, ConfigDict, Field, field_validator

from auth import (
    create_access_token,
    get_current_user_from_db,
    hash_password,
    verify_password,
    _extract_bearer,
)

router = APIRouter(prefix="/api")

# Folder tempat lampiran surat masuk disimpan di disk lokal.
# Diserve balik lewat static mount "/uploads" di server.py.
UPLOAD_DIR = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ==============================================================
# DB dependency
# ==============================================================

_db: Optional[AsyncIOMotorDatabase] = None


def set_db(db: AsyncIOMotorDatabase) -> None:
    global _db
    _db = db


def get_db() -> AsyncIOMotorDatabase:
    assert _db is not None, "DB not initialised. Call set_db() on startup."
    return _db


# ==============================================================
# Auth dependencies
# ==============================================================

async def current_user(
    authorization: Optional[str] = Header(default=None),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    token = _extract_bearer(authorization)
    return await get_current_user_from_db(db, token)


async def require_admin(user: dict = Depends(current_user)) -> dict:
    if (user.get("role") or "").lower() != "admin":
        raise HTTPException(status_code=403, detail="Hanya admin yang boleh melakukan operasi ini.")
    return user


def _is_admin(user: dict) -> bool:
    return (user.get("role") or "").lower() == "admin"


async def require_surat_edit(user: dict = Depends(current_user)) -> dict:
    """Admin selalu boleh; pegawai biasa hanya kalau admin sudah mengaktifkan
    izin 'surat_edit' untuknya di Master Data Pegawai."""
    if not _is_admin(user) and not (user.get("permissions") or {}).get("surat_edit"):
        raise HTTPException(
            status_code=403,
            detail="Anda tidak punya izin mengedit surat. Hubungi admin untuk mengaktifkan izin ini.",
        )
    return user


async def require_surat_delete(user: dict = Depends(current_user)) -> dict:
    if not _is_admin(user) and not (user.get("permissions") or {}).get("surat_delete"):
        raise HTTPException(
            status_code=403,
            detail="Anda tidak punya izin menghapus surat. Hubungi admin untuk mengaktifkan izin ini.",
        )
    return user


async def _get_user_subbag_code(db: AsyncIOMotorDatabase, user: dict) -> Optional[str]:
    subbag_id = user.get("subbag_id")
    if not subbag_id:
        return None
    sub = await db.subbagian.find_one({"id": subbag_id}, {"_id": 0, "code": 1})
    return sub["code"] if sub else None


# Kode subbagian "Teknis Penyelenggaraan Pemilu, Partisipasi dan Hukum" yang dipakai
# untuk membatasi akses SK dan arsip kategori Teknis Pemilu & Hukum. JANGAN diubah
# tanpa mengubah kode subbagian yang sama di Master Data, atau aturan akses ini
# tidak akan mengenalinya lagi.
TEKNIS_HUKUM_SUBBAG_CODE = "SUB-TEKNIS&HUKUM"


async def _is_teknis_hukum(db: AsyncIOMotorDatabase, user: dict) -> bool:
    code = await _get_user_subbag_code(db, user)
    return code == TEKNIS_HUKUM_SUBBAG_CODE


async def require_sk_access(
    user: dict = Depends(current_user), db: AsyncIOMotorDatabase = Depends(get_db)
) -> dict:
    """Hanya admin atau pegawai Subbagian Teknis Penyelenggaraan Pemilu, Partisipasi
    dan Hukum yang boleh membaca/mengubah data SK (Surat Keputusan)."""
    if _is_admin(user) or await _is_teknis_hukum(db, user):
        return user
    raise HTTPException(
        status_code=403,
        detail="Hanya admin atau pegawai Subbagian Teknis Penyelenggaraan Pemilu, Partisipasi dan Hukum yang boleh mengakses SK.",
    )


async def _check_can_approve_srikandi(
    db: AsyncIOMotorDatabase, user: dict, surat_disposisi: Optional[str]
) -> None:
    """Admin selalu boleh approve. Pegawai biasa hanya boleh approve kalau:
    (1) admin sudah mengaktifkan izin 'surat_approve' untuknya, DAN
    (2) sub-bagiannya sendiri sama dengan disposisi (sub-bagian tujuan) surat itu."""
    if _is_admin(user):
        return
    if not (user.get("permissions") or {}).get("surat_approve"):
        raise HTTPException(
            status_code=403,
            detail="Anda tidak punya izin menyetujui (approve) surat. Hubungi admin untuk mengaktifkan izin ini.",
        )
    own_code = await _get_user_subbag_code(db, user)
    if not own_code or not surat_disposisi or own_code != surat_disposisi:
        raise HTTPException(
            status_code=403,
            detail="Surat ini bukan untuk sub-bagian Anda, sehingga tidak bisa Anda setujui.",
        )


# ==============================================================
# Common models
# ==============================================================

Role = Literal["admin", "pegawai"]
Kategori = Literal["Substantif", "Fasilitatif"]


class LoginRequest(BaseModel):
    nip: str
    password: str


class AuthUser(BaseModel):
    id: str
    nip: str
    name: str
    role: Role
    subbag_id: Optional[str] = None
    subbag_code: Optional[str] = None
    jabatan: Optional[str] = None
    is_active: bool = True
    permissions: dict = Field(default_factory=dict)


class LoginResponse(BaseModel):
    token: str
    user: AuthUser


# ==============================================================
# AUTH
# ==============================================================

@router.post("/auth/login", response_model=LoginResponse)
async def login(payload: LoginRequest, db: AsyncIOMotorDatabase = Depends(get_db)):
    nip = payload.nip.strip()
    user = await db.pegawai.find_one({"nip": nip})
    if not user or not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="NIP atau password salah.")
    if not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="NIP atau password salah.")
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Akun sudah dinonaktifkan.")
    token = create_access_token(user_id=user["id"], nip=user["nip"], role=user["role"])
    user.pop("password_hash", None)
    user.pop("_id", None)
    await _hydrate_subbag_name(db, user)
    return {"token": token, "user": _pegawai_public(user)}


@router.get("/auth/me", response_model=AuthUser)
async def me(user: dict = Depends(current_user)):
    return _pegawai_public(user)


# ==============================================================
# SUBBAGIAN
# ==============================================================

class SubbagianCreate(BaseModel):
    code: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=200)
    kepala: str = Field(default="", max_length=200)
    angka: Optional[int] = Field(default=None, ge=1)
    deskripsi: Optional[str] = Field(default=None, max_length=300)


class SubbagianUpdate(BaseModel):
    code: Optional[str] = Field(default=None, min_length=1, max_length=50)
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    kepala: Optional[str] = Field(default=None, max_length=200)
    angka: Optional[int] = Field(default=None, ge=1) 
    deskripsi: Optional[str] = Field(default=None, max_length=300)


class Subbagian(SubbagianCreate):
    id: str
    pegawai_count: int = 0
    created_at: str
    updated_at: str

# Deskripsi bawaan untuk subbagian lama yang belum punya deskripsi sendiri.
DESKRIPSI_BAWAAN = {
    "SUB-KUL": "Laporan anggaran, SPJ, inventaris, dan pengadaan barang logistik.",
    "SUB-RENDATIN": "Data pemilih, DPT, rekapitulasi, dan pemetaan TPS.",
    "SUB-SDM": "Kepegawaian, diklat, partisipasi masyarakat, dan hubungan media.",
    TEKNIS_HUKUM_SUBBAG_CODE: "Pencalonan, kampanye, pemungutan suara, dan kajian hukum.",
}


def _deskripsi_subbag(doc: dict) -> str:
    d = doc.get("deskripsi")
    return d if d is not None else DESKRIPSI_BAWAAN.get(doc.get("code"), "")

def _subbag_to_model(doc: dict) -> dict:
    return {
        "id": doc["id"],
        "code": doc["code"],
        "name": doc["name"],
        "kepala": doc.get("kepala", ""),
        "angka": doc.get("angka") or None,
        "deskripsi": _deskripsi_subbag(doc),
        "pegawai_count": doc.get("pegawai_count", 0),
        "created_at": doc.get("created_at", ""),
        "updated_at": doc.get("updated_at", ""),
    }


@router.get("/subbagian", response_model=List[Subbagian])
async def list_subbagian(db: AsyncIOMotorDatabase = Depends(get_db)):
    docs = await db.subbagian.find({}, {"_id": 0}).sort("code", 1).to_list(500)
    # Urut menurut angka (kecil ke besar); yang belum punya angka di paling bawah.
    docs.sort(key=lambda d: (not d.get("angka"), d.get("angka") or 0, d.get("code") or ""))
    # attach pegawai_count fresh
    for d in docs:
        d["pegawai_count"] = await db.pegawai.count_documents({"subbag_id": d["id"], "is_active": True})
    return [_subbag_to_model(d) for d in docs]


@router.post("/subbagian", response_model=Subbagian, status_code=201)
async def create_subbagian(
    payload: SubbagianCreate,
    _admin: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    existing = await db.subbagian.find_one({"code": payload.code.strip()}, {"_id": 0, "id": 1})
    if existing:
        raise HTTPException(status_code=409, detail=f"Kode subbagian '{payload.code}' sudah ada.")
    if payload.angka is not None:
        dup = await db.subbagian.find_one({"angka": payload.angka}, {"_id": 0, "id": 1})
        if dup:
            raise HTTPException(status_code=409, detail=f"Angka {payload.angka} sudah dipakai subbagian lain.")
    ts = now_iso()
    doc = payload.model_dump()
    doc.update({"id": str(uuid.uuid4()), "pegawai_count": 0, "created_at": ts, "updated_at": ts})
    await db.subbagian.insert_one(doc)
    doc.pop("_id", None)
    return _subbag_to_model(doc)


@router.put("/subbagian/{item_id}", response_model=Subbagian)
async def update_subbagian(
    item_id: str,
    payload: SubbagianUpdate,
    _admin: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    current = await db.subbagian.find_one({"id": item_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Subbagian tidak ditemukan.")
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if "angka" in payload.model_fields_set:
        updates["angka"] = payload.angka if payload.angka is not None else 0  # 0 = angka dikosongkan
        if payload.angka is not None:
            dup = await db.subbagian.find_one({"angka": payload.angka, "id": {"$ne": item_id}}, {"_id": 0, "id": 1})
            if dup:
                raise HTTPException(status_code=409, detail=f"Angka {payload.angka} sudah dipakai subbagian lain.")
    if "code" in updates and updates["code"] != current["code"]:
        other = await db.subbagian.find_one({"code": updates["code"], "id": {"$ne": item_id}}, {"_id": 0, "id": 1})
        if other:
            raise HTTPException(status_code=409, detail=f"Kode '{updates['code']}' sudah ada.")
    if updates:
        updates["updated_at"] = now_iso()
        await db.subbagian.update_one({"id": item_id}, {"$set": updates})
    fresh = await db.subbagian.find_one({"id": item_id}, {"_id": 0})
    fresh["pegawai_count"] = await db.pegawai.count_documents({"subbag_id": item_id, "is_active": True})
    return _subbag_to_model(fresh)


@router.delete("/subbagian/{item_id}")
async def delete_subbagian(
    item_id: str,
    _admin: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    used = await db.pegawai.count_documents({"subbag_id": item_id})
    if used > 0:
        raise HTTPException(status_code=409, detail=f"Subbagian ini masih dipakai oleh {used} pegawai. Pindahkan pegawai terlebih dulu.")
    result = await db.subbagian.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Subbagian tidak ditemukan.")
    return {"status": "deleted", "message": "Subbagian dihapus."}


# ==============================================================
# PEGAWAI
# ==============================================================

DEFAULT_PERMISSIONS = {
    "keuangan": True,
    "perencanaan": True,
    "parhubmas": True,
    "teknis": False,
    # Hak akses modul Surat Masuk & Surat Keluar - diatur admin per pegawai
    # lewat Master Data Pegawai / Hak Akses.
    "surat_edit": False,
    "surat_delete": False,
    "surat_approve": False,
}


class PegawaiCreate(BaseModel):
    nip: str = Field(min_length=3, max_length=50)
    name: str = Field(min_length=1, max_length=200)
    jabatan: str = Field(default="", max_length=200)
    subbag_id: Optional[str] = None
    role: Role = "pegawai"
    is_active: bool = True
    permissions: dict = Field(default_factory=lambda: DEFAULT_PERMISSIONS.copy())
    password: Optional[str] = Field(default=None, min_length=6, max_length=100)


class PegawaiUpdate(BaseModel):
    nip: Optional[str] = Field(default=None, min_length=3, max_length=50)
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    jabatan: Optional[str] = Field(default=None, max_length=200)
    subbag_id: Optional[str] = None
    role: Optional[Role] = None
    is_active: Optional[bool] = None
    permissions: Optional[dict] = None


class PegawaiPublic(BaseModel):
    id: str
    nip: str
    name: str
    jabatan: str = ""
    subbag_id: Optional[str] = None
    subbag_name: Optional[str] = None
    subbag_code: Optional[str] = None
    role: Role
    is_active: bool = True
    permissions: dict = Field(default_factory=dict)
    has_password: bool = False
    created_at: str = ""
    updated_at: str = ""


class PasswordChange(BaseModel):
    password: str = Field(min_length=6, max_length=100)


def _pegawai_public(doc: dict) -> dict:
    return {
        "id": doc["id"],
        "nip": doc["nip"],
        "name": doc["name"],
        "jabatan": doc.get("jabatan", ""),
        "subbag_id": doc.get("subbag_id"),
        "subbag_name": doc.get("subbag_name"),
        "subbag_code": doc.get("subbag_code"),
        "role": doc.get("role", "pegawai"),
        "is_active": doc.get("is_active", True),
        "permissions": doc.get("permissions", {}),
        "has_password": bool(doc.get("has_password", doc.get("password_hash"))) if "password_hash" in doc else bool(doc.get("has_password", False)),
        "created_at": doc.get("created_at", ""),
        "updated_at": doc.get("updated_at", ""),
    }


async def _hydrate_subbag_name(db: AsyncIOMotorDatabase, doc: dict) -> dict:
    if doc.get("subbag_id"):
        s = await db.subbagian.find_one({"id": doc["subbag_id"]}, {"_id": 0, "name": 1, "code": 1})
        doc["subbag_name"] = s["name"] if s else None
        doc["subbag_code"] = s["code"] if s else None
    return doc


@router.get("/pegawai", response_model=List[PegawaiPublic])
async def list_pegawai(
    role: Optional[Role] = None,
    active_only: bool = Query(False),
    search: Optional[str] = None,
    _u: dict = Depends(current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    query: dict = {}
    if role:
        query["role"] = role
    if active_only:
        query["is_active"] = True
    if search:
        s = search.strip()
        query["$or"] = [
            {"nip": {"$regex": s, "$options": "i"}},
            {"name": {"$regex": s, "$options": "i"}},
            {"jabatan": {"$regex": s, "$options": "i"}},
        ]
    docs = await db.pegawai.find(query, {"_id": 0}).sort("name", 1).to_list(500)
    result = []
    for d in docs:
        d["has_password"] = bool(d.get("password_hash"))
        d.pop("password_hash", None)
        await _hydrate_subbag_name(db, d)
        result.append(_pegawai_public(d))
    return result


@router.post("/pegawai", response_model=PegawaiPublic, status_code=201)
async def create_pegawai(
    payload: PegawaiCreate,
    _admin: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    existing = await db.pegawai.find_one({"nip": payload.nip.strip()}, {"_id": 0, "id": 1})
    if existing:
        raise HTTPException(status_code=409, detail=f"NIP '{payload.nip}' sudah terdaftar.")
    if payload.subbag_id:
        exists_sub = await db.subbagian.find_one({"id": payload.subbag_id}, {"_id": 0, "id": 1})
        if not exists_sub:
            raise HTTPException(status_code=400, detail="Subbagian tidak ditemukan.")
    ts = now_iso()
    data = payload.model_dump(exclude={"password"})
    data.update({
        "id": str(uuid.uuid4()),
        "created_at": ts,
        "updated_at": ts,
        "password_hash": hash_password(payload.password) if payload.password else None,
    })
    await db.pegawai.insert_one(data)
    data["has_password"] = bool(data.get("password_hash"))
    data.pop("password_hash", None)
    data.pop("_id", None)
    await _hydrate_subbag_name(db, data)
    return _pegawai_public(data)


@router.put("/pegawai/{item_id}", response_model=PegawaiPublic)
async def update_pegawai(
    item_id: str,
    payload: PegawaiUpdate,
    admin: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    current = await db.pegawai.find_one({"id": item_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Pegawai tidak ditemukan.")
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if "nip" in updates and updates["nip"] != current["nip"]:
        other = await db.pegawai.find_one({"nip": updates["nip"], "id": {"$ne": item_id}}, {"_id": 0, "id": 1})
        if other:
            raise HTTPException(status_code=409, detail=f"NIP '{updates['nip']}' sudah terdaftar.")
    if "subbag_id" in updates and updates["subbag_id"]:
        exists_sub = await db.subbagian.find_one({"id": updates["subbag_id"]}, {"_id": 0, "id": 1})
        if not exists_sub:
            raise HTTPException(status_code=400, detail="Subbagian tidak ditemukan.")
    # Prevent admin from demoting themselves if they are the last active admin
    if "role" in updates and updates["role"] != current.get("role") and current.get("role") == "admin":
        active_admins = await db.pegawai.count_documents({"role": "admin", "is_active": True, "id": {"$ne": item_id}})
        if active_admins == 0:
            raise HTTPException(status_code=400, detail="Tidak bisa menurunkan admin terakhir. Angkat admin lain terlebih dulu.")
    if "is_active" in updates and updates["is_active"] is False and current.get("role") == "admin":
        active_admins = await db.pegawai.count_documents({"role": "admin", "is_active": True, "id": {"$ne": item_id}})
        if active_admins == 0:
            raise HTTPException(status_code=400, detail="Tidak bisa menonaktifkan admin terakhir.")
    if updates:
        updates["updated_at"] = now_iso()
        await db.pegawai.update_one({"id": item_id}, {"$set": updates})
    fresh = await db.pegawai.find_one({"id": item_id}, {"_id": 0})
    fresh["has_password"] = bool(fresh.get("password_hash"))
    fresh.pop("password_hash", None)
    await _hydrate_subbag_name(db, fresh)
    return _pegawai_public(fresh)


@router.delete("/pegawai/{item_id}")
async def delete_pegawai(
    item_id: str,
    admin: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    current = await db.pegawai.find_one({"id": item_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Pegawai tidak ditemukan.")
    if admin["id"] == item_id:
        raise HTTPException(status_code=400, detail="Tidak bisa menghapus akun Anda sendiri.")
    if current.get("role") == "admin":
        active_admins = await db.pegawai.count_documents({"role": "admin", "is_active": True, "id": {"$ne": item_id}})
        if active_admins == 0:
            raise HTTPException(status_code=400, detail="Tidak bisa menghapus admin terakhir.")
    await db.pegawai.delete_one({"id": item_id})
    return {"status": "deleted", "message": "Pegawai dihapus."}


@router.post("/pegawai/{item_id}/password")
async def reset_password(
    item_id: str,
    payload: PasswordChange,
    _admin: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    current = await db.pegawai.find_one({"id": item_id}, {"_id": 0, "id": 1})
    if not current:
        raise HTTPException(status_code=404, detail="Pegawai tidak ditemukan.")
    await db.pegawai.update_one(
        {"id": item_id},
        {"$set": {"password_hash": hash_password(payload.password), "updated_at": now_iso()}},
    )
    return {"status": "ok", "message": "Password berhasil di-reset."}

class GantiPasswordRequest(BaseModel):
    password_lama: str = Field(min_length=1, max_length=100)
    password_baru: str = Field(min_length=6, max_length=100)


@router.post("/auth/ganti-password")
async def ganti_password(
    payload: GantiPasswordRequest,
    user: dict = Depends(current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    doc = await db.pegawai.find_one({"id": user["id"]}, {"_id": 0})
    if not doc or not doc.get("password_hash") or not verify_password(payload.password_lama, doc["password_hash"]):
        raise HTTPException(status_code=400, detail="Password lama salah.")
    if payload.password_lama == payload.password_baru:
        raise HTTPException(status_code=400, detail="Password baru harus berbeda dari password lama.")
    await db.pegawai.update_one(
        {"id": user["id"]},
        {"$set": {"password_hash": hash_password(payload.password_baru), "updated_at": now_iso()}},
    )
    return {"status": "ok", "message": "Password berhasil diganti."}

# ==============================================================
# PEJABAT
# ==============================================================

class PejabatCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    jabatan: str = Field(min_length=1, max_length=200)
    tmt: Optional[str] = Field(default=None, max_length=20)
    is_active: bool = True


class PejabatUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    jabatan: Optional[str] = Field(default=None, min_length=1, max_length=200)
    tmt: Optional[str] = Field(default=None, max_length=20)
    is_active: Optional[bool] = None


class Pejabat(PejabatCreate):
    id: str
    created_at: str
    updated_at: str


def _pejabat_model(doc: dict) -> dict:
    return {
        "id": doc["id"],
        "name": doc["name"],
        "jabatan": doc["jabatan"],
        "tmt": doc.get("tmt"),
        "is_active": doc.get("is_active", True),
        "created_at": doc.get("created_at", ""),
        "updated_at": doc.get("updated_at", ""),
    }


@router.get("/pejabat", response_model=List[Pejabat])
async def list_pejabat(db: AsyncIOMotorDatabase = Depends(get_db)):
    docs = await db.pejabat.find({}, {"_id": 0}).sort("jabatan", 1).to_list(500)
    # Ketua paling atas, sisanya tetap urut abjad menurut jabatan.
    docs.sort(key=lambda d: not (d.get("jabatan") or "").strip().lower().startswith("ketua"))
    return [_pejabat_model(d) for d in docs]


@router.post("/pejabat", response_model=Pejabat, status_code=201)
async def create_pejabat(
    payload: PejabatCreate,
    _admin: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    ts = now_iso()
    doc = payload.model_dump()
    doc.update({"id": str(uuid.uuid4()), "created_at": ts, "updated_at": ts})
    await db.pejabat.insert_one(doc)
    doc.pop("_id", None)
    return _pejabat_model(doc)


@router.put("/pejabat/{item_id}", response_model=Pejabat)
async def update_pejabat(
    item_id: str,
    payload: PejabatUpdate,
    _admin: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    current = await db.pejabat.find_one({"id": item_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Pejabat tidak ditemukan.")
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if updates:
        updates["updated_at"] = now_iso()
        await db.pejabat.update_one({"id": item_id}, {"$set": updates})
    fresh = await db.pejabat.find_one({"id": item_id}, {"_id": 0})
    return _pejabat_model(fresh)


@router.delete("/pejabat/{item_id}")
async def delete_pejabat(
    item_id: str,
    _admin: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    result = await db.pejabat.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pejabat tidak ditemukan.")
    return {"status": "deleted", "message": "Pejabat dihapus."}


# ==============================================================
# WILAYAH
# ==============================================================

class WilayahCreate(BaseModel):
    kode: str = Field(min_length=1, max_length=30)
    kecamatan: str = Field(min_length=1, max_length=200)
    kelurahan_count: int = Field(default=0, ge=0)


class WilayahUpdate(BaseModel):
    kode: Optional[str] = Field(default=None, min_length=1, max_length=30)
    kecamatan: Optional[str] = Field(default=None, min_length=1, max_length=200)
    kelurahan_count: Optional[int] = Field(default=None, ge=0)


class Wilayah(WilayahCreate):
    id: str
    created_at: str
    updated_at: str


def _wilayah_model(doc: dict) -> dict:
    return {
        "id": doc["id"],
        "kode": doc["kode"],
        "kecamatan": doc["kecamatan"],
        "kelurahan_count": doc.get("kelurahan_count", 0),
        "created_at": doc.get("created_at", ""),
        "updated_at": doc.get("updated_at", ""),
    }


@router.get("/wilayah", response_model=List[Wilayah])
async def list_wilayah(db: AsyncIOMotorDatabase = Depends(get_db)):
    docs = await db.wilayah.find({}, {"_id": 0}).sort("kode", 1).to_list(500)
    return [_wilayah_model(d) for d in docs]


@router.post("/wilayah", response_model=Wilayah, status_code=201)
async def create_wilayah(
    payload: WilayahCreate,
    _admin: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    existing = await db.wilayah.find_one({"kode": payload.kode.strip()}, {"_id": 0, "id": 1})
    if existing:
        raise HTTPException(status_code=409, detail=f"Kode wilayah '{payload.kode}' sudah ada.")
    ts = now_iso()
    doc = payload.model_dump()
    doc.update({"id": str(uuid.uuid4()), "created_at": ts, "updated_at": ts})
    await db.wilayah.insert_one(doc)
    doc.pop("_id", None)
    return _wilayah_model(doc)


@router.put("/wilayah/{item_id}", response_model=Wilayah)
async def update_wilayah(
    item_id: str,
    payload: WilayahUpdate,
    _admin: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    current = await db.wilayah.find_one({"id": item_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Wilayah tidak ditemukan.")
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if "kode" in updates and updates["kode"] != current["kode"]:
        other = await db.wilayah.find_one({"kode": updates["kode"], "id": {"$ne": item_id}}, {"_id": 0, "id": 1})
        if other:
            raise HTTPException(status_code=409, detail=f"Kode '{updates['kode']}' sudah ada.")
    if updates:
        updates["updated_at"] = now_iso()
        await db.wilayah.update_one({"id": item_id}, {"$set": updates})
    fresh = await db.wilayah.find_one({"id": item_id}, {"_id": 0})
    return _wilayah_model(fresh)


@router.delete("/wilayah/{item_id}")
async def delete_wilayah(
    item_id: str,
    _admin: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    result = await db.wilayah.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Wilayah tidak ditemukan.")
    return {"status": "deleted", "message": "Wilayah dihapus."}


# ==============================================================
# JENIS NASKAH
# ==============================================================

class JenisNaskahCreate(BaseModel):
    kode: str = Field(min_length=1, max_length=30)
    nama: str = Field(min_length=1, max_length=200)
    ket: str = Field(default="", max_length=500)


class JenisNaskahUpdate(BaseModel):
    kode: Optional[str] = Field(default=None, min_length=1, max_length=30)
    nama: Optional[str] = Field(default=None, min_length=1, max_length=200)
    ket: Optional[str] = Field(default=None, max_length=500)


class JenisNaskah(JenisNaskahCreate):
    id: str
    created_at: str
    updated_at: str


def _naskah_model(doc: dict) -> dict:
    return {
        "id": doc["id"],
        "kode": doc["kode"],
        "nama": doc["nama"],
        "ket": doc.get("ket", ""),
        "created_at": doc.get("created_at", ""),
        "updated_at": doc.get("updated_at", ""),
    }


@router.get("/jenis-naskah", response_model=List[JenisNaskah])
async def list_naskah(db: AsyncIOMotorDatabase = Depends(get_db)):
    docs = await db.jenis_naskah.find({}, {"_id": 0}).sort("kode", 1).to_list(500)
    return [_naskah_model(d) for d in docs]


@router.post("/jenis-naskah", response_model=JenisNaskah, status_code=201)
async def create_naskah(
    payload: JenisNaskahCreate,
    _admin: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    existing = await db.jenis_naskah.find_one({"kode": payload.kode.strip()}, {"_id": 0, "id": 1})
    if existing:
        raise HTTPException(status_code=409, detail=f"Kode '{payload.kode}' sudah ada.")
    ts = now_iso()
    doc = payload.model_dump()
    doc.update({"id": str(uuid.uuid4()), "created_at": ts, "updated_at": ts})
    await db.jenis_naskah.insert_one(doc)
    doc.pop("_id", None)
    return _naskah_model(doc)


@router.put("/jenis-naskah/{item_id}", response_model=JenisNaskah)
async def update_naskah(
    item_id: str,
    payload: JenisNaskahUpdate,
    _admin: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    current = await db.jenis_naskah.find_one({"id": item_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Jenis naskah tidak ditemukan.")
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if "kode" in updates and updates["kode"] != current["kode"]:
        other = await db.jenis_naskah.find_one({"kode": updates["kode"], "id": {"$ne": item_id}}, {"_id": 0, "id": 1})
        if other:
            raise HTTPException(status_code=409, detail=f"Kode '{updates['kode']}' sudah ada.")
    if updates:
        updates["updated_at"] = now_iso()
        await db.jenis_naskah.update_one({"id": item_id}, {"$set": updates})
    fresh = await db.jenis_naskah.find_one({"id": item_id}, {"_id": 0})
    return _naskah_model(fresh)


@router.delete("/jenis-naskah/{item_id}")
async def delete_naskah(
    item_id: str,
    _admin: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    result = await db.jenis_naskah.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Jenis naskah tidak ditemukan.")
    return {"status": "deleted", "message": "Jenis naskah dihapus."}


# ==============================================================
# KLASIFIKASI ARSIP (moved here, JWT-based admin gating)
# ==============================================================

KA_COLL = "klasifikasi_arsip"


class KlasifikasiBase(BaseModel):
    kategori: Kategori
    bidang: str = Field(min_length=1, max_length=200)
    kode: str = Field(min_length=1, max_length=50)
    uraian: str = Field(min_length=1, max_length=1000)
    level: int = Field(ge=0, le=10)

    @field_validator("kode", "bidang", "uraian")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()


class KlasifikasiCreate(KlasifikasiBase):
    pass


class KlasifikasiUpdate(BaseModel):
    kategori: Optional[Kategori] = None
    bidang: Optional[str] = Field(default=None, min_length=1, max_length=200)
    kode: Optional[str] = Field(default=None, min_length=1, max_length=50)
    uraian: Optional[str] = Field(default=None, min_length=1, max_length=1000)
    level: Optional[int] = Field(default=None, ge=0, le=10)


class Klasifikasi(KlasifikasiBase):
    id: str
    is_active: bool = True
    created_at: str
    updated_at: str


def _klas_model(doc: dict) -> dict:
    return {
        "id": doc["id"],
        "kategori": doc["kategori"],
        "bidang": doc["bidang"],
        "kode": doc["kode"],
        "uraian": doc["uraian"],
        "level": doc["level"],
        "is_active": doc.get("is_active", True),
        "created_at": doc.get("created_at", ""),
        "updated_at": doc.get("updated_at", ""),
    }


@router.get("/klasifikasi-arsip/meta/bidang", response_model=List[str])
async def klas_bidang(kategori: Optional[Kategori] = None, db: AsyncIOMotorDatabase = Depends(get_db)):
    q: dict = {}
    if kategori:
        q["kategori"] = kategori
    values = await db[KA_COLL].distinct("bidang", q)
    return sorted(values)


@router.get("/klasifikasi-arsip/meta/stats")
async def klas_stats(db: AsyncIOMotorDatabase = Depends(get_db)):
    return {
        "total": await db[KA_COLL].count_documents({}),
        "substantif": await db[KA_COLL].count_documents({"kategori": "Substantif"}),
        "fasilitatif": await db[KA_COLL].count_documents({"kategori": "Fasilitatif"}),
        "active": await db[KA_COLL].count_documents({"is_active": True}),
    }


@router.get("/klasifikasi-arsip", response_model=List[Klasifikasi])
async def klas_list(
    kategori: Optional[Kategori] = None,
    bidang: Optional[str] = None,
    search: Optional[str] = None,
    active_only: bool = Query(True),
    limit: int = Query(1000, ge=1, le=5000),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    q: dict = {}
    if active_only:
        q["is_active"] = True
    if kategori:
        q["kategori"] = kategori
    if bidang:
        q["bidang"] = bidang
    if search and search.strip():
        s = search.strip()
        q["$or"] = [
            {"kode": {"$regex": s, "$options": "i"}},
            {"uraian": {"$regex": s, "$options": "i"}},
            {"bidang": {"$regex": s, "$options": "i"}},
        ]
    docs = await db[KA_COLL].find(q, {"_id": 0}).sort([("kategori", 1), ("kode", 1)]).to_list(limit)
    return [_klas_model(d) for d in docs]


@router.get("/klasifikasi-arsip/{item_id}", response_model=Klasifikasi)
async def klas_get(item_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    doc = await db[KA_COLL].find_one({"id": item_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Klasifikasi tidak ditemukan.")
    return _klas_model(doc)


@router.post("/klasifikasi-arsip", response_model=Klasifikasi, status_code=201)
async def klas_create(
    payload: KlasifikasiCreate,
    _admin: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    existing = await db[KA_COLL].find_one({"kode": payload.kode}, {"_id": 0, "id": 1})
    if existing:
        raise HTTPException(status_code=409, detail=f"Kode '{payload.kode}' sudah digunakan.")
    ts = now_iso()
    doc = payload.model_dump()
    doc.update({"id": str(uuid.uuid4()), "is_active": True, "created_at": ts, "updated_at": ts})
    await db[KA_COLL].insert_one(doc)
    doc.pop("_id", None)
    return _klas_model(doc)


@router.put("/klasifikasi-arsip/{item_id}", response_model=Klasifikasi)
async def klas_update(
    item_id: str,
    payload: KlasifikasiUpdate,
    _admin: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    current = await db[KA_COLL].find_one({"id": item_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Klasifikasi tidak ditemukan.")
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if "kode" in updates and updates["kode"] != current["kode"]:
        other = await db[KA_COLL].find_one({"kode": updates["kode"], "id": {"$ne": item_id}}, {"_id": 0, "id": 1})
        if other:
            raise HTTPException(status_code=409, detail=f"Kode '{updates['kode']}' sudah digunakan.")
    if updates:
        updates["updated_at"] = now_iso()
        await db[KA_COLL].update_one({"id": item_id}, {"$set": updates})
    fresh = await db[KA_COLL].find_one({"id": item_id}, {"_id": 0})
    return _klas_model(fresh)


@router.delete("/klasifikasi-arsip/{item_id}")
async def klas_delete(
    item_id: str,
    _admin: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    current = await db[KA_COLL].find_one({"id": item_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Klasifikasi tidak ditemukan.")
    usage = 0
    for coll_name, field in [("surat_masuk", "kodeArsip"), ("surat_keluar", "kodeArsip"), ("arsip", "kodeArsip")]:
        try:
            usage += await db[coll_name].count_documents({field: current["kode"]})
        except Exception:
            pass
    if usage > 0:
        await db[KA_COLL].update_one({"id": item_id}, {"$set": {"is_active": False, "updated_at": now_iso()}})
        return {"status": "soft_deleted", "message": f"Klasifikasi digunakan pada {usage} data. Dinonaktifkan.", "usage_count": usage}
    await db[KA_COLL].delete_one({"id": item_id})
    return {"status": "deleted", "message": "Klasifikasi berhasil dihapus.", "usage_count": 0}


# ==============================================================
# ARSIP VISIBILITY (tampil/sembunyikan kategori Arsip & Dokumen)
# ==============================================================

ARSIP_VIS_COLL = "arsip_visibility"
ARSIP_VIS_ID = "default"
DEFAULT_ARSIP_VISIBILITY = {
    "keuangan": True,
    "perencanaan": True,
    "parhubmas": True,
    "teknis": False,
}


async def _get_arsip_visibility_raw(db: AsyncIOMotorDatabase) -> dict:
    doc = await db[ARSIP_VIS_COLL].find_one({"id": ARSIP_VIS_ID}, {"_id": 0})
    if not doc:
        return DEFAULT_ARSIP_VISIBILITY.copy()
    return {k: doc.get(k, DEFAULT_ARSIP_VISIBILITY[k]) for k in DEFAULT_ARSIP_VISIBILITY}


class ArsipVisibility(BaseModel):
    keuangan: bool
    perencanaan: bool
    parhubmas: bool
    teknis: bool


class ArsipVisibilityUpdate(BaseModel):
    keuangan: Optional[bool] = None
    perencanaan: Optional[bool] = None
    parhubmas: Optional[bool] = None
    teknis: Optional[bool] = None


@router.get("/arsip-visibility", response_model=ArsipVisibility)
async def get_arsip_visibility_effective(
    user: dict = Depends(current_user), db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Visibilitas kategori Arsip & Dokumen untuk pengguna yang sedang login.
    Kategori 'teknis' (Teknis Pemilu & Hukum) selalu terlihat oleh admin dan
    pegawai Subbagian Teknis & Hukum, walau admin sedang menyembunyikannya
    dari pegawai lain."""
    vis = await _get_arsip_visibility_raw(db)
    if _is_admin(user) or await _is_teknis_hukum(db, user):
        vis["teknis"] = True
    return vis


@router.get("/arsip-visibility/settings", response_model=ArsipVisibility)
async def get_arsip_visibility_settings(
    _admin: dict = Depends(require_admin), db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Nilai toggle admin yang sebenarnya tersimpan (dipakai halaman Hak Akses)."""
    return await _get_arsip_visibility_raw(db)


@router.put("/arsip-visibility/settings", response_model=ArsipVisibility)
async def update_arsip_visibility_settings(
    payload: ArsipVisibilityUpdate,
    _admin: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    current = await _get_arsip_visibility_raw(db)
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    current.update(updates)
    await db[ARSIP_VIS_COLL].update_one(
        {"id": ARSIP_VIS_ID},
        {"$set": {**current, "id": ARSIP_VIS_ID, "updated_at": now_iso()}},
        upsert=True,
    )
    return current

# --------------------------------------------------------------
# KATEGORI ARSIP = SUBBAGIAN. Satu subbagian = satu menu Arsip & Dokumen.
# Tampil/sembunyi disimpan di subbagian ("arsipTampil"). Kalau belum pernah
# diatur, subbagian lama memakai nilai pengaturan lama (4 tombol), subbagian
# baru otomatis tampil.
# --------------------------------------------------------------

class ArsipKategori(BaseModel):
    id: str
    code: str
    name: str
    angka: Optional[int] = None
    deskripsi: str = ""
    tampil: bool


class ArsipKategoriUpdate(BaseModel):
    tampil: bool


def _arsip_tampil_tersimpan(sub: dict, vis_lama: dict) -> bool:
    if sub.get("arsipTampil") is not None:
        return bool(sub["arsipTampil"])
    kat = SUBBAG_CODE_TO_KATEGORI.get(sub.get("code"))
    return vis_lama.get(kat, True) if kat else True


async def _list_arsip_kategori(db: AsyncIOMotorDatabase, user: Optional[dict]) -> list:
    docs = await db.subbagian.find({}, {"_id": 0}).sort("code", 1).to_list(500)
    docs.sort(key=lambda d: (not d.get("angka"), d.get("angka") or 0, d.get("code") or ""))
    vis_lama = await _get_arsip_visibility_raw(db)
    istimewa = bool(user) and (_is_admin(user) or await _is_teknis_hukum(db, user))
    out = []
    for d in docs:
        tampil = _arsip_tampil_tersimpan(d, vis_lama)
        if istimewa and d.get("code") == TEKNIS_HUKUM_SUBBAG_CODE:
            tampil = True
        out.append({
            "id": d["id"], "code": d["code"], "name": d["name"], "angka": d.get("angka") or None,
            "deskripsi": _deskripsi_subbag(d), "tampil": tampil,
        })
    return out


@router.get("/arsip-kategori", response_model=List[ArsipKategori])
async def arsip_kategori_efektif(
    user: dict = Depends(current_user), db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Daftar kategori Arsip (= subbagian) untuk pengguna yang sedang login."""
    return await _list_arsip_kategori(db, user)


@router.get("/arsip-kategori/settings", response_model=List[ArsipKategori])
async def arsip_kategori_settings(
    _admin: dict = Depends(require_admin), db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Nilai tampil/sembunyi yang sebenarnya tersimpan (halaman Hak Akses)."""
    return await _list_arsip_kategori(db, None)


@router.put("/arsip-kategori/{subbag_id}", response_model=ArsipKategoriUpdate)
async def arsip_kategori_update(
    subbag_id: str,
    payload: ArsipKategoriUpdate,
    _admin: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    sub = await db.subbagian.find_one({"id": subbag_id}, {"_id": 0, "id": 1})
    if not sub:
        raise HTTPException(status_code=404, detail="Subbagian tidak ditemukan.")
    await db.subbagian.update_one({"id": subbag_id}, {"$set": {"arsipTampil": payload.tampil}})
    return payload

# ==============================================================
# SURAT MASUK
# ==============================================================

SM_COLL = "surat_masuk"
Ditujukan = Literal["KETUA", "SEKRETARIS"]


class SuratMasukCreate(BaseModel):
    nomorUrut: int = Field(gt=0)
    nomorAgenda: Optional[str] = Field(default=None, max_length=50)
    tanggal: str  # tanggal surat DITERIMA / masuk ke agenda
    tanggalSurat: str  # tanggal yang tertulis di surat aslinya
    alamatPengirim: str = Field(min_length=1, max_length=300)
    nomorSurat: str = Field(min_length=1, max_length=200)
    perihal: str = Field(min_length=1, max_length=500)
    disposisi: str = Field(min_length=1, max_length=50)  # kode subbagian, mis. "SUB-KUL"
    ditujukan: Ditujukan
    kodeArsip: str = Field(min_length=1, max_length=50)


class SuratMasukUpdate(BaseModel):
    nomorUrut: Optional[int] = Field(default=None, gt=0)
    nomorAgenda: Optional[str] = Field(default=None, max_length=50)
    tanggal: Optional[str] = None
    tanggalSurat: Optional[str] = None
    alamatPengirim: Optional[str] = Field(default=None, min_length=1, max_length=300)
    nomorSurat: Optional[str] = Field(default=None, min_length=1, max_length=200)
    perihal: Optional[str] = Field(default=None, min_length=1, max_length=500)
    disposisi: Optional[str] = Field(default=None, min_length=1, max_length=50)
    ditujukan: Optional[Ditujukan] = None
    kodeArsip: Optional[str] = Field(default=None, min_length=1, max_length=50)


class SuratMasuk(BaseModel):
    id: str
    nomorUrut: int
    nomorAgenda: str
    tanggal: str
    tanggalSurat: str
    alamatPengirim: str
    nomorSurat: str
    perihal: str
    disposisi: str
    ditujukan: str
    kodeArsip: str
    srikandi: bool = False
    srikandiApprovedBy: Optional[str] = None
    srikandiApprovedAt: Optional[str] = None
    lampiran: Optional[str] = None
    createdBy: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


def _surat_masuk_model(doc: dict) -> SuratMasuk:
    return SuratMasuk(**{k: doc.get(k) for k in SuratMasuk.model_fields.keys()})


async def _check_nomor_urut_unique(
    db: AsyncIOMotorDatabase,
    coll: str,
    nomor_urut: int,
    tanggal: str,
    exclude_id: Optional[str] = None,
    no_urut_field: str = "nomorUrut",
    date_field: str = "tanggal",
    extra_filter: Optional[dict] = None,
) -> int:
    """Nomor urut hanya perlu unik dalam tahun yang sama (diambil dari tanggal),
    dan kalau extra_filter dikasih (misal {"bagian": "Ketua"}), juga hanya dalam
    lingkup itu. Jadi nomor 1 boleh dipakai lagi setiap tahun (atau di bagian lain)."""
    try:
        tahun = datetime.fromisoformat(tanggal).year
    except Exception:
        tahun = datetime.now(timezone.utc).year
    filt: dict = {no_urut_field: nomor_urut, date_field: {"$regex": f"^{tahun}"}}
    if extra_filter:
        filt.update(extra_filter)
    if exclude_id:
        filt["id"] = {"$ne": exclude_id}
    existing = await db[coll].find_one(filt, {"_id": 0, "id": 1})
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Nomor urut {nomor_urut} sudah dipakai di tahun {tahun}. Silakan pilih nomor lain.",
        )
    return tahun


@router.get("/surat-masuk/nomor-terpakai", response_model=List[int])
async def sm_nomor_terpakai(_user: dict = Depends(current_user), db: AsyncIOMotorDatabase = Depends(get_db)):
    """Daftar nomor urut yang sudah dipakai, supaya frontend bisa menandai/skip nomor tsb."""
    return sorted(await db[SM_COLL].distinct("nomorUrut"))


@router.get("/surat-masuk", response_model=List[SuratMasuk])
async def sm_list(
    q: Optional[str] = Query(default=None),
    disposisi: Optional[str] = Query(default=None),
    ditujukan: Optional[str] = Query(default=None),
    srikandi: Optional[bool] = Query(default=None),
    _user: dict = Depends(current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    filt: dict = {}
    if disposisi:
        filt["disposisi"] = disposisi
    if ditujukan:
        filt["ditujukan"] = ditujukan
    if srikandi is not None:
        filt["srikandi"] = srikandi
    if q:
        filt["$or"] = [
            {"perihal": {"$regex": q, "$options": "i"}},
            {"nomorSurat": {"$regex": q, "$options": "i"}},
            {"alamatPengirim": {"$regex": q, "$options": "i"}},
        ]
    docs = await db[SM_COLL].find(filt, {"_id": 0}).sort("nomorUrut", 1).to_list(2000)
    return [_surat_masuk_model(d) for d in docs]


@router.get("/surat-masuk/{item_id}", response_model=SuratMasuk)
async def sm_get(item_id: str, _user: dict = Depends(current_user), db: AsyncIOMotorDatabase = Depends(get_db)):
    doc = await db[SM_COLL].find_one({"id": item_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Surat masuk tidak ditemukan.")
    return _surat_masuk_model(doc)


@router.post("/surat-masuk", response_model=SuratMasuk, status_code=201)
async def sm_create(
    payload: SuratMasukCreate,
    user: dict = Depends(current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    await _check_nomor_urut_unique(db, SM_COLL, payload.nomorUrut, payload.tanggal)
    sub = await db.subbagian.find_one({"code": payload.disposisi}, {"_id": 0, "id": 1})
    if not sub:
        raise HTTPException(status_code=400, detail=f"Kode sub-bagian '{payload.disposisi}' tidak ditemukan.")
    ts = now_iso()
    doc = payload.model_dump()
    if not doc.get("nomorAgenda"):
        doc["nomorAgenda"] = str(payload.nomorUrut)
    doc.update({
        "id": str(uuid.uuid4()),
        "srikandi": False,
        "srikandiApprovedBy": None,
        "srikandiApprovedAt": None,
        "lampiran": None,
        "createdBy": user["id"],
        "createdAt": ts,
        "updatedAt": ts,
    })
    await db[SM_COLL].insert_one(doc)
    return _surat_masuk_model(doc)


@router.put("/surat-masuk/{item_id}", response_model=SuratMasuk)
async def sm_update(
    item_id: str,
    payload: SuratMasukUpdate,
    _perm: dict = Depends(require_surat_edit),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    current = await db[SM_COLL].find_one({"id": item_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Surat masuk tidak ditemukan.")
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if "nomorUrut" in updates or "tanggal" in updates:
        no_urut = updates.get("nomorUrut", current["nomorUrut"])
        tgl = updates.get("tanggal", current["tanggal"])
        await _check_nomor_urut_unique(db, SM_COLL, no_urut, tgl, exclude_id=item_id)
    if "disposisi" in updates:
        sub = await db.subbagian.find_one({"code": updates["disposisi"]}, {"_id": 0, "id": 1})
        if not sub:
            raise HTTPException(status_code=400, detail=f"Kode sub-bagian '{updates['disposisi']}' tidak ditemukan.")
    if updates:
        updates["updatedAt"] = now_iso()
        await db[SM_COLL].update_one({"id": item_id}, {"$set": updates})
    fresh = await db[SM_COLL].find_one({"id": item_id}, {"_id": 0})
    return _surat_masuk_model(fresh)


@router.delete("/surat-masuk/{item_id}")
async def sm_delete(
    item_id: str,
    _perm: dict = Depends(require_surat_delete),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    current = await db[SM_COLL].find_one({"id": item_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Surat masuk tidak ditemukan.")
    if current.get("lampiran"):
        try:
            (UPLOAD_DIR / current["lampiran"]).unlink(missing_ok=True)
        except Exception:
            pass
    await db[SM_COLL].delete_one({"id": item_id})
    return {"status": "deleted", "message": "Surat masuk berhasil dihapus."}


@router.post("/surat-masuk/{item_id}/approve", response_model=SuratMasuk)
async def sm_approve(
    item_id: str,
    user: dict = Depends(current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Approval 'srikandi' dilakukan staf sub-bagian tujuan langsung dari baris tabel,
    bukan checkbox saat membuat surat."""
    current = await db[SM_COLL].find_one({"id": item_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Surat masuk tidak ditemukan.")
    await _check_can_approve_srikandi(db, user, current.get("disposisi"))
    updates = {
        "srikandi": True,
        "srikandiApprovedBy": user["id"],
        "srikandiApprovedAt": now_iso(),
        "updatedAt": now_iso(),
    }
    await db[SM_COLL].update_one({"id": item_id}, {"$set": updates})
    fresh = await db[SM_COLL].find_one({"id": item_id}, {"_id": 0})
    return _surat_masuk_model(fresh)


@router.post("/surat-masuk/{item_id}/unapprove", response_model=SuratMasuk)
async def sm_unapprove(
    item_id: str,
    user: dict = Depends(current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    current = await db[SM_COLL].find_one({"id": item_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Surat masuk tidak ditemukan.")
    await _check_can_approve_srikandi(db, user, current.get("disposisi"))
    updates = {"srikandi": False, "srikandiApprovedBy": None, "srikandiApprovedAt": None, "updatedAt": now_iso()}
    await db[SM_COLL].update_one({"id": item_id}, {"$set": updates})
    fresh = await db[SM_COLL].find_one({"id": item_id}, {"_id": 0})
    return _surat_masuk_model(fresh)


@router.post("/surat-masuk/{item_id}/lampiran", response_model=SuratMasuk)
async def sm_upload_lampiran(
    item_id: str,
    file: UploadFile = File(...),
    user: dict = Depends(current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    current = await db[SM_COLL].find_one({"id": item_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Surat masuk tidak ditemukan.")
    allowed_ext = {".pdf", ".jpg", ".jpeg", ".png"}
    ext = Path(file.filename or "").suffix.lower()
    if ext not in allowed_ext:
        raise HTTPException(status_code=400, detail="Format file harus PDF, JPG, atau PNG.")
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Ukuran file maksimal 10MB.")
    stored_name = f"{uuid.uuid4()}{ext}"
    (UPLOAD_DIR / stored_name).write_bytes(contents)
    if current.get("lampiran"):
        try:
            (UPLOAD_DIR / current["lampiran"]).unlink(missing_ok=True)
        except Exception:
            pass
    await db[SM_COLL].update_one({"id": item_id}, {"$set": {"lampiran": stored_name, "updatedAt": now_iso()}})
    fresh = await db[SM_COLL].find_one({"id": item_id}, {"_id": 0})
    return _surat_masuk_model(fresh)


# ==============================================================
# SURAT KELUAR
# ==============================================================

SK_COLL = "surat_keluar"
StatusSK = Literal["Draft", "Terkirim"]


class SuratKeluarCreate(BaseModel):
    nomorUrut: int = Field(gt=0)
    nomor: str = Field(min_length=1, max_length=200)
    tanggal: str
    tujuan: str = Field(min_length=1, max_length=300)
    perihal: str = Field(min_length=1, max_length=500)
    penanggungJawab: str = Field(min_length=1, max_length=200)
    pejabatId: Optional[str] = None
    disposisi: str = Field(min_length=1, max_length=50)  # kode subbagian (untuk approval)
    jenisSurat: str = Field(default="Surat Keluar", max_length=50)  # "Surat Keluar" atau "Surat Edaran"
    kodeArsip: Optional[str] = Field(default=None, max_length=50)  # kosong kalau Surat Edaran
    jenisNaskah: Optional[str] = Field(default=None, max_length=50)  # kosong kalau Surat Edaran
    kodeWilayah: Optional[str] = Field(default=None, max_length=50)
    bagian: str = Field(min_length=1, max_length=50)  # "Ketua" atau "Sekretaris"
    status: StatusSK = "Draft"


class SuratKeluarUpdate(BaseModel):
    nomorUrut: Optional[int] = Field(default=None, gt=0)
    nomor: Optional[str] = Field(default=None, min_length=1, max_length=200)
    tanggal: Optional[str] = None
    tujuan: Optional[str] = Field(default=None, min_length=1, max_length=300)
    perihal: Optional[str] = Field(default=None, min_length=1, max_length=500)
    penanggungJawab: Optional[str] = Field(default=None, min_length=1, max_length=200)
    pejabatId: Optional[str] = None
    disposisi: Optional[str] = Field(default=None, min_length=1, max_length=50)
    jenisSurat: Optional[str] = Field(default=None, max_length=50)
    kodeArsip: Optional[str] = Field(default=None, max_length=50)
    jenisNaskah: Optional[str] = Field(default=None, max_length=50)
    kodeWilayah: Optional[str] = Field(default=None, max_length=50)
    bagian: Optional[str] = Field(default=None, min_length=1, max_length=50)
    status: Optional[StatusSK] = None


class SuratKeluar(BaseModel):
    id: str
    nomorUrut: int
    nomor: str
    tanggal: str
    tujuan: str
    perihal: str
    penanggungJawab: Optional[str] = None
    pejabatId: Optional[str] = None
    pejabatNama: Optional[str] = None
    pejabatJabatan: Optional[str] = None
    disposisi: str
    jenisSurat: str = "Surat Keluar"
    kodeArsip: Optional[str] = None
    jenisNaskah: Optional[str] = None
    kodeWilayah: Optional[str] = None
    bagian: Optional[str] = None
    status: str
    lampiran: Optional[str] = None
    srikandi: bool = False
    srikandiApprovedBy: Optional[str] = None
    srikandiApprovedAt: Optional[str] = None
    createdBy: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


async def _surat_keluar_model(db: AsyncIOMotorDatabase, doc: dict) -> SuratKeluar:
    out = {k: doc.get(k) for k in SuratKeluar.model_fields.keys()}
    out["jenisSurat"] = doc.get("jenisSurat") or "Surat Keluar"
    if doc.get("pejabatId"):
        pej = await db.pejabat.find_one({"id": doc["pejabatId"]}, {"_id": 0, "name": 1, "jabatan": 1})
        if pej:
            out["pejabatNama"] = pej.get("name")
            out["pejabatJabatan"] = pej.get("jabatan")
    return SuratKeluar(**out)


async def _validate_pejabat_ketua_sekretaris(db: AsyncIOMotorDatabase, pejabat_id: str) -> None:
    """Dropdown Ketua/Sekretaris di Surat Keluar hanya boleh memilih pejabat
    yang jabatannya mengandung kata 'Ketua' atau 'Sekretaris'."""
    pej = await db.pejabat.find_one({"id": pejabat_id}, {"_id": 0, "jabatan": 1})
    if not pej:
        raise HTTPException(status_code=400, detail="Pejabat penandatangan tidak ditemukan.")
    jabatan = (pej.get("jabatan") or "").lower()
    if "ketua" not in jabatan and "sekretaris" not in jabatan:
        raise HTTPException(
            status_code=400,
            detail="Penandatangan surat keluar harus Ketua atau Sekretaris.",
        )


@router.get("/surat-keluar/nomor-terpakai", response_model=List[int])
async def sk_nomor_terpakai(_user: dict = Depends(current_user), db: AsyncIOMotorDatabase = Depends(get_db)):
    return sorted(await db[SK_COLL].distinct("nomorUrut"))


@router.get("/pejabat/penandatangan", response_model=List[Pejabat])
async def pejabat_penandatangan(_user: dict = Depends(current_user), db: AsyncIOMotorDatabase = Depends(get_db)):
    """List pejabat yang boleh dipilih sebagai penandatangan surat keluar
    (jabatan Ketua/Sekretaris saja) - dipakai untuk dropdown yang bisa dicari di Surat Keluar."""
    docs = await db.pejabat.find({"is_active": True}, {"_id": 0}).sort("jabatan", 1).to_list(500)
    filtered = [
        d for d in docs
        if "ketua" in (d.get("jabatan") or "").lower() or "sekretaris" in (d.get("jabatan") or "").lower()
    ]
    return [_pejabat_model(d) for d in filtered]


@router.get("/surat-keluar", response_model=List[SuratKeluar])
async def sk_list(
    q: Optional[str] = Query(default=None),
    disposisi: Optional[str] = Query(default=None),
    pejabatId: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    srikandi: Optional[bool] = Query(default=None),
    _user: dict = Depends(current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    filt: dict = {}
    if disposisi:
        filt["disposisi"] = disposisi
    if pejabatId:
        filt["pejabatId"] = pejabatId
    if status:
        filt["status"] = status
    if srikandi is not None:
        filt["srikandi"] = srikandi
    if q:
        filt["$or"] = [
            {"perihal": {"$regex": q, "$options": "i"}},
            {"nomor": {"$regex": q, "$options": "i"}},
            {"tujuan": {"$regex": q, "$options": "i"}},
        ]
    docs = await db[SK_COLL].find(filt, {"_id": 0}).sort("nomorUrut", 1).to_list(2000)
    return [await _surat_keluar_model(db, d) for d in docs]


@router.get("/surat-keluar/{item_id}", response_model=SuratKeluar)
async def sk_get(item_id: str, _user: dict = Depends(current_user), db: AsyncIOMotorDatabase = Depends(get_db)):
    doc = await db[SK_COLL].find_one({"id": item_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Surat keluar tidak ditemukan.")
    return await _surat_keluar_model(db, doc)


@router.post("/surat-keluar", response_model=SuratKeluar, status_code=201)
async def sk_create(
    payload: SuratKeluarCreate,
    user: dict = Depends(current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    await _check_nomor_urut_unique(db, SK_COLL, payload.nomorUrut, payload.tanggal, extra_filter={"bagian": payload.bagian})
    if payload.jenisSurat == "Surat Keluar" and (not payload.kodeArsip or not payload.jenisNaskah):
        raise HTTPException(status_code=400, detail="Kode Arsip dan Jenis Naskah wajib diisi untuk Surat Keluar biasa.")
    if payload.pejabatId:
        await _validate_pejabat_ketua_sekretaris(db, payload.pejabatId)
    sub = await db.subbagian.find_one({"code": payload.disposisi}, {"_id": 0, "id": 1})
    if not sub:
        raise HTTPException(status_code=400, detail=f"Kode sub-bagian '{payload.disposisi}' tidak ditemukan.")
    ts = now_iso()
    doc = payload.model_dump()
    doc.update({
        "id": str(uuid.uuid4()),
        "srikandi": False,
        "srikandiApprovedBy": None,
        "srikandiApprovedAt": None,
        "createdBy": user["id"],
        "createdAt": ts,
        "updatedAt": ts,
    })
    await db[SK_COLL].insert_one(doc)
    return await _surat_keluar_model(db, doc)


@router.put("/surat-keluar/{item_id}", response_model=SuratKeluar)
async def sk_update(
    item_id: str,
    payload: SuratKeluarUpdate,
    _perm: dict = Depends(require_surat_edit),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    current = await db[SK_COLL].find_one({"id": item_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Surat keluar tidak ditemukan.")
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if "nomorUrut" in updates or "tanggal" in updates or "bagian" in updates:
        no_urut = updates.get("nomorUrut", current["nomorUrut"])
        tgl = updates.get("tanggal", current["tanggal"])
        bagian = updates.get("bagian", current.get("bagian"))
        await _check_nomor_urut_unique(
            db, SK_COLL, no_urut, tgl, exclude_id=item_id, extra_filter={"bagian": bagian}
        )
    if "pejabatId" in updates and updates["pejabatId"]:
        await _validate_pejabat_ketua_sekretaris(db, updates["pejabatId"])
    if "disposisi" in updates:
        sub = await db.subbagian.find_one({"code": updates["disposisi"]}, {"_id": 0, "id": 1})
        if not sub:
            raise HTTPException(status_code=400, detail=f"Kode sub-bagian '{updates['disposisi']}' tidak ditemukan.")
    jenis_surat = updates.get("jenisSurat", current.get("jenisSurat", "Surat Keluar"))
    kode_arsip = updates.get("kodeArsip", current.get("kodeArsip"))
    jenis_naskah = updates.get("jenisNaskah", current.get("jenisNaskah"))
    if jenis_surat == "Surat Keluar" and (not kode_arsip or not jenis_naskah):
        raise HTTPException(status_code=400, detail="Kode Arsip dan Jenis Naskah wajib diisi untuk Surat Keluar biasa.")
    if updates:
        updates["updatedAt"] = now_iso()
        await db[SK_COLL].update_one({"id": item_id}, {"$set": updates})
    fresh = await db[SK_COLL].find_one({"id": item_id}, {"_id": 0})
    return await _surat_keluar_model(db, fresh)


@router.delete("/surat-keluar/{item_id}")
async def sk_delete(
    item_id: str,
    _perm: dict = Depends(require_surat_delete),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    current = await db[SK_COLL].find_one({"id": item_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Surat keluar tidak ditemukan.")
    if current.get("lampiran"):
        try:
            (UPLOAD_DIR / current["lampiran"]).unlink(missing_ok=True)
        except Exception:
            pass
    await db[SK_COLL].delete_one({"id": item_id})
    return {"status": "deleted", "message": "Surat keluar berhasil dihapus."}


@router.post("/surat-keluar/{item_id}/lampiran", response_model=SuratKeluar)
async def sk_upload_lampiran(
    item_id: str,
    file: UploadFile = File(...),
    user: dict = Depends(current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    current = await db[SK_COLL].find_one({"id": item_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Surat keluar tidak ditemukan.")
    allowed_ext = {".pdf", ".jpg", ".jpeg", ".png"}
    ext = Path(file.filename or "").suffix.lower()
    if ext not in allowed_ext:
        raise HTTPException(status_code=400, detail="Format file harus PDF, JPG, atau PNG.")
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Ukuran file maksimal 10MB.")
    stored_name = f"{uuid.uuid4()}{ext}"
    (UPLOAD_DIR / stored_name).write_bytes(contents)
    if current.get("lampiran"):
        try:
            (UPLOAD_DIR / current["lampiran"]).unlink(missing_ok=True)
        except Exception:
            pass
    await db[SK_COLL].update_one({"id": item_id}, {"$set": {"lampiran": stored_name, "updatedAt": now_iso()}})
    fresh = await db[SK_COLL].find_one({"id": item_id}, {"_id": 0})
    return await _surat_keluar_model(db, fresh)


@router.post("/surat-keluar/{item_id}/approve", response_model=SuratKeluar)
async def sk_approve(
    item_id: str,
    user: dict = Depends(current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    current = await db[SK_COLL].find_one({"id": item_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Surat keluar tidak ditemukan.")
    await _check_can_approve_srikandi(db, user, current.get("disposisi"))
    updates = {
        "srikandi": True,
        "srikandiApprovedBy": user["id"],
        "srikandiApprovedAt": now_iso(),
        "updatedAt": now_iso(),
    }
    await db[SK_COLL].update_one({"id": item_id}, {"$set": updates})
    fresh = await db[SK_COLL].find_one({"id": item_id}, {"_id": 0})
    return await _surat_keluar_model(db, fresh)


@router.post("/surat-keluar/{item_id}/unapprove", response_model=SuratKeluar)
async def sk_unapprove(
    item_id: str,
    user: dict = Depends(current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    current = await db[SK_COLL].find_one({"id": item_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Surat keluar tidak ditemukan.")
    await _check_can_approve_srikandi(db, user, current.get("disposisi"))
    updates = {"srikandi": False, "srikandiApprovedBy": None, "srikandiApprovedAt": None, "updatedAt": now_iso()}
    await db[SK_COLL].update_one({"id": item_id}, {"$set": updates})
    fresh = await db[SK_COLL].find_one({"id": item_id}, {"_id": 0})
    return await _surat_keluar_model(db, fresh)


# ==============================================================
# SK (SURAT KEPUTUSAN) - menu "SK" di Buku Agenda, TIDAK sama dengan
# Surat Keluar di atas. Hanya admin dan pegawai Subbagian Teknis
# Penyelenggaraan Pemilu, Partisipasi dan Hukum yang boleh mengakses.
# ==============================================================

SKDOK_COLL = "sk_dokumen"
SkOleh = Literal["Ketua", "Sekretaris"]


def _build_nomor_sk(no_urut: int, tanggal: str) -> str:
    try:
        tahun = datetime.fromisoformat(tanggal).year
    except Exception:
        tahun = datetime.now(timezone.utc).year
    return f"{no_urut} TAHUN {tahun}"


class SkDokumenCreate(BaseModel):
    noUrut: int = Field(gt=0)
    tanggal: str
    perihal: str = Field(min_length=1, max_length=500)
    skOleh: SkOleh
    subbagId: str = Field(min_length=1)


class SkDokumenUpdate(BaseModel):
    noUrut: Optional[int] = Field(default=None, gt=0)
    tanggal: Optional[str] = None
    perihal: Optional[str] = Field(default=None, min_length=1, max_length=500)
    skOleh: Optional[SkOleh] = None
    subbagId: Optional[str] = None


class SkDokumen(BaseModel):
    id: str
    noUrut: int
    nomorSk: str
    tanggal: str
    perihal: str
    skOleh: str
    subbagId: str
    arsipFileName: Optional[str] = None
    arsipFile: Optional[str] = None
    createdBy: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


def _sk_dokumen_model(doc: dict) -> SkDokumen:
    return SkDokumen(**{k: doc.get(k) for k in SkDokumen.model_fields.keys()})


@router.get("/sk/nomor-terpakai", response_model=List[int])
async def sk_dokumen_nomor_terpakai(
    _perm: dict = Depends(require_sk_access), db: AsyncIOMotorDatabase = Depends(get_db)
):
    return sorted(await db[SKDOK_COLL].distinct("noUrut"))


@router.get("/sk", response_model=List[SkDokumen])
async def sk_dokumen_list(
    q: Optional[str] = Query(default=None),
    skOleh: Optional[str] = Query(default=None),
    _perm: dict = Depends(require_sk_access),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    filt: dict = {}
    if skOleh:
        filt["skOleh"] = skOleh
    if q:
        filt["$or"] = [
            {"perihal": {"$regex": q, "$options": "i"}},
            {"nomorSk": {"$regex": q, "$options": "i"}},
        ]
    docs = await db[SKDOK_COLL].find(filt, {"_id": 0}).sort("noUrut", 1).to_list(2000)
    return [_sk_dokumen_model(d) for d in docs]


@router.post("/sk", response_model=SkDokumen, status_code=201)
async def sk_dokumen_create(
    payload: SkDokumenCreate,
    user: dict = Depends(require_sk_access),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    await _check_nomor_urut_unique(db, SKDOK_COLL, payload.noUrut, payload.tanggal, no_urut_field="noUrut")
    sub = await db.subbagian.find_one({"id": payload.subbagId}, {"_id": 0, "id": 1})
    if not sub:
        raise HTTPException(status_code=400, detail="Subbagian tidak ditemukan.")
    ts = now_iso()
    doc = payload.model_dump()
    doc.update({
        "id": str(uuid.uuid4()),
        "nomorSk": _build_nomor_sk(payload.noUrut, payload.tanggal),
        "arsipFileName": None,
        "arsipFile": None,
        "createdBy": user["id"],
        "createdAt": ts,
        "updatedAt": ts,
    })
    await db[SKDOK_COLL].insert_one(doc)
    return _sk_dokumen_model(doc)


@router.put("/sk/{item_id}", response_model=SkDokumen)
async def sk_dokumen_update(
    item_id: str,
    payload: SkDokumenUpdate,
    _perm: dict = Depends(require_sk_access),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    current = await db[SKDOK_COLL].find_one({"id": item_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Data SK tidak ditemukan.")
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if "noUrut" in updates or "tanggal" in updates:
        no_urut = updates.get("noUrut", current["noUrut"])
        tanggal = updates.get("tanggal", current["tanggal"])
        await _check_nomor_urut_unique(db, SKDOK_COLL, no_urut, tanggal, exclude_id=item_id, no_urut_field="noUrut")
    if "subbagId" in updates:
        sub = await db.subbagian.find_one({"id": updates["subbagId"]}, {"_id": 0, "id": 1})
        if not sub:
            raise HTTPException(status_code=400, detail="Subbagian tidak ditemukan.")
    if updates:
        no_urut = updates.get("noUrut", current["noUrut"])
        tanggal = updates.get("tanggal", current["tanggal"])
        updates["nomorSk"] = _build_nomor_sk(no_urut, tanggal)
        updates["updatedAt"] = now_iso()
        await db[SKDOK_COLL].update_one({"id": item_id}, {"$set": updates})
    fresh = await db[SKDOK_COLL].find_one({"id": item_id}, {"_id": 0})
    return _sk_dokumen_model(fresh)


@router.delete("/sk/{item_id}")
async def sk_dokumen_delete(
    item_id: str,
    _admin: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    current = await db[SKDOK_COLL].find_one({"id": item_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Data SK tidak ditemukan.")
    if current.get("arsipFile"):
        try:
            (UPLOAD_DIR / current["arsipFile"]).unlink(missing_ok=True)
        except Exception:
            pass
    await db[SKDOK_COLL].delete_one({"id": item_id})
    return {"status": "deleted", "message": "Data SK berhasil dihapus."}


@router.post("/sk/{item_id}/arsip", response_model=SkDokumen)
async def sk_dokumen_upload_arsip(
    item_id: str,
    file: UploadFile = File(...),
    _perm: dict = Depends(require_sk_access),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    current = await db[SKDOK_COLL].find_one({"id": item_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Data SK tidak ditemukan.")
    allowed_ext = {".pdf", ".jpg", ".jpeg", ".png"}
    ext = Path(file.filename or "").suffix.lower()
    if ext not in allowed_ext:
        raise HTTPException(status_code=400, detail="Format file harus PDF, JPG, atau PNG.")
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Ukuran file maksimal 10MB.")
    stored_name = f"{uuid.uuid4()}{ext}"
    (UPLOAD_DIR / stored_name).write_bytes(contents)
    if current.get("arsipFile"):
        try:
            (UPLOAD_DIR / current["arsipFile"]).unlink(missing_ok=True)
        except Exception:
            pass
    await db[SKDOK_COLL].update_one(
        {"id": item_id},
        {"$set": {"arsipFile": stored_name, "arsipFileName": file.filename, "updatedAt": now_iso()}},
    )
    fresh = await db[SKDOK_COLL].find_one({"id": item_id}, {"_id": 0})
    return _sk_dokumen_model(fresh)


# ==============================================================
# LEGALISIR - pengesahan salinan dokumen. Nomor dibentuk otomatis
# memakai pola yang sama seperti Nota Dinas/Surat Keluar:
# {noUrut}/{kodeArsip}-LGS/[kodeTujuan/][kodeWilayah/]{tahun}
# Contoh: 1/KU.03.1-LGS/Sek/6371/2026
# ==============================================================

LEGALISIR_COLL = "legalisir"
LEGALISIR_JENIS_NASKAH = "LGS"


def _build_nomor_legalisir(
    no_urut: int,
    kode_arsip: str,
    tanggal: str,
    kode_tujuan: Optional[str] = None,
    kode_wilayah: Optional[str] = None,
) -> str:
    try:
        tahun = datetime.fromisoformat(tanggal).year
    except Exception:
        tahun = datetime.now(timezone.utc).year
    segments = [f"{no_urut}", f"{kode_arsip}-{LEGALISIR_JENIS_NASKAH}"]
    if kode_tujuan:
        segments.append(kode_tujuan)
    if kode_wilayah:
        segments.append(kode_wilayah)
    segments.append(f"{tahun}")
    return "/".join(segments)


class LegalisirCreate(BaseModel):
    noUrut: int = Field(gt=0)
    kodeArsip: str = Field(min_length=1, max_length=50)
    kodeTujuan: Optional[str] = Field(default=None, max_length=50)
    kodeWilayah: Optional[str] = Field(default=None, max_length=50)
    tanggalLegalisir: str
    tandaTanganLegalisir: str = Field(min_length=1, max_length=200)
    instansiParpol: str = Field(min_length=1, max_length=300)
    perihal: str = Field(min_length=1, max_length=500)
    tanggalPenyerahan: str
    diserahkanKepada: str = Field(min_length=1, max_length=200)


class LegalisirUpdate(BaseModel):
    noUrut: Optional[int] = Field(default=None, gt=0)
    kodeArsip: Optional[str] = Field(default=None, min_length=1, max_length=50)
    kodeTujuan: Optional[str] = Field(default=None, max_length=50)
    kodeWilayah: Optional[str] = Field(default=None, max_length=50)
    tanggalLegalisir: Optional[str] = None
    tandaTanganLegalisir: Optional[str] = Field(default=None, min_length=1, max_length=200)
    instansiParpol: Optional[str] = Field(default=None, min_length=1, max_length=300)
    perihal: Optional[str] = Field(default=None, min_length=1, max_length=500)
    tanggalPenyerahan: Optional[str] = None
    diserahkanKepada: Optional[str] = Field(default=None, min_length=1, max_length=200)


class Legalisir(BaseModel):
    id: str
    noUrut: int
    nomor: str
    kodeArsip: str
    kodeTujuan: Optional[str] = None
    kodeWilayah: Optional[str] = None
    tanggalLegalisir: str
    tandaTanganLegalisir: str
    instansiParpol: str
    perihal: str
    tanggalPenyerahan: str
    diserahkanKepada: str
    arsipFileName: Optional[str] = None
    arsipFile: Optional[str] = None
    createdBy: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


def _legalisir_model(doc: dict) -> Legalisir:
    return Legalisir(**{k: doc.get(k) for k in Legalisir.model_fields.keys()})


@router.get("/legalisir/nomor-terpakai", response_model=List[int])
async def legalisir_nomor_terpakai(
    _u: dict = Depends(current_user), db: AsyncIOMotorDatabase = Depends(get_db)
):
    return sorted(await db[LEGALISIR_COLL].distinct("noUrut"))


@router.get("/legalisir", response_model=List[Legalisir])
async def legalisir_list(
    q: Optional[str] = Query(default=None),
    _u: dict = Depends(current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    filt: dict = {}
    if q:
        filt["$or"] = [
            {"perihal": {"$regex": q, "$options": "i"}},
            {"nomor": {"$regex": q, "$options": "i"}},
            {"instansiParpol": {"$regex": q, "$options": "i"}},
            {"diserahkanKepada": {"$regex": q, "$options": "i"}},
        ]
    docs = await db[LEGALISIR_COLL].find(filt, {"_id": 0}).sort("noUrut", 1).to_list(2000)
    return [_legalisir_model(d) for d in docs]


@router.post("/legalisir", response_model=Legalisir, status_code=201)
async def legalisir_create(
    payload: LegalisirCreate,
    user: dict = Depends(require_surat_edit),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    await _check_nomor_urut_unique(
        db, LEGALISIR_COLL, payload.noUrut, payload.tanggalLegalisir, no_urut_field="noUrut", date_field="tanggalLegalisir"
    )
    klas = await db.klasifikasi_arsip.find_one({"kode": payload.kodeArsip}, {"_id": 0, "kode": 1})
    if not klas:
        raise HTTPException(status_code=400, detail="Kode Arsip tidak ditemukan di Klasifikasi Arsip.")
    ts = now_iso()
    doc = payload.model_dump()
    doc.update({
        "id": str(uuid.uuid4()),
        "nomor": _build_nomor_legalisir(
            payload.noUrut, payload.kodeArsip, payload.tanggalLegalisir, payload.kodeTujuan, payload.kodeWilayah
        ),
        "arsipFileName": None,
        "arsipFile": None,
        "createdBy": user["id"],
        "createdAt": ts,
        "updatedAt": ts,
    })
    await db[LEGALISIR_COLL].insert_one(doc)
    return _legalisir_model(doc)


@router.put("/legalisir/{item_id}", response_model=Legalisir)
async def legalisir_update(
    item_id: str,
    payload: LegalisirUpdate,
    _perm: dict = Depends(require_surat_edit),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    current = await db[LEGALISIR_COLL].find_one({"id": item_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Data legalisir tidak ditemukan.")
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if "noUrut" in updates or "tanggalLegalisir" in updates:
        no_urut = updates.get("noUrut", current["noUrut"])
        tgl = updates.get("tanggalLegalisir", current["tanggalLegalisir"])
        await _check_nomor_urut_unique(
            db, LEGALISIR_COLL, no_urut, tgl, exclude_id=item_id, no_urut_field="noUrut", date_field="tanggalLegalisir"
        )
    if "kodeArsip" in updates:
        klas = await db.klasifikasi_arsip.find_one({"kode": updates["kodeArsip"]}, {"_id": 0, "kode": 1})
        if not klas:
            raise HTTPException(status_code=400, detail="Kode Arsip tidak ditemukan di Klasifikasi Arsip.")
    if updates:
        no_urut = updates.get("noUrut", current["noUrut"])
        kode_arsip = updates.get("kodeArsip", current["kodeArsip"])
        tanggal = updates.get("tanggalLegalisir", current["tanggalLegalisir"])
        kode_tujuan = updates.get("kodeTujuan", current.get("kodeTujuan"))
        kode_wilayah = updates.get("kodeWilayah", current.get("kodeWilayah"))
        updates["nomor"] = _build_nomor_legalisir(no_urut, kode_arsip, tanggal, kode_tujuan, kode_wilayah)
        updates["updatedAt"] = now_iso()
        await db[LEGALISIR_COLL].update_one({"id": item_id}, {"$set": updates})
    fresh = await db[LEGALISIR_COLL].find_one({"id": item_id}, {"_id": 0})
    return _legalisir_model(fresh)



@router.delete("/legalisir/{item_id}")
async def legalisir_delete(
    item_id: str,
    _perm: dict = Depends(require_surat_delete),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    current = await db[LEGALISIR_COLL].find_one({"id": item_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Data legalisir tidak ditemukan.")
    if current.get("arsipFile"):
        try:
            (UPLOAD_DIR / current["arsipFile"]).unlink(missing_ok=True)
        except Exception:
            pass
    await db[LEGALISIR_COLL].delete_one({"id": item_id})
    return {"status": "deleted", "message": "Data legalisir berhasil dihapus."}


@router.post("/legalisir/{item_id}/arsip", response_model=Legalisir)
async def legalisir_upload_arsip(
    item_id: str,
    file: UploadFile = File(...),
    _perm: dict = Depends(require_surat_edit),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    current = await db[LEGALISIR_COLL].find_one({"id": item_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Data legalisir tidak ditemukan.")
    allowed_ext = {".pdf", ".jpg", ".jpeg", ".png"}
    ext = Path(file.filename or "").suffix.lower()
    if ext not in allowed_ext:
        raise HTTPException(status_code=400, detail="Format file harus PDF, JPG, atau PNG.")
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Ukuran file maksimal 10MB.")
    stored_name = f"{uuid.uuid4()}{ext}"
    (UPLOAD_DIR / stored_name).write_bytes(contents)
    if current.get("arsipFile"):
        try:
            (UPLOAD_DIR / current["arsipFile"]).unlink(missing_ok=True)
        except Exception:
            pass
    await db[LEGALISIR_COLL].update_one(
        {"id": item_id},
        {"$set": {"arsipFile": stored_name, "arsipFileName": file.filename, "updatedAt": now_iso()}},
    )
    fresh = await db[LEGALISIR_COLL].find_one({"id": item_id}, {"_id": 0})
    return _legalisir_model(fresh)


# ==============================================================
# NOTA DINAS - 5 bagian penerbit (Komisioner, KUL, Rendatin,
# Parhubmas & SDM, Teknis & Hukum). Nomor urut unik per bagian per
# tahun (bukan global), sama seperti pola tab Surat Keluar.
# Nomor lengkap dibentuk & dikirim dari frontend (mengikuti pola
# Surat Keluar), backend hanya menyimpannya.
# ==============================================================

NOTA_DINAS_COLL = "nota_dinas"
BAGIAN_ND_LIST = ["Komisioner", "KUL", "Rendatin", "Parhubmas & SDM", "Teknis & Hukum"]


class NotaDinasCreate(BaseModel):
    bagian: str = Field(min_length=1, max_length=50)
    noUrut: int = Field(gt=0)
    nomor: str = Field(min_length=1, max_length=200)
    kodeArsip: str = Field(min_length=1, max_length=50)
    jenisNaskah: str = Field(min_length=1, max_length=50)
    kodeTujuan: Optional[str] = Field(default=None, max_length=50)
    kodeWilayah: Optional[str] = Field(default=None, max_length=50)
    subBagian: Optional[str] = Field(default=None, max_length=50)  # kode subbagian, kosong = Komisioner
    tanggal: str
    alamatTujuan: str = Field(min_length=1, max_length=300)
    perihal: str = Field(min_length=1, max_length=500)
    keterangan: Optional[str] = Field(default=None, max_length=500)


class NotaDinasUpdate(BaseModel):
    bagian: Optional[str] = Field(default=None, min_length=1, max_length=50)
    noUrut: Optional[int] = Field(default=None, gt=0)
    nomor: Optional[str] = Field(default=None, min_length=1, max_length=200)
    kodeArsip: Optional[str] = Field(default=None, min_length=1, max_length=50)
    jenisNaskah: Optional[str] = Field(default=None, min_length=1, max_length=50)
    kodeTujuan: Optional[str] = Field(default=None, max_length=50)
    kodeWilayah: Optional[str] = Field(default=None, max_length=50)
    subBagian: Optional[str] = Field(default=None, max_length=50)
    tanggal: Optional[str] = None
    alamatTujuan: Optional[str] = Field(default=None, min_length=1, max_length=300)
    perihal: Optional[str] = Field(default=None, min_length=1, max_length=500)
    keterangan: Optional[str] = Field(default=None, max_length=500)


class NotaDinas(BaseModel):
    id: str
    bagian: str
    noUrut: int
    nomor: str
    kodeArsip: str
    jenisNaskah: str
    kodeTujuan: Optional[str] = None
    kodeWilayah: Optional[str] = None
    subBagian: Optional[str] = None
    tanggal: str
    alamatTujuan: str
    perihal: str
    keterangan: Optional[str] = None
    arsipFile: Optional[str] = None
    arsipFileName: Optional[str] = None
    createdBy: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


def _nota_dinas_model(doc: dict) -> NotaDinas:
    return NotaDinas(**{k: doc.get(k) for k in NotaDinas.model_fields.keys()})


@router.get("/nota-dinas", response_model=List[NotaDinas])
async def nota_dinas_list(
    bagian: Optional[str] = Query(default=None),
    q: Optional[str] = Query(default=None),
    _u: dict = Depends(current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    filt: dict = {}
    if bagian:
        filt["bagian"] = bagian
    if q:
        filt["$or"] = [
            {"perihal": {"$regex": q, "$options": "i"}},
            {"nomor": {"$regex": q, "$options": "i"}},
            {"alamatTujuan": {"$regex": q, "$options": "i"}},
            {"keterangan": {"$regex": q, "$options": "i"}},
        ]
    docs = await db[NOTA_DINAS_COLL].find(filt, {"_id": 0}).sort("noUrut", 1).to_list(2000)
    return [_nota_dinas_model(d) for d in docs]


@router.post("/nota-dinas", response_model=NotaDinas, status_code=201)
async def nota_dinas_create(
    payload: NotaDinasCreate,
    user: dict = Depends(require_surat_edit),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    if payload.bagian not in BAGIAN_ND_LIST:
        raise HTTPException(status_code=400, detail="Bagian tidak dikenali.")
    await _check_nomor_urut_unique(
        db, NOTA_DINAS_COLL, payload.noUrut, payload.tanggal, no_urut_field="noUrut", extra_filter={"bagian": payload.bagian}
    )
    if payload.subBagian:
        sub = await db.subbagian.find_one({"code": payload.subBagian}, {"_id": 0, "id": 1})
        if not sub:
            raise HTTPException(status_code=400, detail="Sub Bagian tidak ditemukan.")
    ts = now_iso()
    doc = payload.model_dump()
    doc.update({
        "id": str(uuid.uuid4()),
        "createdBy": user["id"],
        "createdAt": ts,
        "updatedAt": ts,
    })
    await db[NOTA_DINAS_COLL].insert_one(doc)
    return _nota_dinas_model(doc)


@router.put("/nota-dinas/{item_id}", response_model=NotaDinas)
async def nota_dinas_update(
    item_id: str,
    payload: NotaDinasUpdate,
    _perm: dict = Depends(require_surat_edit),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    current = await db[NOTA_DINAS_COLL].find_one({"id": item_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Nota Dinas tidak ditemukan.")
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    bagian = updates.get("bagian", current["bagian"])
    if "bagian" in updates and updates["bagian"] not in BAGIAN_ND_LIST:
        raise HTTPException(status_code=400, detail="Bagian tidak dikenali.")
    if "noUrut" in updates or "tanggal" in updates or "bagian" in updates:
        no_urut = updates.get("noUrut", current["noUrut"])
        tgl = updates.get("tanggal", current["tanggal"])
        await _check_nomor_urut_unique(
            db, NOTA_DINAS_COLL, no_urut, tgl, exclude_id=item_id, no_urut_field="noUrut", extra_filter={"bagian": bagian}
        )
    if "subBagian" in updates and updates["subBagian"]:
        sub = await db.subbagian.find_one({"code": updates["subBagian"]}, {"_id": 0, "id": 1})
        if not sub:
            raise HTTPException(status_code=400, detail="Sub Bagian tidak ditemukan.")
    if updates:
        updates["updatedAt"] = now_iso()
        await db[NOTA_DINAS_COLL].update_one({"id": item_id}, {"$set": updates})
    fresh = await db[NOTA_DINAS_COLL].find_one({"id": item_id}, {"_id": 0})
    return _nota_dinas_model(fresh)


@router.delete("/nota-dinas/{item_id}")
async def nota_dinas_delete(
    item_id: str,
    _perm: dict = Depends(require_surat_delete),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    current = await db[NOTA_DINAS_COLL].find_one({"id": item_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Nota Dinas tidak ditemukan.")
    if current.get("arsipFile"):
        try:
            (UPLOAD_DIR / current["arsipFile"]).unlink(missing_ok=True)
        except Exception:
            pass
    await db[NOTA_DINAS_COLL].delete_one({"id": item_id})
    return {"status": "deleted", "message": "Nota Dinas berhasil dihapus."}



@router.post("/nota-dinas/{item_id}/arsip", response_model=NotaDinas)
async def nota_dinas_upload_arsip(
    item_id: str,
    file: UploadFile = File(...),
    _perm: dict = Depends(require_surat_edit),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    current = await db[NOTA_DINAS_COLL].find_one({"id": item_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Nota Dinas tidak ditemukan.")
    allowed_ext = {".pdf", ".jpg", ".jpeg", ".png"}
    ext = Path(file.filename or "").suffix.lower()
    if ext not in allowed_ext:
        raise HTTPException(status_code=400, detail="Format file harus PDF, JPG, atau PNG.")
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Ukuran file maksimal 10MB.")
    stored_name = f"{uuid.uuid4()}{ext}"
    (UPLOAD_DIR / stored_name).write_bytes(contents)
    if current.get("arsipFile"):
        try:
            (UPLOAD_DIR / current["arsipFile"]).unlink(missing_ok=True)
        except Exception:
            pass
    await db[NOTA_DINAS_COLL].update_one(
        {"id": item_id},
        {"$set": {"arsipFile": stored_name, "arsipFileName": file.filename, "updatedAt": now_iso()}},
    )
    fresh = await db[NOTA_DINAS_COLL].find_one({"id": item_id}, {"_id": 0})
    return _nota_dinas_model(fresh)


# ==============================================================
# BERITA ACARA - 2 bagian penerbit (Ketua, Sekretaris), nomor urut
# unik per bagian per tahun, sama seperti Surat Keluar/Nota Dinas.
# Nomor lengkap dibentuk & dikirim dari frontend, backend menyimpannya.
# ==============================================================

BERITA_ACARA_COLL = "berita_acara"
BAGIAN_BA_LIST = ["Ketua", "Sekretaris"]


class BeritaAcaraCreate(BaseModel):
    bagian: str = Field(min_length=1, max_length=50)
    noUrut: int = Field(gt=0)
    nomor: str = Field(min_length=1, max_length=200)
    kodeArsip: str = Field(min_length=1, max_length=50)
    jenisNaskah: str = Field(min_length=1, max_length=50)
    kodeWilayah: Optional[str] = Field(default=None, max_length=50)
    subbagId: str = Field(min_length=1, max_length=50)
    tanggal: str
    alamatTujuan: str = Field(min_length=1, max_length=300)
    penanggungJawab: str = Field(min_length=1, max_length=200)
    perihal: str = Field(min_length=1, max_length=500)


class BeritaAcaraUpdate(BaseModel):
    bagian: Optional[str] = Field(default=None, min_length=1, max_length=50)
    noUrut: Optional[int] = Field(default=None, gt=0)
    nomor: Optional[str] = Field(default=None, min_length=1, max_length=200)
    kodeArsip: Optional[str] = Field(default=None, min_length=1, max_length=50)
    jenisNaskah: Optional[str] = Field(default=None, min_length=1, max_length=50)
    kodeWilayah: Optional[str] = Field(default=None, max_length=50)
    subbagId: Optional[str] = Field(default=None, min_length=1, max_length=50)
    tanggal: Optional[str] = None
    alamatTujuan: Optional[str] = Field(default=None, min_length=1, max_length=300)
    penanggungJawab: Optional[str] = Field(default=None, min_length=1, max_length=200)
    perihal: Optional[str] = Field(default=None, min_length=1, max_length=500)


class BeritaAcara(BaseModel):
    id: str
    bagian: str
    noUrut: int
    nomor: str
    kodeArsip: str
    jenisNaskah: str
    kodeWilayah: Optional[str] = None
    subbagId: str
    tanggal: str
    alamatTujuan: str
    penanggungJawab: str
    perihal: str
    arsipFileName: Optional[str] = None
    arsipFile: Optional[str] = None
    createdBy: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


def _berita_acara_model(doc: dict) -> BeritaAcara:
    return BeritaAcara(**{k: doc.get(k) for k in BeritaAcara.model_fields.keys()})


@router.get("/berita-acara", response_model=List[BeritaAcara])
async def berita_acara_list(
    bagian: Optional[str] = Query(default=None),
    q: Optional[str] = Query(default=None),
    _u: dict = Depends(current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    filt: dict = {}
    if bagian:
        filt["bagian"] = bagian
    if q:
        filt["$or"] = [
            {"perihal": {"$regex": q, "$options": "i"}},
            {"nomor": {"$regex": q, "$options": "i"}},
            {"alamatTujuan": {"$regex": q, "$options": "i"}},
        ]
    docs = await db[BERITA_ACARA_COLL].find(filt, {"_id": 0}).sort("noUrut", 1).to_list(2000)
    return [_berita_acara_model(d) for d in docs]


@router.post("/berita-acara", response_model=BeritaAcara, status_code=201)
async def berita_acara_create(
    payload: BeritaAcaraCreate,
    user: dict = Depends(require_surat_edit),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    if payload.bagian not in BAGIAN_BA_LIST:
        raise HTTPException(status_code=400, detail="Bagian tidak dikenali.")
    await _check_nomor_urut_unique(
        db, BERITA_ACARA_COLL, payload.noUrut, payload.tanggal, no_urut_field="noUrut", extra_filter={"bagian": payload.bagian}
    )
    sub = await db.subbagian.find_one({"id": payload.subbagId}, {"_id": 0, "id": 1})
    if not sub:
        raise HTTPException(status_code=400, detail="Subbagian tidak ditemukan.")
    ts = now_iso()
    doc = payload.model_dump()
    doc.update({
        "id": str(uuid.uuid4()),
        "arsipFileName": None,
        "arsipFile": None,
        "createdBy": user["id"],
        "createdAt": ts,
        "updatedAt": ts,
    })
    await db[BERITA_ACARA_COLL].insert_one(doc)
    return _berita_acara_model(doc)


@router.put("/berita-acara/{item_id}", response_model=BeritaAcara)
async def berita_acara_update(
    item_id: str,
    payload: BeritaAcaraUpdate,
    _perm: dict = Depends(require_surat_edit),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    current = await db[BERITA_ACARA_COLL].find_one({"id": item_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Berita Acara tidak ditemukan.")
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    bagian = updates.get("bagian", current["bagian"])
    if "bagian" in updates and updates["bagian"] not in BAGIAN_BA_LIST:
        raise HTTPException(status_code=400, detail="Bagian tidak dikenali.")
    if "noUrut" in updates or "tanggal" in updates or "bagian" in updates:
        no_urut = updates.get("noUrut", current["noUrut"])
        tgl = updates.get("tanggal", current["tanggal"])
        await _check_nomor_urut_unique(
            db, BERITA_ACARA_COLL, no_urut, tgl, exclude_id=item_id, no_urut_field="noUrut", extra_filter={"bagian": bagian}
        )
    if "subbagId" in updates:
        sub = await db.subbagian.find_one({"id": updates["subbagId"]}, {"_id": 0, "id": 1})
        if not sub:
            raise HTTPException(status_code=400, detail="Subbagian tidak ditemukan.")
    if updates:
        updates["updatedAt"] = now_iso()
        await db[BERITA_ACARA_COLL].update_one({"id": item_id}, {"$set": updates})
    fresh = await db[BERITA_ACARA_COLL].find_one({"id": item_id}, {"_id": 0})
    return _berita_acara_model(fresh)


@router.delete("/berita-acara/{item_id}")
async def berita_acara_delete(
    item_id: str,
    _perm: dict = Depends(require_surat_delete),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    current = await db[BERITA_ACARA_COLL].find_one({"id": item_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Berita Acara tidak ditemukan.")
    if current.get("arsipFile"):
        try:
            (UPLOAD_DIR / current["arsipFile"]).unlink(missing_ok=True)
        except Exception:
            pass
    await db[BERITA_ACARA_COLL].delete_one({"id": item_id})
    return {"status": "deleted", "message": "Berita Acara berhasil dihapus."}


@router.post("/berita-acara/{item_id}/arsip", response_model=BeritaAcara)
async def berita_acara_upload_arsip(
    item_id: str,
    file: UploadFile = File(...),
    _perm: dict = Depends(require_surat_edit),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    current = await db[BERITA_ACARA_COLL].find_one({"id": item_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Berita Acara tidak ditemukan.")
    allowed_ext = {".pdf", ".jpg", ".jpeg", ".png"}
    ext = Path(file.filename or "").suffix.lower()
    if ext not in allowed_ext:
        raise HTTPException(status_code=400, detail="Format file harus PDF, JPG, atau PNG.")
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Ukuran file maksimal 10MB.")
    stored_name = f"{uuid.uuid4()}{ext}"
    (UPLOAD_DIR / stored_name).write_bytes(contents)
    if current.get("arsipFile"):
        try:
            (UPLOAD_DIR / current["arsipFile"]).unlink(missing_ok=True)
        except Exception:
            pass
    await db[BERITA_ACARA_COLL].update_one(
        {"id": item_id},
        {"$set": {"arsipFile": stored_name, "arsipFileName": file.filename, "updatedAt": now_iso()}},
    )
    fresh = await db[BERITA_ACARA_COLL].find_one({"id": item_id}, {"_id": 0})
    return _berita_acara_model(fresh)


# ==============================================================
# SOP (Standard Operating Procedure)
# ==============================================================

SOP_COLL = "sop"


def _build_nomor_tahun(no_urut: int, tanggal: str) -> str:
    try:
        tahun = datetime.fromisoformat(tanggal).year
    except Exception:
        tahun = datetime.now(timezone.utc).year
    return f"{no_urut} TAHUN {tahun}"


class SopCreate(BaseModel):
    noUrut: int = Field(gt=0)
    tanggal: str
    perihal: str = Field(min_length=1, max_length=500)
    keterangan: Optional[str] = Field(default=None, max_length=500)
    klasifikasi: str = Field(min_length=1, max_length=200)


class SopUpdate(BaseModel):
    noUrut: Optional[int] = Field(default=None, gt=0)
    tanggal: Optional[str] = None
    perihal: Optional[str] = Field(default=None, min_length=1, max_length=500)
    keterangan: Optional[str] = Field(default=None, max_length=500)
    klasifikasi: Optional[str] = Field(default=None, min_length=1, max_length=200)


class Sop(BaseModel):
    id: str
    noUrut: int
    nomorSop: str
    tanggal: str
    perihal: str
    keterangan: Optional[str] = None
    klasifikasi: str
    dokumenFileName: Optional[str] = None
    dokumenFile: Optional[str] = None
    createdBy: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


def _sop_model(doc: dict) -> Sop:
    return Sop(**{k: doc.get(k) for k in Sop.model_fields.keys()})


@router.get("/sop/nomor-terpakai", response_model=List[int])
async def sop_nomor_terpakai(_u: dict = Depends(current_user), db: AsyncIOMotorDatabase = Depends(get_db)):
    return sorted(await db[SOP_COLL].distinct("noUrut"))


@router.get("/sop", response_model=List[Sop])
async def sop_list(
    q: Optional[str] = Query(default=None),
    _u: dict = Depends(current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    filt: dict = {}
    if q:
        filt["$or"] = [
            {"perihal": {"$regex": q, "$options": "i"}},
            {"nomorSop": {"$regex": q, "$options": "i"}},
            {"klasifikasi": {"$regex": q, "$options": "i"}},
            {"keterangan": {"$regex": q, "$options": "i"}},
        ]
    docs = await db[SOP_COLL].find(filt, {"_id": 0}).sort("noUrut", 1).to_list(2000)
    return [_sop_model(d) for d in docs]


@router.get("/sop/{item_id}", response_model=Sop)
async def sop_get(item_id: str, _u: dict = Depends(current_user), db: AsyncIOMotorDatabase = Depends(get_db)):
    doc = await db[SOP_COLL].find_one({"id": item_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Data SOP tidak ditemukan.")
    return _sop_model(doc)


@router.post("/sop", response_model=Sop, status_code=201)
async def sop_create(
    payload: SopCreate,
    user: dict = Depends(require_surat_edit),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    await _check_nomor_urut_unique(db, SOP_COLL, payload.noUrut, payload.tanggal, no_urut_field="noUrut")
    ts = now_iso()
    doc = payload.model_dump()
    doc.update({
        "id": str(uuid.uuid4()),
        "nomorSop": _build_nomor_tahun(payload.noUrut, payload.tanggal),
        "dokumenFileName": None,
        "dokumenFile": None,
        "createdBy": user["id"],
        "createdAt": ts,
        "updatedAt": ts,
    })
    await db[SOP_COLL].insert_one(doc)
    return _sop_model(doc)


@router.put("/sop/{item_id}", response_model=Sop)
async def sop_update(
    item_id: str,
    payload: SopUpdate,
    _perm: dict = Depends(require_surat_edit),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    current = await db[SOP_COLL].find_one({"id": item_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Data SOP tidak ditemukan.")
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if "noUrut" in updates or "tanggal" in updates:
        no_urut = updates.get("noUrut", current["noUrut"])
        tgl = updates.get("tanggal", current["tanggal"])
        await _check_nomor_urut_unique(db, SOP_COLL, no_urut, tgl, exclude_id=item_id, no_urut_field="noUrut")
    if updates:
        no_urut = updates.get("noUrut", current["noUrut"])
        tanggal = updates.get("tanggal", current["tanggal"])
        updates["nomorSop"] = _build_nomor_tahun(no_urut, tanggal)
        updates["updatedAt"] = now_iso()
        await db[SOP_COLL].update_one({"id": item_id}, {"$set": updates})
    fresh = await db[SOP_COLL].find_one({"id": item_id}, {"_id": 0})
    return _sop_model(fresh)


@router.delete("/sop/{item_id}")
async def sop_delete(
    item_id: str,
    _perm: dict = Depends(require_surat_delete),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    current = await db[SOP_COLL].find_one({"id": item_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Data SOP tidak ditemukan.")
    if current.get("dokumenFile"):
        try:
            (UPLOAD_DIR / current["dokumenFile"]).unlink(missing_ok=True)
        except Exception:
            pass
    await db[SOP_COLL].delete_one({"id": item_id})
    return {"status": "deleted", "message": "Data SOP berhasil dihapus."}


@router.post("/sop/{item_id}/dokumen", response_model=Sop)
async def sop_upload_dokumen(
    item_id: str,
    file: UploadFile = File(...),
    _perm: dict = Depends(require_surat_edit),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    current = await db[SOP_COLL].find_one({"id": item_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Data SOP tidak ditemukan.")
    allowed_ext = {".pdf", ".jpg", ".jpeg", ".png"}
    ext = Path(file.filename or "").suffix.lower()
    if ext not in allowed_ext:
        raise HTTPException(status_code=400, detail="Format file harus PDF, JPG, atau PNG.")
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Ukuran file maksimal 10MB.")
    stored_name = f"{uuid.uuid4()}{ext}"
    (UPLOAD_DIR / stored_name).write_bytes(contents)
    if current.get("dokumenFile"):
        try:
            (UPLOAD_DIR / current["dokumenFile"]).unlink(missing_ok=True)
        except Exception:
            pass
    await db[SOP_COLL].update_one(
        {"id": item_id},
        {"$set": {"dokumenFile": stored_name, "dokumenFileName": file.filename, "updatedAt": now_iso()}},
    )
    fresh = await db[SOP_COLL].find_one({"id": item_id}, {"_id": 0})
    return _sop_model(fresh)


# ==============================================================
# MOU (Memorandum of Understanding)
# ==============================================================

MOU_COLL = "mou"


class MouCreate(BaseModel):
    noUrut: int = Field(gt=0)
    tanggal: str
    perihal: str = Field(min_length=1, max_length=500)
    instansi: str = Field(min_length=1, max_length=300)


class MouUpdate(BaseModel):
    noUrut: Optional[int] = Field(default=None, gt=0)
    tanggal: Optional[str] = None
    perihal: Optional[str] = Field(default=None, min_length=1, max_length=500)
    instansi: Optional[str] = Field(default=None, min_length=1, max_length=300)


class Mou(BaseModel):
    id: str
    noUrut: int
    nomorMou: str
    tanggal: str
    perihal: str
    instansi: str
    lampiranFileName: Optional[str] = None
    lampiranFile: Optional[str] = None
    createdBy: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


def _mou_model(doc: dict) -> Mou:
    return Mou(**{k: doc.get(k) for k in Mou.model_fields.keys()})


@router.get("/mou/nomor-terpakai", response_model=List[int])
async def mou_nomor_terpakai(_u: dict = Depends(current_user), db: AsyncIOMotorDatabase = Depends(get_db)):
    return sorted(await db[MOU_COLL].distinct("noUrut"))


@router.get("/mou", response_model=List[Mou])
async def mou_list(
    q: Optional[str] = Query(default=None),
    _u: dict = Depends(current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    filt: dict = {}
    if q:
        filt["$or"] = [
            {"perihal": {"$regex": q, "$options": "i"}},
            {"nomorMou": {"$regex": q, "$options": "i"}},
            {"instansi": {"$regex": q, "$options": "i"}},
        ]
    docs = await db[MOU_COLL].find(filt, {"_id": 0}).sort("noUrut", 1).to_list(2000)
    return [_mou_model(d) for d in docs]


@router.get("/mou/{item_id}", response_model=Mou)
async def mou_get(item_id: str, _u: dict = Depends(current_user), db: AsyncIOMotorDatabase = Depends(get_db)):
    doc = await db[MOU_COLL].find_one({"id": item_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Data MOU tidak ditemukan.")
    return _mou_model(doc)


@router.post("/mou", response_model=Mou, status_code=201)
async def mou_create(
    payload: MouCreate,
    user: dict = Depends(require_surat_edit),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    await _check_nomor_urut_unique(db, MOU_COLL, payload.noUrut, payload.tanggal, no_urut_field="noUrut")
    ts = now_iso()
    doc = payload.model_dump()
    doc.update({
        "id": str(uuid.uuid4()),
        "nomorMou": _build_nomor_tahun(payload.noUrut, payload.tanggal),
        "lampiranFileName": None,
        "lampiranFile": None,
        "createdBy": user["id"],
        "createdAt": ts,
        "updatedAt": ts,
    })
    await db[MOU_COLL].insert_one(doc)
    return _mou_model(doc)


@router.put("/mou/{item_id}", response_model=Mou)
async def mou_update(
    item_id: str,
    payload: MouUpdate,
    _perm: dict = Depends(require_surat_edit),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    current = await db[MOU_COLL].find_one({"id": item_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Data MOU tidak ditemukan.")
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if "noUrut" in updates or "tanggal" in updates:
        no_urut = updates.get("noUrut", current["noUrut"])
        tgl = updates.get("tanggal", current["tanggal"])
        await _check_nomor_urut_unique(db, MOU_COLL, no_urut, tgl, exclude_id=item_id, no_urut_field="noUrut")
    if updates:
        no_urut = updates.get("noUrut", current["noUrut"])
        tanggal = updates.get("tanggal", current["tanggal"])
        updates["nomorMou"] = _build_nomor_tahun(no_urut, tanggal)
        updates["updatedAt"] = now_iso()
        await db[MOU_COLL].update_one({"id": item_id}, {"$set": updates})
    fresh = await db[MOU_COLL].find_one({"id": item_id}, {"_id": 0})
    return _mou_model(fresh)


@router.delete("/mou/{item_id}")
async def mou_delete(
    item_id: str,
    _perm: dict = Depends(require_surat_delete),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    current = await db[MOU_COLL].find_one({"id": item_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Data MOU tidak ditemukan.")
    if current.get("lampiranFile"):
        try:
            (UPLOAD_DIR / current["lampiranFile"]).unlink(missing_ok=True)
        except Exception:
            pass
    await db[MOU_COLL].delete_one({"id": item_id})
    return {"status": "deleted", "message": "Data MOU berhasil dihapus."}


@router.post("/mou/{item_id}/lampiran", response_model=Mou)
async def mou_upload_lampiran(
    item_id: str,
    file: UploadFile = File(...),
    _perm: dict = Depends(require_surat_edit),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    current = await db[MOU_COLL].find_one({"id": item_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Data MOU tidak ditemukan.")
    allowed_ext = {".pdf", ".jpg", ".jpeg", ".png"}
    ext = Path(file.filename or "").suffix.lower()
    if ext not in allowed_ext:
        raise HTTPException(status_code=400, detail="Format file harus PDF, JPG, atau PNG.")
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Ukuran file maksimal 10MB.")
    stored_name = f"{uuid.uuid4()}{ext}"
    (UPLOAD_DIR / stored_name).write_bytes(contents)
    if current.get("lampiranFile"):
        try:
            (UPLOAD_DIR / current["lampiranFile"]).unlink(missing_ok=True)
        except Exception:
            pass
    await db[MOU_COLL].update_one(
        {"id": item_id},
        {"$set": {"lampiranFile": stored_name, "lampiranFileName": file.filename, "updatedAt": now_iso()}},
    )
    fresh = await db[MOU_COLL].find_one({"id": item_id}, {"_id": 0})
    return _mou_model(fresh)


# ==============================================================
# ARSIP & DOKUMEN - agregasi file arsip dari Surat Masuk, Surat
# Keluar, Berita Acara dan SK, dikelompokkan ke salah satu dari 4
# kategori sesuai sub bagian pembuatnya. SK selalu masuk kategori
# "teknis" (aksesnya memang sudah dibatasi ke situ).
# ==============================================================

SUBBAG_CODE_TO_KATEGORI = {
    "SUB-KUL": "keuangan",
    "SUB-RENDATIN": "perencanaan",
    "SUB-SDM": "parhubmas",
    TEKNIS_HUKUM_SUBBAG_CODE: "teknis",
}
ARSIP_KATEGORI_LIST = ["keuangan", "perencanaan", "parhubmas", "teknis"]


class ArsipDokumenItem(BaseModel):
    id: str
    sumber: str  # "Surat Masuk" | "Surat Keluar" | "Berita Acara" | "SK"
    title: str
    tanggal: Optional[str] = None
    fileName: Optional[str] = None
    file: Optional[str] = None
    perihal: Optional[str] = None
    manual: bool = False
    folderId: Optional[str] = None


@router.get("/arsip-dokumen", response_model=List[ArsipDokumenItem])
async def arsip_dokumen_list(
    
    kategori: str = Query(...),
    user: dict = Depends(current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    
    # kategori = kode subbagian (satu subbagian = satu kategori Arsip)
    sub = await db.subbagian.find_one({"code": kategori}, {"_id": 0, "id": 1})
    if not sub:
        raise HTTPException(status_code=400, detail="Kategori tidak dikenali.")
    daftar = await _list_arsip_kategori(db, user)
    if not any(k["code"] == kategori and k["tampil"] for k in daftar):
        raise HTTPException(status_code=403, detail="Kategori ini sedang disembunyikan oleh admin.")

    items: list = []

    async for d in db[SM_COLL].find({"lampiran": {"$ne": None}}, {"_id": 0}):
        if d.get("disposisi") == kategori:
            items.append({
                "id": d["id"], "sumber": "Surat Masuk", "title": d.get("perihal") or d.get("nomorSurat") or "-",
                "tanggal": d.get("tanggal"), "fileName": d.get("lampiran"), "file": d.get("lampiran"),
            })

    async for d in db[SK_COLL].find({"lampiran": {"$ne": None}}, {"_id": 0}):
        if d.get("disposisi") == kategori:
            items.append({
                "id": d["id"], "sumber": "Surat Keluar", "title": d.get("perihal") or d.get("nomor") or "-",
                "tanggal": d.get("tanggal"), "fileName": d.get("lampiran"), "file": d.get("lampiran"),
            })

    async for d in db[BERITA_ACARA_COLL].find({"arsipFile": {"$ne": None}}, {"_id": 0}):
        if d.get("subbagId") == sub["id"]:
            items.append({
                "id": d["id"], "sumber": "Berita Acara", "title": d.get("perihal") or d.get("nomor") or "-",
                "tanggal": d.get("tanggal"), "fileName": d.get("arsipFileName"), "file": d.get("arsipFile"),
            })
    
    async for d in db[NOTA_DINAS_COLL].find({"arsipFile": {"$ne": None}}, {"_id": 0}):
        if d.get("subBagian") == kategori:
            items.append({
                "id": d["id"], "sumber": "Nota Dinas", "title": d.get("perihal") or d.get("nomor") or "-",
                "tanggal": d.get("tanggal"), "fileName": d.get("arsipFileName"), "file": d.get("arsipFile"),
            })

    if kategori == TEKNIS_HUKUM_SUBBAG_CODE:
        async for d in db[SKDOK_COLL].find({"arsipFile": {"$ne": None}}, {"_id": 0}):
            items.append({
                "id": d["id"], "sumber": "SK", "title": d.get("perihal") or d.get("nomorSk") or "-",
                "tanggal": d.get("tanggal"), "fileName": d.get("arsipFileName"), "file": d.get("arsipFile"),
            })
            # Dokumen yang diunggah manual ke folder buatan sendiri.
    folder_nama = {}
    async for f in db[ARSIP_FOLDER_COLL].find({"kategori": kategori}, {"_id": 0}):
        folder_nama[f["id"]] = f.get("nama") or "Folder"
    async for d in db[ARSIP_UNGGAHAN_COLL].find({"kategori": kategori}, {"_id": 0}):
        items.append({
            "id": d["id"], "sumber": folder_nama.get(d.get("folderId"), "Folder"),
            "title": d.get("judul") or "-", "tanggal": d.get("tanggal"),
            "fileName": d.get("fileName"), "file": d.get("file"),
            "perihal": d.get("perihal"), "manual": True, "folderId": d.get("folderId"),
        })

    items.sort(key=lambda x: x.get("tanggal") or "", reverse=True)
    return [ArsipDokumenItem(**it) for it in items]

@router.get("/arsip-file/{nama_berkas}")
async def arsip_file_unduh(nama_berkas: str, nama: Optional[str] = Query(default=None)):
    """Kirim berkas upload sebagai unduhan (Content-Disposition: attachment)."""
    aman = Path(nama_berkas).name  # cegah nama file yang keluar dari folder uploads
    path = UPLOAD_DIR / aman
    if aman != nama_berkas or not path.is_file():
        raise HTTPException(status_code=404, detail="Berkas tidak ditemukan.")
    dasar = "".join(" " if c in '\\/:*?"<>|' else c for c in (nama or "")).strip()[:80]
    return FileResponse(path, filename=f"{dasar or path.stem}{path.suffix}")


# ==============================================================
# SURAT TUGAS & SPD (Ketua / Sekretaris)
# --------------------------------------------------------------
# Tempel blok ini di BARIS PALING BAWAH master.py (setelah fungsi
# arsip_file_unduh). Semua baris di dalam fungsi menjorok 4 spasi,
# baris @router dan def mulai dari kolom paling kiri.
# ==============================================================

SURAT_TUGAS_COLL = "surat_tugas"
SPD_COLL = "spd"
BAGIAN_ST_LIST = ["Ketua", "Sekretaris"]
# jenis berkas di URL -> awalan nama field di database
BERKAS_ST = {"laporan": "laporan", "tanda-terima": "tandaTerima"}


def _tahun_dari_tanggal(tanggal: str) -> int:
    try:
        return datetime.fromisoformat(tanggal).year
    except Exception:
        return datetime.now(timezone.utc).year


# ---------------------------- Surat Tugas ----------------------------

class SuratTugasCreate(BaseModel):
    bagian: str = Field(min_length=1, max_length=50)
    nomorUrut: int = Field(gt=0)
    nomorSuratTugas: str = Field(min_length=1, max_length=300)
    jenisNaskah: str = Field(min_length=1, max_length=50)
    tanggal: str
    namaList: List[str] = Field(min_length=1)
    perihal: str = Field(min_length=1, max_length=500)
    pembuatSuratTugas: str = Field(min_length=1, max_length=200)
    checklistKelengkapan: List[str] = Field(default_factory=list)
    keteranganPerjadin: Optional[str] = Field(default=None, max_length=200)
    kategoriKlasifikasi: str = Field(min_length=1, max_length=50)
    kodeArsip: str = Field(min_length=1, max_length=50)
    kodeWilayah: Optional[str] = Field(default=None, max_length=50)


class SuratTugasUpdate(BaseModel):
    bagian: Optional[str] = Field(default=None, min_length=1, max_length=50)
    nomorUrut: Optional[int] = Field(default=None, gt=0)
    nomorSuratTugas: Optional[str] = Field(default=None, min_length=1, max_length=300)
    jenisNaskah: Optional[str] = Field(default=None, min_length=1, max_length=50)
    tanggal: Optional[str] = None
    namaList: Optional[List[str]] = Field(default=None, min_length=1)
    perihal: Optional[str] = Field(default=None, min_length=1, max_length=500)
    pembuatSuratTugas: Optional[str] = Field(default=None, min_length=1, max_length=200)
    checklistKelengkapan: Optional[List[str]] = None
    keteranganPerjadin: Optional[str] = Field(default=None, max_length=200)
    kategoriKlasifikasi: Optional[str] = Field(default=None, min_length=1, max_length=50)
    kodeArsip: Optional[str] = Field(default=None, min_length=1, max_length=50)
    kodeWilayah: Optional[str] = Field(default=None, max_length=50)


class SuratTugas(BaseModel):
    id: str
    bagian: str
    nomorUrut: int
    nomorSuratTugas: str
    jenisNaskah: str
    tanggal: str
    namaList: List[str] = Field(default_factory=list)
    perihal: str
    pembuatSuratTugas: str
    checklistKelengkapan: List[str] = Field(default_factory=list)
    keteranganPerjadin: Optional[str] = None
    kategoriKlasifikasi: str
    kodeArsip: str
    kodeWilayah: Optional[str] = None
    laporanFile: Optional[str] = None
    laporanFileName: Optional[str] = None
    laporanFileSize: Optional[int] = None
    tandaTerimaFile: Optional[str] = None
    tandaTerimaFileName: Optional[str] = None
    tandaTerimaFileSize: Optional[int] = None
    createdBy: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


def _surat_tugas_model(doc: dict) -> SuratTugas:
    data = {k: doc.get(k) for k in SuratTugas.model_fields.keys()}
    data["namaList"] = data["namaList"] or []
    data["checklistKelengkapan"] = data["checklistKelengkapan"] or []
    # Berkas yang sudah dihapus disimpan sebagai "" / 0 -> tampil sebagai kosong.
    for f in ("laporanFile", "laporanFileName", "laporanFileSize",
              "tandaTerimaFile", "tandaTerimaFileName", "tandaTerimaFileSize"):
        data[f] = data[f] or None
    return SuratTugas(**data)


def _hapus_berkas_upload(nama: Optional[str]) -> None:
    if not nama:
        return
    try:
        (UPLOAD_DIR / nama).unlink(missing_ok=True)
    except Exception:
        pass


@router.get("/surat-tugas", response_model=List[SuratTugas])
async def surat_tugas_list(
    bagian: Optional[str] = Query(default=None),
    _u: dict = Depends(current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    filt: dict = {}
    if bagian:
        filt["bagian"] = bagian
    docs = await db[SURAT_TUGAS_COLL].find(filt, {"_id": 0}).sort("nomorUrut", 1).to_list(5000)
    return [_surat_tugas_model(d) for d in docs]


@router.post("/surat-tugas", response_model=SuratTugas, status_code=201)
async def surat_tugas_create(
    payload: SuratTugasCreate,
    user: dict = Depends(require_surat_edit),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    if payload.bagian not in BAGIAN_ST_LIST:
        raise HTTPException(status_code=400, detail="Bagian tidak dikenali.")
    await _check_nomor_urut_unique(
        db, SURAT_TUGAS_COLL, payload.nomorUrut, payload.tanggal, extra_filter={"bagian": payload.bagian}
    )
    ts = now_iso()
    doc = payload.model_dump()
    doc.update({
        "id": str(uuid.uuid4()),
        "createdBy": user["id"],
        "createdAt": ts,
        "updatedAt": ts,
    })
    await db[SURAT_TUGAS_COLL].insert_one(doc)
    return _surat_tugas_model(doc)


@router.put("/surat-tugas/{item_id}", response_model=SuratTugas)
async def surat_tugas_update(
    item_id: str,
    payload: SuratTugasUpdate,
    _perm: dict = Depends(require_surat_edit),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    current = await db[SURAT_TUGAS_COLL].find_one({"id": item_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Surat Tugas tidak ditemukan.")
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    bagian = updates.get("bagian", current["bagian"])
    if "bagian" in updates and updates["bagian"] not in BAGIAN_ST_LIST:
        raise HTTPException(status_code=400, detail="Bagian tidak dikenali.")
    if "nomorUrut" in updates or "tanggal" in updates or "bagian" in updates:
        no_urut = updates.get("nomorUrut", current["nomorUrut"])
        tgl = updates.get("tanggal", current["tanggal"])
        await _check_nomor_urut_unique(
            db, SURAT_TUGAS_COLL, no_urut, tgl, exclude_id=item_id, extra_filter={"bagian": bagian}
        )
    if updates:
        updates["updatedAt"] = now_iso()
        await db[SURAT_TUGAS_COLL].update_one({"id": item_id}, {"$set": updates})
    fresh = await db[SURAT_TUGAS_COLL].find_one({"id": item_id}, {"_id": 0})
    return _surat_tugas_model(fresh)


@router.delete("/surat-tugas/{item_id}")
async def surat_tugas_delete(
    item_id: str,
    _perm: dict = Depends(require_surat_delete),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    current = await db[SURAT_TUGAS_COLL].find_one({"id": item_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Surat Tugas tidak ditemukan.")
    dipakai = await db[SPD_COLL].find_one({"suratTugasId": item_id}, {"_id": 0, "id": 1})
    if dipakai:
        raise HTTPException(
            status_code=409,
            detail="Surat Tugas ini tidak bisa dihapus karena sudah dipakai di data SPD.",
        )
    _hapus_berkas_upload(current.get("laporanFile"))
    _hapus_berkas_upload(current.get("tandaTerimaFile"))
    await db[SURAT_TUGAS_COLL].delete_one({"id": item_id})
    return {"status": "deleted", "message": "Surat Tugas berhasil dihapus."}


@router.post("/surat-tugas/{item_id}/berkas/{jenis}", response_model=SuratTugas)
async def surat_tugas_upload_berkas(
    item_id: str,
    jenis: str,
    file: UploadFile = File(...),
    _perm: dict = Depends(require_surat_edit),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    awalan = BERKAS_ST.get(jenis)
    if not awalan:
        raise HTTPException(status_code=404, detail="Jenis berkas tidak dikenali.")
    current = await db[SURAT_TUGAS_COLL].find_one({"id": item_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Surat Tugas tidak ditemukan.")
    allowed_ext = {".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"}
    ext = Path(file.filename or "").suffix.lower()
    if ext not in allowed_ext:
        raise HTTPException(status_code=400, detail="Format file harus PDF, JPG, PNG, DOC, atau DOCX.")
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Ukuran file maksimal 10MB.")
    stored_name = f"{uuid.uuid4()}{ext}"
    (UPLOAD_DIR / stored_name).write_bytes(contents)
    _hapus_berkas_upload(current.get(f"{awalan}File"))
    await db[SURAT_TUGAS_COLL].update_one(
        {"id": item_id},
        {"$set": {
            f"{awalan}File": stored_name,
            f"{awalan}FileName": file.filename,
            f"{awalan}FileSize": len(contents),
            "updatedAt": now_iso(),
        }},
    )
    fresh = await db[SURAT_TUGAS_COLL].find_one({"id": item_id}, {"_id": 0})
    return _surat_tugas_model(fresh)


@router.delete("/surat-tugas/{item_id}/berkas/{jenis}", response_model=SuratTugas)
async def surat_tugas_hapus_berkas(
    item_id: str,
    jenis: str,
    _perm: dict = Depends(require_surat_edit),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    awalan = BERKAS_ST.get(jenis)
    if not awalan:
        raise HTTPException(status_code=404, detail="Jenis berkas tidak dikenali.")
    current = await db[SURAT_TUGAS_COLL].find_one({"id": item_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Surat Tugas tidak ditemukan.")
    _hapus_berkas_upload(current.get(f"{awalan}File"))
    # Wrapper Neo4j membuang nilai None saat $set, jadi dikosongkan dengan "" / 0.
    await db[SURAT_TUGAS_COLL].update_one(
        {"id": item_id},
        {"$set": {
            f"{awalan}File": "",
            f"{awalan}FileName": "",
            f"{awalan}FileSize": 0,
            "updatedAt": now_iso(),
        }},
    )
    fresh = await db[SURAT_TUGAS_COLL].find_one({"id": item_id}, {"_id": 0})
    return _surat_tugas_model(fresh)


# -------------------------------- SPD --------------------------------

class SpdCreate(BaseModel):
    bagian: str = Field(min_length=1, max_length=50)
    nomorUrut: int = Field(gt=0)
    nomorSpd: str = Field(min_length=1, max_length=300)
    jenisNaskah: str = Field(min_length=1, max_length=50)
    tanggal: str
    suratTugasId: str = Field(min_length=1, max_length=50)
    staf: str = Field(min_length=1, max_length=200)
    tempatTujuan: str = Field(min_length=1, max_length=300)
    lamaBerangkat: str = Field(min_length=1, max_length=100)
    tanggalBerangkat: str
    pembuatSpd: str = Field(min_length=1, max_length=200)
    kategoriKlasifikasi: str = Field(min_length=1, max_length=50)
    kodeArsip: str = Field(min_length=1, max_length=50)
    kodeWilayah: Optional[str] = Field(default=None, max_length=50)


class SpdBatchCreate(BaseModel):
    items: List[SpdCreate] = Field(min_length=1, max_length=50)


class SpdUpdate(BaseModel):
    bagian: Optional[str] = Field(default=None, min_length=1, max_length=50)
    nomorUrut: Optional[int] = Field(default=None, gt=0)
    nomorSpd: Optional[str] = Field(default=None, min_length=1, max_length=300)
    jenisNaskah: Optional[str] = Field(default=None, min_length=1, max_length=50)
    tanggal: Optional[str] = None
    suratTugasId: Optional[str] = Field(default=None, min_length=1, max_length=50)
    staf: Optional[str] = Field(default=None, min_length=1, max_length=200)
    tempatTujuan: Optional[str] = Field(default=None, min_length=1, max_length=300)
    lamaBerangkat: Optional[str] = Field(default=None, min_length=1, max_length=100)
    tanggalBerangkat: Optional[str] = None
    pembuatSpd: Optional[str] = Field(default=None, min_length=1, max_length=200)
    kategoriKlasifikasi: Optional[str] = Field(default=None, min_length=1, max_length=50)
    kodeArsip: Optional[str] = Field(default=None, min_length=1, max_length=50)
    kodeWilayah: Optional[str] = Field(default=None, max_length=50)


class Spd(BaseModel):
    id: str
    bagian: str
    nomorUrut: int
    nomorSpd: str
    jenisNaskah: str
    tanggal: str
    suratTugasId: str
    staf: str
    tempatTujuan: str
    lamaBerangkat: str
    tanggalBerangkat: str
    pembuatSpd: str
    kategoriKlasifikasi: str
    kodeArsip: str
    kodeWilayah: Optional[str] = None
    createdBy: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


def _spd_model(doc: dict) -> Spd:
    return Spd(**{k: doc.get(k) for k in Spd.model_fields.keys()})


async def _cek_surat_tugas_untuk_spd(db: AsyncIOMotorDatabase, surat_tugas_id: str, bagian: str) -> None:
    st = await db[SURAT_TUGAS_COLL].find_one({"id": surat_tugas_id}, {"_id": 0, "id": 1, "bagian": 1})
    if not st:
        raise HTTPException(status_code=400, detail="Surat Tugas tidak ditemukan.")
    if st.get("bagian") != bagian:
        raise HTTPException(status_code=400, detail="Surat Tugas berasal dari bagian yang berbeda.")


@router.get("/spd", response_model=List[Spd])
async def spd_list(
    bagian: Optional[str] = Query(default=None),
    _u: dict = Depends(current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    filt: dict = {}
    if bagian:
        filt["bagian"] = bagian
    docs = await db[SPD_COLL].find(filt, {"_id": 0}).sort("nomorUrut", 1).to_list(5000)
    return [_spd_model(d) for d in docs]


@router.post("/spd/batch", response_model=List[Spd], status_code=201)
async def spd_batch_create(
    payload: SpdBatchCreate,
    user: dict = Depends(require_surat_edit),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    # Semua baris diperiksa dulu; baru kalau semuanya lolos, semuanya disimpan.
    # Jadi tidak ada SPD yang tersimpan setengah-setengah.
    terlihat = set()
    for it in payload.items:
        if it.bagian not in BAGIAN_ST_LIST:
            raise HTTPException(status_code=400, detail="Bagian tidak dikenali.")
        kunci = (it.bagian, _tahun_dari_tanggal(it.tanggal), it.nomorUrut)
        if kunci in terlihat:
            raise HTTPException(
                status_code=409,
                detail=f"Nomor urut {it.nomorUrut} muncul lebih dari sekali dalam satu permintaan.",
            )
        terlihat.add(kunci)
        await _check_nomor_urut_unique(
            db, SPD_COLL, it.nomorUrut, it.tanggal, extra_filter={"bagian": it.bagian}
        )
        await _cek_surat_tugas_untuk_spd(db, it.suratTugasId, it.bagian)
    ts = now_iso()
    hasil = []
    for it in payload.items:
        doc = it.model_dump()
        doc.update({
            "id": str(uuid.uuid4()),
            "createdBy": user["id"],
            "createdAt": ts,
            "updatedAt": ts,
        })
        await db[SPD_COLL].insert_one(doc)
        hasil.append(_spd_model(doc))
    return hasil


@router.put("/spd/{item_id}", response_model=Spd)
async def spd_update(
    item_id: str,
    payload: SpdUpdate,
    _perm: dict = Depends(require_surat_edit),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    current = await db[SPD_COLL].find_one({"id": item_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Data SPD tidak ditemukan.")
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    bagian = updates.get("bagian", current["bagian"])
    if "bagian" in updates and updates["bagian"] not in BAGIAN_ST_LIST:
        raise HTTPException(status_code=400, detail="Bagian tidak dikenali.")
    if "nomorUrut" in updates or "tanggal" in updates or "bagian" in updates:
        no_urut = updates.get("nomorUrut", current["nomorUrut"])
        tgl = updates.get("tanggal", current["tanggal"])
        await _check_nomor_urut_unique(
            db, SPD_COLL, no_urut, tgl, exclude_id=item_id, extra_filter={"bagian": bagian}
        )
    if "suratTugasId" in updates or "bagian" in updates:
        await _cek_surat_tugas_untuk_spd(db, updates.get("suratTugasId", current["suratTugasId"]), bagian)
    if updates:
        updates["updatedAt"] = now_iso()
        await db[SPD_COLL].update_one({"id": item_id}, {"$set": updates})
    fresh = await db[SPD_COLL].find_one({"id": item_id}, {"_id": 0})
    return _spd_model(fresh)


@router.delete("/spd/{item_id}")
async def spd_delete(
    item_id: str,
    _perm: dict = Depends(require_surat_delete),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    current = await db[SPD_COLL].find_one({"id": item_id}, {"_id": 0, "id": 1})
    if not current:
        raise HTTPException(status_code=404, detail="Data SPD tidak ditemukan.")
    await db[SPD_COLL].delete_one({"id": item_id})
    return {"status": "deleted", "message": "Data SPD berhasil dihapus."}

# ==============================================================
# ARSIP: FOLDER BUATAN SENDIRI + UNGGAHAN DOKUMEN
# --------------------------------------------------------------
# Tempel blok ini di BARIS PALING BAWAH master.py (setelah blok
# Surat Tugas & SPD). Baris @router dan def mulai dari kolom paling
# kiri; isi fungsi menjorok 4 spasi.
# ==============================================================

ARSIP_FOLDER_COLL = "arsip_folder"
ARSIP_UNGGAHAN_COLL = "arsip_unggahan"
# Nama jenis bawaan di halaman arsip (huruf kecil); tidak boleh dipakai sebagai nama folder.
NAMA_FOLDER_DICADANGKAN = {"surat masuk", "surat keluar", "berita acara", "nota dinas", "sk", "unggahan"}
UNGGAHAN_EXT = {".pdf", ".jpg", ".jpeg", ".png"}
UNGGAHAN_MAKS_BYTE = 10 * 1024 * 1024


async def _kategori_tampil(db: AsyncIOMotorDatabase, user: dict, kode: str) -> dict:
    """Pastikan subbagian ada dan tampil untuk pengguna ini. Mengembalikan data subbagian."""
    sub = await db.subbagian.find_one({"code": kode}, {"_id": 0})
    if not sub:
        raise HTTPException(status_code=400, detail="Kategori tidak dikenali.")
    daftar = await _list_arsip_kategori(db, user)
    if not any(k["code"] == kode and k["tampil"] for k in daftar):
        raise HTTPException(status_code=403, detail="Kategori ini sedang disembunyikan oleh admin.")
    return sub


# ------------------------------ Folder ------------------------------

class ArsipFolderCreate(BaseModel):
    kategori: str = Field(min_length=1, max_length=100)
    nama: str = Field(min_length=1, max_length=60)


class ArsipFolderUpdate(BaseModel):
    nama: str = Field(min_length=1, max_length=60)


class ArsipFolder(BaseModel):
    id: str
    kategori: str
    nama: str
    createdAt: Optional[str] = None


def _folder_model(doc: dict) -> ArsipFolder:
    return ArsipFolder(**{k: doc.get(k) for k in ArsipFolder.model_fields.keys()})


async def _cek_nama_folder(
    db: AsyncIOMotorDatabase, kategori: str, nama: str, exclude_id: Optional[str] = None
) -> str:
    bersih = " ".join((nama or "").split())
    if not bersih:
        raise HTTPException(status_code=400, detail="Nama folder tidak boleh kosong.")
    if bersih.lower() in NAMA_FOLDER_DICADANGKAN:
        raise HTTPException(
            status_code=400,
            detail=f"Nama '{bersih}' sudah dipakai jenis bawaan. Pilih nama folder lain.",
        )
    async for f in db[ARSIP_FOLDER_COLL].find({"kategori": kategori}, {"_id": 0}):
        if f["id"] != exclude_id and (f.get("nama") or "").lower() == bersih.lower():
            raise HTTPException(status_code=409, detail=f"Folder '{bersih}' sudah ada di sub bagian ini.")
    return bersih


@router.get("/arsip-folder", response_model=List[ArsipFolder])
async def arsip_folder_list(
    kategori: str = Query(...),
    user: dict = Depends(current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    await _kategori_tampil(db, user, kategori)
    docs = await db[ARSIP_FOLDER_COLL].find({"kategori": kategori}, {"_id": 0}).to_list(500)
    docs.sort(key=lambda d: (d.get("nama") or "").lower())
    return [_folder_model(d) for d in docs]


@router.post("/arsip-folder", response_model=ArsipFolder, status_code=201)
async def arsip_folder_create(
    payload: ArsipFolderCreate,
    user: dict = Depends(require_surat_edit),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    await _kategori_tampil(db, user, payload.kategori)
    nama = await _cek_nama_folder(db, payload.kategori, payload.nama)
    doc = {
        "id": str(uuid.uuid4()),
        "kategori": payload.kategori,
        "nama": nama,
        "createdBy": user["id"],
        "createdAt": now_iso(),
    }
    await db[ARSIP_FOLDER_COLL].insert_one(doc)
    return _folder_model(doc)


@router.put("/arsip-folder/{folder_id}", response_model=ArsipFolder)
async def arsip_folder_rename(
    folder_id: str,
    payload: ArsipFolderUpdate,
    user: dict = Depends(require_surat_edit),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    current = await db[ARSIP_FOLDER_COLL].find_one({"id": folder_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Folder tidak ditemukan.")
    await _kategori_tampil(db, user, current["kategori"])
    nama = await _cek_nama_folder(db, current["kategori"], payload.nama, exclude_id=folder_id)
    await db[ARSIP_FOLDER_COLL].update_one({"id": folder_id}, {"$set": {"nama": nama}})
    fresh = await db[ARSIP_FOLDER_COLL].find_one({"id": folder_id}, {"_id": 0})
    return _folder_model(fresh)


@router.delete("/arsip-folder/{folder_id}")
async def arsip_folder_delete(
    folder_id: str,
    user: dict = Depends(require_surat_delete),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    current = await db[ARSIP_FOLDER_COLL].find_one({"id": folder_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Folder tidak ditemukan.")
    await _kategori_tampil(db, user, current["kategori"])
    isi = await db[ARSIP_UNGGAHAN_COLL].find_one({"folderId": folder_id}, {"_id": 0, "id": 1})
    if isi:
        raise HTTPException(
            status_code=409,
            detail="Folder tidak bisa dihapus karena masih berisi dokumen. Hapus atau pindahkan dokumennya dulu.",
        )
    await db[ARSIP_FOLDER_COLL].delete_one({"id": folder_id})
    return {"status": "deleted", "message": "Folder berhasil dihapus."}


# ----------------------------- Unggahan -----------------------------

class ArsipUnggahan(BaseModel):
    id: str
    kategori: str
    folderId: str
    judul: str
    perihal: str
    tanggal: str
    file: Optional[str] = None
    fileName: Optional[str] = None
    fileSize: Optional[int] = None
    createdBy: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


def _unggahan_model(doc: dict) -> ArsipUnggahan:
    return ArsipUnggahan(**{k: doc.get(k) for k in ArsipUnggahan.model_fields.keys()})


def _cek_isian_unggahan(judul: str, perihal: str, tanggal: str) -> tuple:
    judul = (judul or "").strip()
    perihal = (perihal or "").strip()
    tanggal = (tanggal or "").strip()
    if not judul or not perihal:
        raise HTTPException(status_code=400, detail="Judul dan perihal wajib diisi.")
    if len(judul) > 300:
        raise HTTPException(status_code=400, detail="Judul maksimal 300 karakter.")
    if len(perihal) > 500:
        raise HTTPException(status_code=400, detail="Perihal maksimal 500 karakter.")
    try:
        datetime.strptime(tanggal, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Tanggal tidak valid.")
    return judul, perihal, tanggal


async def _baca_berkas_unggahan(file: UploadFile) -> tuple:
    """Validasi lalu baca berkas. Mengembalikan (isi, ekstensi)."""
    ext = Path(file.filename or "").suffix.lower()
    if ext not in UNGGAHAN_EXT:
        raise HTTPException(status_code=400, detail="Format file harus PDF, JPG, atau PNG.")
    isi = await file.read()
    if not isi:
        raise HTTPException(status_code=400, detail="File kosong.")
    if len(isi) > UNGGAHAN_MAKS_BYTE:
        raise HTTPException(status_code=400, detail="Ukuran file maksimal 10MB.")
    return isi, ext


def _hapus_berkas_arsip(nama: Optional[str]) -> None:
    if not nama:
        return
    try:
        (UPLOAD_DIR / nama).unlink(missing_ok=True)
    except Exception:
        pass


@router.post("/arsip-unggahan", response_model=ArsipUnggahan, status_code=201)
async def arsip_unggahan_create(
    kategori: str = Form(...),
    folderId: str = Form(...),
    judul: str = Form(...),
    perihal: str = Form(...),
    tanggal: str = Form(...),
    file: UploadFile = File(...),
    user: dict = Depends(require_surat_edit),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    await _kategori_tampil(db, user, kategori)
    judul, perihal, tanggal = _cek_isian_unggahan(judul, perihal, tanggal)
    folder = await db[ARSIP_FOLDER_COLL].find_one({"id": folderId, "kategori": kategori}, {"_id": 0})
    if not folder:
        raise HTTPException(status_code=400, detail="Folder tidak ditemukan di sub bagian ini.")
    isi, ext = await _baca_berkas_unggahan(file)
    stored = f"{uuid.uuid4()}{ext}"
    (UPLOAD_DIR / stored).write_bytes(isi)
    ts = now_iso()
    doc = {
        "id": str(uuid.uuid4()),
        "kategori": kategori,
        "folderId": folderId,
        "judul": judul,
        "perihal": perihal,
        "tanggal": tanggal,
        "file": stored,
        "fileName": file.filename,
        "fileSize": len(isi),
        "createdBy": user["id"],
        "createdAt": ts,
        "updatedAt": ts,
    }
    await db[ARSIP_UNGGAHAN_COLL].insert_one(doc)
    return _unggahan_model(doc)


@router.put("/arsip-unggahan/{item_id}", response_model=ArsipUnggahan)
async def arsip_unggahan_update(
    item_id: str,
    folderId: str = Form(...),
    judul: str = Form(...),
    perihal: str = Form(...),
    tanggal: str = Form(...),
    file: Optional[UploadFile] = File(default=None),
    user: dict = Depends(require_surat_edit),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    current = await db[ARSIP_UNGGAHAN_COLL].find_one({"id": item_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Dokumen tidak ditemukan.")
    await _kategori_tampil(db, user, current["kategori"])
    judul, perihal, tanggal = _cek_isian_unggahan(judul, perihal, tanggal)
    folder = await db[ARSIP_FOLDER_COLL].find_one({"id": folderId, "kategori": current["kategori"]}, {"_id": 0})
    if not folder:
        raise HTTPException(status_code=400, detail="Folder tidak ditemukan di sub bagian ini.")
    updates = {"folderId": folderId, "judul": judul, "perihal": perihal, "tanggal": tanggal, "updatedAt": now_iso()}
    berkas_lama = None
    if file is not None and (file.filename or ""):
        isi, ext = await _baca_berkas_unggahan(file)
        stored = f"{uuid.uuid4()}{ext}"
        (UPLOAD_DIR / stored).write_bytes(isi)
        berkas_lama = current.get("file")
        updates.update({"file": stored, "fileName": file.filename, "fileSize": len(isi)})
    await db[ARSIP_UNGGAHAN_COLL].update_one({"id": item_id}, {"$set": updates})
    _hapus_berkas_arsip(berkas_lama)
    fresh = await db[ARSIP_UNGGAHAN_COLL].find_one({"id": item_id}, {"_id": 0})
    return _unggahan_model(fresh)


@router.delete("/arsip-unggahan/{item_id}")
async def arsip_unggahan_delete(
    item_id: str,
    user: dict = Depends(require_surat_delete),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    current = await db[ARSIP_UNGGAHAN_COLL].find_one({"id": item_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Dokumen tidak ditemukan.")
    await _kategori_tampil(db, user, current["kategori"])
    _hapus_berkas_arsip(current.get("file"))
    await db[ARSIP_UNGGAHAN_COLL].delete_one({"id": item_id})
    return {"status": "deleted", "message": "Dokumen berhasil dihapus."}