import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useMission } from '../context/MissionContext'
import { api } from '../lib/api'
import { Badge, Btn, Card, Empty, ErrorBox, Field, Icon, Modal, Spinner, cx, inputCls, statusTone, useApi } from '../components/ui'
import type { Alert } from '../lib/types'

export default function Alerts() {
  const { can } = useAuth()
  const { selectedId } = useMission()
  const [sev, setSev] = useState('')
  const [status, setStatus] = useState('')
  const [create, setCreate] = useState(false)
  const write = can('alerts:write')

  const path = `/api/alerts?mission_id=${selectedId || ''}&severity=${sev}&status=${status}`
  const { data, loading, error, reload } = useApi<Alert[]>(path)

  const resolve = async (id: number) => {
    await api(`/api/alerts/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'resolved' }) })
    reload()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-50">Alerts & Notices</h1>
          <p className="text-xs text-slate-400">System and manual warnings for the active mission</p>
        </div>
        {write ? <Btn onClick={() => setCreate(true)}><Icon name="plus" size={16} /> Raise alert</Btn> : null}
      </div>

      <Card className="flex flex-wrap gap-2 p-3">
        <select className={inputCls + ' w-40'} value={sev} onChange={(e) => setSev(e.target.value)}>
          <option value="">All severity</option>
          <option>low</option><option>medium</option><option>high</option><option>critical</option>
        </select>
        <select className={inputCls + ' w-40'} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All status</option>
          <option>active</option><option>resolved</option>
        </select>
      </Card>

      {loading ? <Spinner /> : null}
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}
      {!loading && !error && data?.length === 0 ? <Empty label="No alerts." /> : null}

      <div className="space-y-2">
        {(data || []).map((a) => (
          <Card key={a.id} className={cx('p-3.5', a.severity === 'critical' && a.status === 'active' ? 'border-rose-400/50' : 'border-ink-700/60')}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-100">{a.title}</span>
                  <Badge tone={statusTone(a.severity)}>{a.severity}</Badge>
                  <Badge tone={a.status === 'active' ? 'amber' : 'slate'}>{a.status}</Badge>
                </div>
                {a.message ? <p className="mt-1 text-sm text-slate-400">{a.message}</p> : null}
                <div className="mt-1.5 flex items-center gap-3 text-[11px] text-slate-500">
                  <span>source: {a.source || 'system'}</span>
                  <span>·</span>
                  <span>{a.created_at?.slice(0, 16)}</span>
                  {a.type ? <><span>·</span><span>{a.type}</span></> : null}
                </div>
              </div>
              {a.status === 'active' && can('alerts:write') ? (
                <Btn kind="outline" onClick={() => resolve(a.id)}>Resolve</Btn>
              ) : null}
            </div>
          </Card>
        ))}
      </div>

      {create ? (
        <CreateAlert onClose={() => setCreate(false)} onCreated={() => reload()} />
      ) : null}
    </div>
  )
}

function CreateAlert({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { selectedId } = useMission()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [f, setF] = useState({ mission_id: selectedId || (undefined as number | undefined), title: '', message: '', severity: 'high', type: 'manual', status: 'active' })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      await api('/api/alerts', { method: 'POST', body: JSON.stringify(f) })
      onCreated()
      onClose()
    } catch (e: any) {
      setErr(e?.detail || e?.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Raise alert">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Title"><input className={inputCls} required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Message"><textarea rows={2} className={inputCls} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Severity">
            <select className={inputCls} value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value })}>
              <option>low</option><option>medium</option><option>high</option><option>critical</option>
            </select>
          </Field>
          <Field label="Type"><input className={inputCls} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} /></Field>
        </div>
        {err ? <div className="rounded-lg bg-rose-500/15 p-2.5 text-sm text-rose-300">{err}</div> : null}
        <div className="flex gap-2">
          <Btn type="submit" disabled={busy} className="flex-1">{busy ? 'Saving…' : 'Raise alert'}</Btn>
          <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
        </div>
      </form>
    </Modal>
  )
}