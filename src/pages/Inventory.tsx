import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useMission } from '../context/MissionContext'
import { api, fmtNum } from '../lib/api'
import { Badge, Btn, Card, Empty, ErrorBox, Field, Icon, Modal, Progress, Spinner, cx, inputCls, statusTone, useApi } from '../components/ui'
import type { InventoryItem, Prediction, SurvivalClock } from '../lib/types'

const CATS = ['food', 'water', 'fuel', 'medical', 'spares', 'scientific', 'emergency', 'consumable']

export default function Inventory() {
  const { can } = useAuth()
  const { selectedId } = useMission()
  const [cat, setCat] = useState('')
  const [q, setQ] = useState('')
  const [create, setCreate] = useState(false)
  const [detail, setDetail] = useState<InventoryItem | null>(null)

  const path = `/api/inventory?mission_id=${selectedId || ''}&category=${cat}&q=${encodeURIComponent(q)}`
  const { data, loading, error, reload } = useApi<InventoryItem[]>(path)
  const clock = useApi<SurvivalClock[]>(`/api/inventory/survival-clock/all?mission_id=${selectedId}`)
  const write = can('inventory:write')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-50">Inventory & Stock</h1>
          <p className="text-xs text-slate-400">Restock levels, live consumption and AI depletion forecasts</p>
        </div>
        {write ? <Btn onClick={() => setCreate(true)}><Icon name="plus" size={16} /> Add stock</Btn> : null}
      </div>

      {/* Survival clock */}
      <Card className="p-4">
        <div className="mb-2 flex items-center gap-2">
          <Icon name="inventory" size={16} className="text-ice-300" />
          <span className="text-sm font-semibold text-ice-200">Survival clock</span>
          <span className="text-[11px] text-slate-500">days left per critical category</span>
        </div>
        {clock.loading ? <Spinner /> : null}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {(clock.data || []).map((c) => (
            <div key={c.category} className="rounded-xl border border-ink-700/50 bg-ink-800/50 p-3">
              <div className="text-[11px] uppercase tracking-wide text-slate-400">{c.label}</div>
              <div className={cx('my-1 text-2xl font-bold tabular-nums', c.days_remaining == null ? 'text-slate-600' : statusTone(c.status) === 'green' ? 'text-emerald-300' : statusTone(c.status) === 'amber' ? 'text-amber-300' : 'text-rose-300')}>
                {c.days_remaining == null ? '—' : `${c.days_remaining}d`}
              </div>
              <div className="truncate text-[11px] text-slate-500">{c.item || '—'}</div>
              <div className="mt-1"><Badge tone={statusTone(c.status)}>{c.status}</Badge></div>
              {c.days_to_resupply != null ? (
                <div className="mt-1 text-[10px] text-slate-500">resupply in {c.days_to_resupply}d</div>
              ) : null}
            </div>
          ))}
        </div>
      </Card>

      <Card className="flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-40 flex-1">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"><Icon name="search" size={14} /></span>
          <input className={inputCls + ' pl-8'} placeholder="Search item / batch…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {CATS.map((c) => (
          <button
            key={c}
            onClick={() => setCat(cat === c ? '' : c)}
            className={cx(
              'rounded-full px-2.5 py-1 text-[11px] capitalize',
              cat === c ? 'bg-ice-500 text-ink-950' : 'bg-ink-800 text-slate-300 hover:bg-ink-700',
            )}
          >
            {c}
          </button>
        ))}
      </Card>

      {loading ? <Spinner /> : null}
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}
      {!loading && !error && data?.length === 0 ? <Empty label="No stock items." /> : null}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {(data || []).map((i) => (
          <ItemCard key={i.id} item={i} onClick={() => setDetail(i)} />
        ))}
      </div>

      {create ? <CreateStock onClose={() => setCreate(false)} onCreated={() => reload()} /> : null}
      {detail ? <StockDetail item={detail} onClose={() => setDetail(null)} onUpdated={() => reload()} /> : null}
    </div>
  )
}

function ItemCard({ item, onClick }: { item: InventoryItem; onClick: () => void }) {
  const low = item.reorder_level != null && item.quantity <= item.reorder_level
  return (
    <Card className={cx('p-3.5', low ? 'border-rose-400/40' : 'border-ink-700/60')}>
      <button onClick={onClick} className="w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-100">{item.item}</div>
            <div className="text-[11px] text-slate-400">{item.batch || 'batch —'} · {item.location || '—'}</div>
          </div>
          <Badge tone={statusTone(item.category)}>{item.category}</Badge>
        </div>
        <div className="mt-2 flex items-end justify-between">
          <div>
            <span className="text-xl font-bold tabular-nums text-ice-200">{fmtNum(item.quantity)}</span>
            <span className="ml-1 text-xs text-slate-400">{item.unit}</span>
          </div>
          {low ? <Badge tone="red">low stock</Badge> : null}
        </div>
        {(item.reorder_level != null || item.expiry_date) ? (
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500">
            <span>reorder at {fmtNum(item.reorder_level)}</span>
            {item.expiry_date ? <span>exp {item.expiry_date}</span> : null}
          </div>
        ) : null}
      </button>
    </Card>
  )
}

