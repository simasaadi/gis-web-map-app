/**
 * GIS Web Map App (Leaflet)
 * - Loads external GeoJSON (Canada populated places)
 * - Proportional circle markers by POP_MAX
 * - Canvas renderer for performance
 * - Legend + scale bar + strong error/status reporting
 */

(function () {
  const statusEl = document.getElementById("status");
  const btnHome = document.getElementById("btn-home");
  const btnToggle = document.getElementById("btn-toggle");

  function setStatus(txt) {
    if (statusEl) statusEl.textContent = txt;
  }

  // Make failures visible (so you never get "Loading..." with no clue)
  window.addEventListener("error", (e) => {
    setStatus(`❌ JS error:\n${e.message}`);
  });
  window.addEventListener("unhandledrejection", (e) => {
    const msg = (e.reason && e.reason.message) ? e.reason.message : String(e.reason);
    setStatus(`❌ Promise error:\n${msg}`);
  });

  setStatus("Initializing map…");

  // Map
  const map = L.map("map", { center: [43.6532, -79.3832], zoom: 10 });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap contributors",
  }).addTo(map);

  // Demo overlay so the app always renders something
  const demoGeoJson = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { name: "Downtown Toronto (demo)" },
        geometry: { type: "Point", coordinates: [-79.3832, 43.6532] },
      },
    ],
  };

  // Data source (Repo #1 output)
  const DATA_URL_PRIMARY =
    "https://cdn.jsdelivr.net/gh/simasaadi/gis-spatial-data-engineering@main/data/outputs/web/ne_10m_populated_places_canada.geojson";
  const DATA_URL_FALLBACK =
    "https://raw.githubusercontent.com/simasaadi/gis-spatial-data-engineering/main/data/outputs/web/ne_10m_populated_places_canada.geojson";

  // Rendering + style helpers
  const CANVAS = L.canvas({ padding: 0.5 });
  const MIN_POP = 0; // set to 5000 if you want fewer points

  function toNum(x) {
    const n = Number(x);
    return Number.isFinite(n) ? n : 0;
  }
  function fmt(n) {
    return toNum(n).toLocaleString();
  }
  function getName(p) {
    return (p && (p.NAME || p.name)) ? (p.NAME || p.name) : "Place";
  }
  function getPop(p) {
    return toNum(p && (p.POP_MAX ?? p.pop_max ?? p.POP ?? p.population));
  }
  function popRadius(pop) {
    // sqrt scaling for proportional symbols
    const r = Math.sqrt(Math.max(pop, 0)) * 0.01;
    return Math.max(2.5, Math.min(18, r));
  }
  function popColor(pop) {
    if (pop >= 1000000) return "#6a00ff";
    if (pop >= 250000) return "#2563eb";
    if (pop >= 100000) return "#0ea5e9";
    if (pop >= 25000) return "#22c55e";
    if (pop >= 5000) return "#84cc16";
    return "#a3a3a3";
  }

  // Overlay + controls
  let overlayVisible = true;

  let overlay = L.geoJSON(demoGeoJson, {
    renderer: CANVAS,
    pointToLayer: (_, latlng) =>
      L.circleMarker(latlng, {
        radius: 6,
        color: "rgba(17,24,39,0.55)",
        weight: 1,
        fillColor: "#60a5fa",
        fillOpacity: 0.75,
      }),
    onEachFeature: (feature, layer) => {
      const p = feature.properties || {};
      const name = p.name || p.NAME || "Feature";
      layer.bindPopup(String(name));
    },
  }).addTo(map);

  if (btnHome) {
    btnHome.addEventListener("click", () => map.setView([43.6532, -79.3832], 10));
  }

  if (btnToggle) {
    btnToggle.addEventListener("click", () => {
      overlayVisible = !overlayVisible;
      if (overlayVisible) overlay.addTo(map);
      else map.removeLayer(overlay);
    });
  }

  // Legend (adds a “senior” touch + makes symbology defensible)
  let legendCtl = null;

  function ensureLegend() {
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
        .legend i { width: 10px; height: 10px; border-radius: 50%; display:inline-block; border: 1px solid rgba(0,0,0,0.25); }
        .legend .note { margin-top: 6px; color:#444; font-size: 11px; }
      `;
      document.head.appendChild(s);
    }

    if (legendCtl) map.removeControl(legendCtl);

    legendCtl = L.control({ position: "bottomleft" });
    legendCtl.onAdd = () => {
      const div = L.DomUtil.create("div", "legend");
      div.innerHTML = `
        <div class="title">Population (POP_MAX)</div>
        <div class="row"><i style="background:${popColor(1000000)}"></i> ≥ 1,000,000</div>
        <div class="row"><i style="background:${popColor(250000)}"></i> 250k – 999k</div>
        <div class="row"><i style="background:${popColor(100000)}"></i> 100k – 249k</div>
        <div class="row"><i style="background:${popColor(25000)}"></i> 25k – 99k</div>
        <div class="row"><i style="background:${popColor(5000)}"></i> 5k – 24k</div>
        <div class="row"><i style="background:${popColor(1)}"></i> &lt; 5k</div>
        <div class="note">Circle size ∝ √(POP_MAX)</div>
      `;
      return div;
    };
    legendCtl.addTo(map);
  }

  // Fetch helpers: timeout + fallback
  async function fetchJsonWithTimeout(url, ms) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), ms);
    try {
      // cache-bust the GeoJSON itself
      const u = url + (url.includes("?") ? "&" : "?") + "v=" + Date.now();
      const res = await fetch(u, { cache: "no-store", signal: controller.signal });
      if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
      return await res.json();
    } finally {
      clearTimeout(t);
    }
  }

  async function loadExternalGeoJson() {
    setStatus("Fetching external GeoJSON…");

    const t0 = performance.now();
    let gj = null;
    let source = null;

    // Try CDN first, then raw GitHub
    try {
      gj = await fetchJsonWithTimeout(DATA_URL_PRIMARY, 25000);
      source = DATA_URL_PRIMARY;
    } catch (e1) {
      console.warn("Primary failed, trying fallback:", e1);
      gj = await fetchJsonWithTimeout(DATA_URL_FALLBACK, 25000);
      source = DATA_URL_FALLBACK;
    }

    if (!gj || !Array.isArray(gj.features)) {
      throw new Error("Invalid GeoJSON (missing features[])");
    }

    // Replace overlay with styled external data
    if (overlay && map.hasLayer(overlay)) map.removeLayer(overlay);

    overlay = L.geoJSON(gj, {
      renderer: CANVAS,
      filter: (feature) => getPop(feature.properties || {}) >= MIN_POP,
      pointToLayer: (feature, latlng) => {
        const p = feature.properties || {};
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
        const p = feature.properties || {};
        const name = getName(p);
        const pop = getPop(p);

        layer.bindPopup(
          `<b>${name}</b><br/>Country: ${p.ADM0NAME ?? "—"}<br/>POP_MAX: ${fmt(pop)}`,
          { maxWidth: 280 }
        );

        layer.bindTooltip(name, { sticky: true, direction: "top", opacity: 0.9 });

        layer.on("mouseover", () => layer.setStyle({ weight: 2, fillOpacity: 0.95 }));
        layer.on("mouseout", () => layer.setStyle({ weight: 1, fillOpacity: 0.78 }));
      },
    });

    if (overlayVisible) overlay.addTo(map);

    const bounds = overlay.getBounds();
    if (bounds && bounds.isValid()) {
      // keep Canada view readable; don't zoom too far in
      map.fitBounds(bounds, { padding: [20, 20], maxZoom: 5 });
    }

    ensureLegend();

    if (!window.__scaleAdded) {
      L.control.scale({ metric: true, imperial: false }).addTo(map);
      window.__scaleAdded = true;
    }

    const ms = Math.round(performance.now() - t0);
    const n = (overlay.getLayers && overlay.getLayers().length) ? overlay.getLayers().length : (gj.features.length || "?");

    setStatus(
      `✅ Loaded external GeoJSON\n` +
      `Features: ${n}\n` +
      `Load: ${ms} ms\n` +
      `Source:\n${source}`
    );
  }

  loadExternalGeoJson().catch((err) => {
    console.error(err);
    setStatus(`❌ Error loading external data:\n${err.message}`);
  });
})();
