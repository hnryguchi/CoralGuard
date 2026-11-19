import json
from pathlib import Path

from coralguard.build import build, station_payload
from coralguard.crw import parse

FIXTURE = Path(__file__).parent / "fixtures" / "abrolhos_reefs_sample.txt"


def test_build_writes_site_and_json(tmp_path):
    st = parse(FIXTURE.read_text(encoding="utf-8"), slug="abrolhos_reefs", name="Abrolhos")
    out = build(tmp_path / "dist", [st])
    for f in ("index.html", "app.js", "style.css", "data.json", "status.svg"):
        assert (out / f).exists(), f
    data = json.loads((out / "data.json").read_text(encoding="utf-8"))
    s = data["stations"][0]
    assert s["name"] == "Abrolhos"
    assert {"latest", "yearly", "events", "weekly", "trend"} <= s.keys()
    assert data["alert_levels"]["6"] == "Alert Level 4"
    svg = (out / "status.svg").read_text(encoding="utf-8")
    assert svg.startswith("<svg") and svg.endswith("</svg>") and "Abrolhos" in svg


def test_payload_is_json_serialisable():
    st = parse(FIXTURE.read_text(encoding="utf-8"), slug="abrolhos_reefs", name="Abrolhos")
    json.dumps(station_payload(st))
