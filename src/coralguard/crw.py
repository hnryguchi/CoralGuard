"""NOAA Coral Reef Watch (CRW) Regional Virtual Station files: stations, download and parsing.

Data: NOAA Coral Reef Watch, Version 3.1 daily global 5km satellite coral bleaching heat stress
monitoring, Regional Virtual Stations (public domain, U.S. Government work).
Format and definitions: https://coralreefwatch.noaa.gov/product/vs/description.php
"""

from __future__ import annotations

import urllib.request
from dataclasses import dataclass
from datetime import date

import pandas as pd

VS_URL = "https://coralreefwatch.noaa.gov/product/vs/data/{slug}.txt"

# The 7 CRW Regional Virtual Stations in Brazil (slugs exactly as published by CRW,
# including their spelling of "trinadade").
BRAZIL_STATIONS: dict[str, str] = {
    "fernando_de_noronha": "Fernando de Noronha",
    "maracajau": "Maracajaú",
    "costa_dos_corais": "Costa dos Corais",
    "todos_os_santos": "Todos os Santos",
    "abrolhos_reefs": "Abrolhos",
    "trinadade_martim_vaz": "Trindade e Martim Vaz",
    "buzios": "Búzios",
}

# BAA_7day_max codes, from the CRW description page.
ALERT_LEVELS: dict[int, str] = {
    0: "No Stress",
    1: "Bleaching Watch",
    2: "Bleaching Warning",
    3: "Alert Level 1",
    4: "Alert Level 2",
    5: "Alert Level 3",
    6: "Alert Level 4",
    7: "Alert Level 5",
}
ALERT_1 = 3  # first level at which CRW predicts reef-wide bleaching risk

COLUMNS = ["sst_min", "sst_max", "sst_90", "ssta_90", "hotspot_90", "dhw", "baa"]


@dataclass
class Station:
    slug: str
    name: str
    lat: float
    lon: float
    mmm: float  # averaged maximum monthly mean (bleaching threshold baseline), degC
    monthly_mean: list[float]
    data: pd.DataFrame  # index: date; columns: COLUMNS

    @property
    def last_date(self) -> date:
        return self.data.index[-1].date()


def download(slug: str, timeout: float = 60.0) -> str:
    req = urllib.request.Request(VS_URL.format(slug=slug), headers={"User-Agent": "CoralGuard"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310 (fixed https host)
        return resp.read().decode("utf-8")


def parse(text: str, slug: str = "", name: str | None = None) -> Station:
    """Parse a CRW Regional Virtual Station text file (header block + daily table)."""
    lines = text.splitlines()

    def after(label: str) -> str:
        for i, ln in enumerate(lines):
            if ln.strip().rstrip(":") == label.rstrip(":"):
                for nxt in lines[i + 1 :]:
                    if nxt.strip():
                        return nxt.strip()
        raise ValueError(f"field {label!r} not found in CRW file")

    header_idx = next((i for i, ln in enumerate(lines) if ln.startswith("YYYY MM DD")), None)
    if header_idx is None:
        raise ValueError("not a CRW virtual station file (no 'YYYY MM DD' table header)")

    rows = []
    for ln in lines[header_idx + 1 :]:
        parts = ln.split()
        if len(parts) != 10:
            continue
        y, m, d = (int(p) for p in parts[:3])
        rows.append([date(y, m, d), *(float(p) for p in parts[3:9]), int(float(parts[9]))])
    if not rows:
        raise ValueError("CRW file has no data rows")

    df = pd.DataFrame(rows, columns=["date", *COLUMNS]).set_index("date")
    df.index = pd.to_datetime(df.index)
    df = df.sort_index()

    return Station(
        slug=slug,
        name=name or after("Name:"),
        lat=float(after("Polygon Middle Latitude:")),
        lon=float(after("Polygon Middle Longitude:")),
        mmm=float(after("Averaged Maximum Monthly Mean:")),
        monthly_mean=[float(x) for x in after("Averaged Monthly Mean (Jan-Dec):").split()],
        data=df,
    )
