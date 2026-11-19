"""Build the static dashboard: download (or read cached) CRW files, analyse, write JSON + site."""

from __future__ import annotations

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

from . import analysis
from .crw import ALERT_LEVELS, BRAZIL_STATIONS, Station, download, parse

SITE_SRC = Path(__file__).resolve().parent / "site"  # shipped as package data


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
    (out_dir / "status.svg").write_text(status_svg(payload["stations"]), encoding="utf-8")
    return out_dir


# NOAA CRW Bleaching Alert Area colours, from "No Stress" (0) to "Alert Level 5" (7).
LEVEL_COLORS = ["#4f9fd6", "#e8cf3a", "#f29a2e", "#e4572e", "#c0182a", "#8e0f2a", "#6a0d3a", "#4a0a4f"]


def status_svg(stations: list[dict]) -> str:
    """A small card with today's heat stress per reef, for embedding as an image (e.g. a GitHub README)."""
    rows = sorted(stations, key=lambda s: (-s["latest"]["level"], -s["latest"]["dhw"]))
    width, row_h, top = 540, 26, 76
    height = top + row_h * len(rows) + 30
    dates = sorted({s["latest"]["date"] for s in rows})
    date_txt = dates[-1] if len(dates) == 1 else f"{dates[0]} to {dates[-1]}"
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}"'
        ' role="img" aria-label="Heat stress on Brazil\'s coral reefs today">',
        "<style>"
        "text{font:13px -apple-system,'Segoe UI',Helvetica,Arial,sans-serif;fill:#1f2328}"
        ".t{font-weight:600;font-size:15px}.m{fill:#59636e;font-size:11px}.v{font-variant-numeric:tabular-nums}"
        ".bg{fill:#ffffff;stroke:#d1d9e0}"
        "@media (prefers-color-scheme:dark){text{fill:#e6edf3}.m{fill:#9198a1}.bg{fill:#0d1117;stroke:#3d444d}}"
        "@keyframes p{0%,100%{opacity:1}50%{opacity:.35}}.live{animation:p 2s ease-in-out infinite}"
        "@media (prefers-reduced-motion:reduce){.live{animation:none}}"
        "</style>",
        f'<rect class="bg" x="0.5" y="0.5" width="{width - 1}" height="{height - 1}" rx="8"/>',
        '<circle class="live" cx="20" cy="24" r="5" fill="#e4572e"/>',
        '<text class="t" x="34" y="29">Brazil\'s coral reefs: heat stress today</text>',
        f'<text class="m" x="20" y="48">NOAA Coral Reef Watch · data for {date_txt}</text>',
        '<text class="m" x="215" y="68">SST anomaly</text>',
        '<text class="m" x="305" y="68">Heat stress (DHW)</text>',
        '<text class="m" x="420" y="68">Alert level</text>',
    ]
    for i, s in enumerate(rows):
        y = top + i * row_h + 17
        lv = s["latest"]
        parts += [
            f'<circle cx="26" cy="{y - 4}" r="6" fill="{LEVEL_COLORS[lv["level"]]}"/>',
            f'<text x="42" y="{y}">{_esc(s["name"])}</text>',
            f'<text class="v" x="215" y="{y}">{lv["ssta"]:+.1f} °C</text>',
            f'<text class="v" x="305" y="{y}">{lv["dhw"]:.1f} °C-wk</text>',
            f'<text x="420" y="{y}">{_esc(lv["label"])}</text>',
        ]
    parts.append(
        f'<text class="m" x="20" y="{height - 12}">'
        "DHW: accumulated heat stress over 12 weeks · rebuilt daily by GitHub Actions</text></svg>"
    )
    return "".join(parts)


def _esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
