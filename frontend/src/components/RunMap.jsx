import { useEffect, useMemo } from 'react'
import { CircleMarker, MapContainer, Polyline, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

function FitRoute({ points }) {
  const map = useMap()
  useEffect(() => {
    const timer = window.setTimeout(() => {
      map.invalidateSize()
      if (points.length > 1) map.fitBounds(points, { padding: [34, 34], maxZoom: 16 })
      else if (points.length === 1) map.setView(points[0], 16)
    }, 80)
    return () => window.clearTimeout(timer)
  }, [map, points])
  return null
}

export default function RunMap({ route = [], className = '' }) {
  const segments = useMemo(() => {
    const result = []
    let segment = []
    route.forEach((point) => {
      if (point.breakBefore && segment.length) {
        result.push(segment)
        segment = []
      }
      segment.push([point.latitude, point.longitude])
    })
    if (segment.length) result.push(segment)
    return result
  }, [route])
  const positions = useMemo(() => segments.flat(), [segments])
  const center = positions[0] || [20, 0]

  return (
    <div className={`map-shell ${className}`}>
      <MapContainer center={center} zoom={positions.length ? 15 : 2} scrollWheelZoom={false} zoomControl={false}>
        {positions.length > 0 && <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          crossOrigin="anonymous"
        />}
        <FitRoute points={positions} />
        {segments.map((segment, index) => segment.length > 1 && <Polyline key={`shadow-${index}`} positions={segment} pathOptions={{ color: '#243a30', weight: 6, opacity: 0.22, lineCap: 'round', lineJoin: 'round' }} />)}
        {segments.map((segment, index) => segment.length > 1 && <Polyline key={`route-${index}`} positions={segment} pathOptions={{ color: '#a8c84b', weight: 4, opacity: 1, lineCap: 'round', lineJoin: 'round' }} />)}
        {positions.length > 0 && <CircleMarker center={positions[0]} radius={6} pathOptions={{ color: '#fff', weight: 3, fillColor: '#93b331', fillOpacity: 1 }} />}
        {positions.length > 1 && <CircleMarker center={positions.at(-1)} radius={6} pathOptions={{ color: '#fff', weight: 3, fillColor: '#22382d', fillOpacity: 1 }} />}
      </MapContainer>
      {positions.length === 0 && (
        <div className="map-empty-state">
          <span className="map-empty-icon" aria-hidden="true">⌖</span>
          <strong>Your route will appear here</strong>
          <span>Start a run to see your path on the map.</span>
        </div>
      )}
      <div className="map-attribution">© OpenStreetMap</div>
    </div>
  )
}
