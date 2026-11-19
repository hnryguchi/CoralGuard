// CoralGuard dashboard. Reads data.json produced by the Python pipeline.
const LEVEL_COLORS = ["#7ec8d8", "#f5e400", "#f5a50a", "#e8231c", "#a10f0f", "#7a1c5c", "#4c1366", "#24093f"];
const DHW_LINES = [[4, "Alert 1"], [8, "Alert 2"], [12, "Alert 3"], [16, "Alert 4"], [20, "Alert 5"]];
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const dark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

let DATA = null, current = null, map = null, markers = {};

const $ = (id) => document.getElementById(id);
const fmt = (n, d = 1) => Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const levelChip = (lvl, label) =>
  `<span class="chip" style="background:${LEVEL_COLORS[lvl]};color:${lvl >= 4 ? "#fff" : "#111"}">${label}</span>`;

function countUp(el, target, decimals = 0) {
  if (reduceMotion) { el.textContent = fmt(target, decimals); return; }
  const t0 = performance.now(), dur = 1400;
  const step = (t) => {
    const p = Math.min(1, (t - t0) / dur), eased = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(target * eased, decimals);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function plotLayout(extra = {}) {
  const fg = dark() ? "#e6f1fb" : "#0c1a2e", grid = dark() ? "#1f3550" : "#e3ecf3";
  return Object.assign({
    paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
    font: { family: "Segoe UI, system-ui, sans-serif", color: fg, size: 12 },
    margin: { l: 56, r: 16, t: 16, b: 40 },
    xaxis: { gridcolor: grid }, yaxis: { gridcolor: grid, zeroline: false },
    hovermode: "x unified", showlegend: false,
  }, extra);
}

function renderKpis() {
  const st = DATA.stations;
  const worst = Math.max(...st.map((s) => Math.max(...s.yearly.max_dhw)));
  const events = st.reduce((a, s) => a + s.events.length, 0);
  const trends = st.map((s) => s.trend.per_decade).filter((v) => v !== null);
  const avg = trends.reduce((a, b) => a + b, 0) / trends.length;
  countUp($("kpi-worst"), worst, 1);
  countUp($("kpi-events"), events, 0);
  countUp($("kpi-trend"), avg, 2);
  $("last-date").textContent = st[0].latest.date;
  $("generated").textContent = `Built ${DATA.generated_utc.replace("T", " ")} UTC from ${DATA.source}.`;
}

function renderCards() {
  $("cards").innerHTML = DATA.stations.map((s, i) => {
    const l = s.latest;
    return `<button class="card" data-slug="${s.slug}" style="animation-delay:${i * 70}ms">
      <div class="name">${s.name}</div>
      <div class="lvl" style="color:${LEVEL_COLORS[l.level]}">
        <span class="dot ${l.level >= 1 ? "pulse" : ""}" style="background:${LEVEL_COLORS[l.level]}"></span>
        <span style="color:var(--fg)">${l.label}</span></div>
      <div class="meta">DHW ${fmt(l.dhw)} · SST anomaly ${l.ssta >= 0 ? "+" : ""}${fmt(l.ssta, 2)} °C</div>
    </button>`;
  }).join("");
  document.querySelectorAll(".card").forEach((c) => c.addEventListener("click", () => select(c.dataset.slug)));
}

function renderMap() {
  map = L.map("map", { scrollWheelZoom: false }).setView([-12, -38], 4);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 9, attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);
  DATA.stations.forEach((s) => {
    const m = L.circleMarker([s.lat, s.lon], {
      radius: 9, color: "#0c1a2e", weight: 1.5, fillColor: LEVEL_COLORS[s.latest.level], fillOpacity: 0.95,
    }).addTo(map).bindTooltip(`${s.name}: ${s.latest.label}`);
    m.on("click", () => select(s.slug));
    markers[s.slug] = m;
  });
}

function renderFacts(s) {
  const y = s.yearly, worstIdx = y.max_dhw.indexOf(Math.max(...y.max_dhw));
  const alertDays = y.alert_days.reduce((a, b) => a + b, 0);
  $("facts").innerHTML = `
    <h3>${s.name}</h3>
    <div class="coords">${Math.abs(s.lat).toFixed(2)}°S, ${Math.abs(s.lon).toFixed(2)}°W · usual summer max ${fmt(s.mmm, 2)} °C</div>
    <dl>
      <dt>Now</dt><dd>${levelChip(s.latest.level, s.latest.label)}</dd>
      <dt>Worst year</dt><dd>${y.years[worstIdx]} · DHW ${fmt(y.max_dhw[worstIdx])}</dd>
      <dt>Days at Alert 1+</dt><dd>${alertDays.toLocaleString("en-US")} since ${y.years[0]}</dd>
      <dt>Alert events</dt><dd>${s.events.length}</dd>
      <dt>SST trend</dt><dd>${s.trend.per_decade === null ? "n/a" : (s.trend.per_decade >= 0 ? "+" : "") + fmt(s.trend.per_decade, 2) + " °C / decade"}
        <span class="small">(${s.trend.years ? s.trend.years.join("–") : ""})</span></dd>
    </dl>`;
}

function renderChart(s) {
  const w = s.weekly;
  const shapes = DHW_LINES.map(([v]) => ({
    type: "line", xref: "paper", x0: 0, x1: 1, y0: v, y1: v, line: { color: LEVEL_COLORS[DHW_LINES.findIndex((d) => d[0] === v) + 3], width: 1, dash: "dot" },
  }));
  const annotations = DHW_LINES.map(([v, name]) => ({
    xref: "paper", x: 1, xanchor: "right", y: v, yanchor: "bottom", text: name, showarrow: false, font: { size: 10 },
  }));
  const trace = {
    x: w.dates, y: w.dhw, type: "scatter", mode: "lines", name: "DHW",
    line: { color: "#e8231c", width: 1.6, shape: "spline", smoothing: 0.3 }, fill: "tozeroy", fillcolor: "rgba(232,35,28,.15)",
    hovertemplate: "%{x|%b %d, %Y}<br>DHW %{y:.1f} °C-weeks<extra></extra>",
  };
  const layout = plotLayout({
    shapes, annotations,
    yaxis: { title: "DHW (°C-weeks)", rangemode: "tozero", gridcolor: dark() ? "#1f3550" : "#e3ecf3" },
    xaxis: { rangeslider: { visible: true, thickness: 0.08 }, type: "date", gridcolor: dark() ? "#1f3550" : "#e3ecf3" },
  });
  $("chart-title").textContent = `Heat stress over time: ${s.name}`;
  Plotly.react("chart", [trace], layout, { responsive: true, displaylogo: false })
    .then(() => { if (!reduceMotion) Plotly.animate("chart", { data: [trace] }, { transition: { duration: 500 } }); });
}

function renderHeatmap() {
  const st = DATA.stations;
  const years = st[0].yearly.years;
  const z = st.map((s) => years.map((yr) => { const i = s.yearly.years.indexOf(yr); return i < 0 ? null : s.yearly.max_dhw[i]; }));
  Plotly.react("heatmap", [{
    type: "heatmap", x: years, y: st.map((s) => s.name), z,
    colorscale: [[0, "#e6f4f8"], [0.2, "#f5e400"], [0.4, "#f5a50a"], [0.6, "#e8231c"], [0.8, "#a10f0f"], [1, "#24093f"]],
    zmin: 0, zmax: 20, colorbar: { title: { text: "DHW" }, thickness: 12 },
    hovertemplate: "%{y} · %{x}<br>max DHW %{z:.1f}<extra></extra>", xgap: 1, ygap: 2,
  }], plotLayout({ margin: { l: 150, r: 16, t: 10, b: 30 }, hovermode: "closest" }), { responsive: true, displaylogo: false });
  document.getElementById("heatmap").on("plotly_click", (ev) => {
    const name = ev.points[0].y; const s = st.find((x) => x.name === name); if (s) select(s.slug);
  });
}

function renderEvents(s) {
  $("events-title").textContent = `Strongest heat-stress events: ${s.name}`;
  const rows = s.events.slice(0, 10).map((e) =>
    `<tr><td>${e.start}</td><td>${e.end}</td><td>${e.days}</td><td>${fmt(e.peak_dhw)}</td><td>${levelChip(e.peak_level, e.peak_label)}</td></tr>`);
  document.querySelector("#events tbody").innerHTML = rows.join("") || `<tr><td colspan="5">No alert-level events.</td></tr>`;
}

function select(slug) {
  current = DATA.stations.find((s) => s.slug === slug);
  document.querySelectorAll(".card").forEach((c) => c.classList.toggle("active", c.dataset.slug === slug));
  Object.entries(markers).forEach(([k, m]) => m.setStyle({ weight: k === slug ? 4 : 1.5, radius: k === slug ? 12 : 9 }));
  if (map) map.flyTo([current.lat, current.lon], 5, { duration: reduceMotion ? 0 : 0.8 });
  renderFacts(current); renderChart(current); renderEvents(current);
  history.replaceState(null, "", `#${slug}`);
}

fetch("data.json").then((r) => r.json()).then((d) => {
  DATA = d;
  renderKpis(); renderCards(); renderMap(); renderHeatmap();
  const fromHash = location.hash.slice(1);
  const initial = d.stations.find((s) => s.slug === fromHash) ||
    d.stations.reduce((a, b) => (Math.max(...b.yearly.max_dhw) > Math.max(...a.yearly.max_dhw) ? b : a));
  select(initial.slug);
}).catch((e) => {
  document.querySelector("main").insertAdjacentHTML("afterbegin", `<p>Could not load data: ${e}</p>`);
});
