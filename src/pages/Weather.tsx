import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { api, fmtNum } from '../lib/api'
import { useConnectivity } from '../lib/connectivity'
import { Badge, Btn, Card, Empty, Field, Icon, Modal, SectionTitle, Spinner, inputCls, useApi } from '../components/ui'
import type { Station, WeatherRecord } from '../lib/types'

export default function Weather() {
  const { can } = useAuth()
  const conn = useConnectivity()
  const write = can('weather:write')
  const status = useApi<any>('/api/weather/status')
  const stations = useApi<Station[]>('/api/stations')
  const [stationId, setStationId] = useState<number | null>(null)
  const [records, setRecords] = useState<WeatherRecord[] | null>(null)
  const [live, setLive] = useState<WeatherRecord | null>(null)
  const [liveBusy, setLiveBusy] = useState(false)
  const [liveMsg, setLiveMsg] = useState('')
  const [manual, setManual] = useState(false)

  const st = stations.data?.find((s) => s.id === stationId) || stations.data?.[0]

  const fetchRecords = async (sid?: number) => {
    const id = sid || stationId || st?.id
    if (!id) return
    const data = await api<WeatherRecord[]>(`/api/weather?station_id=${id}`)
    setRecords(data)
  }

  const fetchLive = async () => {
    const id = stationId || st?.id
    if (!id) return
    setLiveBusy(true)
    setLiveMsg('')
    try {
      const r = await api<WeatherRecord & { error?: string; status?: string; message?: string }>(
        `/api/weather/live?station_id=${id}`,
        { useCache: false },
      )
      if (r.error || r.status === 'not_configured') {
        setLiveMsg(r.message || r.error || 'Live weather not available.')
        setLive(null)
      } else {
        setLive(r)
        setLiveMsg('Live updated')
      }
      fetchRecords(id)
    } catch (e: any) {
      setLiveMsg(e?.detail || e?.message || 'Live weather unavailable.')
    } finally {
      setLiveBusy(false)
    }
  }

  const srcStatus = status.data

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
<div>
        <h1 className="text-lg font-bold text-slate-50">Weather & Ice Conditions</h1>
        <p className="text-xs text-slate-400">Live feeds when configured, manual reports otherwise</p>
      </div>

      {conn.mode === 'offline' ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <b>LIVE DATA UNAVAILABLE</b> — offline. Showing cached weather only (last sync{' '}
          {conn.lastSync ? new Date(conn.lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
          ). Manual entries will be queued and synced when back online.
        </div>
      ) : conn.mode === 'weak' ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/80">
          <b>WEAK SIGNAL</b> — weather values may be from cache.
        </div>
      ) : null}
        {write ? <Btn onClick={() => setManual(true)}><Icon name="plus" size={16} /> Manual entry</Btn> : null}
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <select className={inputCls + ' w-56'} value={stationId || st?.id || ''} onChange={(e) => { setStationId(Number(e.target.value)); fetchRecords(Number(e.target.value)) }}>
            {(stations.data || []).map((s) => (
              <option key={s.id} value={s.id}>{s.code} – {s.name}</option>
            ))}
          </select>
          <Btn onClick={fetchLive} disabled={liveBusy}>
            <Icon name="refresh" size={15} /> {liveBusy ? 'Fetching…' : 'Fetch live weather'}
          </Btn>
          {srcStatus?.list?.length ? (
            <span className="ml-auto flex items-center gap-2 text-xs text-slate-400">
              {srcStatus.list.map((s: any) => (
                <Badge key={s.station} tone={s.configured ? 'green' : 'slate'}>
                  {s.station}: {s.source}
                </Badge>
              ))}
            </span>
          ) : null}
        </div>
        {liveMsg ? <div className="mt-2 text-xs text-slate-400">{liveMsg} (source: {live?.source || srcStatus?.list?.[0]?.source || 'not configured'})</div> : null}
      </Card>

      {live ? (
        <Card className="border-ice-500/30 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-ice-200">{st?.name} — live</span>
            <Badge tone="green">live · {live.source_label || live.source}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KV k="Temperature" v={live.temperature_c != null ? `${fmtNum(live.temperature_c, 1)}°C` : '—'} />
            <KV k="Wind" v={live.wind_speed != null ? `${fmtNum(live.wind_speed)} km/h${live.wind_direction != null ? ` (${fmtNum(live.wind_direction)}°)` : ''}` : '—'} />
            <KV k="Visibility" v={live.visibility_km != null ? `${fmtNum(live.visibility_km, 1)} km` : '—'} />
            <KV k="Humidity" v={live.humidity != null ? `${fmtNum(live.humidity)}%` : '—'} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone="ice">{live.condition || '—'}</Badge>
            {live.storm ? <Badge tone="red">STORM WARNING</Badge> : null}
            <span className="text-xs text-slate-400">ice route: {live.ice_route_condition || '—'}</span>
          </div>
          {(live.forecast_alerts || []).length ? (
            <div className="mt-2 space-y-0.5 text-xs text-amber-300">
              {(live.forecast_alerts as string[]).map((a, i) => <div key={i}>⚠ {a}</div>)}
            </div>
          ) : null}
        </Card>
      ) : null}

      <Card className="p-4">
        <SectionTitle title="Recent records" sub={`for ${st?.name || 'station'}`} right={<Btn kind="ghost" onClick={() => fetchRecords()}><Icon name="refresh" size={14} /></Btn>} />
        {records ? (
          records.length === 0 ? (
            <Empty label="No weather records yet — fetch live or add a manual entry." />
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {records.map((r) => (
                <div key={r.id} className="rounded-lg border border-ink-700/50 bg-ink-800/40 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-200">{r.condition || '—'}</span>
                    <Badge tone={r.storm ? 'red' : 'ice'}>{r.source_label || r.source}</Badge>
                  </div>
                  <div className="mt-1.5 grid grid-cols-3 gap-2 text-xs text-slate-400">
                    <span>🌡 {r.temperature_c != null ? `${r.temperature_c}°C` : '—'}</span>
                    <span>💨 {r.wind_speed != null ? `${r.wind_speed} km/h` : '—'}</span>
                    <span>👁 {r.visibility_km != null ? `${r.visibility_km} km` : '—'}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">{r.recorded_at?.slice(0, 16)} · ice: {r.ice_route_condition || '—'}</div>
                </div>
              ))}
            </div>
          )
        ) : (
          <Spinner />
        )}
      </Card>

      {manual ? (
        <ManualEntry stationId={stationId || st?.id} onClose={() => setManual(false)} onDone={() => { fetchRecords(); setManual(false) }} />
      ) : null}
    </div>
  )
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg bg-ink-800/60 p-2.5">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{k}</div>
      <div className="text-lg font-bold tabular-nums text-slate-100">{v}</div>
    </div>
  )
}

