/**
 * GIS Web Map App (Leaflet)
 * Loads external GeoJSON from Repo #1 (data outputs)
 */

const statusEl = document.getElementById("status");
const btnHome  = document.getElementById("btn-home");
const btnToggle = document.getElementById("btn-toggle");

// 1) Base map
const map = L.map("map", { center: [43.6532, -79.3832], zoom: 10 });

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap contributors",
}).addTo(map);

// 2) Demo layer (so app always renders something)
const demoGeoJson = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "Downtown (demo point)" },
      geometry: { type: "Point", coordinates: [-79.3832, 43.6532] },
    },
  ],
};

// Render points as circle markers (so styling works reliably)
function pointToLayer(feature, latlng) {
  return L.circleMarker(latlng, { radius: 5, weight: 1, fillOpacity: 0.6 });
}

function onEachFeature(feature, layer) {
  const props = feature.properties || {};
  const name =
    props.name ||
    props.NAME ||
    props.NAMELSAD10 ||
    props.NAME10 ||
    "Feature";

  layer.bindPopup(String(name));

  layer.on("mouseover", () => {
    if (layer.setStyle) layer.setStyle({ weight: 2, fillOpacity: 0.85 });
    if (layer.setRadius) layer.setRadius(7);
  });

  layer.on("mouseout", () => {
    if (layer.setStyle) layer.setStyle({ weight: 1, fillOpacity: 0.6 });
    if (layer.setRadius) layer.setRadius(5);
  });
}

// IMPORTANT: overlay must be initialized from demoGeoJson (NOT gj)
let overlay = L.geoJSON(demoGeoJson, { pointToLayer, onEachFeature }).addTo(map);
let overlayVisible = true;

// 3) Controls
btnHome?.addEventListener("click", () => map.setView([43.6532, -79.3832], 10));

btnToggle?.addEventListener("click", () => {
  overlayVisible = !overlayVisible;
  if (overlayVisible) overlay.addTo(map);
  else map.removeLayer(overlay);
});

// 4) External data (Repo #1 output)
const DATA_URL_PRIMARY =
  "https://cdn.jsdelivr.net/gh/simasaadi/gis-spatial-data-engineering@main/data/outputs/web/ne_10m_populated_places_canada.geojson";

const DATA_URL_FALLBACK =
  "https://raw.githubusercontent.com/simasaadi/gis-spatial-data-engineering/main/data/outputs/web/ne_10m_populated_places_canada.geojson";

function fetchWithTimeout(url, ms = 20000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  return fetch(url, { cache: "no-store", signal: controller.signal })
    .finally(() => clearTimeout(t));
}

/** ---- External GeoJSON (styled + performant) ---- **/

// Tune this if you want to hide tiny places (e.g., 5000)
const MIN_POP = 0;

// Canvas renderer makes lots of points feel snappier than SVG
const CANVAS = L.canvas({ padding: 0.5 });

// Utility
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

// Style: size + color by population
function popRadius(pop) {
  // sqrt scaling is standard for proportional symbols
  // clamp so circles stay readable
  const r = Math.sqrt(Math.max(pop, 0)) * 0.01;
  return Math.max(2.5, Math.min(18, r));
}
function popColor(pop) {
  if (pop >= 1000000) return "#6a00ff";
  if (pop >= 250000)  return "#2563eb";
  if (pop >= 100000)  return "#0ea5e9";
  if (pop >= 25000)   return "#22c55e";
  if (pop >= 5000)    return "#84cc16";
  return "#a3a3a3";
}

