import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useMission } from '../context/MissionContext'
import { api, fmtNum } from '../lib/api'
import { Badge, Btn, Card, Empty, ErrorBox, Field, Icon, Modal, Progress, Spinner, cx, inputCls, statusTone, useApi } from '../components/ui'
import type { Asset } from '../lib/types'

export default function Assets() {
  const { can } = useAuth()
  const { selectedId } = useMission()
  const [q, setQ] = useState('')
  const [cat] = useState('')
  const [create, setCreate] = useState(false)
  const [detail, setDetail] = useState<Asset | null>(null)

  const path = `/api/assets?mission_id=${selectedId || ''}&category=${cat}&q=${encodeURIComponent(q)}`
  const { data, loading, error, reload } = useApi<Asset[]>(path)
  const pred = useApi<any>(`/api/assets/predictive?mission_id=${selectedId || ''}`)
  const write = can('assets:write')

  const counts = pred.data?.counts || {}

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-50">Equipment & Assets</h1>
          <p className="text-xs text-slate-400">Vehicles, generators, instruments & predictive maintenance</p>
        </div>
        {write ? <Btn onClick={() => setCreate(true)}><Icon name="plus" size={16} /> Add asset</Btn> : null}
      </div>

      {pred.loading ? <Spinner /> : null}
      {pred.data ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Object.entries(counts as Record<string, number>).map(([k, v]) => (
            <Card key={k} className="p-3 text-center">
              <div className={cx('text-2xl font-bold tabular-nums', statusTone(k) === 'green' ? 'text-emerald-300' : statusTone(k) === 'amber' ? 'text-amber-300' : statusTone(k) === 'red' ? 'text-rose-300' : 'text-slate-100')}>
                {v}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-slate-500">{k}</div>
            </Card>
          ))}
          <Card className="p-3 text-center">
            <div className="text-2xl font-bold tabular-nums text-ice-200">{fmtNum(pred.data.assets?.length)}</div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">total</div>
          </Card>
        </div>
      ) : null}

      <Card className="p-3">
        <div className="relative">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"><Icon name="search" size={14} /></span>
          <input className={inputCls + ' pl-8'} placeholder="Search asset name / ID…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </Card>

      {loading ? <Spinner /> : null}
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}
      {!loading && !error && data?.length === 0 ? <Empty label="No assets." /> : null}

      <div className="grid gap-3 md:grid-cols-2">
        {(data || []).map((a) => {
          const r = a.risk || {} as any
          const st = r.status || a.operational_status
          return (
            <Card key={a.id} className="p-3.5">
              <button onClick={() => setDetail(a)} className="w-full text-left">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">{a.name}</div>
                    <div className="text-[11px] text-slate-400">{a.asset_id} · {a.category || '—'} · {a.location || '—'}</div>
                  </div>
                  <Badge tone={statusTone(st)}>{r.status_label || a.operational_status}</Badge>
                </div>
                {r.status === 'due' || r.status === 'high' || r.status === 'critical' ? (
                  <div className="mt-2 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-200">
                    maintenance due — {(r.reasons || []).slice(0, 1).join(' ')}
                  </div>
                ) : r.days_since_maintenance != null ? (
                  <div className="mt-2 text-xs text-slate-500">last maintenance {r.days_since_maintenance}d ago</div>
                ) : null}
                {a.runtime_hours != null ? (
                  <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-400">
                    <span>runtime {fmtNum(a.runtime_hours)}h</span>
                    {a.fuel_type ? <span>· {a.fuel_type}</span> : null}
                  </div>
                ) : null}
                <div className="mt-2"><Progress value={st === 'critical' ? 100 : st === 'high' ? 70 : st === 'due' ? 45 : 15} tone={statusTone(st) === 'green' ? 'green' : statusTone(st) === 'amber' ? 'amber' : 'red'} /></div>
              </button>
            </Card>
          )
        })}
      </div>

      {create ? <CreateAsset onClose={() => setCreate(false)} onCreated={() => reload()} /> : null}
      {detail ? <AssetDetail asset={detail} onClose={() => setDetail(null)} onUpdated={() => reload()} /> : null}
    </div>
  )
}

