"""Backend tests for Klasifikasi Arsip endpoints (SIPADIN) — JWT auth."""
import os
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
TEST_KODE = "ZZ.PYTEST"
TEST_KODE_2 = "ZZ.PYTEST2"


@pytest.fixture(scope="module")
def cleanup(admin_headers):
    yield
    r = requests.get(f"{API}/klasifikasi-arsip", params={"search": "ZZ.PYTEST", "active_only": False})
    if r.ok:
        for item in r.json():
            if item["kode"].startswith("ZZ.PYTEST"):
                requests.delete(f"{API}/klasifikasi-arsip/{item['id']}", headers=admin_headers)


def test_stats_returns_expected_counts():
    r = requests.get(f"{API}/klasifikasi-arsip/meta/stats")
    assert r.status_code == 200
    d = r.json()
    assert d["substantif"] == 68
    assert d["fasilitatif"] == 270
    assert d["total"] >= 338


def test_bidang_meta_unique_sorted():
    r = requests.get(f"{API}/klasifikasi-arsip/meta/bidang")
    assert r.status_code == 200
    lst = r.json()
    assert lst == sorted(lst)
    assert len(lst) == len(set(lst))


def test_list_default_returns_338():
    r = requests.get(f"{API}/klasifikasi-arsip")
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 338
    assert "_id" not in data[0]


def test_list_filter_kategori():
    r = requests.get(f"{API}/klasifikasi-arsip", params={"kategori": "Substantif"})
    assert r.status_code == 200
    assert len(r.json()) == 68


def test_create_without_admin_401(pegawai_headers):
    payload = {"kategori": "Substantif", "bidang": "ZZ Test", "kode": TEST_KODE, "uraian": "x", "level": 1}
    r = requests.post(f"{API}/klasifikasi-arsip", json=payload)  # no token
    assert r.status_code == 401
    r2 = requests.post(f"{API}/klasifikasi-arsip", json=payload, headers=pegawai_headers)
    assert r2.status_code == 403


def test_crud_lifecycle(cleanup, admin_headers):
    payload = {"kategori": "Substantif", "bidang": "ZZ - Test", "kode": TEST_KODE, "uraian": "Test Awal", "level": 1}
    r = requests.post(f"{API}/klasifikasi-arsip", json=payload, headers=admin_headers)
    assert r.status_code == 201, r.text
    item_id = r.json()["id"]

    dup = requests.post(f"{API}/klasifikasi-arsip", json=payload, headers=admin_headers)
    assert dup.status_code == 409

    u = requests.put(f"{API}/klasifikasi-arsip/{item_id}", json={"uraian": "Test Updated"}, headers=admin_headers)
    assert u.status_code == 200
    assert u.json()["uraian"] == "Test Updated"

    r2 = requests.post(f"{API}/klasifikasi-arsip",
                       json={**payload, "kode": TEST_KODE_2, "uraian": "Second"},
                       headers=admin_headers)
    assert r2.status_code == 201
    id2 = r2.json()["id"]
    conflict = requests.put(f"{API}/klasifikasi-arsip/{id2}", json={"kode": TEST_KODE}, headers=admin_headers)
    assert conflict.status_code == 409

    d = requests.delete(f"{API}/klasifikasi-arsip/{item_id}", headers=admin_headers)
    assert d.status_code == 200
    assert d.json()["status"] == "deleted"
    requests.delete(f"{API}/klasifikasi-arsip/{id2}", headers=admin_headers)


def test_update_unknown_id_404(admin_headers):
    r = requests.put(f"{API}/klasifikasi-arsip/nonexistent-xyz",
                     json={"uraian": "x"}, headers=admin_headers)
    assert r.status_code == 404
