// CoralGuard dashboard (PT / EN). Reads data.json produced by the Python pipeline.
const LEVEL_COLORS = ["#7ec8d8", "#f5e400", "#f5a50a", "#e8231c", "#a10f0f", "#7a1c5c", "#4c1366", "#24093f"];
const DHW_LINES = [4, 8, 12, 16, 20];
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const dark = () => true; // brand theme is always dark

const I18N = {
  en: {
    title: "Heat stress on Brazil's coral reefs, since 1985",
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
    hudDhw: "DHW (°C-weeks)", hudSsta: "SST anomaly", hudSst: "SST", hudNow: "now", hudReplay: "replay",
    replayHint: "Replay 1985 to today: the 3D sea warms with the reef's measured heat stress.",
    stripesTitle: "Warming stripes", stripesHint: "Annual mean sea surface temperature of each reef, relative to its own average over the full record. Blue: cooler years; red: warmer.",
    hoverStripe: "vs. average",
  },
  pt: {
    title: "Estresse térmico nos recifes de coral do Brasil, desde 1985",
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
    hudDhw: "DHW (°C-semana)", hudSsta: "anomalia TSM", hudSst: "TSM", hudNow: "agora", hudReplay: "replay",
    replayHint: "Reproduza de 1985 até hoje: o mar 3D esquenta com o estresse térmico medido no recife.",
    stripesTitle: "Faixas de aquecimento", stripesHint: "Temperatura média anual da superfície do mar em cada recife, relativa à média do próprio recife em todo o registro. Azul: anos mais frios; vermelho: mais quentes.",
    hoverStripe: "vs. média",
  },
};