function ManualEntry({ stationId, onClose, onDone }: { stationId?: number; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [f, setF] = useState({
    station_id: stationId,
    temperature_c: -25,
    wind_speed: 18,
    visibility_km: 12,
    condition: 'clear',
    humidity: 70,
    storm: false,
    ice_route_condition: 'open' as string,
    source_label: 'Manual entry',
  })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      await api('/api/weather', { method: 'POST', body: JSON.stringify(f) })
      onDone()
    } catch (e: any) {
      setErr(e?.detail || e?.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Manual weather entry">
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label="Temperature (°C)"><input type="number" className={inputCls} value={f.temperature_c} onChange={(e) => setF({ ...f, temperature_c: Number(e.target.value) })} /></Field>
        <Field label="Wind (km/h)"><input type="number" className={inputCls} value={f.wind_speed} onChange={(e) => setF({ ...f, wind_speed: Number(e.target.value) })} /></Field>
        <Field label="Visibility (km)"><input type="number" className={inputCls} value={f.visibility_km} onChange={(e) => setF({ ...f, visibility_km: Number(e.target.value) })} /></Field>
        <Field label="Humidity (%)"><input type="number" className={inputCls} value={f.humidity} onChange={(e) => setF({ ...f, humidity: Number(e.target.value) })} /></Field>
        <Field label="Condition">
          <select className={inputCls} value={f.condition} onChange={(e) => setF({ ...f, condition: e.target.value })}>
            <option>clear</option><option>overcast</option><option>blizzard</option><option>snow</option><option>fog</option><option>windy</option>
          </select>
        </Field>
        <Field label="Ice route">
          <select className={inputCls} value={f.ice_route_condition} onChange={(e) => setF({ ...f, ice_route_condition: e.target.value })}>
            <option>open</option><option>quasi</option><option>closed</option>
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={f.storm} onChange={(e) => setF({ ...f, storm: e.target.checked })} /> Storm conditions
        </label>
        {err ? <div className="rounded-lg bg-rose-500/15 p-2.5 text-sm text-rose-300 sm:col-span-2">{err}</div> : null}
        <div className="flex gap-2 sm:col-span-2">
          <Btn type="submit" disabled={busy} className="flex-1">{busy ? 'Saving…' : 'Save entry'}</Btn>
          <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
        </div>
      </form>
    </Modal>
  )
}