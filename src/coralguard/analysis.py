"""Heat-stress analyses on CRW station data.

These are satellite-derived *heat stress* indicators. They predict bleaching risk; they are not
in-water observations of bleaching.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from .crw import ALERT_1, ALERT_LEVELS, Station


@dataclass
class Event:
    start: pd.Timestamp
    end: pd.Timestamp
    days: int
    peak_dhw: float
    peak_level: int

    def as_dict(self) -> dict:
        return {
            "start": self.start.date().isoformat(),
            "end": self.end.date().isoformat(),
            "days": self.days,
            "peak_dhw": round(self.peak_dhw, 2),
            "peak_level": self.peak_level,
            "peak_label": ALERT_LEVELS[self.peak_level],
        }


def complete_years(df: pd.DataFrame, min_days: int = 360) -> pd.DataFrame:
    counts = df.groupby(df.index.year).size()
    keep = counts[counts >= min_days].index
    return df[df.index.year.isin(keep)]


def yearly(st: Station) -> pd.DataFrame:
    """Per calendar year: max DHW, days at Alert Level 1 or higher, highest level, mean SST."""
    df = st.data
    g = df.groupby(df.index.year)
    out = pd.DataFrame({
        "max_dhw": g["dhw"].max(),
        "alert_days": g["baa"].apply(lambda s: int((s >= ALERT_1).sum())),
        "max_level": g["baa"].max(),
        "mean_sst": g.apply(lambda x: ((x["sst_min"] + x["sst_max"]) / 2).mean()),
        "n_days": g.size(),
    })
    out.index.name = "year"
    return out


def sst_trend(st: Station) -> dict:
    """Linear trend of annual mean SST over complete years, in degC per decade."""
    y = yearly(st)
    y = y[y["n_days"] >= 360]
    if len(y) < 10:
        return {"per_decade": None, "years": [int(y.index.min()), int(y.index.max())] if len(y) else None}
    slope, _ = np.polyfit(y.index.to_numpy(dtype=float), y["mean_sst"].to_numpy(), 1)
    return {"per_decade": round(float(slope) * 10, 3), "years": [int(y.index.min()), int(y.index.max())]}


def events(st: Station, min_level: int = ALERT_1, join_gap_days: int = 7) -> list[Event]:
    """Periods with Bleaching Alert Area at or above ``min_level``.

    Runs separated by fewer than ``join_gap_days`` days are merged into one event.
    """
    s = st.data["baa"]
    on = s[s >= min_level]
    if on.empty:
        return []
    evs: list[list[pd.Timestamp]] = [[on.index[0], on.index[0]]]
    for t in on.index[1:]:
        if (t - evs[-1][1]).days <= join_gap_days:
            evs[-1][1] = t
        else:
            evs.append([t, t])
    out = []
    for start, end in evs:
        win = st.data.loc[start:end]
        out.append(Event(start, end, int((end - start).days) + 1, float(win["dhw"].max()), int(win["baa"].max())))
    return out


def latest(st: Station) -> dict:
    row = st.data.iloc[-1]
    level = int(row["baa"])
    return {
        "date": st.last_date.isoformat(),
        "sst": round(float(row["sst_90"]), 2),
        "ssta": round(float(row["ssta_90"]), 2),
        "dhw": round(float(row["dhw"]), 2),
        "level": level,
        "label": ALERT_LEVELS[level],
    }


def weekly_series(st: Station) -> dict:
    """Weekly maxima, to keep the browser payload small (~2,200 points per station)."""
    w = st.data.resample("W").agg({"dhw": "max", "baa": "max", "sst_90": "mean", "ssta_90": "mean"}).dropna()
    return {
        "dates": [d.date().isoformat() for d in w.index],
        "dhw": [round(float(v), 2) for v in w["dhw"]],
        "baa": [int(v) for v in w["baa"]],
        "sst": [round(float(v), 2) for v in w["sst_90"]],
        "ssta": [round(float(v), 2) for v in w["ssta_90"]],
    }