let DATA = null, current = null, globeRotating = true;
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
  const fg = "#c6e2f3", grid = "#16324f";
  return Object.assign({
    paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
    font: { family: "Inter, system-ui, sans-serif", color: fg, size: 12 },
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

function renderGlobe() {
  const st = DATA.stations;
  const sel = (s) => current && s.slug === current.slug;
  const trace = {
    type: "scattergeo", lon: st.map((s) => s.lon), lat: st.map((s) => s.lat), customdata: st.map((s) => s.slug),
    text: st.map((s) => `${s.name}: ${levelLabel(s.latest.level)}`), hoverinfo: "text", mode: "markers",
    marker: { size: st.map((s) => (sel(s) ? 16 : 11)), color: st.map((s) => LEVEL_COLORS[s.latest.level]),
      line: { color: "#e8f4fd", width: st.map((s) => (sel(s) ? 3 : 1)) } },
  };
  const rot = current ? { lon: current.lon, lat: current.lat * 0.6 } : { lon: -40, lat: -12 };
  const layout = {
    paper_bgcolor: "rgba(0,0,0,0)", margin: { l: 0, r: 0, t: 0, b: 0 }, showlegend: false, dragmode: "pan",
    font: { family: "Inter, system-ui, sans-serif", color: "#c6e2f3" },
    geo: {
      projection: { type: "orthographic", rotation: rot, scale: 1.05 }, bgcolor: "rgba(0,0,0,0)",
      showocean: true, oceancolor: "#082a46", showland: true, landcolor: "#12304d", showcountries: true, countrycolor: "#24507a",
      showcoastlines: true, coastlinecolor: "#3a86ad", showframe: false,
      lataxis: { showgrid: true, gridcolor: "#0f3557" }, lonaxis: { showgrid: true, gridcolor: "#0f3557" },
    },
  };
  Plotly.react("globe", [trace], layout, { responsive: true, displaylogo: false, displayModeBar: false });
}

function spinGlobe() {
  const el = $("globe");
  el.addEventListener("pointerdown", () => { globeRotating = false; });
  el.on("plotly_click", (ev) => { globeRotating = false; select(ev.points[0].customdata); });
  if (reduceMotion) return;
  let lon = current ? current.lon : -40;
  const step = () => {
    if (!globeRotating) return;
    lon = ((lon + 0.25 + 180) % 360) - 180;
    Plotly.relayout("globe", { "geo.projection.rotation.lon": lon });
    setTimeout(step, 60);
  };
  setTimeout(step, 1500);
}

function renderStripes() {
  const st = DATA.stations;
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const rows = st.map((s) => {
    const byYear = {};
    s.weekly.dates.forEach((d, i) => {
      const v = s.weekly.sst[i];
      if (v == null) return;
      const y = +d.slice(0, 4);
      (byYear[y] = byYear[y] || []).push(v);
    });
    const years = Object.keys(byYear).map(Number).filter((y) => byYear[y].length >= 50).sort((a, b) => a - b);
    const annual = years.map((y) => mean(byYear[y]));
    const ref = mean(annual);
    return { years, anom: annual.map((v) => v - ref) };
  });
  const years = [...new Set(rows.flatMap((r) => r.years))].sort((a, b) => a - b);
  const z = rows.map((r) => years.map((y) => { const i = r.years.indexOf(y); return i < 0 ? null : r.anom[i]; }));
  Plotly.react("stripes", [{
    type: "heatmap", x: years, y: st.map((s) => s.name), z, zmid: 0, zmin: -0.8, zmax: 0.8,
    colorscale: [[0, "#08306b"], [0.2, "#2171b5"], [0.4, "#9ecae1"], [0.5, "#f7f7f7"], [0.6, "#fcbba1"], [0.8, "#ef3b2c"], [1, "#67000d"]],
    colorbar: { title: { text: "°C" }, thickness: 12 }, xgap: 0, ygap: 3,
    hovertemplate: `%{y} · %{x}<br>%{z:+.2f} °C ${t("hoverStripe")}<extra></extra>`,
  }], plotLayout({ margin: { l: 150, r: 16, t: 10, b: 30 }, hovermode: "closest" }), { responsive: true, displaylogo: false });
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
  const grid = "#16324f";
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
  baseShapes = shapes;
  const layout = plotLayout({
    shapes: shapes.concat(cursorShape()), annotations,
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
  renderGlobe();
  renderFacts(current); renderChart(current, animate); renderEvents(current);
  history.replaceState(null, "", `#${slug}`);
  stopReplay(); $("scrub").value = 1000; setWeek(current.weekly.dates.length - 1, { force: true });
}

function setLang(next) {
  if (next === lang) return;
  lang = next;
  try { localStorage.setItem("cg-lang", lang); } catch (e) { /* storage blocked */ }
  document.body.classList.add("switching");
  setTimeout(() => {
    applyStaticText();
    if (DATA) { renderKpis(false); renderCards(); renderHeatmap(); renderStripes(); select(current.slug, { animate: false }); }
    document.body.classList.remove("switching");
  }, reduceMotion ? 0 : 180);
}

// ---- live 3D sea + replay (1985 to today) ---------------------------------------------------
const ocean = window.Ocean3D ? Ocean3D.mount(document.querySelector(".hero")) : { set() {} };
let baseShapes = [], cursorIdx = null, playing = false, lastRelayout = 0;

function cursorShape() {
  if (!current || cursorIdx === null) return [];
  const x = current.weekly.dates[cursorIdx];
  return [{ type: "line", xref: "x", yref: "paper", x0: x, x1: x, y0: 0, y1: 1, line: { color: "#2dd4bf", width: 2 } }];
}
function setWeek(i, { force = false } = {}) {
  if (!current) return;
  const w = current.weekly;
  i = Math.max(0, Math.min(w.dates.length - 1, i)); cursorIdx = i;
  const live = i === w.dates.length - 1, lvl = w.baa[i], dhw = w.dhw[i], ssta = w.ssta[i], sst = w.sst[i];
  $("hud-title").textContent = `${live ? t("hudNow") : t("hudReplay")} · ${current.name}`;
  $("hud-time").textContent = fmtDate(w.dates[i]);
  $("hud-dhw").textContent = dhw == null ? "–" : fmt(dhw);
  $("hud-ssta").textContent = ssta == null ? "–" : `${ssta >= 0 ? "+" : ""}${fmt(ssta)}°`;
  $("hud-sst").textContent = sst == null ? "–" : `${fmt(sst)}°`;
  $("hud-level").innerHTML = `<span class="sw" style="background:${LEVEL_COLORS[lvl]};color:${LEVEL_COLORS[lvl]}"></span>${levelLabel(lvl)}`;
  ocean.set({ waveHeight: 1.6, wind: 7, warmth: Math.min(1, (dhw || 0) / 12 + Math.max(0, ssta || 0) * 0.12) });
  const now = performance.now();
  if (force || now - lastRelayout > 120) { lastRelayout = now; Plotly.relayout("chart", { shapes: baseShapes.concat(cursorShape()) }); }
}
function stopReplay() { playing = false; $("play").classList.remove("on"); $("play").setAttribute("aria-label", "Play"); }
function startReplay() {
  if (!current) return;
  if (Number($("scrub").value) >= 1000) $("scrub").value = 0;
  playing = true; $("play").classList.add("on"); $("play").setAttribute("aria-label", "Pause");
  let prev = performance.now();
  const n = current.weekly.dates.length - 1;
  const tick = (now) => {
    if (!playing) return;
    const v = Math.min(1000, Number($("scrub").value) + (now - prev) / 40000 * 1000);   // ~40 years in ~40 s
    prev = now; $("scrub").value = v; setWeek(Math.round((v / 1000) * n));
    if (v >= 1000) { stopReplay(); setWeek(n, { force: true }); return; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
$("play").addEventListener("click", () => (playing ? stopReplay() : startReplay()));
$("scrub").addEventListener("input", () => {
  if (!current) return;
  stopReplay();
  setWeek(Math.round((Number($("scrub").value) / 1000) * (current.weekly.dates.length - 1)));
});

document.querySelectorAll(".lang button").forEach((b) => b.addEventListener("click", () => setLang(b.dataset.lang)));
applyStaticText();


fetch("data.json").then((r) => r.json()).then((d) => {
  DATA = d;
  renderKpis(true); renderCards(); renderHeatmap(); renderStripes();
  document.getElementById("heatmap").on("plotly_click", (ev) => {
    const s = DATA.stations.find((x) => x.name === ev.points[0].y); if (s) select(s.slug);
  });
  const fromHash = location.hash.slice(1);
  const initial = d.stations.find((s) => s.slug === fromHash) ||
    d.stations.reduce((a, b) => (Math.max(...b.yearly.max_dhw) > Math.max(...a.yearly.max_dhw) ? b : a));
  select(initial.slug);
  spinGlobe();
}).catch((e) => {
  document.querySelector("main").insertAdjacentHTML("afterbegin", `<p>${t("loadError")} ${e}</p>`);
});
