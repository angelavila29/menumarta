"""
Ingesta diaria de precios desde opencesta (github.com/ruvelro/opencesta) a Supabase.

Uso:
  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... python ingest/ingest.py
  (en local también lee ../.env.local si existe)

Variables opcionales:
  OPENCESTA_TAG   tag de release concreto (por defecto, la última)
  MERCADONA_ZONE  zona de Mercadona (por defecto 'mad1')
  DRY_RUN=1       no escribe en Supabase, solo imprime el resumen
"""

from __future__ import annotations

import io
import json
import os
import re
import sys
import tarfile
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import httpx
import polars as pl
from dotenv import load_dotenv

REPO = "ruvelro/opencesta"
MERCADONA_ZONE = os.environ.get("MERCADONA_ZONE", "mad1")
DIA_ZONE = "es-default"  # Dia no tiene zonas en opencesta todavía
BATCH = 500

load_dotenv(Path(__file__).resolve().parent.parent / ".env.local")
SUPABASE_URL = (os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or "").strip()
SERVICE_KEY = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
DRY_RUN = os.environ.get("DRY_RUN") == "1"

if not DRY_RUN and (not SUPABASE_URL or not SERVICE_KEY):
    sys.exit("Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en el entorno")
if not DRY_RUN and not SUPABASE_URL.startswith("https://"):
    sys.exit(f"SUPABASE_URL no parece una URL: {SUPABASE_URL!r}")
if not DRY_RUN and not SERVICE_KEY.startswith("eyJ"):
    sys.exit("SUPABASE_SERVICE_ROLE_KEY no parece la clave service_role (debería empezar por 'eyJ')")


# ---------------------------------------------------------------------------
# 1. Descarga de la release
# ---------------------------------------------------------------------------
def fetch_release(client: httpx.Client) -> dict:
    tag = os.environ.get("OPENCESTA_TAG")
    url = (
        f"https://api.github.com/repos/{REPO}/releases/tags/{tag}"
        if tag
        else f"https://api.github.com/repos/{REPO}/releases/latest"
    )
    headers = {"Accept": "application/vnd.github+json"}
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        r = client.get(url, headers={**headers, "Authorization": f"Bearer {token}"})
        if r.status_code in (401, 403):
            print(f"GitHub API con token: {r.status_code}; reintento sin token")
            r = client.get(url, headers=headers)
    else:
        r = client.get(url, headers=headers)
    if r.status_code >= 400:
        raise SystemExit(f"GitHub API {r.status_code} en {url}: {r.text[:300]}")
    return r.json()


def download_asset(client: httpx.Client, release: dict, name: str) -> bytes:
    for a in release["assets"]:
        if a["name"] == name:
            r = client.get(a["browser_download_url"], follow_redirects=True)
            r.raise_for_status()
            return r.content
    names = ", ".join(a["name"] for a in release["assets"])
    raise SystemExit(f"No encuentro el asset '{name}' en la release {release['tag_name']}. Assets: {names}")


def read_prices(tar_bytes: bytes) -> pl.DataFrame:
    """Lee todos los prices.parquet del tar y devuelve un DataFrame único."""
    frames = []
    with tarfile.open(fileobj=io.BytesIO(tar_bytes), mode="r:gz") as tar, tempfile.TemporaryDirectory() as tmp:
        tar.extractall(tmp, filter="data")
        for p in Path(tmp).rglob("prices.parquet"):
            frames.append(pl.read_parquet(p))
    if not frames:
        raise SystemExit("El tar no contiene ningún prices.parquet")
    return pl.concat(frames, how="diagonal_relaxed")


# ---------------------------------------------------------------------------
# 2. Mapeo a nuestro esquema
# ---------------------------------------------------------------------------
SIZE_RE = re.compile(r"(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|cl|ud|uds|unidades)\b", re.IGNORECASE)


