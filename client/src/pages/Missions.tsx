import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useMission } from '../context/MissionContext'
import { api, fmtNum } from '../lib/api'
import { Badge, Btn, Card, Empty, ErrorBox, Field, Icon, Modal, SectionTitle, Spinner, inputCls, riskTone, statusTone, useApi } from '../components/ui'
import type { MissionSummary, Station } from '../lib/types'

export default function Missions() {
  const { can } = useAuth()
  const { setMissions } = useMission()
  const { data, loading, error, reload } = useApi<MissionSummary[]>('/api/missions')
  const stations = useApi<Station[]>('/api/stations')
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (data) setMissions(data)
  }, [data, setMissions])

  const write = can('mission:write')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionTitle title="Expedition Missions" sub="Plan, track and assess each polar deployment" />
        {write ? (
          <Btn onClick={() => setShow(true)}>
            <Icon name="plus" size={16} /> New mission
          </Btn>
        ) : null}
      </div>

      {loading ? <Spinner /> : null}
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}

      {!loading && !error && data?.length === 0 ? <Empty label="No missions yet. Create one to begin planning." /> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(data || []).map((m) => (
          <Link key={m.id} to={`/missions/${m.id}`} className="group">
            <Card className="flex h-full flex-col p-4 transition-colors group-hover:border-ice-500/50">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-slate-50 group-hover:text-ice-200">{m.mission_id}</div>
                  <div className="text-xs text-slate-400">{m.name}</div>
                </div>
                <Badge tone={riskTone(m.risk_level)}>{m.risk_level}</Badge>
              </div>
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <Badge tone={statusTone(m.status)}>{m.status}</Badge>
                {m.station?.code ? <Badge tone="ice">{m.station.code}</Badge> : null}
                {m.active_alerts ? <Badge tone="red">{m.active_alerts} alerts</Badge> : null}
              </div>
              <p className="line-clamp-2 text-xs text-slate-400">{m.objective}</p>
              <div className="mt-auto grid grid-cols-4 gap-2 pt-3 text-center">
                <Cell v={fmtNum(m.progress) + '%'} l="prog" />
                <Cell v={fmtNum(m.personnel_count)} l="team" />
                <Cell v={fmtNum(m.cargo_count)} l="cargo" />
                <Cell v={m.food_days != null ? m.food_days + 'd' : '—'} l="food" />
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {show && stations.data ? (
        <CreateModal
          onClose={() => setShow(false)}
          onCreated={() => {
            setShow(false)
            reload()
          }}
          stations={stations.data}
        />
      ) : null}
    </div>
  )
}

function Cell({ v, l }: { v: string; l: string }) {
  return (
    <div className="rounded-lg bg-ink-800/60 px-1 py-1.5">
      <div className="text-sm font-semibold tabular-nums text-ice-200">{v}</div>
      <div className="text-[9px] uppercase tracking-wide text-slate-500">{l}</div>
    </div>
  )
}

function CreateModal({ onClose, onCreated, stations }: { onClose: () => void; onCreated: (m: MissionSummary) => void; stations: Station[] }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [f, setF] = useState({
    mission_id: '',
    name: '',
    destination: 'Bharati Station, Antarctica',
    region: 'Antarctica',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: '',
    duration_days: 60,
    team_size: 12,
    objective: '',
    status: 'planned',
    station_id: stations?.[0]?.id as number,
  })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      const m = await api<MissionSummary>('/api/missions', {
        method: 'POST',
        body: JSON.stringify({ ...f, station_id: f.station_id || undefined }),
      })
      onCreated(m)
    } catch (e: any) {
      setErr(e?.detail || e?.message || 'Create failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="New mission" wide>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label="Mission ID">
          <input className={inputCls} required value={f.mission_id} onChange={(e) => setF({ ...f, mission_id: e.target.value.toUpperCase() })} placeholder="EXP-2026-04" />
        </Field>
        <Field label="Name">
          <input className={inputCls} required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Destination">
          <input className={inputCls} value={f.destination} onChange={(e) => setF({ ...f, destination: e.target.value })} />
        </Field>
        <Field label="Station">
          <select className={inputCls} value={f.station_id} onChange={(e) => setF({ ...f, station_id: Number(e.target.value) })}>
            {stations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} – {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Start date">
          <input type="date" className={inputCls} value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} />
        </Field>
        <Field label="End date">
          <input type="date" className={inputCls} value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} />
        </Field>
        <Field label="Duration (days)">
          <input type="number" min={1} className={inputCls} value={f.duration_days} onChange={(e) => setF({ ...f, duration_days: Number(e.target.value) })} />
        </Field>
        <Field label="Team size">
          <input type="number" min={1} className={inputCls} value={f.team_size} onChange={(e) => setF({ ...f, team_size: Number(e.target.value) })} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Objective">
            <textarea rows={2} className={inputCls} value={f.objective} onChange={(e) => setF({ ...f, objective: e.target.value })} />
          </Field>
        </div>
        {err ? <div className="rounded-lg bg-rose-500/15 p-2.5 text-sm text-rose-300 sm:col-span-2">{err}</div> : null}
        <div className="flex gap-2 sm:col-span-2">
          <Btn type="submit" disabled={busy} className="flex-1">
            {busy ? 'Creating…' : 'Create mission'}
          </Btn>
          <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
        </div>
      </form>
    </Modal>
  )
}