function StockDetail({ item, onClose, onUpdated }: { item: InventoryItem; onClose: () => void; onUpdated: () => void }) {
  const { can } = useAuth()
  const write = can('inventory:write')
  const detail = useApi<InventoryItem & { prediction?: Prediction; transactions?: any[] }>(`/api/inventory/${item.id}`)
  const [change, setChange] = useState(0)
  const [type, setType] = useState('consume')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const d = (detail.data || item) as InventoryItem & { prediction?: Prediction; transactions?: any[] }
  const pred = d.prediction

  const applyTx = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!change) return
    setBusy(true)
    try {
      await api(`/api/inventory/${item.id}/transaction`, {
        method: 'POST',
        body: JSON.stringify({ change: type === 'consume' ? -Math.abs(change) : Math.abs(change), type, note }),
      })
      detail.reload()
      onUpdated()
      setChange(0)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`${d.item} — ${d.category}`} wide>
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-3 gap-2 text-center">
          <MiniBox l="Stock" v={`${fmtNum(d.quantity)} ${d.unit}`} />
          <MiniBox l="Reorder level" v={fmtNum(d.reorder_level)} />
          <MiniBox l="Criticality" v={d.criticality || '—'} />
        </div>

        {pred && pred.days_remaining != null ? (
          <Card className="p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-400">AI depletion forecast</div>
                <div className="text-2xl font-bold tabular-nums text-ice-200">{pred.days_remaining} days</div>
                <div className="text-[11px] text-slate-400">
                  depletes ~{pred.depletion_date} · shortage prob {pred.shortage_probability != null ? Math.round(pred.shortage_probability * 100) + '%' : '—'}
                </div>
              </div>
              <Badge tone={statusTone(pred.status)}>{pred.status}</Badge>
            </div>
            <div className="mt-2">
              <Progress
                value={Math.max(0, Math.min(100, (pred.days_remaining / 60) * 100))}
                tone={statusTone(pred.status) === 'green' ? 'green' : statusTone(pred.status) === 'amber' ? 'amber' : 'red'}
              />
            </div>
            <div className="mt-2 space-y-0.5 text-xs text-slate-400">
              {(pred.reasons || []).slice(0, 6).map((r, i) => (
                <div key={i} className="flex gap-1"><span className="text-ice-400">•</span>{r}</div>
              ))}
            </div>
            {pred.reorder_recommended ? (
              <div className="mt-2 rounded-lg bg-amber-500/15 px-2.5 py-1.5 text-xs text-amber-300">⚠ Reorder recommended</div>
            ) : null}
          </Card>
        ) : null}

        {write ? (
          <form onSubmit={applyTx} className="grid grid-cols-3 gap-2 border-t border-ink-700/60 pt-3">
            <select className={inputCls} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="consume">Consume (issue)</option>
              <option value="restock">Restock (receive)</option>
            </select>
            <input type="number" className={inputCls} placeholder="Qty" value={change} onChange={(e) => setChange(Number(e.target.value))} />
            <Btn type="submit" disabled={busy || !change}>{busy ? '…' : 'Apply'}</Btn>
            <input className={inputCls + ' col-span-3'} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          </form>
        ) : null}

        {d.transactions?.length ? (
          <div className="max-h-40 space-y-1 overflow-y-auto">
            <div className="text-[11px] uppercase tracking-wide text-slate-500">Recent transactions</div>
            {(d.transactions as any[]).map((tx: any) => (
              <div key={tx.id} className="flex items-center justify-between rounded bg-ink-800/50 px-2 py-1 text-xs text-slate-300">
                <span className={cx(tx.change < 0 ? 'text-amber-300' : 'text-emerald-300')}>
                  {tx.change > 0 ? '+' : ''}{fmtNum(tx.change)} {tx.unit}
                </span>
                <span className="text-slate-500">{tx.type} · {tx.timestamp?.slice(0, 16)}{tx.note ? ` · ${tx.note}` : ''}</span>
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

function CreateStock({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { selectedId } = useMission()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [f, setF] = useState({
    item: '',
    category: 'food',
    quantity: 100,
    unit: 'kg',
    mission_id: selectedId || (undefined as number | undefined),
    location: '',
    reorder_level: 30,
    criticality: 'normal',
    consumption_rate: 10,
    batch: '',
    expiry_date: '',
  })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      await api('/api/inventory', { method: 'POST', body: JSON.stringify(f) })
      onCreated()
      onClose()
    } catch (e: any) {
      setErr(e?.detail || e?.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Add stock item" wide>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label="Item name"><input className={inputCls} required value={f.item} onChange={(e) => setF({ ...f, item: e.target.value })} placeholder="e.g. Packaged Rations" /></Field>
        <Field label="Category">
          <select className={inputCls} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            {CATS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Quantity"><input type="number" min={0} className={inputCls} value={f.quantity} onChange={(e) => setF({ ...f, quantity: Number(e.target.value) })} /></Field>
        <Field label="Unit"><input className={inputCls} value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} /></Field>
        <Field label="Consumption rate / day"><input type="number" min={0} className={inputCls} value={f.consumption_rate} onChange={(e) => setF({ ...f, consumption_rate: Number(e.target.value) })} /></Field>
        <Field label="Reorder level"><input type="number" min={0} className={inputCls} value={f.reorder_level} onChange={(e) => setF({ ...f, reorder_level: Number(e.target.value) })} /></Field>
        <Field label="Batch"><input className={inputCls} value={f.batch} onChange={(e) => setF({ ...f, batch: e.target.value })} /></Field>
        <Field label="Expiry"><input type="date" className={inputCls} value={f.expiry_date} onChange={(e) => setF({ ...f, expiry_date: e.target.value })} /></Field>
        {err ? <div className="rounded-lg bg-rose-500/15 p-2.5 text-sm text-rose-300 sm:col-span-2">{err}</div> : null}
        <div className="flex gap-2 sm:col-span-2">
          <Btn type="submit" disabled={busy} className="flex-1">{busy ? 'Saving…' : 'Add stock'}</Btn>
          <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
        </div>
      </form>
    </Modal>
  )
}