def pack_size_from_name(name: str | None) -> str | None:
    """Dia no trae unit_size: sacamos '500 ml', '400 g'... del final del nombre."""
    if not name:
        return None
    m = None
    for m in SIZE_RE.finditer(name):
        pass
    if not m:
        return None
    qty, unit = m.group(1).replace(",", "."), m.group(2).lower()
    if unit in ("uds", "unidades"):
        unit = "ud"
    return f"{qty} {unit}"


def normalize_unit(reference_price: float | None, fmt: str | None) -> tuple[float | None, str | None]:
    """Convierte (reference_price, reference_format) de opencesta a (unit_price, unit) en €/kg, €/L, €/ud."""
    if reference_price is None or fmt is None:
        return None, None
    f = fmt.strip().lower()
    if f == "kg":
        return reference_price, "kg"
    if f == "l":
        return reference_price, "l"
    if f == "ud":
        return reference_price, "ud"
    if f == "100 g":
        return reference_price * 10, "kg"
    if f == "100 ml":
        return reference_price * 10, "l"
    if f in ("g",):
        return reference_price * 1000, "kg"
    if f in ("ml", "cl"):
        return reference_price * (1000 if f == "ml" else 100), "l"
    # lavado, lv, dosis, m, dz... los dejamos tal cual
    return reference_price, f


def unit_price_from_pack(price: float, pack_size: str) -> tuple[float | None, str | None]:
    """'12 ud' a 2,85 € → (0,2375 €/ud); '500 g' → €/kg; '33 cl' → €/L."""
    m = re.match(r"^(\d+(?:\.\d+)?)\s*(kg|g|l|ml|cl|ud)$", pack_size.strip().lower())
    if not m:
        return None, None
    qty, u = float(m.group(1)), m.group(2)
    if qty <= 0:
        return None, None
    factor, unit = {"kg": (1, "kg"), "g": (0.001, "kg"), "l": (1, "l"), "ml": (0.001, "l"), "cl": (0.01, "l"), "ud": (1, "ud")}[u]
    return price / (qty * factor), unit


def build_products(df: pl.DataFrame, catalog: pl.DataFrame) -> pl.DataFrame:
    df = df.filter(
        ((pl.col("chain") == "mercadona") & (pl.col("zone") == MERCADONA_ZONE))
        | ((pl.col("chain") == "dia") & (pl.col("zone") == DIA_ZONE))
    )
    # Marca de Mercadona: viene en el catálogo enriquecido, no en prices
    cat = catalog.filter(pl.col("chain") == "mercadona").select(
        "sku", pl.col("brand").alias("brand_catalog")
    ).unique(subset=["sku"])
    df = df.join(cat, on="sku", how="left")

    rows = []
    for r in df.iter_rows(named=True):
        unit_price, unit = normalize_unit(r.get("reference_price"), r.get("reference_format"))
        if r.get("unit_size") is not None and r.get("size_format"):
            size = r["unit_size"]
            size_str = f"{size:g}"
            pack_size = f"{size_str} {r['size_format']}"
        else:
            pack_size = pack_size_from_name(r.get("display_name"))
        # Sin precio por unidad en origen (pasa en Dia): se deduce del tamaño del envase
        if unit_price is None and pack_size and r.get("unit_price") is not None:
            unit_price, unit = unit_price_from_pack(float(r["unit_price"]), pack_size)
        category = r.get("category")
        if r.get("subcategory"):
            category = f"{category} > {r['subcategory']}" if category else r["subcategory"]
        rows.append(
            {
                "supermarket_id": r["chain"],
                "external_id": str(r["sku"]),
                "zone": r["zone"],
                "name": r["display_name"],
                "brand": r.get("brand") or r.get("brand_catalog"),
                "category": category,
                "price": _num(r.get("unit_price")),
                "unit_price": _num(unit_price),
                "unit": unit,
                "pack_size": pack_size,
                "image_url": r.get("thumbnail"),
                "product_url": r.get("url"),
                "is_discounted": bool(r.get("is_discounted") or False),
                "captured_at": r.get("captured_at"),
            }
        )
    # Esquema explícito: si las primeras filas son de Dia (sin imagen), polars inferiría
    # image_url como nula y fallaría al llegar a Mercadona. El orden de lectura no es estable.
    return pl.DataFrame(rows, schema=PRODUCT_SCHEMA)


