/**
 * GIS Web Map App (Leaflet)
 * Next: replace DATA_URL with Repo #1 output URL (GitHub Pages or Release asset).
 */

const statusEl = document.getElementById("status");
const btnHome = document.getElementById("btn-home");
const btnToggle = document.getElementById("btn-toggle");

// 1) Base map
const map = L.map("map", {
  center: [43.6532, -79.3832], // Toronto
  zoom: 10,
});

const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

// 2) A small demo GeoJSON layer (so you see something immediately)
const demoGeoJson = {
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": { "name": "Downtown (demo point)" },
      "geometry": { "type": "Point", "coordinates": [-79.3832, 43.6532] }
    }
  ]
};

overlay = L.geoJSON(gj, {
  style: () => ({ weight: 2, fillOpacity: 0.15 }),
  onEachFeature: (feature, layer) => {
    const props = feature.properties ?? {};
    const name = props.name || props.NAME10 || props.NAMELSAD10 || "Feature";

    layer.bindPopup(`<strong>${name}</strong>`);

    layer.on("mouseover", () => layer.setStyle({ weight: 4, fillOpacity: 0.25 }));
    layer.on("mouseout", () => layer.setStyle({ weight: 2, fillOpacity: 0.15 }));
  }
}).addTo(map);


let overlayVisible = true;

// 3) Controls
btnHome.addEventListener("click", () => {
  map.setView([43.6532, -79.3832], 10);
});

btnToggle.addEventListener("click", () => {
  overlayVisible = !overlayVisible;
  if (overlayVisible) overlay.addTo(map);
  else map.removeLayer(overlay);
});

// 4) Data loading hook (Repo #1 output)

const DATA_URL = "https://raw.githubusercontent.com/simasaadi/gis-spatial-data-engineering/main/data/outputs/web/ne_10m_populated_places_canada.geojson";


async function loadExternalGeoJson() {
  if (!DATA_URL) {
    statusEl.textContent =
      "✅ App loaded.\n\nNext step:\n- Put a GeoJSON URL into DATA_URL in js/app.js\n- Then we’ll fetch it and style it.";
    return;
  }

  statusEl.textContent = "Fetching external GeoJSON…";

  const res = await fetch(DATA_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);

  const gj = await res.json();

  // Replace demo layer with external data
  map.removeLayer(overlay);
  overlay = L.geoJSON(gj, {
    style: () => ({ weight: 2 }),
    onEachFeature: (feature, layer) => {
      const name = feature.properties?.name || feature.properties?.NAME || "Feature";
      layer.bindPopup(String(name));
    }
  }).addTo(map);

  const bounds = overlay.getBounds?.();
  if (bounds && bounds.isValid()) map.fitBounds(bounds, { padding: [20, 20] });

  statusEl.textContent = `✅ Loaded external GeoJSON.\nFeatures: ${gj.features?.length ?? "?"}`;
}

loadExternalGeoJson().catch((err) => {
  console.error(err);
  statusEl.textContent = `❌ Error loading external data:\n${err.message}`;
});
