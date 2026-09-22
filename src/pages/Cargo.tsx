import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { useAuth } from '../context/AuthContext'
import { useMission } from '../context/MissionContext'
import { api, fmtNum } from '../lib/api'
import { Badge, Btn, Card, Empty, ErrorBox, Field, Icon, Modal, Spinner, cx, inputCls, statusTone, useApi } from '../components/ui'
import type { CargoItem, Container } from '../lib/types'

const LIFE = ['requirement', 'indent', 'approval', 'packing', 'container_assigned', 'manifest', 'transport', 'transit', 'station_arrival', 'inspection', 'inventory']

export default function Cargo() {
  const { can } = useAuth()
  const { selectedId } = useMission()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [category, setCategory] = useState('')
  const [create, setCreate] = useState(false)
  const [pack, setPack] = useState(false)
  const [detailId, setDetailId] = useState<number | null>(null)
  const [view, setView] = useState<'cargo' | 'containers' | 'shipments'>('cargo')

  const path = `/api/cargo?mission_id=${selectedId || ''}&status=${status}&category=${category}&q=${encodeURIComponent(q)}`
  const { data, loading, error, reload } = useApi<CargoItem[]>(path)
  const containers = useApi<Container[]>('/api/containers')
  const write = can('cargo:write')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-50">Cargo & Supplies</h1>
          <p className="text-xs text-slate-400">Indent → transit → station arrival with QR tracking</p>
        </div>
        <div className="flex gap-2">
          {write ? (
            <Btn onClick={() => setCreate(true)}><Icon name="plus" size={16} /> Add item</Btn>
          ) : null}
          <Btn kind="ghost" onClick={() => setPack(true)}><Icon name="simulate" size={16} /> Pack plan</Btn>
        </div>
      </div>

      <div className="flex gap-2">
        {(['cargo', 'containers', 'shipments'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cx(
              'rounded-full px-3 py-1.5 text-xs font-medium capitalize',
              view === v ? 'bg-ice-500 text-ink-950' : 'bg-ink-800 text-slate-300 hover:bg-ink-700',
            )}
          >
            {v}
          </button>
        ))}
      </div>

      {view === 'cargo' ? (
        <>
          <Card className="flex flex-wrap items-center gap-2 p-3">
            <SearchBox q={q} setQ={setQ} />
            <select className={inputCls + ' w-44'} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {LIFE.map((s) => <option key={s}>{s}</option>)}
            </select>
            <select className={inputCls + ' w-40'} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All categories</option>
              <option>food</option><option>fuel</option><option>equipment</option><option>medical</option><option>spares</option><option>scientific</option><option>construction</option>
            </select>
          </Card>

          {loading ? <Spinner /> : null}
          {error ? <ErrorBox message={error} onRetry={reload} /> : null}
          {!loading && !error && data?.length === 0 ? <Empty label="No cargo found." /> : null}

          <div className="grid gap-3 md:grid-cols-2">
            {(data || []).map((c) => (
              <Card key={c.id} className="p-3.5">
                <button className="flex w-full items-start justify-between text-left" onClick={() => setDetailId(c.id)}>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-semibold text-slate-100">{c.item_name}</span>
                      {c.delayed ? <Badge tone="red">delayed</Badge> : null}
                    </div>
                    <div className="truncate text-[11px] text-slate-400">
                      {c.cargo_id} · {c.category || '—'} · {fmtNum(c.quantity)} {c.unit || ''}
                      {c.weight_kg ? ` · ${fmtNum(c.weight_kg)} kg` : ''}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge tone={statusTone(c.shipment_status)}>{c.shipment_status.replaceAll('_', ' ')}</Badge>
                      {c.container_id ? <Badge tone="slate">📦 {c.container_id}</Badge> : null}
                      {c.expected_arrival ? (
                        <span className="text-[11px] text-slate-500">ETA {c.expected_arrival}</span>
                      ) : null}
                    </div>
                  </div>
                  <span className="text-slate-500"><Icon name="chevron" size={14} /></span>
                </button>
              </Card>
            ))}
          </div>
        </>
      ) : null}

      {view === 'containers' ? <ContainersView containers={containers} /> : null}
      {view === 'shipments' ? <ShipmentsView missionId={selectedId} /> : null}

      {create ? (
        <CreateCargo onClose={() => setCreate(false)} onCreated={() => reload()} write={write} />
      ) : null}
      {pack ? <PackModal onClose={() => setPack(false)} /> : null}
      {detailId ? <CargoDetail cargoId={detailId} onClose={() => setDetailId(null)} onUpdated={() => reload()} /> : null}
    </div>
  )
}

