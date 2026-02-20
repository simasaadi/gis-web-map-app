(function () {
  const BUILD = "build-20260220-003645-9432";

  const statusEl = document.getElementById("status");
  const btnHome = document.getElementById("btn-home");
  const btnToggle = document.getElementById("btn-toggle");

  function setStatus(t){ if(statusEl) statusEl.textContent = t; }

  // If JS loads at all, you WILL see this build ID
  setStatus("✅ app.js loaded\n" + BUILD + "\nInitializing…");

  window.addEventListener("error", (e) => setStatus("❌ JS error\n" + BUILD + "\n" + e.message));
  window.addEventListener("unhandledrejection", (e) => {
    const m = e.reason?.message ? e.reason.message : String(e.reason);
    setStatus("❌ Promise error\n" + BUILD + "\n" + m);
  });

  const map = L.map("map", { center: [43.6532, -79.3832], zoom: 4 });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap contributors"
  }).addTo(map);

  L.control.scale({ metric: true, imperial: false }).addTo(map);

  const CANVAS = L.canvas({ padding: 0.5 });
  let overlayVisible = true;
  let overlay = L.geoJSON({ type:"FeatureCollection", features:[] }, { renderer: CANVAS }).addTo(map);

  function toNum(x){ const n = Number(x); return Number.isFinite(n) ? n : 0; }
  function fmt(n){ return toNum(n).toLocaleString(); }
  function getName(p){ return (p?.NAME || p?.name || "Place"); }
  function getPop(p){ return toNum(p?.POP_MAX ?? p?.pop_max ?? p?.POP ?? p?.population); }
  function rad(pop){ const r = Math.sqrt(Math.max(pop,0))*0.01; return Math.max(2.5, Math.min(18, r)); }
  function col(pop){
    if(pop>=1000000) return "#6a00ff";
    if(pop>=250000)  return "#2563eb";
    if(pop>=100000)  return "#0ea5e9";
    if(pop>=25000)   return "#22c55e";
    if(pop>=5000)    return "#84cc16";
    return "#a3a3a3";
  }

  if(btnHome) btnHome.addEventListener("click", () => map.setView([43.6532, -79.3832], 4));
  if(btnToggle) btnToggle.addEventListener("click", () => {
    overlayVisible = !overlayVisible;
    if(overlayVisible) overlay.addTo(map); else map.removeLayer(overlay);
  });

  async function fetchJson(url, ms){
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), ms);
    try{
      const u = url + (url.includes("?") ? "&" : "?") + "v=" + Date.now();
      const res = await fetch(u, { cache:"no-store", signal: controller.signal });
      if(!res.ok) throw new Error("Fetch failed: " + res.status + " " + res.statusText);
      return await res.json();
    } finally { clearTimeout(t); }
  }

  function ensureLegend(){
    if(document.getElementById("legend-css")) return;
    const s=document.createElement("style");
    s.id="legend-css";
    s.textContent = ".legend{background:rgba(255,255,255,.92);padding:10px 12px;border-radius:10px;box-shadow:0 6px 18px rgba(0,0,0,.18);font:12px/1.25 system-ui;color:#111}.legend .t{font-weight:700;margin-bottom:6px}.legend .r{display:flex;align-items:center;gap:8px;margin:4px 0}.legend i{width:10px;height:10px;border-radius:50%;display:inline-block;border:1px solid rgba(0,0,0,.25)}";
    document.head.appendChild(s);

    const legend = L.control({position:"bottomleft"});
    legend.onAdd = () => {
      const d=L.DomUtil.create("div","legend");
      d.innerHTML = "<div class='t'>POP_MAX</div>"
        + "<div class='r'><i style='background:#6a00ff'></i> ≥ 1,000,000</div>"
        + "<div class='r'><i style='background:#2563eb'></i> 250k–999k</div>"
        + "<div class='r'><i style='background:#0ea5e9'></i> 100k–249k</div>"
        + "<div class='r'><i style='background:#22c55e'></i> 25k–99k</div>"
        + "<div class='r'><i style='background:#84cc16'></i> 5k–24k</div>"
        + "<div class='r'><i style='background:#a3a3a3'></i> < 5k</div>";
      return d;
    };
    legend.addTo(map);
  }

  async function load(){
    setStatus("Fetching GeoJSON…\n" + BUILD);

    let gj=null, source=null;
    try { gj = await fetchJson("https://cdn.jsdelivr.net/gh/simasaadi/gis-spatial-data-engineering@main/data/outputs/web/ne_10m_populated_places_canada.geojson", 25000); source="https://cdn.jsdelivr.net/gh/simasaadi/gis-spatial-data-engineering@main/data/outputs/web/ne_10m_populated_places_canada.geojson"; }
    catch(e1){
      console.warn("Primary failed:", e1);
      gj = await fetchJson("https://raw.githubusercontent.com/simasaadi/gis-spatial-data-engineering/main/data/outputs/web/ne_10m_populated_places_canada.geojson", 25000); source="https://raw.githubusercontent.com/simasaadi/gis-spatial-data-engineering/main/data/outputs/web/ne_10m_populated_places_canada.geojson";
    }

    if(!gj || !Array.isArray(gj.features)) throw new Error("Invalid GeoJSON: missing features[]");

    if(overlay && map.hasLayer(overlay)) map.removeLayer(overlay);

    overlay = L.geoJSON(gj, {
      renderer: CANVAS,
      pointToLayer: (f, latlng) => {
        const p=f.properties||{};
        const pop=getPop(p);
        return L.circleMarker(latlng, {
          radius: rad(pop),
          color:"rgba(17,24,39,.55)",
          weight:1,
          fillColor: col(pop),
          fillOpacity:.78
        });
      },
      onEachFeature: (f, layer) => {
        const p=f.properties||{};
        const name=getName(p);
        const pop=getPop(p);
        layer.bindPopup("<b>"+name+"</b><br/>Country: "+(p.ADM0NAME??"—")+"<br/>POP_MAX: "+fmt(pop));
        layer.bindTooltip(name, { sticky:true, direction:"top", opacity:.9 });
      }
    });

    if(overlayVisible) overlay.addTo(map);

    const b = overlay.getBounds();
    if(b && b.isValid()) map.fitBounds(b, { padding:[20,20], maxZoom: 5 });

    ensureLegend();

    setStatus("✅ Loaded external GeoJSON\n" + BUILD + "\nFeatures: " + (gj.features?.length ?? "?") + "\nSource:\n" + source);
  }

  load().catch(err => {
    console.error(err);
    setStatus("❌ Error loading data\n" + BUILD + "\n" + err.message);
  });
})();
