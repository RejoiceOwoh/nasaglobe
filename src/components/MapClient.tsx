"use client";

import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import * as L from "leaflet";
import type { LeafletMouseEvent, LatLngExpression, Icon } from "leaflet";
import { useMemo } from "react";

const icon: Icon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export default function MapClient({
  picked,
  onPick,
  overlays,
}: {
  picked: { lat: number; lon: number } | null;
  onPick: (pt: { lat: number; lon: number }) => void;
  overlays?: { trueColor?: boolean; ndvi?: boolean };
}) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const gibsTrueColor = useMemo(
    () =>
      `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${today}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
    [today]
  );
  const ndvi = useMemo(
    () =>
      `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Combined_NDVI_16Day/default/${today}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png`,
    [today]
  );

  function ClickPicker() {
    useMapEvents({
      click(e: LeafletMouseEvent) {
        onPick({ lat: e.latlng.lat, lon: e.latlng.lng });
      },
    });
    return null;
  }

  return (
    <MapContainer
      center={(picked ? [picked.lat, picked.lon] : [20, 0]) as LatLngExpression}
      zoom={picked ? 12 : 2}
      minZoom={2}
      className="w-full h-full"
      worldCopyJump
      scrollWheelZoom
    >
      <ClickPicker />
      <TileLayer attribution="© OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {overlays?.trueColor !== false && (
        <TileLayer attribution="Imagery © NASA GIBS" url={gibsTrueColor} opacity={0.85} />
      )}
      {overlays?.ndvi !== false && (
        <TileLayer attribution="NDVI © NASA GIBS" url={ndvi} opacity={0.4} />
      )}
      {picked && (
        <Marker position={([picked.lat, picked.lon] as unknown) as LatLngExpression} icon={icon}>
          <Popup>
            {picked.lat.toFixed(5)}, {picked.lon.toFixed(5)}
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
