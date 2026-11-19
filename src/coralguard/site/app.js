// CoralGuard dashboard (PT / EN). Reads data.json produced by the Python pipeline.
const LEVEL_COLORS = ["#7ec8d8", "#f5e400", "#f5a50a", "#e8231c", "#a10f0f", "#7a1c5c", "#4c1366", "#24093f"];
const DHW_LINES = [4, 8, 12, 16, 20];
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const dark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

const I18N = {
  en: {
    title: "How hot is the sea over Brazil's coral reefs?",
    lede: "Satellite heat stress for the 7 reef regions that NOAA Coral Reef Watch monitors in Brazil, every day since 1985.",
    dataThrough: "Data through", rebuilt: "rebuilt daily",
    kpiWorst: "highest heat stress recorded (DHW, °C-weeks)", kpiEvents: "alert-level events since 1985, all reefs",
    kpiTrend: "average warming, °C per decade",
    nowTitle: "Right now", nowHint: "Latest 7-day maximum alert level per reef. Click a reef to explore it.",
    chartTitle: "Heat stress over time", chartHint:
      "Degree Heating Weeks (DHW) accumulate heat above the reef's usual summer maximum. CRW alert thresholds: 4 (Alert 1, bleaching likely), 8, 12, 16 and 20 (Alert 5). Drag the slider to zoom.",
    heatTitle: "Every year, every reef", heatHint: "Highest DHW reached in each year. Darker means more heat stress.",
    eventsTitle: "Strongest heat-stress events", thStart: "Start", thEnd: "End", thDays: "Days", thPeakDhw: "Peak DHW", thPeakLevel: "Peak level",
    noEvents: "No alert-level events.",
    aboutTitle: "About the data",
    aboutSource: "<b>Source:</b> NOAA Coral Reef Watch (CRW), Version 3.1 daily global 5 km satellite coral bleaching heat stress products, Regional Virtual Stations. Public domain.",
    aboutWhat: "<b>What it is:</b> satellite-derived sea surface temperature and heat stress indicators that <i>predict</i> bleaching risk. They are not in-water observations of bleaching.",
    aboutProcessing: "<b>Processing:</b> daily station files are downloaded, parsed and summarised (weekly maxima, yearly maxima, alert-level events, linear SST trend over complete years) by a Python pipeline that runs every day on GitHub Actions.",
    aboutCode: "<b>Code:</b> <a href=\"https://github.com/hnryguchi/CoralGuard\">github.com/hnryguchi/CoralGuard</a> · built by Henry Noguchi.",
    built: (d, src) => `Built ${d} UTC from ${src}.`,
    now: "Now", worstYear: "Worst year", alertDays: "Days at Alert 1+", since: "since", alertEvents: "Alert events",
    sstTrend: "SST trend", perDecade: "°C / decade", usualMax: "usual summer max", anomaly: "SST anomaly",
    hoverDhw: "DHW %{y:.1f} °C-weeks", hoverHeat: "max DHW", dateFmt: "%b %d, %Y", alertShort: "Alert", yTitle: "DHW (°C-weeks)",
    levels: ["No Stress", "Bleaching Watch", "Bleaching Warning", "Alert Level 1", "Alert Level 2", "Alert Level 3", "Alert Level 4", "Alert Level 5"],
    loadError: "Could not load data:",
  },
  pt: {
    title: "Quão quente está o mar sobre os recifes de coral do Brasil?",
    lede: "Estresse térmico medido por satélite nas 7 regiões de recifes que o NOAA Coral Reef Watch monitora no Brasil, todos os dias desde 1985.",
    dataThrough: "Dados até", rebuilt: "atualizado diariamente",
    kpiWorst: "maior estresse térmico registrado (DHW, °C-semana)", kpiEvents: "eventos em nível de alerta desde 1985, todos os recifes",
    kpiTrend: "aquecimento médio, °C por década",
    nowTitle: "Agora", nowHint: "Nível de alerta máximo dos últimos 7 dias em cada recife. Clique em um recife para explorá-lo.",
    chartTitle: "Estresse térmico ao longo do tempo", chartHint:
      "As Semanas de Aquecimento (DHW) acumulam o calor acima do máximo de verão habitual do recife. Limites de alerta do CRW: 4 (Alerta 1, branqueamento provável), 8, 12, 16 e 20 (Alerta 5). Arraste o seletor para dar zoom.",
    heatTitle: "Cada ano, cada recife", heatHint: "Maior DHW atingido em cada ano. Quanto mais escuro, maior o estresse térmico.",
    eventsTitle: "Eventos de estresse térmico mais fortes", thStart: "Início", thEnd: "Fim", thDays: "Dias", thPeakDhw: "DHW máximo", thPeakLevel: "Nível máximo",
    noEvents: "Nenhum evento em nível de alerta.",
    aboutTitle: "Sobre os dados",
    aboutSource: "<b>Fonte:</b> NOAA Coral Reef Watch (CRW), produtos diários globais de 5 km de estresse térmico para branqueamento de corais, Versão 3.1, Estações Virtuais Regionais. Domínio público.",
    aboutWhat: "<b>O que é:</b> temperatura da superfície do mar e indicadores de estresse térmico derivados de satélite, que <i>preveem</i> o risco de branqueamento. Não são observações de branqueamento feitas no mar.",
    aboutProcessing: "<b>Processamento:</b> os arquivos diários das estações são baixados, lidos e resumidos (máximos semanais e anuais, eventos em nível de alerta, tendência linear da temperatura em anos completos) por um pipeline em Python que roda todos os dias no GitHub Actions.",
    aboutCode: "<b>Código:</b> <a href=\"https://github.com/hnryguchi/CoralGuard\">github.com/hnryguchi/CoralGuard</a> · feito por Henry Noguchi.",
    built: (d, src) => `Gerado em ${d} UTC a partir de ${src}.`,
    now: "Agora", worstYear: "Pior ano", alertDays: "Dias em Alerta 1+", since: "desde", alertEvents: "Eventos de alerta",
    sstTrend: "Tendência da temperatura", perDecade: "°C / década", usualMax: "máximo de verão habitual", anomaly: "anomalia de temperatura",
    hoverDhw: "DHW %{y:.1f} °C-semana", hoverHeat: "DHW máximo", dateFmt: "%d/%m/%Y", alertShort: "Alerta", yTitle: "DHW (°C-semana)",
    levels: ["Sem estresse", "Vigilância", "Aviso de branqueamento", "Alerta nível 1", "Alerta nível 2", "Alerta nível 3", "Alerta nível 4", "Alerta nível 5"],
    loadError: "Não foi possível carregar os dados:",
  },
};

