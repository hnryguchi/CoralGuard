"""Build the static dashboard: download (or read cached) CRW files, analyse, write JSON + site."""

from __future__ import annotations

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

from . import analysis
from .crw import ALERT_LEVELS, BRAZIL_STATIONS, Station, download, parse

SITE_SRC = Path(__file__).resolve().parents[2] / "site"


def load_stations(cache_dir: Path, refresh: bool = True) -> list[Station]:
    cache_dir.mkdir(parents=True, exist_ok=True)
    stations = []
    for slug, name in BRAZIL_STATIONS.items():
        f = cache_dir / f"{slug}.txt"
        if refresh or not f.exists():
            f.write_text(download(slug), encoding="utf-8")
        stations.append(parse(f.read_text(encoding="utf-8"), slug=slug, name=name))
    return stations


def station_payload(st: Station) -> dict:
    y = analysis.yearly(st)
    evs = analysis.events(st)
    return {
        "slug": st.slug,
        "name": st.name,
        "lat": st.lat,
        "lon": st.lon,
        "mmm": round(st.mmm, 2),
        "latest": analysis.latest(st),
        "trend": analysis.sst_trend(st),
        "yearly": {
            "years": [int(v) for v in y.index],
            "max_dhw": [round(float(v), 2) for v in y["max_dhw"]],
            "alert_days": [int(v) for v in y["alert_days"]],
            "max_level": [int(v) for v in y["max_level"]],
        },
        "events": [e.as_dict() for e in sorted(evs, key=lambda e: -e.peak_dhw)],
        "weekly": analysis.weekly_series(st),
    }


def build(out_dir: Path, stations: list[Station]) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.iterdir():  # clear contents, keep the folder (it may be served or open)
        shutil.rmtree(old) if old.is_dir() else old.unlink()
    shutil.copytree(SITE_SRC, out_dir, dirs_exist_ok=True)
    payload = {
        "generated_utc": datetime.now(timezone.utc).isoformat(timespec="minutes"),
        "source": "NOAA Coral Reef Watch, Version 3.1 Regional Virtual Stations",
        "alert_levels": ALERT_LEVELS,
        "stations": [station_payload(s) for s in stations],
    }
    (out_dir / "data.json").write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    return out_dir