PRODUCT_SCHEMA = {
    "supermarket_id": pl.Utf8,
    "external_id": pl.Utf8,
    "zone": pl.Utf8,
    "name": pl.Utf8,
    "brand": pl.Utf8,
    "category": pl.Utf8,
    "price": pl.Float64,
    "unit_price": pl.Float64,
    "unit": pl.Utf8,
    "pack_size": pl.Utf8,
    "image_url": pl.Utf8,
    "product_url": pl.Utf8,
    "is_discounted": pl.Boolean,
    "captured_at": pl.Utf8,
}


def _num(v):
    if v is None:
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    if f != f:  # NaN
        return None
    return round(f, 4)


# ---------------------------------------------------------------------------
# 3-4. Carga en Supabase (REST / PostgREST)
# ---------------------------------------------------------------------------
class Supa:
    def __init__(self, url: str, key: str):
        self.base = url.rstrip("/") + "/rest/v1"
        self.client = httpx.Client(
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
            },
            timeout=120,
        )

    def existing_keys(self) -> set[tuple[str, str, str]]:
        keys: set[tuple[str, str, str]] = set()
        offset, page = 0, 1000
        while True:
            r = self.client.get(
                f"{self.base}/products",
                params={"select": "supermarket_id,external_id,zone"},
                headers={"Range": f"{offset}-{offset + page - 1}"},
            )
            if r.status_code >= 400:
                raise RuntimeError(f"GET products {r.status_code}: {r.text[:300]}")
            data = r.json()
            keys.update((d["supermarket_id"], d["external_id"], d["zone"]) for d in data)
            if len(data) < page:
                return keys
            offset += page

    def upsert_products(self, rows: list[dict]) -> list[dict]:
        r = self.client.post(
            f"{self.base}/products",
            params={"on_conflict": "supermarket_id,external_id,zone", "select": "id,supermarket_id,external_id,zone"},
            headers={"Prefer": "resolution=merge-duplicates,return=representation"},
            json=rows,
        )
        if r.status_code >= 400:
            raise RuntimeError(f"upsert products {r.status_code}: {r.text[:500]}")
        return r.json()

    def replace_equivalences(self, rows: list[dict]) -> None:
        """La tabla es pequeña: se vacía y se vuelve a cargar con la release del día."""
        r = self.client.delete(f"{self.base}/product_equivalences", params={"product_a": "gt.0"})
        if r.status_code >= 400:
            raise RuntimeError(f"delete product_equivalences {r.status_code}: {r.text[:300]}")
        for i in range(0, len(rows), BATCH):
            r = self.client.post(
                f"{self.base}/product_equivalences",
                headers={"Prefer": "resolution=ignore-duplicates,return=minimal"},
                json=rows[i : i + BATCH],
            )
            if r.status_code >= 400:
                raise RuntimeError(f"insert product_equivalences {r.status_code}: {r.text[:300]}")

    def insert_history(self, rows: list[dict]) -> None:
        r = self.client.post(
            f"{self.base}/price_history",
            params={"on_conflict": "product_id,captured_at"},
            headers={"Prefer": "resolution=ignore-duplicates,return=minimal"},
            json=rows,
        )
        if r.status_code >= 400:
            raise RuntimeError(f"insert price_history {r.status_code}: {r.text[:500]}")