let DATA = null, current = null, map = null;
const markers = {};
let lang = (() => {
  try { const s = localStorage.getItem("cg-lang"); if (s === "pt" || s === "en") return s; } catch (e) { /* storage blocked */ }
  return (navigator.language || "en").toLowerCase().startsWith("pt") ? "pt" : "en";
})();
const t = (k) => I18N[lang][k];

const $ = (id) => document.getElementById(id);
const locale = () => (lang === "pt" ? "pt-BR" : "en-US");
const fmt = (n, d = 1) => Number(n).toLocaleString(locale(), { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtDate = (iso) => new Date(iso + "T12:00:00Z").toLocaleDateString(locale(), { timeZone: "UTC" });
const levelLabel = (lvl) => t("levels")[lvl];
const levelChip = (lvl) =>
  `<span class="chip" style="background:${LEVEL_COLORS[lvl]};color:${lvl >= 4 ? "#fff" : "#111"}">${levelLabel(lvl)}</span>`;

function countUp(el, target, decimals = 0) {
  if (reduceMotion) { el.textContent = fmt(target, decimals); return; }
  const t0 = performance.now(), dur = 1400;
  const step = (now) => {
    const p = Math.min(1, (now - t0) / dur), eased = 1 - Math.pow(1 - p, 3);
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
    hovermode: "x unified", showlegend: false, separators: lang === "pt" ? ",." : ".,",
  }, extra);
}

function applyStaticText() {
  document.documentElement.lang = lang === "pt" ? "pt-BR" : "en";
  document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll("[data-i18n-html]").forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
  document.querySelectorAll(".lang button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
}

function renderKpis(animate) {
  const st = DATA.stations;
  const worst = Math.max(...st.map((s) => Math.max(...s.yearly.max_dhw)));
  const events = st.reduce((a, s) => a + s.events.length, 0);
  const trends = st.map((s) => s.trend.per_decade).filter((v) => v !== null);
  const avg = trends.reduce((a, b) => a + b, 0) / trends.length;
  const set = (el, v, d) => { if (animate) countUp(el, v, d); else el.textContent = fmt(v, d); };
  set($("kpi-worst"), worst, 1); set($("kpi-events"), events, 0); set($("kpi-trend"), avg, 2);
  $("last-date").textContent = fmtDate(st[0].latest.date);
  $("generated").textContent = t("built")(DATA.generated_utc.replace("T", " "), DATA.source);
}

function renderCards() {
  $("cards").innerHTML = DATA.stations.map((s, i) => {
    const l = s.latest;
    const active = current && current.slug === s.slug ? "active" : "";
    return `<button class="card ${active}" data-slug="${s.slug}" style="animation-delay:${i * 70}ms">
      <div class="name">${s.name}</div>
      <div class="lvl" style="color:${LEVEL_COLORS[l.level]}">
        <span class="dot ${l.level >= 1 ? "pulse" : ""}" style="background:${LEVEL_COLORS[l.level]}"></span>
        <span style="color:var(--fg)">${levelLabel(l.level)}</span></div>
      <div class="meta">DHW ${fmt(l.dhw)} · ${t("anomaly")} ${l.ssta >= 0 ? "+" : ""}${fmt(l.ssta, 2)} °C</div>
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
    }).addTo(map);
    m.on("click", () => select(s.slug));
    markers[s.slug] = m;
  });
  updateMapTooltips();
}

function updateMapTooltips() {
  DATA.stations.forEach((s) => markers[s.slug].unbindTooltip().bindTooltip(`${s.name}: ${levelLabel(s.latest.level)}`));
}

function renderFacts(s) {
  const y = s.yearly, worstIdx = y.max_dhw.indexOf(Math.max(...y.max_dhw));
  const alertDays = y.alert_days.reduce((a, b) => a + b, 0);
  const tr = s.trend.per_decade;
  $("facts").innerHTML = `
    <h3>${s.name}</h3>
    <div class="coords">${Math.abs(s.lat).toFixed(2)}°S, ${Math.abs(s.lon).toFixed(2)}°W · ${t("usualMax")} ${fmt(s.mmm, 2)} °C</div>
    <dl>
      <dt>${t("now")}</dt><dd>${levelChip(s.latest.level)}</dd>
      <dt>${t("worstYear")}</dt><dd>${y.years[worstIdx]} · DHW ${fmt(y.max_dhw[worstIdx])}</dd>
      <dt>${t("alertDays")}</dt><dd>${alertDays.toLocaleString(locale())} ${t("since")} ${y.years[0]}</dd>
      <dt>${t("alertEvents")}</dt><dd>${s.events.length}</dd>
      <dt>${t("sstTrend")}</dt><dd>${tr === null ? "n/a" : (tr >= 0 ? "+" : "") + fmt(tr, 2) + " " + t("perDecade")}
        <span class="small">(${s.trend.years ? s.trend.years.join("–") : ""})</span></dd>
    </dl>`;
}

function renderChart(s, animate) {
  const w = s.weekly;
  const grid = dark() ? "#1f3550" : "#e3ecf3";
  const shapes = DHW_LINES.map((v, i) => ({
    type: "line", xref: "paper", x0: 0, x1: 1, y0: v, y1: v, line: { color: LEVEL_COLORS[i + 3], width: 1, dash: "dot" },
  }));
  const annotations = DHW_LINES.map((v, i) => ({
    xref: "paper", x: 1, xanchor: "right", y: v, yanchor: "bottom", text: `${t("alertShort")} ${i + 1}`, showarrow: false, font: { size: 10 },
  }));
  const trace = {
    x: w.dates, y: w.dhw, type: "scatter", mode: "lines", name: "DHW",
    line: { color: "#e8231c", width: 1.6, shape: "spline", smoothing: 0.3 }, fill: "tozeroy", fillcolor: "rgba(232,35,28,.15)",
    hovertemplate: `%{x|${t("dateFmt")}}<br>${t("hoverDhw")}<extra></extra>`,
  };
  const layout = plotLayout({
    shapes, annotations,
    yaxis: { title: t("yTitle"), rangemode: "tozero", gridcolor: grid },
    xaxis: { rangeslider: { visible: true, thickness: 0.08 }, type: "date", gridcolor: grid },
  });
  $("chart-title").textContent = `${t("chartTitle")}: ${s.name}`;
  Plotly.react("chart", [trace], layout, { responsive: true, displaylogo: false })
    .then(() => { if (animate && !reduceMotion) Plotly.animate("chart", { data: [trace] }, { transition: { duration: 500 } }); });
}

function renderHeatmap() {
  const st = DATA.stations;
  const years = st[0].yearly.years;
  const z = st.map((s) => years.map((yr) => { const i = s.yearly.years.indexOf(yr); return i < 0 ? null : s.yearly.max_dhw[i]; }));
  Plotly.react("heatmap", [{
    type: "heatmap", x: years, y: st.map((s) => s.name), z,
    colorscale: [[0, "#e6f4f8"], [0.2, "#f5e400"], [0.4, "#f5a50a"], [0.6, "#e8231c"], [0.8, "#a10f0f"], [1, "#24093f"]],
    zmin: 0, zmax: 20, colorbar: { title: { text: "DHW" }, thickness: 12 },
    hovertemplate: `%{y} · %{x}<br>${t("hoverHeat")} %{z:.1f}<extra></extra>`, xgap: 1, ygap: 2,
  }], plotLayout({ margin: { l: 150, r: 16, t: 10, b: 30 }, hovermode: "closest" }), { responsive: true, displaylogo: false });
}

function renderEvents(s) {
  $("events-title").textContent = `${t("eventsTitle")}: ${s.name}`;
  const rows = s.events.slice(0, 10).map((e) =>
    `<tr><td>${fmtDate(e.start)}</td><td>${fmtDate(e.end)}</td><td>${e.days}</td><td>${fmt(e.peak_dhw)}</td><td>${levelChip(e.peak_level)}</td></tr>`);
  document.querySelector("#events tbody").innerHTML = rows.join("") || `<tr><td colspan="5">${t("noEvents")}</td></tr>`;
}

function select(slug, { animate = true } = {}) {
  current = DATA.stations.find((s) => s.slug === slug);
  document.querySelectorAll(".card").forEach((c) => c.classList.toggle("active", c.dataset.slug === slug));
  Object.entries(markers).forEach(([k, m]) => m.setStyle({ weight: k === slug ? 4 : 1.5, radius: k === slug ? 12 : 9 }));
  if (map && animate) map.flyTo([current.lat, current.lon], 5, { duration: reduceMotion ? 0 : 0.8 });
  renderFacts(current); renderChart(current, animate); renderEvents(current);
  history.replaceState(null, "", `#${slug}`);
}

function setLang(next) {
  if (next === lang) return;
  lang = next;
  try { localStorage.setItem("cg-lang", lang); } catch (e) { /* storage blocked */ }
  document.body.classList.add("switching");
  setTimeout(() => {
    applyStaticText();
    if (DATA) { renderKpis(false); renderCards(); updateMapTooltips(); renderHeatmap(); select(current.slug, { animate: false }); }
    document.body.classList.remove("switching");
  }, reduceMotion ? 0 : 180);
}

document.querySelectorAll(".lang button").forEach((b) => b.addEventListener("click", () => setLang(b.dataset.lang)));
applyStaticText();

fetch("data.json").then((r) => r.json()).then((d) => {
  DATA = d;
  renderKpis(true); renderCards(); renderMap(); renderHeatmap();
  document.getElementById("heatmap").on("plotly_click", (ev) => {
    const s = DATA.stations.find((x) => x.name === ev.points[0].y); if (s) select(s.slug);
  });
  const fromHash = location.hash.slice(1);
  const initial = d.stations.find((s) => s.slug === fromHash) ||
    d.stations.reduce((a, b) => (Math.max(...b.yearly.max_dhw) > Math.max(...a.yearly.max_dhw) ? b : a));
  select(initial.slug);
}).catch((e) => {
  document.querySelector("main").insertAdjacentHTML("afterbegin", `<p>${t("loadError")} ${e}</p>`);
});
