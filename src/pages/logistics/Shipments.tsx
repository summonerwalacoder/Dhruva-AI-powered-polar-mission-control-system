import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../lib/api'
import { Badge, Btn, Card, Empty, Field, Modal, Spinner, inputCls, statusTone, useApi } from '../../components/ui'

const STATUSES = ['planned', 'in_prep', 'loaded', 'in_transit', 'arrived', 'delivered']

export default function Shipments() {
  const { can } = useAuth()
  const shipments = useApi<any[]>('/api/shipments')
  const [draft, setDraft] = useState(false)
  const [f, setF] = useState({ shipment_id: '', name: '', origin: '', destination: '', eta: '', carrier: '' })

  const setStatus = async (s: any, status: string) => {
    await api(`/api/shipments/${s.id}`, { method: 'PATCH', body: JSON.stringify({ status }) }).catch(() => {})
    shipments.reload()
  }

  const create = async () => {
    if (!f.name) return
    try {
      await api('/api/shipments', { method: 'POST', body: JSON.stringify({ shipment_id: f.shipment_id || undefined, name: f.name, origin: f.origin, destination: f.destination, eta: f.eta, carrier: f.carrier }) })
      setDraft(false)
      setF({ shipment_id: '', name: '', origin: '', destination: '', eta: '', carrier: '' })
      shipments.reload()
    } catch (e: any) {
      alert(e?.detail || e?.message || 'Failed')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-50">Shipments</h1>
          <p className="text-xs text-slate-400">Consignment-level tracking from origin to polar stations</p>
        </div>
        {can('cargo:write') ? <Btn kind="outline" onClick={() => setDraft(true)}>+ New shipment</Btn> : null}
      </div>

      {shipments.loading ? <Spinner label="Loading shipments…" /> : null}
      {!shipments.loading && !shipments.data?.length ? <Empty label="No shipments yet." /> : null}

      <div className="space-y-2">
        {(shipments.data || []).map((s) => (
          <Card key={s.id} className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-100">{s.name || s.shipment_id}</span>
                  <code className="text-xs text-ice-400">{s.shipment_id}</code>
                  <Badge tone={statusTone(s.status)}>{s.status}</Badge>
                </div>
                <div className="mt-1 text-sm text-slate-400">
                  {s.origin || '—'} → {s.destination || '—'}
                  {s.eta ? ` · eta ${String(s.eta).slice(0, 10)}` : ''}
                  {s.carrier ? ` · via ${s.carrier}` : ''}
                </div>
                <div className="mt-1 text-xs text-slate-500">{(s.cargo_items || []).length} cargo items attached</div>
              </div>
              {can('cargo:write') ? (
                <div className="flex flex-wrap gap-1.5">
                  {STATUSES.filter((st) => st !== s.status).slice(0, 4).map((st) => (
                    <Btn key={st} kind="ghost" className="!px-2 !py-1 text-[11px]" onClick={() => setStatus(s, st)}>{st}</Btn>
                  ))}
                </div>
              ) : null}
            </div>
          </Card>
        ))}
      </div>

      <Modal open={draft} onClose={() => setDraft(false)} title="New shipment">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name"><input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Shipment ID"><input className={inputCls} placeholder="auto" value={f.shipment_id} onChange={(e) => setF({ ...f, shipment_id: e.target.value })} /></Field>
          <Field label="Origin"><input className={inputCls} value={f.origin} onChange={(e) => setF({ ...f, origin: e.target.value })} /></Field>
          <Field label="Destination"><input className={inputCls} value={f.destination} onChange={(e) => setF({ ...f, destination: e.target.value })} /></Field>
          <Field label="ETA"><input className={inputCls} type="date" value={f.eta} onChange={(e) => setF({ ...f, eta: e.target.value })} /></Field>
          <Field label="Carrier"><input className={inputCls} value={f.carrier} onChange={(e) => setF({ ...f, carrier: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Btn kind="ghost" onClick={() => setDraft(false)}>Cancel</Btn>
            <Btn onClick={create}>Create shipment</Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}