# GIS Web Map App (Leaflet + GitHub Pages)

Interactive Leaflet web map deployed on GitHub Pages. Loads a Canada populated places GeoJSON from a separate data repo and styles points by population.

## Live Demo
https://simasaadi.github.io/gis-web-map-app/

## Features
- Loads external GeoJSON (CDN in production, local file in dev)
- Scales point symbology by POP_MAX
- Legend + status panel (feature count, load time)
- Minimum population filter + name search
- Home + layer toggle controls

## Run locally
From repo root:
\\\ash
python -m http.server 8000 --bind 127.0.0.1
\\\
Then open: http://127.0.0.1:8000/

## Data source
GeoJSON generated in: https://github.com/simasaadi/gis-spatial-data-engineering
