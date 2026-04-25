// RouteMap.jsx
// Shows the trip route on an OpenStreetMap with markers for the start,
// pickup, dropoff, fuel stops, breaks, and rest periods.

import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";

// ---- Marker icons --------------------------------------------------------

// Build a colored map pin (SVG) with an optional letter/emoji inside.
function makePin(color, glyph = "") {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
      <defs>
        <filter id="s" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.3"/>
        </filter>
      </defs>
      <path filter="url(#s)" fill="${color}" stroke="white" stroke-width="2"
        d="M16 1c-7.18 0-13 5.82-13 13 0 9.75 13 25 13 25s13-15.25 13-25c0-7.18-5.82-13-13-13z"/>
      <text x="16" y="19" text-anchor="middle" fill="white" font-size="13" font-weight="700"
        font-family="Inter, sans-serif">${glyph}</text>
    </svg>`;

  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -36],
  });
}

// Pre-built icons for every type of marker we use.
const ICONS = {
  current: makePin("hsl(214, 88%, 27%)", "A"),
  pickup: makePin("hsl(152, 70%, 38%)", "P"),
  dropoff: makePin("hsl(38, 95%, 50%)", "D"),
  fuel: makePin("hsl(214, 95%, 55%)", "⛽"),
  break: makePin("hsl(215, 16%, 50%)", "☕"),
  rest: makePin("hsl(270, 60%, 55%)", "💤"),
};

// ---- Helpers -------------------------------------------------------------

// Auto-zoom the map so the whole route fits inside the view.
function FitBounds({ geometry }) {
  const map = useMap();
  useEffect(() => {
    if (!geometry || geometry.length === 0) return;
    map.fitBounds(L.latLngBounds(geometry), { padding: [40, 40] });
  }, [geometry, map]);
  return null;
}

// Pick the right icon + popup title for a stop (fuel / rest / break).
function iconForStop(stop) {
  const label = stop.ev.label || "";
  if (stop.ev.meta?.kind === "fuel")
    return { icon: ICONS.fuel, title: "Fuel stop (15 min)" };
  if (label.includes("10-hour") || label.includes("34-hour"))
    return { icon: ICONS.rest, title: label };
  if (label.includes("30-min"))
    return { icon: ICONS.break, title: "30-minute break" };
  return { icon: ICONS.break, title: "Break" };
}

// ---- Main component ------------------------------------------------------

export default function RouteMap({ waypoints, geometry, stops }) {
  // Center the map on the start point if we have one, otherwise on the US.
  const center = waypoints?.[0]
    ? [waypoints[0].lat, waypoints[0].lon]
    : [39.5, -98.35];

  const [start, pickup, dropoff] = waypoints || [];

  return (
    <div className="relative h-[520px] w-full rounded-xl overflow-hidden border border-border shadow-card">
      <MapContainer
        center={center}
        zoom={4}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%" }}
      >
        {/* Base map tiles from OpenStreetMap */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · Routing by OSRM'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Route line: a thick translucent halo + a thinner solid line on top */}
        {geometry && geometry.length > 0 && (
          <>
            <Polyline
              positions={geometry}
              pathOptions={{
                color: "hsl(214, 88%, 27%)",
                weight: 6,
                opacity: 0.25,
              }}
            />
            <Polyline
              positions={geometry}
              pathOptions={{
                color: "hsl(214, 95%, 55%)",
                weight: 3.5,
                opacity: 1,
              }}
            />
            <FitBounds geometry={geometry} />
          </>
        )}

        {/* The 3 main waypoints */}
        {start && (
          <Marker position={[start.lat, start.lon]} icon={ICONS.current}>
            <Popup>
              <b>Start</b>
              <br />
              {start.label}
            </Popup>
          </Marker>
        )}
        {pickup && (
          <Marker position={[pickup.lat, pickup.lon]} icon={ICONS.pickup}>
            <Popup>
              <b>Pickup</b>
              <br />
              {pickup.label}
            </Popup>
          </Marker>
        )}
        {dropoff && (
          <Marker position={[dropoff.lat, dropoff.lon]} icon={ICONS.dropoff}>
            <Popup>
              <b>Dropoff</b>
              <br />
              {dropoff.label}
            </Popup>
          </Marker>
        )}

        {/* Fuel / break / rest stops along the route */}
        {stops?.map((stop, i) => {
          const { icon, title } = iconForStop(stop);
          return (
            <Marker key={i} position={stop.position} icon={icon}>
              <Popup>
                <b>{title}</b>
                <br />
                {stop.ev.start.toLocaleString()}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Legend overlay (top-right corner of the map) */}
      <div className="absolute top-3 right-3 z-[400] surface-card p-3 text-xs space-y-1.5 max-w-[180px]">
        <div className="font-semibold text-foreground mb-1">Legend</div>
        <LegendRow color="hsl(214, 88%, 27%)" label="Start" />
        <LegendRow color="hsl(152, 70%, 38%)" label="Pickup" />
        <LegendRow color="hsl(38, 95%, 50%)" label="Dropoff" />
        <LegendRow color="hsl(214, 95%, 55%)" label="Fuel stop" />
        <LegendRow color="hsl(215, 16%, 50%)" label="30-min break" />
        <LegendRow color="hsl(270, 60%, 55%)" label="10hr rest" />
      </div>
    </div>
  );
}

function LegendRow({ color, label }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="h-2.5 w-2.5 rounded-full ring-2 ring-background"
        style={{ background: color }}
      />
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}
