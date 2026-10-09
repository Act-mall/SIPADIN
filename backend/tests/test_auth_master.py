"""Backend tests for Auth + Master Data (Pegawai, Subbagian, Pejabat, Wilayah, Jenis Naskah)."""
import os
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_NIP = "198205122005011002"
PEGAWAI_NIP = "199011152014031004"


# =============== AUTH ===============

class TestAuth:
    def test_login_success_admin(self):
        r = requests.post(f"{API}/auth/login", json={"nip": ADMIN_NIP, "password": "admin123"})
        assert r.status_code == 200
        d = r.json()
        assert "token" in d and "user" in d
        assert d["user"]["nip"] == ADMIN_NIP
        assert d["user"]["role"] == "admin"

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login", json={"nip": ADMIN_NIP, "password": "wrong"})
        assert r.status_code == 401

    def test_login_unknown_nip(self):
        r = requests.post(f"{API}/auth/login", json={"nip": "0000000000", "password": "admin123"})
        assert r.status_code == 401

    def test_me_with_token(self, admin_headers):
        r = requests.get(f"{API}/auth/me", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["role"] == "admin"

    def test_me_no_token(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401


# =============== PEGAWAI ===============

class TestPegawai:
    def test_list_requires_auth(self):
        r = requests.get(f"{API}/pegawai")
        assert r.status_code == 401

    def test_list_returns_5(self, admin_headers):
        r = requests.get(f"{API}/pegawai", headers=admin_headers)
        assert r.status_code == 200
        assert len(r.json()) >= 5

    def test_pegawai_cannot_create(self, pegawai_headers):
        r = requests.post(f"{API}/pegawai", headers=pegawai_headers,
                          json={"nip": "TEST_PYT_X", "name": "X", "password": "abcdef"})
        assert r.status_code == 403

    def test_create_no_auth(self):
        r = requests.post(f"{API}/pegawai", json={"nip": "TEST_PYT_Y", "name": "Y", "password": "abcdef"})
        assert r.status_code == 401

    def test_full_pegawai_flow(self, admin_headers):
        # CREATE
        payload = {
            "nip": "TEST_PYT001",
            "name": "TEST Pegawai",
            "jabatan": "Tester",
            "role": "pegawai",
            "is_active": True,
            "password": "abcdef",
        }
        r = requests.post(f"{API}/pegawai", headers=admin_headers, json=payload)
        assert r.status_code == 201, r.text
        created = r.json()
        assert created["nip"] == "TEST_PYT001"
        assert created["has_password"] is True
        pid = created["id"]

        # duplicate NIP
        dup = requests.post(f"{API}/pegawai", headers=admin_headers, json=payload)
        assert dup.status_code == 409

        # Login as new pegawai
        lr = requests.post(f"{API}/auth/login", json={"nip": "TEST_PYT001", "password": "abcdef"})
        assert lr.status_code == 200

        # UPDATE jabatan
        u = requests.put(f"{API}/pegawai/{pid}", headers=admin_headers, json={"jabatan": "Senior Tester"})
        assert u.status_code == 200
        assert u.json()["jabatan"] == "Senior Tester"

        # Reset password
        pw = requests.post(f"{API}/pegawai/{pid}/password", headers=admin_headers, json={"password": "newpass"})
        assert pw.status_code == 200
        lr2 = requests.post(f"{API}/auth/login", json={"nip": "TEST_PYT001", "password": "newpass"})
        assert lr2.status_code == 200

        # DELETE
        d = requests.delete(f"{API}/pegawai/{pid}", headers=admin_headers)
        assert d.status_code == 200
        assert d.json()["status"] == "deleted"

    def test_cannot_delete_self(self, admin_headers, admin_token):
        me = requests.get(f"{API}/auth/me", headers=admin_headers).json()
        r = requests.delete(f"{API}/pegawai/{me['id']}", headers=admin_headers)
        assert r.status_code == 400

    def test_cannot_demote_last_admin(self, admin_headers):
        me = requests.get(f"{API}/auth/me", headers=admin_headers).json()
        r = requests.put(f"{API}/pegawai/{me['id']}", headers=admin_headers, json={"role": "pegawai"})
        assert r.status_code == 400

    def test_cannot_deactivate_last_admin(self, admin_headers):
        me = requests.get(f"{API}/auth/me", headers=admin_headers).json()
        r = requests.put(f"{API}/pegawai/{me['id']}", headers=admin_headers, json={"is_active": False})
        assert r.status_code == 400

    def test_password_min_length(self, admin_headers):
        r = requests.post(f"{API}/pegawai", headers=admin_headers,
                          json={"nip": "TEST_PYT_SHORT", "name": "X", "password": "abc"})
        assert r.status_code == 422


# =============== SUBBAGIAN ===============

class TestSubbagian:
    def test_list_public(self):
        r = requests.get(f"{API}/subbagian")
        assert r.status_code == 200
        assert len(r.json()) >= 5

    def test_admin_crud_and_unique(self, admin_headers, pegawai_headers):
        # non-admin cannot create
        nc = requests.post(f"{API}/subbagian", headers=pegawai_headers,
                           json={"code": "SUB-PYT", "name": "PYT sub"})
        assert nc.status_code == 403

        r = requests.post(f"{API}/subbagian", headers=admin_headers,
                          json={"code": "SUB-PYT", "name": "PYT sub"})
        assert r.status_code == 201
        sid = r.json()["id"]

        # duplicate code
        dup = requests.post(f"{API}/subbagian", headers=admin_headers,
                            json={"code": "SUB-PYT", "name": "again"})
        assert dup.status_code == 409

        # update
        u = requests.put(f"{API}/subbagian/{sid}", headers=admin_headers, json={"name": "Updated"})
        assert u.status_code == 200
        assert u.json()["name"] == "Updated"

        # delete
        d = requests.delete(f"{API}/subbagian/{sid}", headers=admin_headers)
        assert d.status_code == 200

    def test_delete_subbagian_with_pegawai_fails(self, admin_headers):
        subs = requests.get(f"{API}/subbagian").json()
        # find one with active pegawai
        target = next((s for s in subs if s["pegawai_count"] > 0), None)
        if not target:
            pytest.skip("no subbagian with pegawai")
        r = requests.delete(f"{API}/subbagian/{target['id']}", headers=admin_headers)
        assert r.status_code == 409


# =============== PEJABAT ===============

class TestPejabat:
    def test_list_public(self):
        r = requests.get(f"{API}/pejabat")
        assert r.status_code == 200
        assert len(r.json()) >= 4

    def test_crud(self, admin_headers, pegawai_headers):
        nc = requests.post(f"{API}/pejabat", headers=pegawai_headers,
                           json={"name": "PYT Test", "jabatan": "Anggota Test"})
        assert nc.status_code == 403

        r = requests.post(f"{API}/pejabat", headers=admin_headers,
                          json={"name": "PYT Test", "jabatan": "Anggota Test"})
        assert r.status_code == 201
        pid = r.json()["id"]

        u = requests.put(f"{API}/pejabat/{pid}", headers=admin_headers, json={"jabatan": "Updated"})
        assert u.status_code == 200
        assert u.json()["jabatan"] == "Updated"

        d = requests.delete(f"{API}/pejabat/{pid}", headers=admin_headers)
        assert d.status_code == 200


# =============== WILAYAH ===============

class TestWilayah:
    def test_list_public(self):
        r = requests.get(f"{API}/wilayah")
        assert r.status_code == 200
        assert len(r.json()) >= 5

    def test_crud_unique(self, admin_headers, pegawai_headers):
        nc = requests.post(f"{API}/wilayah", headers=pegawai_headers,
                           json={"kode": "XX.XX", "kecamatan": "PYT"})
        assert nc.status_code == 403

        r = requests.post(f"{API}/wilayah", headers=admin_headers,
                          json={"kode": "XX.XX", "kecamatan": "PYT"})
        assert r.status_code == 201
        wid = r.json()["id"]

        dup = requests.post(f"{API}/wilayah", headers=admin_headers,
                            json={"kode": "XX.XX", "kecamatan": "again"})
        assert dup.status_code == 409

        d = requests.delete(f"{API}/wilayah/{wid}", headers=admin_headers)
        assert d.status_code == 200


# =============== JENIS NASKAH ===============

class TestJenisNaskah:
    def test_list_public(self):
        r = requests.get(f"{API}/jenis-naskah")
        assert r.status_code == 200
        assert len(r.json()) >= 5

    def test_crud_unique(self, admin_headers, pegawai_headers):
        nc = requests.post(f"{API}/jenis-naskah", headers=pegawai_headers,
                           json={"kode": "PYT", "nama": "PYT Naskah"})
        assert nc.status_code == 403

        r = requests.post(f"{API}/jenis-naskah", headers=admin_headers,
                          json={"kode": "PYT", "nama": "PYT Naskah"})
        assert r.status_code == 201
        nid = r.json()["id"]

        dup = requests.post(f"{API}/jenis-naskah", headers=admin_headers,
                            json={"kode": "PYT", "nama": "again"})
        assert dup.status_code == 409

        d = requests.delete(f"{API}/jenis-naskah/{nid}", headers=admin_headers)
        assert d.status_code == 200
