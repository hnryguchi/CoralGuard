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
    (out_dir / "status-pt.svg").write_text(brand(status_svg(payload["stations"], lang="pt")), encoding="utf-8")
    (out_dir / "reefs.geojson").write_text(json.dumps(reefs_geojson(payload["stations"]), indent=1,
                                                      ensure_ascii=False), encoding="utf-8")
    return out_dir


def reefs_geojson(stations: list[dict]) -> dict:
    """One point per reef with its record year and trend; GitHub renders .geojson files as an interactive map."""
    features = []
    for s in stations:
        y = s["yearly"]
        i = max(range(len(y["years"])), key=lambda k: y["max_dhw"][k])
        worst = y["max_dhw"][i]
        color = "#7a0019" if worst >= 20 else "#c0182a" if worst >= 12 else "#e4572e" if worst >= 8 else "#f29a2e"
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [s["lon"], s["lat"]]},
            "properties": {
                "reef": s["name"],
                "worst_year": y["years"][i],
                "worst_max_dhw_degC_weeks": worst,
                "alert_events_since_1985": len(s["events"]),
                "sst_trend_degC_per_decade": s["trend"]["per_decade"] if s["trend"] else None,
                "data_up_to": s["latest"]["date"],
                "source": "NOAA Coral Reef Watch v3.1 virtual station",
                "marker-color": color,
                "marker-symbol": "water",
            },
        })
    return {"type": "FeatureCollection", "features": features}


# NOAA CRW Bleaching Alert Area colours, from "No Stress" (0) to "Alert Level 5" (7).
LEVEL_COLORS = ["#4f9fd6", "#e8cf3a", "#f29a2e", "#e4572e", "#c0182a", "#8e0f2a", "#6a0d3a", "#4a0a4f"]


TEXT = {
    "en": dict(aria="Heat stress on Brazil's coral reefs today", title="Brazil's coral reefs: heat stress today",
               data="NOAA Coral Reef Watch · data for", to="to", ssta="SST anomaly", dhw="Heat stress (DHW)",
               level="Alert level", unit="°C-wk",
               foot="DHW: accumulated heat stress over 12 weeks · rebuilt daily by GitHub Actions", labels=None),
    "pt": dict(aria="Estresse térmico nos recifes de coral do Brasil hoje",
               title="Recifes de coral do Brasil: estresse térmico hoje",
               data="NOAA Coral Reef Watch · dados de", to="a", ssta="Anomalia TSM", dhw="Estresse (DHW)",
               level="Nível de alerta", unit="°C-sem",
               foot="DHW: calor acumulado em 12 semanas · atualizado todo dia pelo GitHub Actions",
               labels=["Sem estresse", "Observação", "Aviso", "Alerta 1", "Alerta 2", "Alerta 3", "Alerta 4",
                       "Alerta 5"]),
}


def status_svg(stations: list[dict], lang: str = "en") -> str:
    """A small card with today's heat stress per reef, for embedding as an image (e.g. a GitHub README)."""
    tx = TEXT[lang]
    rows = sorted(stations, key=lambda s: (-s["latest"]["level"], -s["latest"]["dhw"]))
    width, row_h, top = 540, 26, 76
    height = top + row_h * len(rows) + 30
    dates = sorted({s["latest"]["date"] for s in rows})
    date_txt = dates[-1] if len(dates) == 1 else f"{dates[0]} {tx['to']} {dates[-1]}"
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}"'
        f' role="img" aria-label="{_esc(tx["aria"])}">',
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
        f'<text class="t" x="34" y="29">{_esc(tx["title"])}</text>',
        f'<text class="m" x="20" y="48">{tx["data"]} {date_txt}</text>',
        f'<text class="m" x="215" y="68">{tx["ssta"]}</text>',
        f'<text class="m" x="305" y="68">{tx["dhw"]}</text>',
        f'<text class="m" x="420" y="68">{tx["level"]}</text>',
    ]
    for i, s in enumerate(rows):
        y = top + i * row_h + 17
        lv = s["latest"]
        parts += [
            f'<circle cx="26" cy="{y - 4}" r="6" fill="{LEVEL_COLORS[lv["level"]]}"/>',
            f'<text x="42" y="{y}">{_esc(s["name"])}</text>',
            f'<text class="v" x="215" y="{y}">{lv["ssta"]:+.1f} °C</text>',
            f'<text class="v" x="305" y="{y}">{lv["dhw"]:.1f} {tx["unit"]}</text>',
            f'<text x="420" y="{y}">{_esc(tx["labels"][lv["level"]] if tx["labels"] else lv["label"])}</text>',
        ]
    parts.append(f'<text class="m" x="20" y="{height - 12}">{tx["foot"]}</text></svg>')
    return "".join(parts)


def _esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def brand(svg: str) -> str:
    """Fixed navy palette (the profile README's brand), regardless of the viewer's light/dark theme."""
    for old, new in (
        ("@media (prefers-color-scheme:dark){text{fill:#e6edf3}.m{fill:#9198a1}.bg{fill:#0d1117;stroke:#3d444d}}", ""),
        ("fill:#1f2328}", "fill:#f0f9ff}"),
        (".m{fill:#59636e;", ".m{fill:#9cc3dc;"),
        (".bg{fill:#ffffff;stroke:#d1d9e0}", ".bg{fill:#081a2e;stroke:#16324f}"),
    ):
        assert old in svg, old
        svg = svg.replace(old, new)
    return svg