let __legendCtl = null;
function ensureLegend() {
  // inject minimal CSS once
  if (!document.getElementById("legend-css")) {
    const s = document.createElement("style");
    s.id = "legend-css";
    s.textContent = `
      .legend {
        background: rgba(255,255,255,0.92);
        padding: 10px 12px;
        border-radius: 10px;
        box-shadow: 0 6px 18px rgba(0,0,0,0.18);
        font: 12px/1.25 system-ui, -apple-system, Segoe UI, Roboto, Arial;
        color: #111;
      }
      .legend .title { font-weight: 700; margin-bottom: 6px; }
      .legend .row { display:flex; align-items:center; margin: 4px 0; gap: 8px; }
      .legend i {
        width: 10px; height: 10px;
        border-radius: 50%;
        display:inline-block;
        border: 1px solid rgba(0,0,0,0.25);
      }
      .legend .note { margin-top: 6px; color:#444; font-size: 11px; }
    `;
    document.head.appendChild(s);
  }

  if (__legendCtl) map.removeControl(__legendCtl);

  __legendCtl = L.control({ position: "bottomleft" });
  __legendCtl.onAdd = () => {
    const div = L.DomUtil.create("div", "legend");
    div.innerHTML = `
      <div class="title">Population (POP_MAX)</div>
      <div class="row"><i style="background:${popColor(1000000)}"></i><span>≥ 1,000,000</span></div>
      <div class="row"><i style="background:${popColor(250000)}"></i><span>250k – 999k</span></div>
      <div class="row"><i style="background:${popColor(100000)}"></i><span>100k – 249k</span></div>
      <div class="row"><i style="background:${popColor(25000)}"></i><span>25k – 99k</span></div>
      <div class="row"><i style="background:${popColor(5000)}"></i><span>5k – 24k</span></div>
      <div class="row"><i style="background:${popColor(0)}"></i><span>&lt; 5k</span></div>
      <div class="note">Circle size ∝ √(POP_MAX)</div>
    `;
    return div;
  };
  __legendCtl.addTo(map);
}

async function loadExternalGeoJson() {
  if (!DATA_URL) {
    statusEl.textContent =
      "✅ App loaded.\n\nNext step:\n- Put a GeoJSON URL into DATA_URL in js/app.js\n- Then we’ll fetch it and style it.";
    return;
  }

  // cache-bust the DATA_URL itself (helps with CDN/browser caching)
  const url = DATA_URL + (DATA_URL.includes("?") ? "&" : "?") + "v=" + Date.now();

  statusEl.textContent = "Fetching external GeoJSON…";

  const t0 = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);

  let res;
  try {
    res = await fetch(url, { cache: "no-store", signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);

  const gj = await res.json();
  if (!gj || !Array.isArray(gj.features)) throw new Error("Invalid GeoJSON: missing features[]");

  // Replace old overlay
  try { if (overlay && map.hasLayer(overlay)) map.removeLayer(overlay); } catch (_) {}

  overlay = L.geoJSON(gj, {
    renderer: CANVAS,
    filter: (feature) => getPop(feature?.properties) >= MIN_POP,
    pointToLayer: (feature, latlng) => {
      const p = feature?.properties || {};
      const pop = getPop(p);
      return L.circleMarker(latlng, {
        radius: popRadius(pop),
        color: "rgba(17,24,39,0.55)",   // stroke
        weight: 1,
        fillColor: popColor(pop),
        fillOpacity: 0.75
      });
    },
    onEachFeature: (feature, layer) => {
      const p = feature?.properties || {};
      const name = getName(p);
      const pop  = getPop(p);

      const html = `
        <div style="font: 13px/1.35 system-ui;">
          <div style="font-weight:700; margin-bottom:4px;">${name}</div>
          <div><b>Country:</b> ${p.ADM0NAME ?? "—"}</div>
          <div><b>POP_MAX:</b> ${fmt(pop)}</div>
          <div style="color:#666; margin-top:6px; font-size:12px;">Click points to compare places.</div>
        </div>
      `;

      layer.bindPopup(html, { maxWidth: 280 });
      layer.bindTooltip(name, { sticky: true, direction: "top", opacity: 0.9 });

      layer.on("mouseover", () => layer.setStyle({ weight: 2, fillOpacity: 0.95 }));
      layer.on("mouseout",  () => layer.setStyle({ weight: 1, fillOpacity: 0.75 }));
    }
  });

  if (overlayVisible !== false) overlay.addTo(map);

  // Fit bounds to Canada, but don't zoom out to "tiny world"
  const bounds = overlay.getBounds?.();
  if (bounds && bounds.isValid()) map.fitBounds(bounds, { padding: [20, 20], maxZoom: 5 });

  // Add legend + scale once
  ensureLegend();
  if (!window.__scaleAdded) {
    L.control.scale({ metric: true, imperial: false }).addTo(map);
    window.__scaleAdded = true;
  }

  const ms = Math.round(performance.now() - t0);
  const n  = overlay.getLayers?.().length ?? (gj.features?.length ?? "?");

  statusEl.textContent =
    `✅ Loaded external GeoJSON\n` +
    `Features: ${n}\n` +
    `Load: ${ms} ms\n` +
    `Source:\n${DATA_URL}`;
}

loadExternalGeoJson().catch((err) => {
  console.error(err);
  statusEl.textContent = `❌ Error loading external data:\n${err.message}`;
});statusEl.textContent = `❌ Error loading external data:\n${err.message}`;
});

