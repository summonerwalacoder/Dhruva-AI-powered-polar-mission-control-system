import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../lib/api'
import { Badge, Btn, Card, Field, Modal, Spinner, Stat, inputCls, statusTone, useApi } from '../../components/ui'

export default function Containers() {
  const { can } = useAuth()
  const containers = useApi<any[]>('/api/containers')
  const [draft, setDraft] = useState(false)
  const [f, setF] = useState({ container_id: '', capacity_kg: '', location: '', status: 'empty' })

  const canWrite = can('cargo:write')

  const create = async () => {
    if (!f.container_id) return
    try {
      await api('/api/containers', { method: 'POST', body: JSON.stringify({ container_id: f.container_id, capacity_kg: Number(f.capacity_kg) || 0, location: f.location, status: f.status }) })
      setDraft(false)
      setF({ container_id: '', capacity_kg: '', location: '', status: 'empty' })
      containers.reload()
    } catch (e: any) {
      alert(e?.detail || e?.message || 'Failed')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-50">Containers</h1>
          <p className="text-xs text-slate-400">Container-level utilization across the cargo pipeline</p>
        </div>
        {canWrite ? <Btn kind="outline" onClick={() => setDraft(true)}>+ Register container</Btn> : null}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Containers" value={containers.data?.length || 0} tone="ice" />
        <Stat label="Utilized" value={containers.data ? Math.round((containers.data.reduce((s, c) => s + (Number(c.used_kg) || 0), 0) / Math.max(1, containers.data.reduce((s, c) => s + (Number(c.capacity_kg) || 0), 0))) * 100) : 0} sub="% of total capacity" tone="default" />
        <Stat label="Packed" value={(containers.data || []).filter((c) => c.status === 'packed' || c.status === 'packing').length} tone="default" />
        <Stat label="In transit" value={(containers.data || []).filter((c) => (c.status || '').includes('transit')).length} tone="default" />
      </div>

      {containers.loading ? <Spinner label="Loading containers…" /> : null}
      {!containers.loading && !containers.data?.length ? <p className="rounded-xl border border-dashed border-ink-700 p-8 text-center text-sm text-slate-400">No containers registered.</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(containers.data || []).map((c) => {
          const pct = c.capacity_kg ? Math.round(((Number(c.used_kg) || 0) / Number(c.capacity_kg)) * 100) : 0
          return (
            <Card key={c.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <code className="text-sm font-bold text-ice-300">{c.container_id}</code>
                  <div className="mt-0.5 text-xs text-slate-500">{c.location || '—'}</div>
                </div>
                <Badge tone={statusTone(c.status)}>{c.status}</Badge>
              </div>
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-xs text-slate-400">
                  <span>{Number(c.used_kg) || 0} / {Number(c.capacity_kg) || 0} kg</span>
                  <span>{pct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-ink-700/70">
                  <div className="h-full rounded-full bg-gradient-to-r from-ice-500 to-ice-300" style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      <Modal open={draft} onClose={() => setDraft(false)} title="Register container">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Container ID"><input className={inputCls} value={f.container_id} onChange={(e) => setF({ ...f, container_id: e.target.value })} /></Field>
          <Field label="Capacity (kg)"><input className={inputCls} type="number" value={f.capacity_kg} onChange={(e) => setF({ ...f, capacity_kg: e.target.value })} /></Field>
          <Field label="Location"><input className={inputCls} value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></Field>
          <Field label="Status">
            <select className={inputCls} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
              <option value="empty">empty</option><option value="packing">packing</option><option value="packed">packed</option>
              <option value="in_transit">in transit</option><option value="arrived">arrived</option><option value="unloaded">unloaded</option>
            </select>
          </Field>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Btn kind="ghost" onClick={() => setDraft(false)}>Cancel</Btn>
            <Btn onClick={create}>Register</Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}