function SearchBox({ q, setQ }: { q: string; setQ: (v: string) => void }) {
  return (
    <div className="relative min-w-40 flex-1">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"><Icon name="search" size={14} /></span>
      <input className={inputCls + ' pl-8'} placeholder="Search name / ID / QR…" value={q} onChange={(e) => setQ(e.target.value)} />
    </div>
  )
}

function ContainersView({ containers }: { containers: ReturnType<typeof useApi<Container[]>> }) {
  const [detail, setDetail] = useState<Container | null>(null)
  if (containers.loading) return <Spinner />
  if (!containers.data || containers.data.length === 0) return <Empty label="No containers. Create containers to plan packing." />
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {containers.data.map((c) => {
        const pct = c.capacity_kg ? Math.round((c.used_kg / c.capacity_kg) * 100) : 0
        return (
          <Card key={c.id} className="p-3.5">
            <button onClick={() => setDetail(c)} className="w-full text-left">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-100">📦 {c.container_id}</span>
                <Badge tone={statusTone(c.status)}>{c.status}</Badge>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-700/70">
                <div className={cx('h-full rounded-full', pct > 90 ? 'bg-rose-400' : 'bg-ice-400')} style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                {fmtNum(c.used_kg)} / {fmtNum(c.capacity_kg)} kg ({pct}%) · {c.location || '—'}
              </div>
            </button>
          </Card>
        )
      })}
      {detail ? (
        <ContainerDetail container={detail} onClose={() => setDetail(null)} />
      ) : null}
    </div>
  )
}

function ContainerDetail({ container, onClose }: { container: Container; onClose: () => void }) {
  const items = useApi<{ items: CargoItem[] }>(`/api/containers/${container.id}`)
  return (
    <Modal open onClose={onClose} title={`Container ${container.container_id}`}>
      <div className="space-y-2">
        {items.loading ? <Spinner /> : null}
        {(items.data?.items || []).map((i) => (
          <div key={i.id} className="flex items-center justify-between rounded-lg bg-ink-800/60 px-3 py-2 text-sm">
            <span className="text-slate-200">{i.item_name}</span>
            <span className="text-xs text-slate-400">{fmtNum(i.weight_kg)} kg</span>
          </div>
        ))}
      </div>
    </Modal>
  )
}

function ShipmentsView({ missionId }: { missionId: number | null }) {
  const { data, loading, error } = useApi<any[]>('/api/shipments', { useCache: missionId == null ? undefined : true })
  if (loading) return <Spinner />
  if (error) return <ErrorBox message={error} />
  if (!data || data.length === 0) return <Empty label="No shipments recorded." />
  return (
    <div className="space-y-2">
      {data.map((s) => (
        <Card key={s.id} className="p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-sm font-semibold text-slate-100">{s.shipment_id}</span>
              <span className="ml-2 text-xs text-slate-400">{s.name}</span>
            </div>
            <Badge tone={statusTone(s.status)}>{s.status}</Badge>
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {s.origin} → {s.destination}{s.carrier ? ` · ${s.carrier}` : ''}{s.eta ? ` · ETA ${s.eta}` : ''}
          </div>
          {s.cargo_items?.length ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {(s.cargo_items as any[]).map((c) => (
                <span key={c.id} className="rounded bg-ink-800 px-1.5 py-0.5 text-[11px] text-slate-300">{c.item_name}</span>
              ))}
            </div>
          ) : null}
        </Card>
      ))}
    </div>
  )
}

