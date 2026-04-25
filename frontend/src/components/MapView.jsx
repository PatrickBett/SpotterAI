import { MapContainer, TileLayer, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export default function MapView({ geometry }) {
  // Convert [lng, lat] → [lat, lng]
  const positions = geometry.coordinates.map((coord) => [coord[1], coord[0]]);

  return (
    <MapContainer
      center={positions[0]}
      zoom={6}
      style={{ height: "400px", width: "100%" }}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Polyline positions={positions} />
    </MapContainer>
  );
}