def main() -> None:
    with httpx.Client(timeout=120) as client:
        release = fetch_release(client)
        print(f"Release: {release['tag_name']} ({release.get('published_at')})")
        prices = read_prices(download_asset(client, release, "prices.tar.gz"))
        catalog = pl.read_parquet(io.BytesIO(download_asset(client, release, "catalog-mercadona.parquet")))
        try:
            equivalences_raw = download_asset(client, release, "equivalences.jsonl").decode("utf-8")
        except SystemExit:
            equivalences_raw = ""  # la release no trae equivalencias: no es un fallo

    print(f"Filas en el dataset: {prices.height} (zonas: {sorted(prices['zone'].unique().to_list())})")
    products = build_products(prices, catalog)
    if products.height == 0:
        raise SystemExit("0 productos tras filtrar; ¿ha cambiado el nombre de zona?")

    counts = products.group_by("supermarket_id").len().sort("supermarket_id")
    for chain, n in counts.iter_rows():
        print(f"  {chain}: {n} productos")
    sin_unit = products.filter(pl.col("unit_price").is_null()).height
    print(f"  sin precio por unidad: {sin_unit}")

    if DRY_RUN:
        print(products.head(5))
        print("DRY_RUN=1: no se escribe nada")
        return

    supa = Supa(SUPABASE_URL, SERVICE_KEY)
    existing = supa.existing_keys()
    now = datetime.now(timezone.utc).isoformat()

    inserted = updated = failed = history_rows = 0
    ids_by_sku: dict[tuple[str, str], int] = {}  # (cadena, sku) -> id de producto
    records = products.to_dicts()
    for i in range(0, len(records), BATCH):
        batch = records[i : i + BATCH]
        payload = []
        for rec in batch:
            row = {k: v for k, v in rec.items() if k != "captured_at"}
            row["updated_at"] = now
            payload.append(row)
        try:
            returned = supa.upsert_products(payload)
        except Exception as e:  # noqa: BLE001
            failed += len(batch)
            print(f"  lote {i // BATCH + 1}: ERROR {e}")
            continue

        id_by_key = {(d["supermarket_id"], d["external_id"], d["zone"]): d["id"] for d in returned}
        for d in returned:
            ids_by_sku[(d["supermarket_id"], d["external_id"])] = d["id"]
        hist = []
        for rec in batch:
            key = (rec["supermarket_id"], rec["external_id"], rec["zone"])
            if key in existing:
                updated += 1
            else:
                inserted += 1
            pid = id_by_key.get(key)
            if pid is not None:
                hist.append(
                    {
                        "product_id": pid,
                        "price": rec["price"],
                        "unit_price": rec["unit_price"],
                        "captured_at": rec["captured_at"] or now[:10],
                    }
                )
        try:
            supa.insert_history(hist)
            history_rows += len(hist)
        except Exception as e:  # noqa: BLE001
            print(f"  lote {i // BATCH + 1}: ERROR price_history {e}")
        print(f"  lote {i // BATCH + 1}: {len(batch)} productos ok")

    # Equivalencias Mercadona (a) - Dia (b) de opencesta
    eq_rows = []
    for line in equivalences_raw.splitlines():
        if not line.strip():
            continue
        try:
            e = json.loads(line)
            a = ids_by_sku.get(("mercadona", str(e["a"]["sku"])))
            b = ids_by_sku.get(("dia", str(e["b"]["sku"])))
        except (ValueError, KeyError, TypeError):
            continue
        if a and b:
            eq_rows.append({"product_a": a, "product_b": b, "score": e.get("score"), "method": e.get("method")})
    if eq_rows:
        try:
            supa.replace_equivalences(eq_rows)
        except Exception as e:  # noqa: BLE001
            print(f"  ERROR equivalencias: {e}")
            eq_rows = []

    print("\nResumen")
    for chain, n in counts.iter_rows():
        print(f"  {chain}: {n} productos")
    print(f"  insertados: {inserted}")
    print(f"  actualizados: {updated}")
    print(f"  fallos: {failed}")
    print(f"  equivalencias entre cadenas: {len(eq_rows)}")
    print(f"  filas enviadas a price_history (se ignoran las ya existentes): {history_rows}")
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
