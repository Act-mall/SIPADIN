"""
Lapisan database MySQL yang meniru API Motor/PyMongo, pengganti neo4j_db.py.

Kode lain (master.py, auth.py, seed.py) ditulis memakai gaya Motor:
    db.<koleksi>.find_one(...), .find(...).sort(...).to_list(n), .insert_one(...),
    .update_one(filter, {"$set": ...}), .delete_one(...), .count_documents(...),
    .distinct(field, filter), .create_index(field, unique=True)

Modul ini menyediakan permukaan yang sama di atas MySQL: satu "koleksi" = satu tabel
dengan nama yang sama (mis. "pegawai" -> tabel `pegawai`, "nota_dinas" -> `nota_dinas`),
satu "dokumen" = satu baris. Operator filter yang didukung sama persis dengan versi
Neo4j: kesamaan biasa, $ne, $or, $regex/$options, dan update $set.

Perilaku yang sengaja DIPERTAHANKAN dari versi Neo4j supaya aplikasi tidak berubah:
  - Nilai None tidak disimpan dan tidak mengubah apa pun saat $set
    (kolom dikosongkan dengan "" / 0, bukan None). Dokumen yang dibaca tidak
    memuat key yang nilainya NULL.
  - Dict bersarang (pegawai.permissions) diratakan menjadi kolom
    permissions__keuangan, dst., lalu disusun kembali saat dibaca.
  - Urutan sort meniru Cypher: NULL berada paling akhir untuk ASC.

Kolom baru HARUS ditambahkan ke tabel dulu (ALTER TABLE). Kalau kode menulis field yang
belum ada kolomnya, akan muncul pesan error yang menyebut tabel dan kolom itu.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Any, Iterable, Optional

logger = logging.getLogger(__name__)

_IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def _q(name: str) -> str:
    """Kutip nama tabel/kolom dengan backtick, sambil menolak nama yang aneh."""
    if not _IDENT.match(name):
        raise ValueError(f"Nama tabel/kolom tidak valid: {name!r}")
    return f"`{name}`"


def _is_json(coltype: Optional[str]) -> bool:
    return bool(coltype) and coltype.lower() == "json"


def _is_bool(coltype: Optional[str]) -> bool:
    return bool(coltype) and coltype.lower().startswith("tinyint(1)")


def _like_escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _unflatten(props: dict) -> dict:
    out: dict = {}
    nested: dict = {}
    for k, v in props.items():
        if "__" in k:
            base, sub = k.split("__", 1)
            nested.setdefault(base, {})[sub] = v
        else:
            out[k] = v
    for base, sub in nested.items():
        out[base] = sub
    # pegawai.permissions selalu diharapkan ada walau kosong
    if "permissions" not in out and any(k.startswith("permissions__") for k in props):
        out["permissions"] = {}
    return out


class _QueryBuilder:
    """Mengubah filter gaya Mongo menjadi klausa WHERE MySQL + daftar parameter."""

    def __init__(self) -> None:
        self.params: list = []

    def clause(self, filt: dict) -> str:
        if not filt:
            return "1=1"
        parts = []
        for key, val in filt.items():
            if key == "$or":
                if not val:
                    parts.append("1=0")
                    continue
                sub = [f"({self.clause(cond)})" for cond in val]
                parts.append("(" + " OR ".join(sub) + ")")
                continue

            col = _q(key)
            if isinstance(val, dict) and "$ne" in val:
                if val["$ne"] is None:
                    parts.append(f"{col} IS NOT NULL")
                else:
                    self.params.append(val["$ne"])
                    parts.append(f"{col} <> %s")
            elif isinstance(val, dict) and "$regex" in val:
                raw = str(val["$regex"])
                case_insensitive = "i" in (val.get("$options") or "")
                anchored = raw.startswith("^")
                body = raw[1:] if anchored else raw
                # re.escape(...) dari kode pemanggil dikembalikan ke teks biasa
                body = re.sub(r"\\(.)", r"\1", body)
                esc = _like_escape(body)
                self.params.append(esc + "%" if anchored else "%" + esc + "%")
                if case_insensitive:
                    parts.append(f"{col} LIKE %s")
                else:
                    parts.append(f"{col} LIKE BINARY %s")
            elif isinstance(val, dict):
                raise NotImplementedError(f"Operator Mongo tidak didukung pada filter: {val}")
            elif val is None:
                parts.append(f"{col} IS NULL")
            else:
                self.params.append(val)
                parts.append(f"{col} = %s")
        return " AND ".join(parts) if parts else "1=1"


def _order_by(sort: list) -> str:
    if not sort:
        return ""
    items = []
    for key, direction in sort:
        col = _q(key)
        if direction == -1:
            # Cypher: DESC menaruh NULL paling awal
            items.append(f"({col} IS NULL) DESC, {col} DESC")
        else:
            # Cypher: ASC menaruh NULL paling akhir
            items.append(f"({col} IS NULL) ASC, {col} ASC")
    return " ORDER BY " + ", ".join(items)


class _UpdateResult:
    def __init__(self, matched: int, modified: int):
        self.matched_count = matched
        self.modified_count = modified


class _DeleteResult:
    def __init__(self, deleted: int):
        self.deleted_count = deleted


class _Cursor:
    """Meniru cursor Motor untuk rantai .find(...).sort(...).to_list(n)."""

    def __init__(self, coll: "MySQLCollection", filt: dict):
        self._coll = coll
        self._filt = filt or {}
        self._sort: list = []

    def sort(self, key_or_list, direction: int = 1) -> "_Cursor":
        if isinstance(key_or_list, list):
            self._sort = key_or_list
        else:
            self._sort = [(key_or_list, direction)]
        return self

    def __await__(self):
        return self.to_list(10_000).__await__()

    async def to_list(self, length: Optional[int] = None):
        return await self._coll._fetch(self._filt, self._sort, length or 10_000)

    def __aiter__(self):
        return self._aiter_impl()

    async def _aiter_impl(self):
        docs = await self._coll._fetch(self._filt, self._sort, 10_000)
        for doc in docs:
            yield doc


class MySQLCollection:
    def __init__(self, driver: "MySQLDriver", name: str):
        self._driver = driver
        self.name = name
        self.table = _q(name)

    # ---------- util tipe data ----------

    async def _convert_row(self, row: dict) -> dict:
        coltypes = await self._driver.columns(self.name)
        out = {}
        for k, v in row.items():
            if v is None:
                continue
            t = coltypes.get(k)
            if _is_bool(t):
                v = bool(v)
            elif _is_json(t) and isinstance(v, (str, bytes, bytearray)):
                v = json.loads(v)
            out[k] = v
        return _unflatten(out)

    async def _prepare(self, doc: dict) -> dict:
        """Ratakan dict bersarang, buang None, serialisasi JSON, dan pastikan kolomnya ada."""
        coltypes = await self._driver.columns(self.name)
        flat: dict = {}
        for k, v in doc.items():
            if v is None:
                continue
            if isinstance(v, dict) and not _is_json(coltypes.get(k)):
                for sk, sv in v.items():
                    if sv is not None:
                        flat[f"{k}__{sk}"] = sv
            else:
                flat[k] = v

        missing = [k for k in flat if k not in coltypes]
        if missing:
            # mungkin tabel baru di-ALTER saat server berjalan: muat ulang sekali
            coltypes = await self._driver.columns(self.name, refresh=True)
            missing = [k for k in flat if k not in coltypes]
        if missing:
            raise RuntimeError(
                f"Tabel '{self.name}' belum punya kolom: {', '.join(missing)}. "
                f"Tambahkan dulu dengan ALTER TABLE {self.name} ADD COLUMN ..."
            )

        out = {}
        for k, v in flat.items():
            t = coltypes[k]
            if _is_json(t):
                out[k] = json.dumps(v, ensure_ascii=False)
            elif isinstance(v, (list, dict, set, tuple)):
                raise TypeError(
                    f"Kolom '{self.name}.{k}' bertipe {t}, tidak bisa menyimpan {type(v).__name__}. "
                    f"Ubah kolomnya menjadi JSON atau kirim nilai berupa teks."
                )
            else:
                out[k] = v
        return out

    # ---------- operasi ala Motor ----------

    async def _fetch(self, filt: dict, sort: list, limit: int) -> list:
        qb = _QueryBuilder()
        where = qb.clause(filt)
        sql = f"SELECT * FROM {self.table} WHERE {where}{_order_by(sort)} LIMIT %s"
        rows, _ = await self._driver.execute(sql, qb.params + [int(limit)], fetch=True)
        return [await self._convert_row(r) for r in rows]

    def find(self, filt: Optional[dict] = None, projection: Optional[dict] = None) -> _Cursor:
        return _Cursor(self, filt or {})

    async def find_one(self, filt: dict, projection: Optional[dict] = None) -> Optional[dict]:
        docs = await self._fetch(filt, [], 1)
        return docs[0] if docs else None

    async def insert_one(self, doc: dict):
        props = await self._prepare(doc)
        if not props:
            raise ValueError(f"insert_one pada '{self.name}' tidak punya field apa pun.")
        cols = ", ".join(_q(c) for c in props)
        marks = ", ".join(["%s"] * len(props))
        await self._driver.execute(
            f"INSERT INTO {self.table} ({cols}) VALUES ({marks})", list(props.values())
        )
        return doc

    async def insert_many(self, docs: Iterable[dict]):
        docs = list(docs)
        for doc in docs:
            await self.insert_one(doc)
        return docs

    async def update_one(self, filt: dict, update: dict) -> _UpdateResult:
        set_fields = await self._prepare(update.get("$set", {}))
        if not set_fields:
            return _UpdateResult(0, 0)
        qb = _QueryBuilder()
        where = qb.clause(filt)
        assignments = ", ".join(f"{_q(c)} = %s" for c in set_fields)
        params = list(set_fields.values()) + qb.params
        _, rowcount = await self._driver.execute(
            f"UPDATE {self.table} SET {assignments} WHERE {where} LIMIT 1", params
        )
        # koneksi memakai flag FOUND_ROWS, jadi rowcount = jumlah baris yang cocok
        return _UpdateResult(rowcount, rowcount)

    async def delete_one(self, filt: dict) -> _DeleteResult:
        qb = _QueryBuilder()
        where = qb.clause(filt)
        _, rowcount = await self._driver.execute(
            f"DELETE FROM {self.table} WHERE {where} LIMIT 1", qb.params
        )
        return _DeleteResult(rowcount)

    async def count_documents(self, filt: Optional[dict] = None) -> int:
        qb = _QueryBuilder()
        where = qb.clause(filt or {})
        rows, _ = await self._driver.execute(
            f"SELECT COUNT(*) AS c FROM {self.table} WHERE {where}", qb.params, fetch=True
        )
        return int(rows[0]["c"]) if rows else 0

    async def distinct(self, field: str, filt: Optional[dict] = None) -> list:
        qb = _QueryBuilder()
        where = qb.clause(filt or {})
        rows, _ = await self._driver.execute(
            f"SELECT {_q(field)} AS v FROM {self.table} WHERE {where}", qb.params, fetch=True
        )
        coltypes = await self._driver.columns(self.name)
        t = coltypes.get(field)
        seen: list = []
        seen_set: set = set()
        for r in rows:
            v = r["v"]
            if v is not None and _is_bool(t):
                v = bool(v)
            key = json.dumps(v, sort_keys=True, default=str)
            if key not in seen_set:
                seen_set.add(key)
                seen.append(v)
        return seen

    async def create_index(self, field: str, unique: bool = False):
        name = f"{self.name}_{field}_{'unique' if unique else 'idx'}"[:64]
        try:
            rows, _ = await self._driver.execute(
                f"SHOW INDEX FROM {self.table} WHERE Key_name = %s", [name], fetch=True
            )
            if rows:
                return
            kind = "UNIQUE " if unique else ""
            await self._driver.execute(
                f"CREATE {kind}INDEX {_q(name)} ON {self.table} ({_q(field)})"
            )
        except Exception as e:  # jangan menggagalkan startup hanya karena indeks
            logger.warning("Gagal membuat indeks %s pada %s: %s", name, self.name, e)


class MySQLDriver:
    """Pengganti AsyncDriver Neo4j: memegang pool koneksi dan menjalankan SQL."""

    def __init__(self, host: str, port: int, user: str, password: str, database: str):
        self._cfg = dict(host=host, port=int(port), user=user, password=password, db=database)
        self._pool = None
        self._lock = asyncio.Lock()
        self._columns: dict = {}

    async def _get_pool(self):
        if self._pool is None:
            async with self._lock:
                if self._pool is None:
                    import aiomysql
                    from pymysql.constants import CLIENT

                    self._pool = await aiomysql.create_pool(
                        charset="utf8mb4",
                        autocommit=True,
                        minsize=1,
                        maxsize=10,
                        client_flag=CLIENT.FOUND_ROWS,
                        **self._cfg,
                    )
        return self._pool

    async def execute(self, sql: str, params: Optional[list] = None, fetch: bool = False):
        """Jalankan satu perintah. Mengembalikan (daftar_baris_dict, rowcount)."""
        import aiomysql

        pool = await self._get_pool()
        async with pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute(sql, params or None)
                rows = list(await cur.fetchall()) if fetch else []
                return rows, cur.rowcount

    async def columns(self, table: str, refresh: bool = False) -> dict:
        """{nama_kolom: tipe} dari tabel, di-cache."""
        if refresh or table not in self._columns:
            rows, _ = await self.execute(f"SHOW COLUMNS FROM {_q(table)}", fetch=True)
            self._columns[table] = {r["Field"]: str(r["Type"]).lower() for r in rows}
        return self._columns[table]

    async def verify_connectivity(self):
        await self.execute("SELECT 1", fetch=True)

    async def close(self):
        if self._pool is not None:
            self._pool.close()
            await self._pool.wait_closed()
            self._pool = None


class MySQLDatabase:
    """Pengganti AsyncIOMotorDatabase: db.pegawai dan db["pegawai"] sama-sama bisa."""

    def __init__(self, driver: MySQLDriver):
        self._driver = driver
        self._collections: dict = {}

    def _get(self, name: str) -> MySQLCollection:
        if name not in self._collections:
            self._collections[name] = MySQLCollection(self._driver, name)
        return self._collections[name]

    def __getattr__(self, name: str) -> MySQLCollection:
        if name.startswith("_"):
            raise AttributeError(name)
        return self._get(name)

    def __getitem__(self, name: str) -> MySQLCollection:
        return self._get(name)


def make_driver(host: str, port: int, user: str, password: str, database: str) -> MySQLDriver:
    return MySQLDriver(host, port, user, password, database)
