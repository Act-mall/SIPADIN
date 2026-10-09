"""Shared fixtures for SIPADIN backend tests."""
import os
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_NIP = "198205122005011002"
PEGAWAI_NIP = "199011152014031004"
DEFAULT_PW = "admin123"


def _login(nip, pw):
    r = requests.post(f"{API}/auth/login", json={"nip": nip, "password": pw})
    r.raise_for_status()
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_token():
    return _login(ADMIN_NIP, DEFAULT_PW)


@pytest.fixture(scope="session")
def pegawai_token():
    return _login(PEGAWAI_NIP, DEFAULT_PW)


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def pegawai_headers(pegawai_token):
    return {"Authorization": f"Bearer {pegawai_token}", "Content-Type": "application/json"}
