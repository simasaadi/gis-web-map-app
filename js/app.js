/**
 * GIS Web Map App (Leaflet)
 * Build: 20260220004647
 * Loads Canada populated places GeoJSON from Repo #1 and styles points by POP_MAX.
 */

const BUILD = "20260220004647";

// Data sources (Repo #1 output)
const DATA_URL_PRIMARY =
  "https://cdn.jsdelivr.net/gh/simasaadi/gis-spatial-data-engineering@main/data/outputs/web/ne_10m_populated_places_canada.geojson";

const DATA_URL_FALLBACK =
  "https://raw.githubusercontent.com/simasaadi/gis-spatial-data-engineering/main/data/outputs/web/ne_10m_populated_places_canada.geojson";

const statusEl = document.getElementById("status");
const btnHome = document.getElementById("btn-home");
const btnToggle = document.getElementById("btn-toggle");
const minpopEl = document.getElementById("minpop");
const minpopValEl = document.getElementById("minpopVal");
const qEl = document.getElementById("q");
const kpiCountEl = document.getElementById("kpiCount");
const kpiMsEl = document.getElementById("kpiMs");
const sourceEl = document.getElementById("source");

function setStatus(s) {
  statusEl.textContent = String(s ?? "");
}

function toNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function fmt(n) {
  return toNum(n).toLocaleString();
}

function getName(p) {
  return p?.NAME ?? p?.name ?? "Place";
}

function getPop(p) {
  return toNum(p?.POP_MAX ?? p?.pop_max ?? p?.POP ?? p?.population);
}

// Symbology
function popRadius(pop) {
  // sqrt scaling (proportional symbol)
  const r = Math.sqrt(Math.max(pop, 0)) * 0.01;
  return Math.max(2.5, Math.min(18, r));
}

function popColor(pop) {
  if (pop >= 1000000) return "#6a00ff";
  if (pop >= 250000) return "#2563eb";
  if (pop >= 100000) return "#0ea5e9";
  if (pop >= 25000)  return "#22c55e";
  if (pop >= 5000)   return "#84cc16";
  return "#a3a3a3";
}

// Map
const map = L.map("map", { preferCanvas: true })
  .setView([56.1304, -106.3468], 3);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap contributors",
}).addTo(map);

L.control.scale({ metric: true, imperial: false }).addTo(map);

let overlayVisible = true;
let overlay = L.layerGroup().addTo(map);

btnHome?.addEventListener("click", () => map.setView([43.6532, -79.3832], 10));
btnToggle?.addEventListener("click", () => {
  overlayVisible = !overlayVisible;
  if (overlayVisible) overlay.addTo(map);
  else map.removeLayer(overlay);
});

const CANVAS = L.canvas({ padding: 0.5 });
let allFeatures = [];
let legendCtl = null;

function ensureLegend() {
  if (legendCtl) map.removeControl(legendCtl);

  legendCtl = L.control({ position: "bottomleft" });
  legendCtl.onAdd = () => {
    const div = L.DomUtil.create("div", "legend");
    div.style.background = "rgba(255,255,255,0.92)";
    div.style.padding = "10px 12px";
    div.style.borderRadius = "12px";
    div.style.boxShadow = "0 10px 24px rgba(0,0,0,0.25)";
    div.style.font = "12px/1.25 system-ui, -apple-system, Segoe UI, Roboto, Arial";
    div.style.color = "#111";

    const rows = [
      ["≥ 1,000,000", "#6a00ff"],
      ["250k – 999k", "#2563eb"],
      ["100k – 249k", "#0ea5e9"],
      ["25k – 99k",  "#22c55e"],
      ["5k – 24k",   "#84cc16"],
      ["< 5k",       "#a3a3a3"],
    ];

    const rowHtml = rows.map(([label, color]) =>
      `<div style="display:flex;align-items:center;gap:8px;margin:4px 0;">
        <span style="width:10px;height:10px;border-radius:999px;background:${color};border:1px solid rgba(0,0,0,.25)"></span>
        <span>${label}</span>
      </div>`
    ).join("");

    div.innerHTML = `
      <div style="font-weight:800;margin-bottom:6px;">Population (POP_MAX)</div>
      ${rowHtml}
      <div style="margin-top:6px;color:#444;font-size:11px;">Circle size ∝ √(POP_MAX)</div>
    `;
    return div;
  };

  legendCtl.addTo(map);
}

