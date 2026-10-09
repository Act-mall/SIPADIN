from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent / ".env")

import logging
import os

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware

from mysql_db import MySQLDatabase, make_driver
from master import router as master_router, set_db
from seed import run_seed

# --- Logging ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# --- MySQL ---
mysql_host = os.environ.get("MYSQL_HOST", "localhost")
mysql_port = int(os.environ.get("MYSQL_PORT", "3306"))
mysql_user = os.environ["MYSQL_USER"]
mysql_password = os.environ["MYSQL_PASSWORD"]
mysql_database = os.environ.get("MYSQL_DATABASE", "sipadin")

driver = make_driver(mysql_host, mysql_port, mysql_user, mysql_password, mysql_database)
db = MySQLDatabase(driver)
set_db(db)

# --- App ---
app = FastAPI(title="SIPADIN API")

app.include_router(master_router)

UPLOAD_DIR = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/")
async def root():
    return {"message": "SIPADIN API"}


@app.on_event("startup")
async def on_startup():
    try:
        await driver.verify_connectivity()
    except Exception as e:
        logger.exception(
            "Tidak bisa terhubung ke MySQL di %s:%s (database %s): %s",
            mysql_host, mysql_port, mysql_database, e,
        )
        raise
    # Isi SKIP_SEED=1 di .env untuk melewati seed (mis. saat memindahkan data dari Neo4j).
    if os.environ.get("SKIP_SEED") == "1":
        logger.info("SKIP_SEED=1: seed dilewati.")
        return
    try:
        await run_seed(db)
    except Exception as e:
        logger.exception("Seed failed: %s", e)


@app.on_event("shutdown")
async def on_shutdown():
    await driver.close()