function AssetDetail({ asset, onClose, onUpdated }: { asset: Asset; onClose: () => void; onUpdated: () => void }) {
  const { can } = useAuth()
  const detail = useApi<Asset & { maintenance?: any[] }>(`/api/assets/${asset.id}`)
  const [type, setType] = useState('preventive')
  const [note, setNote] = useState('')
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)
  const write = can('assets:write')
  const a = (detail.data || asset) as Asset & { maintenance?: any[] }
  const r = a.risk as any

  const logMaint = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api(`/api/assets/${asset.id}/maintenance`, {
        method: 'POST',
        body: JSON.stringify({ type, note, next_due: next || undefined }),
      })
      detail.reload()
      onUpdated()
      setNote('')
      setNext('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`${a.name} — ${a.asset_id}`} wide>
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <MiniBox l="Category" v={a.category || '—'} />
          <MiniBox l="Operational" v={a.operational_status || '—'} />
          <MiniBox l="Last maintenance" v={a.last_maintenance || '—'} />
          <MiniBox l="Next due" v={a.next_maintenance || '—'} />
        </div>

        {r ? (
          <Card className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wide text-slate-400">Predictive maintenance</span>
              <Badge tone={statusTone(r.status)}>{r.status_label}</Badge>
            </div>
            <div className="mt-2 space-y-0.5 text-xs text-slate-400">
              {(r.reasons || []).map((x: string, i: number) => (
                <div key={i} className="flex gap-1"><span className="text-ice-400">•</span>{x}</div>
              ))}
            </div>
          </Card>
        ) : null}

        {write ? (
          <form onSubmit={logMaint} className="grid grid-cols-2 gap-2 border-t border-ink-700/60 pt-3">
            <select className={inputCls} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="preventive">Preventive</option>
              <option value="corrective">Corrective</option>
              <option value="inspection">Inspection</option>
            </select>
            <input type="date" className={inputCls} value={next} onChange={(e) => setNext(e.target.value)} />
            <input className={inputCls + ' col-span-2'} placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} />
            <Btn type="submit" disabled={busy} className="col-span-2">{busy ? 'Saving…' : 'Log maintenance'}</Btn>
          </form>
        ) : null}

        {a.maintenance?.length ? (
          <div className="max-h-32 space-y-1 overflow-y-auto">
            <div className="text-[11px] uppercase tracking-wide text-slate-500">Maintenance history</div>
            {a.maintenance.map((m: any) => (
              <div key={m.id} className="rounded bg-ink-800/50 px-2 py-1 text-xs text-slate-400">
                {m.date} · {m.type} · {m.note}{m.performed_by ? ` · ${m.performed_by}` : ''}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </Modal>
  )
}

function MiniBox({ l, v }: { l: string; v: string }) {
  return (
    <div className="rounded-lg bg-ink-800/60 p-2.5">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{l}</div>
      <div className="text-sm font-bold text-slate-100">{v}</div>
    </div>
  )
}

function CreateAsset({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { selectedId } = useMission()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [f, setF] = useState({
    asset_id: '',
    name: '',
    category: 'vehicle',
    mission_id: selectedId || (undefined as number | undefined),
    location: '',
    operational_status: 'operational',
    fuel_type: '',
    runtime_hours: 0,
  })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      await api('/api/assets', { method: 'POST', body: JSON.stringify(f) })
      onCreated()
      onClose()
    } catch (e: any) {
      setErr(e?.detail || e?.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Add asset">
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label="Asset ID"><input className={inputCls} required value={f.asset_id} onChange={(e) => setF({ ...f, asset_id: e.target.value.toUpperCase() })} /></Field>
        <Field label="Name"><input className={inputCls} required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Category">
          <select className={inputCls} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            <option>vehicle</option><option>generator</option><option>scientific</option><option>comm</option><option>other</option>
          </select>
        </Field>
        <Field label="Status">
          <select className={inputCls} value={f.operational_status} onChange={(e) => setF({ ...f, operational_status: e.target.value })}>
            <option>operational</option><option>maintenance</option><option>failed</option>
          </select>
        </Field>
        <Field label="Location"><input className={inputCls} value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></Field>
        <Field label="Fuel type"><input className={inputCls} value={f.fuel_type} onChange={(e) => setF({ ...f, fuel_type: e.target.value })} /></Field>
        {err ? <div className="rounded-lg bg-rose-500/15 p-2.5 text-sm text-rose-300 sm:col-span-2">{err}</div> : null}
        <div className="flex gap-2 sm:col-span-2">
          <Btn type="submit" disabled={busy} className="flex-1">{busy ? 'Saving…' : 'Add asset'}</Btn>
          <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
        </div>
      </form>
    </Modal>
  )
}