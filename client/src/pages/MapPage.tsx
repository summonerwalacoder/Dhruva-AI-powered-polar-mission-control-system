import { useEffect, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, Polyline } from 'react-leaflet'
import { useMission } from '../context/MissionContext'
import { Badge, Spinner, ErrorBox } from '../components/ui'
import type { Personnel, Station, Asset } from '../lib/types'
import L from 'leaflet'

const stationIcon = new L.DivIcon({
  className: '',
  html: `<div style="width:22px;height:22px;border-radius:50%;background:#2fa3b8;border:3px solid #dff3f6;box-shadow:0 0 8px rgba(47,163,184,.8)"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
})
const personIcon = new L.DivIcon({
  className: '',
  html: `<div style="width:16px;height:16px;border-radius:50%;background:#34d399;border:2px solid #064e3b"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

interface LoadState<T> {
  data: T | null
  loading: boolean
  error: string
}

function useLoad<T>(path: string): LoadState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    fetch(path, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('dhruva_token') || ''}`,
        'Content-Type': 'application/json',
      },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e?.message || 'Failed'))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [path])
  return { data, loading, error }
}

export default function MapPage() {
  const { selectedId } = useMission()
  const stations = useLoad<Station[]>('/api/stations')
  const personnel = useLoad<Personnel[]>(`/api/personnel?mission_id=${selectedId || ''}`)
  const assets = useLoad<Asset[]>(`/api/assets?mission_id=${selectedId || ''}`)
  const route = useRoute()

  if (stations.loading || personnel.loading) return <Spinner label="Loading map…" />
  if (stations.error || personnel.error) return <ErrorBox message={stations.error || personnel.error} />

  const hasGeo = (stations.data || []).filter((s) => s.latitude && s.longitude)
  const people = (personnel.data || []).filter((p) => p.last_known_lat != null && p.last_known_lng != null)
  const center: [number, number] = hasGeo[0] ? [hasGeo[0].latitude, hasGeo[0].longitude] : [-70.0, 10.0]

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-50">Operations Map</h1>
          <p className="text-xs text-slate-400">Stations · field movement · route awareness — OSM terrain</p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <Legend color="#2fa3b8" label="Station" />
          <Legend color="#34d399" label="Personnel" />
        </div>
      </div>

      {!hasGeo.length ? (
        <div className="rounded-xl border border-ink-700/60 p-6 text-center text-sm text-slate-400">
          No geolocated stations configured yet.
        </div>
      ) : (
        <MapContainer center={center} zoom={5} className="h-[70vh] w-full" scrollWheelZoom>
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {route.length > 1 ? <Polyline positions={route} color="#2fa3b8" /> : null}
          {hasGeo.map((s) => (
            <Marker key={s.id} position={[s.latitude, s.longitude]} icon={stationIcon}>
              <Popup>
                <b>{s.name}</b> ({s.code})<br />
                {s.type} · {s.region}
              </Popup>
            </Marker>
          ))}
          {people.map((p) => (
            <Marker key={`p-${p.id}`} position={[p.last_known_lat!, p.last_known_lng!]} icon={personIcon}>
              <Popup>
                <b>{p.name}</b><br />
                {p.personnel_id} · {p.movement_status} · {p.current_location}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Panel title="Stations" count={hasGeo.length}>
          {hasGeo.map((s) => (
            <Row key={s.id} main={`${s.code} — ${s.name}`} sub={`${s.latitude?.toFixed(2)}, ${s.longitude?.toFixed(2)}`} />
          ))}
        </Panel>
        <Panel title="Field personnel (positioned)" count={people.length}>
          {people.slice(0, 14).map((p) => (
            <Row key={p.id} main={p.name} sub={`${p.movement_status} · ${(p.current_location || '').slice(0, 22)}`} />
          ))}
        </Panel>
        <Panel title="Assets" count={(assets.data || []).length}>
          {(assets.data || []).slice(0, 14).map((a) => (
            <Row key={a.id} main={a.name} sub={`${a.category || '—'} · ${(a.location || '').slice(0, 22)}`} />
          ))}
        </Panel>
      </div>
    </div>
  )
}

function useRoute(): [number, number][] {
  const { selected } = useMission()
  const raw = (selected as any)?.route
  if (raw) {
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      if (Array.isArray(parsed)) {
        const pts = parsed
          .filter((p) => Array.isArray(p) && p.length === 2 && !Number.isNaN(Number(p[0])) && !Number.isNaN(Number(p[1])))
          .map((p) => [Number(p[0]), Number(p[1])] as [number, number])
        if (pts.length > 1) return pts
      }
    } catch {
      /* ignore malformed route */
    }
  }
  return []
}

function Panel({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-ink-700/60 bg-ink-900/70 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-ice-200">{title}</span>
        <Badge tone="ice">{count}</Badge>
      </div>
      <div className="max-h-48 space-y-1 overflow-y-auto">{children}</div>
    </div>
  )
}

function Row({ main, sub }: { main: string; sub: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded bg-ink-800/50 px-2 py-1 text-xs">
      <span className="truncate text-slate-200">{main}</span>
      <span className="truncate text-slate-500">{sub}</span>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-ink-800/70 px-2 py-1 text-slate-300">
      <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block' }} />
      {label}
    </span>
  )
}