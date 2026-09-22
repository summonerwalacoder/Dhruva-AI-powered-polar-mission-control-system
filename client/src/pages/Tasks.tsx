import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { Badge, Btn, Card, Field, Modal, Spinner, inputCls, statusTone, useApi } from '../components/ui'
import type { Task } from '../lib/types'

export default function Tasks({ scope }: { scope: 'scientist' | 'field' }) {
  const { user, can } = useAuth()
  const mid = user?.mission_id
  const tasks = useApi<Task[]>(mid ? `/api/tasks?mission_id=${mid}` : null)
  const [draft, setDraft] = useState(false)
  const [f, setF] = useState({ title: '', description: '', priority: 'normal', due_date: '' })
  const [msg, setMsg] = useState('')

  const myOnly = scope === 'field'
  const rows = (tasks.data || []).filter((t) => (myOnly ? !t.personnel_id || t.personnel_id === user?.id : true))

  const setStatus = async (t: Task, status: string) => {
    try {
      await api(`/api/tasks/${t.id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
      tasks.reload()
    } catch (e: any) {
      setMsg(e?.message || 'Failed')
      setTimeout(() => setMsg(''), 3000)
    }
  }

  const create = async () => {
    if (!f.title.trim()) return
    try {
      await api('/api/tasks', { method: 'POST', body: JSON.stringify({ mission_id: mid, title: f.title, description: f.description, priority: f.priority, due_date: f.due_date || undefined }) })
      setDraft(false)
      setF({ title: '', description: '', priority: 'normal', due_date: '' })
      tasks.reload()
    } catch (e: any) {
      setMsg(e?.message || 'Failed')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-50">{scope === 'field' ? 'My Tasks' : 'Research Tasks'}</h1>
          <p className="text-xs text-slate-400">{scope === 'field' ? 'Field task list with live status updates' : 'Scientific expedition tasks and observations'}</p>
        </div>
        {can('personnel:write') || scope === 'scientist' ? (
          <Btn kind="outline" onClick={() => setDraft(true)}>+ New task</Btn>
        ) : null}
      </div>

      {msg ? <p className="text-sm text-rose-300">{msg}</p> : null}
      {tasks.loading ? <Spinner label="Loading tasks…" /> : null}
      {!tasks.loading && !rows.length ? <p className="rounded-xl border border-dashed border-ink-700 p-8 text-center text-sm text-slate-400">No tasks {myOnly ? 'assigned to you' : 'in this mission'}.</p> : null}

      <div className="space-y-2">
        {rows.map((t) => (
          <Card key={t.id} className="p-3.5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-100">{t.title}</span>
                  <Badge tone={statusTone(t.status)}>{t.status}</Badge>
                  <Badge tone={t.priority === 'critical' ? 'red' : t.priority === 'high' ? 'amber' : 'slate'}>{t.priority}</Badge>
                </div>
                {t.description ? <p className="mt-1 line-clamp-2 text-sm text-slate-400">{t.description}</p> : null}
                <div className="mt-1 text-xs text-slate-500">
                  #{t.id} · created {t.created_at?.slice(0, 10)} {t.due_date ? `· due ${t.due_date}` : ''}
                </div>
              </div>
              <div className="flex gap-2">
                {t.status === 'pending' || t.status === 'assigned' ? (
                  <Btn kind="ghost" className="!px-2.5 !py-1 text-xs" onClick={() => setStatus(t, 'in_progress')}>Start</Btn>
                ) : null}
                {t.status === 'in_progress' ? (
                  <Btn kind="primary" className="!px-2.5 !py-1 text-xs" onClick={() => setStatus(t, 'done')}>Complete</Btn>
                ) : null}
                {t.status === 'in_progress' ? (
                  <Btn kind="ghost" className="!px-2.5 !py-1 text-xs" onClick={() => setStatus(t, 'blocked')}>Blocked</Btn>
                ) : null}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Modal open={draft} onClose={() => setDraft(false)} title="New task">
        <div className="space-y-3">
          <Field label="Title"><input className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Description"><textarea className={inputCls} rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Priority">
              <select className={inputCls} value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>
                <option value="low">low</option><option value="normal">normal</option><option value="high">high</option><option value="critical">critical</option>
              </select>
            </Field>
            <Field label="Due date"><input className={inputCls} type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} /></Field>
          </div>
          <div className="flex justify-end gap-2">
            <Btn kind="ghost" onClick={() => setDraft(false)}>Cancel</Btn>
            <Btn onClick={create}>Create task</Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}