function featurePopup(p) {
  const name = getName(p);
  const pop = getPop(p);
  const admin = p?.ADM0NAME ?? p?.ADMIN ?? p?.SOV0NAME ?? "—";
  return `
    <div style="font:13px/1.3 system-ui,-apple-system,Segoe UI,Roboto,Arial;">
      <div style="font-weight:900;font-size:14px;margin-bottom:6px;">${name}</div>
      <div><b>Country:</b> ${admin}</div>
      <div><b>POP_MAX:</b> ${fmt(pop)}</div>
    </div>
  `;
}

function render() {
  const minPop = toNum(minpopEl?.value);
  const q = (qEl?.value ?? "").trim().toLowerCase();

  minpopValEl.textContent = fmt(minPop);

  const filtered = allFeatures.filter(ft => {
    const p = ft?.properties || {};
    if (getPop(p) < minPop) return false;
    if (q) return getName(p).toLowerCase().includes(q);
    return true;
  });

  overlay.clearLayers();

  const gj = { type: "FeatureCollection", features: filtered };

  const geo = L.geoJSON(gj, {
    renderer: CANVAS,
    pointToLayer: (feature, latlng) => {
      const p = feature?.properties || {};
      const pop = getPop(p);
      return L.circleMarker(latlng, {
        radius: popRadius(pop),
        color: "rgba(17,24,39,0.55)",
        weight: 1,
        fillColor: popColor(pop),
        fillOpacity: 0.78,
      });
    },
    onEachFeature: (feature, layer) => {
      const p = feature?.properties || {};
      const name = getName(p);

      layer.bindPopup(featurePopup(p), { maxWidth: 320 });
      layer.bindTooltip(name, { sticky: true, direction: "top", opacity: 0.9 });

      layer.on("mouseover", () => layer.setStyle({ weight: 2, fillOpacity: 0.95 }));
      layer.on("mouseout",  () => layer.setStyle({ weight: 1, fillOpacity: 0.78 }));
    }
  });

  overlay.addLayer(geo);

  kpiCountEl.textContent = fmt(filtered.length);

  // Fit bounds (don’t over-zoom)
  const bounds = geo.getBounds?.();
  if (bounds && bounds.isValid()) {
    map.fitBounds(bounds, { padding: [20, 20], maxZoom: 5 });
  }
}

async function fetchJsonWithTimeout(url, ms = 20000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);

  try {
    const res = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function loadData() {
  setStatus("Fetching external GeoJSON…");

  const t0 = performance.now();

  // Cache-bust the data URL itself
  const bust = (u) => u + (u.includes("?") ? "&" : "?") + "v=" + Date.now();

  let gj;
  let used = DATA_URL_PRIMARY;

  try {
    gj = await fetchJsonWithTimeout(bust(DATA_URL_PRIMARY), 25000);
  } catch (e1) {
    used = DATA_URL_FALLBACK;
    setStatus("Primary failed. Trying fallback…");
    gj = await fetchJsonWithTimeout(bust(DATA_URL_FALLBACK), 25000);
  }

  if (!gj || !Array.isArray(gj.features)) {
    throw new Error("Invalid GeoJSON: missing features[]");
  }

  allFeatures = gj.features;

  ensureLegend();
  render();

  const ms = Math.round(performance.now() - t0);
  kpiMsEl.textContent = `${ms} ms`;
  sourceEl.textContent = `Source: ${used}`;

  setStatus(
    `✅ Loaded external GeoJSON\n` +
    `Features (total): ${fmt(allFeatures.length)}\n` +
    `Build: ${BUILD}`
  );
}

minpopEl?.addEventListener("input", () => render());
qEl?.addEventListener("input", () => render());

loadData().catch((err) => {
  console.error(err);
  setStatus(`❌ Error loading external data:\n${err.message}`);
});