function CreateCargo({ onClose, onCreated, write }: { onClose: () => void; onCreated: () => void; write: boolean }) {
  const { selectedId } = useMission()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [f, setF] = useState({
    cargo_id: '',
    mission_id: selectedId || (undefined as number | undefined),
    item_name: '',
    category: 'food',
    quantity: 1,
    unit: 'box',
    weight_kg: 10,
    priority: 'normal',
    shipment_status: 'requirement',
  })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!write) return
    setBusy(true)
    setErr('')
    try {
      await api('/api/cargo', { method: 'POST', body: JSON.stringify(f) })
      onCreated()
      onClose()
    } catch (e: any) {
      setErr(e?.detail || e?.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Add cargo item">
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label="Cargo ID">
          <input className={inputCls} required value={f.cargo_id} onChange={(e) => setF({ ...f, cargo_id: e.target.value.toUpperCase() })} />
        </Field>
        <Field label="Item name">
          <input className={inputCls} required value={f.item_name} onChange={(e) => setF({ ...f, item_name: e.target.value })} />
        </Field>
        <Field label="Category">
          <select className={inputCls} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            <option>food</option><option>fuel</option><option>equipment</option><option>medical</option><option>spares</option><option>scientific</option><option>construction</option>
          </select>
        </Field>
        <Field label="Quantity + unit">
          <div className="flex gap-2">
            <input type="number" min={0} className={inputCls} value={f.quantity} onChange={(e) => setF({ ...f, quantity: Number(e.target.value) })} />
            <input className={inputCls + ' w-24'} value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} />
          </div>
        </Field>
        <Field label="Weight (kg)">
          <input type="number" min={0} className={inputCls} value={f.weight_kg} onChange={(e) => setF({ ...f, weight_kg: Number(e.target.value) })} />
        </Field>
        <Field label="Priority">
          <select className={inputCls} value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>
            <option>normal</option><option>high</option><option>critical</option>
          </select>
        </Field>
        {err ? <div className="rounded-lg bg-rose-500/15 p-2.5 text-sm text-rose-300 sm:col-span-2">{err}</div> : null}
        <div className="flex gap-2 sm:col-span-2">
          <Btn type="submit" disabled={busy} className="flex-1">{busy ? 'Saving…' : 'Add item'}</Btn>
          <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
        </div>
      </form>
    </Modal>
  )
}

function PackModal({ onClose }: { onClose: () => void }) {
  const { selectedId } = useMission()
  const { data, loading, error } = useApi<any>(`/api/cargo/pack-plan?mission_id=${selectedId || ''}`, {
    method: 'POST',
  } as any)
  return (
    <Modal open onClose={onClose} title="AI packing plan" wide>
      {loading ? <Spinner label="Computing packing plan…" /> : null}
      {error ? <ErrorBox message={error} /> : null}
      {data ? (
        <div className="space-y-3 text-sm">
          <div className="rounded-lg bg-ink-800/70 p-3 text-slate-300">
            <b className="text-slate-100">{data.containers?.length || 0}</b> units planned for mission{' '}
            <b className="text-slate-100">{data.mission_id || selectedId}</b>
          </div>
          {(data.containers || []).map((c: any) => (
            <Card key={c.container_id} className="p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-100">📦 {c.container_id}</span>
                <span className="text-xs text-slate-400">{fmtNum(c.planned_weight_kgs || 0)} / {fmtNum(c.capacity_kg || 0)} kg</span>
              </div>
              {(c.item_assignments || []).map((it: any, i: number) => (
                <div key={i} className="flex items-center justify-between rounded bg-ink-800/50 px-2 py-1 text-xs text-slate-300">
                  <span>{it.item_name}</span>
                  <span className="text-slate-400">{fmtNum(it.qty)} {it.unit || ''}</span>
                </div>
              ))}
            </Card>
          ))}
          {data.explanation ? <p className="text-[11px] text-slate-500">{data.explanation}</p> : null}
        </div>
      ) : null}
    </Modal>
  )
}

