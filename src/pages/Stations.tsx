import { Badge, Card, Spinner, Stat, useApi } from '../components/ui'

export default function Stations() {
  const stations = useApi<any[]>('/api/stations')
  const missions = useApi<any[]>('/api/missions')

  const rows = stations.data || []
  const ms = missions.data || []

  const stationMission = (id: number | undefined) => ms.find((m) => m.station_id === id)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-50">Stations</h1>
        <p className="text-xs text-slate-400">Indian polar infrastructure — stations, camps and bases</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total stations" value={rows.length} tone="ice" />
        <Stat label="Active" value={rows.filter((s) => s.active).length} tone="good" />
        <Stat label="Research stations" value={rows.filter((s) => s.type === 'station').length} sub="permanent" tone="default" />
        <Stat label="Field camps" value={rows.filter((s) => s.type === 'field_camp').length} sub="seasonal" tone="default" />
      </div>

      {stations.loading ? <Spinner label="Loading stations…" /> : null}
      {!stations.loading && !rows.length ? <p className="text-sm text-slate-400">No stations recorded.</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((s) => {
          const m = stationMission(s.id)
          return (
            <Card key={s.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-bold text-ice-300">{s.code}</code>
                    <Badge tone={s.active ? 'green' : 'slate'}>{s.active ? 'active' : 'inactive'}</Badge>
                  </div>
                  <h2 className="mt-1 text-base font-semibold text-slate-100">{s.name}</h2>
                </div>
                <Badge tone="ice">{s.type}</Badge>
              </div>
              <p className="mt-2 text-sm text-slate-400">{s.region || '—'} · {s.country || '—'}</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-400">
                <div className="rounded-lg bg-ink-800/50 px-2 py-1.5">lat {s.latitude ? Number(s.latitude).toFixed(3) : '—'}</div>
                <div className="rounded-lg bg-ink-800/50 px-2 py-1.5">lon {s.longitude ? Number(s.longitude).toFixed(3) : '—'}</div>
                <div className="rounded-lg bg-ink-800/50 px-2 py-1.5">elev {s.elevation_m ?? '—'} m</div>
                <div className="rounded-lg bg-ink-800/50 px-2 py-1.5">hosts {m ? m.mission_id : '—'}</div>
              </div>
              {s.description ? <p className="mt-2 line-clamp-2 text-xs text-slate-500">{s.description}</p> : null}
            </Card>
          )
        })}
      </div>
    </div>
  )
}