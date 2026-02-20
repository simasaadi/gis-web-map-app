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

async function loadExternalGeoJson() {
  statusEl.textContent = "Fetching external GeoJSON…";

  const urls = [DATA_URL_PRIMARY, DATA_URL_FALLBACK].filter(Boolean);
  let lastErr = null;

  for (const url of urls) {
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);

      const gj = await res.json();

      // swap overlay
      map.removeLayer(overlay);
      overlay = L.geoJSON(gj, { pointToLayer, onEachFeature });

      if (overlayVisible) overlay.addTo(map);

      const bounds = overlay.getBounds?.();
      if (bounds && bounds.isValid()) map.fitBounds(bounds, { padding: [20, 20] });

      statusEl.textContent =
        `✅ Loaded external GeoJSON\n` +
        `Features: ${gj.features?.length ?? "?"}\n` +
        `Source: ${url}`;

      return;
    } catch (e) {
      lastErr = e;
      console.error("GeoJSON load failed:", url, e);
    }
  }

  throw lastErr || new Error("Failed to load GeoJSON from all sources.");
}

loadExternalGeoJson().catch((err) => {
  console.error(err);
  statusEl.textContent = `❌ Error loading external data:\n${err.message}`;
});
