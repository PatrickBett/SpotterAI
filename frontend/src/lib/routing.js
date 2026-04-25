// Geocoding (Nominatim) and Routing (OSRM) services.
// Both APIs are free, key-less, and CORS-enabled.

const NOMINATIM = "https://nominatim.openstreetmap.org";
const OSRM = "https://router.project-osrm.org";

// Simple in-memory cache to reduce duplicate calls.
const geoCache = new Map();

export async function geocode(query) {
  const key = query.trim().toLowerCase();
  if (!key) throw new Error("Empty location");
  if (geoCache.has(key)) return geoCache.get(key);

  const url = `${NOMINATIM}/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);
  const data = await res.json();
  if (!data || data.length === 0) {
    throw new Error(`Could not find location: "${query}"`);
  }
  const hit = data[0];
  const result = {
    label: hit.display_name,
    lat: parseFloat(hit.lat),
    lon: parseFloat(hit.lon),
    query,
  };
  geoCache.set(key, result);
  return result;
}

// Get a route through an ordered list of waypoints (lat/lon).
// Returns: { distanceMeters, durationSeconds, geometry: [[lat,lon]...], legs: [...] }
export async function getRoute(waypoints) {
  if (waypoints.length < 2) throw new Error("Need at least 2 waypoints");
  const coords = waypoints.map((w) => `${w.lon},${w.lat}`).join(";");
  const url = `${OSRM}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Routing failed: ${res.status}`);
  const data = await res.json();
  if (data.code !== "Ok" || !data.routes?.length) {
    throw new Error(`No route found (${data.code || "unknown"})`);
  }
  const route = data.routes[0];
  return {
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    geometry: route.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
    legs: route.legs.map((l) => ({
      distanceMeters: l.distance,
      durationSeconds: l.duration,
    })),
  };
}

export const metersToMiles = (m) => m / 1609.344;
export const secondsToHours = (s) => s / 3600;
