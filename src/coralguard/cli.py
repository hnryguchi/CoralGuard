"""coralguard: build the dashboard or print a text summary."""

from __future__ import annotations

import argparse
from pathlib import Path

from . import analysis
from .build import build, load_stations
from .crw import ALERT_LEVELS


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="coralguard", description="Heat stress on Brazil's coral reefs (NOAA CRW).")
    p.add_argument("command", choices=["build", "summary"])
    p.add_argument("--cache", type=Path, default=Path("data"), help="where raw CRW files are kept")
    p.add_argument("--out", type=Path, default=Path("dist"), help="output folder for the site")
    p.add_argument("--offline", action="store_true", help="use cached files, do not download")
    a = p.parse_args(argv)

    stations = load_stations(a.cache, refresh=not a.offline)
    if a.command == "build":
        out = build(a.out, stations)
        print(f"site written to {out} ({len(stations)} stations, data up to {stations[0].last_date})")
        return 0

    for st in stations:
        y = analysis.yearly(st)
        worst = y["max_dhw"].idxmax()
        ev = analysis.events(st)
        tr = analysis.sst_trend(st)
        lat = analysis.latest(st)
        print(f"{st.name:24s} now: {ALERT_LEVELS[lat['level']]:17s} DHW {lat['dhw']:5.2f} | "
              f"worst year {worst} (max DHW {y.loc[worst, 'max_dhw']:.1f}) | "
              f"{len(ev)} alert events | SST trend {tr['per_decade']} degC/decade {tr['years']}")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
