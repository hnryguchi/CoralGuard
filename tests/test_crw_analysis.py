from pathlib import Path

import pandas as pd
import pytest

from coralguard import analysis
from coralguard.crw import ALERT_1, BRAZIL_STATIONS, Station, parse

FIXTURE = Path(__file__).parent / "fixtures" / "abrolhos_reefs_sample.txt"


@pytest.fixture
def abrolhos() -> Station:
    """Real NOAA CRW data for Abrolhos: all of 2019 plus Oct-Nov 2026 (public domain)."""
    return parse(FIXTURE.read_text(encoding="utf-8"), slug="abrolhos_reefs", name="Abrolhos")


def test_parse_header_and_table(abrolhos):
    assert abrolhos.lat == pytest.approx(-17.225)
    assert abrolhos.lon == pytest.approx(-39.0)
    assert abrolhos.mmm == pytest.approx(26.9552)
    assert len(abrolhos.monthly_mean) == 12
    assert abrolhos.data.index.is_monotonic_increasing
    assert list(abrolhos.data.columns) == ["sst_min", "sst_max", "sst_90", "ssta_90", "hotspot_90", "dhw", "baa"]
    assert abrolhos.data["baa"].between(0, 7).all()


def test_parse_rejects_other_files():
    with pytest.raises(ValueError):
        parse("hello\nworld\n")


def test_2019_was_a_severe_year_at_abrolhos(abrolhos):
    y = analysis.yearly(abrolhos)
    assert y.loc[2019, "max_dhw"] > 16  # Alert Level 4 territory
    assert y.loc[2019, "max_level"] == 6
    assert y.loc[2019, "alert_days"] > 60


def test_events_are_merged_and_ranked(abrolhos):
    evs = analysis.events(abrolhos)
    assert evs, "2019 should contain alert-level events"
    for e in evs:
        assert e.peak_level >= ALERT_1
        assert e.days == (e.end - e.start).days + 1
    starts = [e.start for e in evs]
    assert starts == sorted(starts)


def test_events_join_short_gaps():
    idx = pd.date_range("2020-01-01", periods=30, freq="D")
    baa = [0] * 5 + [3] * 5 + [0] * 3 + [4] * 5 + [0] * 12  # gap of 3 days -> one event
    df = pd.DataFrame({"sst_min": 0.0, "sst_max": 0.0, "sst_90": 0.0, "ssta_90": 0.0, "hotspot_90": 0.0,
                       "dhw": range(30), "baa": baa}, index=idx)
    st = Station("synthetic", "Synthetic", 0, 0, 0, [0] * 12, df)
    evs = analysis.events(st)
    assert len(evs) == 1 and evs[0].peak_level == 4 and evs[0].days == 13


def test_latest_and_weekly(abrolhos):
    lat = analysis.latest(abrolhos)
    assert lat["date"] == abrolhos.data.index[-1].date().isoformat()
    w = analysis.weekly_series(abrolhos)
    assert len(w["dates"]) == len(w["dhw"]) == len(w["baa"])
    assert max(w["baa"]) == 6


def test_trend_needs_ten_years(abrolhos):
    assert analysis.sst_trend(abrolhos)["per_decade"] is None  # fixture has only one complete year


def test_station_list_is_brazil():
    assert len(BRAZIL_STATIONS) == 7
    assert "abrolhos_reefs" in BRAZIL_STATIONS