function CargoDetail({ cargoId, onClose, onUpdated }: { cargoId: number; onClose: () => void; onUpdated: () => void }) {
  const { data, loading, error } = useApi<CargoItem>(`/api/cargo/${cargoId}`)
  const { can } = useAuth()
  const [qr, setQr] = useState('')
  const [busy, setBusy] = useState(false)
  const write = can('cargo:write')

  useEffect(() => {
    if (data?.qr_code) {
      QRCode.toDataURL(data.qr_code, { width: 140, margin: 1 })
        .then(setQr)
        .catch(() => {})
    }
  }, [data?.qr_code])

  const advance = async (status: string) => {
    setBusy(true)
    try {
      await api(`/api/cargo/${cargoId}/status`, { method: 'POST', body: JSON.stringify({ status }) })
      onUpdated()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={data?.item_name || 'Cargo'} wide>
      {loading ? <Spinner /> : null}
      {error ? <ErrorBox message={error} /> : null}
      {data ? (
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap items-start gap-4">
            {qr ? <img src={qr} alt="QR" className="rounded-lg bg-white p-1" width={120} /> : null}
            <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-1.5 text-slate-300">
              <InfoRow k="Cargo ID" v={data.cargo_id} />
              <InfoRow k="QR" v={data.qr_code || '—'} />
              <InfoRow k="Quantity" v={`${fmtNum(data.quantity)} ${data.unit || ''}`} />
              <InfoRow k="Weight" v={data.weight_kg != null ? `${fmtNum(data.weight_kg)} kg` : '—'} />
              <InfoRow k="Status" v={data.shipment_status || '—'} />
              <InfoRow k="ETA" v={data.expected_arrival || '—'} />
              <InfoRow k="Container" v={data.container_id || '—'} />
              <InfoRow k="Priority" v={data.priority || '—'} />
            </div>
          </div>

          {write ? (
            <div className="border-t border-ink-700/60 pt-3">
              <div className="mb-1.5 text-xs uppercase tracking-wide text-slate-400">Advance status</div>
              <div className="flex flex-wrap gap-1.5">
                {LIFE.map((s) => (
                  <button
                    key={s}
                    disabled={busy}
                    onClick={() => advance(s)}
                    className={cx(
                      'rounded-full px-2.5 py-1 text-[11px]',
                      data.shipment_status === s
                        ? 'bg-ice-500 text-ink-950'
                        : 'bg-ink-800 text-slate-300 hover:bg-ink-700',
                    )}
                  >
                    {s.replaceAll('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {(data.history || []).length ? (
            <div className="border-t border-ink-700/60 pt-2">
              <div className="mb-1 text-xs uppercase tracking-wide text-slate-500">History</div>
              <div className="max-h-36 space-y-1 overflow-y-auto">
                {(data.history || []).map((h, i) => (
                  <div key={i} className="rounded bg-ink-800/50 px-2 py-1 text-xs text-slate-400">
                    <b className="text-slate-200">{h.status.replaceAll('_', ' ')}</b>
                    {h.location ? ` · ${h.location}` : ''}
                    {h.note ? ` · ${h.note}` : ''}
                    <span className="float-right text-[10px] text-slate-600">{h.timestamp?.slice(0, 16)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </Modal>
  )
}

function InfoRow({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <span className="text-[10px] uppercase tracking-wide text-slate-500">{k}: </span>
      <span className="text-slate-200">{v}</span>
    </div>
  )
}